import { EventEmitter } from 'events';
import { Logger } from 'winston';
import Redis from 'ioredis';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  Alert,
  Incident,
  Runbook,
  RunbookStep,
  IncidentManagementConfig,
  TimelineEvent,
} from '../types';

export interface RunbookExecution {
  id: string;
  runbookId: string;
  incidentId: string;
  executedBy: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: RunbookStepExecution[];
  outputs: Record<string, any>;
  errors: string[];
  metadata: Record<string, any>;
}

export interface RunbookStepExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  output?: string;
  error?: string;
  manualInput?: any;
  automated: boolean;
}

export interface RunbookMatch {
  runbook: Runbook;
  confidence: number;
  matchReasons: string[];
  applicableSteps: RunbookStep[];
}

export interface AutomationProvider {
  name: string;
  executeCommand: (command: string, context: any) => Promise<{ success: boolean; output: string; error?: string }>;
  validateCommand: (command: string) => boolean;
}

export class RunbookIntegration extends EventEmitter {
  private redis: Redis;
  private logger: Logger;
  private config: IncidentManagementConfig;
  private runbooks: Map<string, Runbook> = new Map();
  private executions: Map<string, RunbookExecution> = new Map();
  private automationProviders: Map<string, AutomationProvider> = new Map();
  private isInitialized = false;

  constructor(
    config: IncidentManagementConfig,
    redis: Redis,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.redis = redis;
    this.logger = logger;
    
    this.setupAutomationProviders();
  }

  /**
   * Initialize the runbook integration system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.info('Initializing runbook integration system');

    // Load existing runbooks from storage
    await this.loadRunbooks();
    
    // Setup default runbooks
    await this.setupDefaultRunbooks();
    
    this.isInitialized = true;
    this.emit('initialized');
    
    this.logger.info(`Runbook integration initialized with ${this.runbooks.size} runbooks`);
  }

  /**
   * Find matching runbooks for an alert or incident
   */
  async findMatchingRunbooks(
    alert: Alert,
    incident?: Incident
  ): Promise<RunbookMatch[]> {
    const matches: RunbookMatch[] = [];

    for (const runbook of this.runbooks.values()) {
      const match = await this.evaluateRunbookMatch(runbook, alert, incident);
      if (match.confidence > 0.3) {
        matches.push(match);
      }
    }

    // Sort by confidence
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Execute a runbook for an incident
   */
  async executeRunbook(
    runbookId: string,
    incidentId: string,
    executedBy: string,
    automaticMode: boolean = false
  ): Promise<RunbookExecution> {
    const runbook = this.runbooks.get(runbookId);
    if (!runbook) {
      throw new Error(`Runbook not found: ${runbookId}`);
    }

    const execution: RunbookExecution = {
      id: uuidv4(),
      runbookId,
      incidentId,
      executedBy,
      startedAt: new Date(),
      status: 'running',
      steps: runbook.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
        automated: step.automatable && automaticMode,
      })),
      outputs: {},
      errors: [],
      metadata: { automaticMode },
    };

    this.executions.set(execution.id, execution);

    // Store execution in Redis
    await this.redis.hset('runbook_executions', execution.id, JSON.stringify(execution));

    // Log timeline event
    await this.logTimelineEvent(incidentId, {
      type: 'action',
      title: 'Runbook Execution Started',
      description: `Started executing runbook: ${runbook.title}`,
      metadata: { 
        runbookId: runbook.id,
        executionId: execution.id,
        automaticMode 
      },
    });

    this.logger.info(`Started runbook execution: ${execution.id} for incident: ${incidentId}`);
    this.emit('execution_started', execution);

    // Start execution
    this.processRunbookExecution(execution).catch(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing runbook execution ${execution.id}:`, error);
      execution.errors.push(errorMessage);
      execution.status = 'failed';
    });

    return execution;
  }

  /**
   * Get runbook execution status
   */
  async getExecution(executionId: string): Promise<RunbookExecution | null> {
    let execution = this.executions.get(executionId);
    
    if (!execution) {
      // Try to load from Redis
      const data = await this.redis.hget('runbook_executions', executionId);
      if (data) {
        execution = JSON.parse(data);
        this.executions.set(executionId, execution!);
      }
    }

    return execution || null;
  }

  /**
   * Update step execution with manual input
   */
  async updateStepExecution(
    executionId: string,
    stepId: string,
    update: {
      status?: RunbookStepExecution['status'];
      output?: string;
      error?: string;
      manualInput?: any;
    }
  ): Promise<void> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const step = execution.steps.find(s => s.stepId === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    // Update step
    if (update.status) step.status = update.status;
    if (update.output !== undefined) step.output = update.output;
    if (update.error !== undefined) step.error = update.error;
    if (update.manualInput !== undefined) step.manualInput = update.manualInput;

    if (update.status === 'completed' || update.status === 'failed') {
      step.completedAt = new Date();
    }

    // Update execution in memory and Redis
    this.executions.set(executionId, execution);
    await this.redis.hset('runbook_executions', executionId, JSON.stringify(execution));

    this.emit('step_updated', { execution, step: step });

    // Continue execution if this was a blocking step
    if (update.status === 'completed' && !step.automated) {
      await this.continueExecution(execution);
    }
  }

  /**
   * Cancel runbook execution
   */
  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date();
    
    if (reason) {
      execution.errors.push(`Cancelled: ${reason}`);
    }

    // Cancel any running steps
    execution.steps.forEach(step => {
      if (step.status === 'running' || step.status === 'pending') {
        step.status = 'skipped';
        step.completedAt = new Date();
      }
    });

    this.executions.set(executionId, execution);
    await this.redis.hset('runbook_executions', executionId, JSON.stringify(execution));

    await this.logTimelineEvent(execution.incidentId, {
      type: 'action',
      title: 'Runbook Execution Cancelled',
      description: `Cancelled runbook execution${reason ? `: ${reason}` : ''}`,
      metadata: { executionId, reason },
    });

    this.logger.info(`Cancelled runbook execution: ${executionId}`);
    this.emit('execution_cancelled', execution);
  }

  /**
   * Add or update a runbook
   */
  async saveRunbook(runbook: Runbook): Promise<void> {
    // Validate runbook
    this.validateRunbook(runbook);

    this.runbooks.set(runbook.id, runbook);
    await this.redis.hset('runbooks', runbook.id, JSON.stringify(runbook));

    this.logger.info(`Runbook saved: ${runbook.title} (${runbook.id})`);
    this.emit('runbook_saved', runbook);
  }

  /**
   * Delete a runbook
   */
  async deleteRunbook(runbookId: string): Promise<void> {
    this.runbooks.delete(runbookId);
    await this.redis.hdel('runbooks', runbookId);

    this.logger.info(`Runbook deleted: ${runbookId}`);
    this.emit('runbook_deleted', runbookId);
  }

  /**
   * Get all runbooks
   */
  getAllRunbooks(): Runbook[] {
    return Array.from(this.runbooks.values());
  }

  /**
   * Get runbooks by category
   */
  getRunbooksByCategory(category: string): Runbook[] {
    return this.getAllRunbooks().filter(runbook => 
      runbook.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Search runbooks by query
   */
  searchRunbooks(query: string): Runbook[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllRunbooks().filter(runbook =>
      runbook.title.toLowerCase().includes(lowerQuery) ||
      runbook.description.toLowerCase().includes(lowerQuery) ||
      runbook.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get execution history for incident
   */
  async getExecutionHistory(incidentId: string): Promise<RunbookExecution[]> {
    const allExecutions = await this.redis.hgetall('runbook_executions');
    const executions: RunbookExecution[] = [];

    for (const [id, data] of Object.entries(allExecutions)) {
      const execution: RunbookExecution = JSON.parse(data);
      if (execution.incidentId === incidentId) {
        executions.push(execution);
      }
    }

    return executions.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Process runbook execution
   */
  private async processRunbookExecution(execution: RunbookExecution): Promise<void> {
    try {
      const runbook = this.runbooks.get(execution.runbookId)!;
      
      for (let i = 0; i < execution.steps.length; i++) {
        const step = execution.steps[i];
        const runbookStep = runbook.steps.find(s => s.id === step.stepId)!;

        // Skip if already completed/failed/skipped
        if (step.status !== 'pending') continue;

        // Check if execution was cancelled
        if (execution.status === 'cancelled') break;

        step.status = 'running';
        step.startedAt = new Date();

        this.emit('step_started', { execution, step, runbookStep });

        try {
          if (step.automated && runbookStep.command) {
            // Execute automated step
            await this.executeAutomatedStep(execution, step, runbookStep);
          } else {
            // Wait for manual completion
            await this.waitForManualStep(execution, step, runbookStep);
            break; // Stop execution until manual step is completed
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          step.status = 'failed';
          step.error = errorMessage;
          step.completedAt = new Date();
          
          execution.errors.push(`Step ${runbookStep.title}: ${errorMessage}`);
          
          this.emit('step_failed', { execution, step, runbookStep, error });
          
          // Optionally continue or stop on error
          if (runbookStep.title.toLowerCase().includes('critical')) {
            throw error; // Stop execution on critical step failure
          }
        }

        // Update execution in storage
        await this.redis.hset('runbook_executions', execution.id, JSON.stringify(execution));
      }

      // Check if all steps are completed
      const allCompleted = execution.steps.every(step => 
        step.status === 'completed' || step.status === 'skipped'
      );

      if (allCompleted && execution.status === 'running') {
        execution.status = 'completed';
        execution.completedAt = new Date();

        await this.logTimelineEvent(execution.incidentId, {
          type: 'action',
          title: 'Runbook Execution Completed',
          description: `Completed executing runbook: ${runbook.title}`,
          metadata: { 
            runbookId: runbook.id,
            executionId: execution.id,
            duration: execution.completedAt.getTime() - execution.startedAt.getTime()
          },
        });

        this.emit('execution_completed', execution);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.errors.push(errorMessage);

      await this.logTimelineEvent(execution.incidentId, {
        type: 'action',
        title: 'Runbook Execution Failed',
        description: `Failed to execute runbook: ${errorMessage}`,
        metadata: { 
          runbookId: execution.runbookId,
          executionId: execution.id,
          error: errorMessage
        },
      });

      this.emit('execution_failed', { execution, error });
    }

    // Always update final state
    this.executions.set(execution.id, execution);
    await this.redis.hset('runbook_executions', execution.id, JSON.stringify(execution));
  }

  /**
   * Execute automated step
   */
  private async executeAutomatedStep(
    execution: RunbookExecution,
    step: RunbookStepExecution,
    runbookStep: RunbookStep
  ): Promise<void> {
    if (!runbookStep.command) {
      throw new Error('No command specified for automated step');
    }

    // Find appropriate automation provider
    const provider = this.findAutomationProvider(runbookStep.command);
    if (!provider) {
      throw new Error(`No automation provider found for command: ${runbookStep.command}`);
    }

    // Execute command
    const result = await provider.executeCommand(runbookStep.command, {
      incident: execution.incidentId,
      execution: execution.id,
      step: step.stepId,
    });

    if (result.success) {
      step.status = 'completed';
      step.output = result.output;
      execution.outputs[step.stepId] = result.output;
    } else {
      step.status = 'failed';
      step.error = result.error || 'Command execution failed';
    }

    step.completedAt = new Date();
  }

  /**
   * Wait for manual step completion
   */
  private async waitForManualStep(
    execution: RunbookExecution,
    step: RunbookStepExecution,
    runbookStep: RunbookStep
  ): Promise<void> {
    // This step will be completed via updateStepExecution when user provides input
    this.emit('manual_step_required', { execution, step, runbookStep });
  }

  /**
   * Continue execution after manual step completion
   */
  private async continueExecution(execution: RunbookExecution): Promise<void> {
    // Find next pending step and continue processing
    const nextPendingIndex = execution.steps.findIndex(s => s.status === 'pending');
    if (nextPendingIndex >= 0) {
      // Continue processing from where we left off
      await this.processRunbookExecution(execution);
    }
  }

  /**
   * Evaluate if runbook matches alert/incident
   */
  private async evaluateRunbookMatch(
    runbook: Runbook,
    alert: Alert,
    incident?: Incident
  ): Promise<RunbookMatch> {
    let confidence = 0;
    const matchReasons: string[] = [];
    const applicableSteps: RunbookStep[] = [];

    // Check alert pattern matches
    for (const pattern of runbook.triggers.alertPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(alert.title) || regex.test(alert.description)) {
        confidence += 0.4;
        matchReasons.push(`Alert pattern match: ${pattern}`);
        break;
      }
    }

    // Check condition matches
    for (const condition of runbook.triggers.conditions) {
      if (this.evaluateCondition(condition, alert, incident)) {
        confidence += 0.3;
        matchReasons.push(`Condition match: ${condition}`);
      }
    }

    // Check labels/annotations
    const alertLabels = Object.keys(alert.labels).join(' ').toLowerCase();
    const runbookTags = runbook.tags.join(' ').toLowerCase();
    
    for (const tag of runbook.tags) {
      if (alertLabels.includes(tag.toLowerCase())) {
        confidence += 0.2;
        matchReasons.push(`Tag match: ${tag}`);
      }
    }

    // Determine applicable steps based on current state
    applicableSteps.push(...runbook.steps);

    return {
      runbook,
      confidence: Math.min(confidence, 1.0),
      matchReasons,
      applicableSteps,
    };
  }

  /**
   * Evaluate a condition against alert/incident
   */
  private evaluateCondition(condition: string, alert: Alert, incident?: Incident): boolean {
    // Simple condition evaluation - in production, use a proper expression parser
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('severity') && lowerCondition.includes('critical')) {
      return alert.severity === 'P1_CRITICAL';
    }
    
    if (lowerCondition.includes('source') && lowerCondition.includes('monitoring')) {
      return alert.source === 'monitoring';
    }

    // Add more condition evaluation logic as needed
    return false;
  }

  /**
   * Find automation provider for command
   */
  private findAutomationProvider(command: string): AutomationProvider | null {
    for (const provider of this.automationProviders.values()) {
      if (provider.validateCommand(command)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Validate runbook structure
   */
  private validateRunbook(runbook: Runbook): void {
    if (!runbook.id || !runbook.title || !runbook.steps.length) {
      throw new Error('Invalid runbook: missing required fields');
    }

    // Validate steps
    for (const step of runbook.steps) {
      if (!step.id || !step.title || !step.description) {
        throw new Error(`Invalid step: missing required fields (${step.id})`);
      }
      
      if (step.automatable && !step.command) {
        throw new Error(`Automatable step must have command: ${step.id}`);
      }
    }
  }

  /**
   * Load runbooks from storage
   */
  private async loadRunbooks(): Promise<void> {
    const runbookData = await this.redis.hgetall('runbooks');
    
    for (const [id, data] of Object.entries(runbookData)) {
      try {
        const runbook: Runbook = JSON.parse(data);
        this.runbooks.set(id, runbook);
      } catch (error) {
        this.logger.error(`Error loading runbook ${id}:`, error);
      }
    }

    this.logger.info(`Loaded ${this.runbooks.size} runbooks from storage`);
  }

  /**
   * Log timeline event
   */
  private async logTimelineEvent(
    incidentId: string,
    event: Omit<TimelineEvent, 'id' | 'incidentId' | 'timestamp'>
  ): Promise<void> {
    const timelineEvent: TimelineEvent = {
      id: uuidv4(),
      incidentId,
      timestamp: new Date(),
      ...event,
    };

    await this.redis.lpush(`timeline:${incidentId}`, JSON.stringify(timelineEvent));
  }

  /**
   * Setup automation providers
   */
  private setupAutomationProviders(): void {
    // Shell/Bash provider
    this.automationProviders.set('shell', {
      name: 'Shell Commands',
      validateCommand: (command: string) => {
        return command.startsWith('bash:') || command.startsWith('sh:') || command.startsWith('cmd:');
      },
      executeCommand: async (command: string, context: any) => {
        // In production, implement proper shell execution with safety measures
        const cmd = command.split(':')[1];
        this.logger.info(`Executing shell command: ${cmd}`);
        
        // Mock execution for safety
        return {
          success: true,
          output: `Mock execution of: ${cmd}`,
        };
      },
    });

    // HTTP API provider
    this.automationProviders.set('http', {
      name: 'HTTP API Calls',
      validateCommand: (command: string) => {
        return command.startsWith('http:') || command.startsWith('https:');
      },
      executeCommand: async (command: string, context: any) => {
        try {
          const [method, url, ...bodyParts] = command.split('|');
          const body = bodyParts.length > 0 ? JSON.parse(bodyParts.join('|')) : undefined;
          
          const response = await axios({
            method: method.split(':')[0] as any,
            url: url,
            data: body,
            timeout: 30000,
          });

          return {
            success: true,
            output: JSON.stringify(response.data, null, 2),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            output: '',
          };
        }
      },
    });

    // Kubernetes provider
    this.automationProviders.set('k8s', {
      name: 'Kubernetes Commands',
      validateCommand: (command: string) => {
        return command.startsWith('kubectl:') || command.startsWith('k8s:');
      },
      executeCommand: async (command: string, context: any) => {
        const cmd = command.split(':')[1];
        this.logger.info(`Executing kubectl command: ${cmd}`);
        
        // Mock execution - in production, use kubernetes client
        return {
          success: true,
          output: `Mock kubectl execution: ${cmd}`,
        };
      },
    });

    this.logger.info(`Setup ${this.automationProviders.size} automation providers`);
  }

  /**
   * Setup default runbooks
   */
  private async setupDefaultRunbooks(): Promise<void> {
    const defaultRunbooks: Runbook[] = [
      {
        id: 'high-error-rate-investigation',
        title: 'High Error Rate Investigation',
        description: 'Standard procedure for investigating high error rates',
        category: 'Performance',
        tags: ['error-rate', 'performance', 'investigation'],
        steps: [
          {
            id: 'check-logs',
            title: 'Check Recent Logs',
            description: 'Review application logs for error patterns',
            order: 1,
            automatable: false,
          },
          {
            id: 'check-metrics',
            title: 'Check System Metrics',
            description: 'Review CPU, memory, and network metrics',
            command: 'http:GET|/api/metrics/system',
            order: 2,
            automatable: true,
          },
          {
            id: 'identify-pattern',
            title: 'Identify Error Pattern',
            description: 'Analyze error logs to identify common patterns',
            order: 3,
            automatable: false,
          },
          {
            id: 'check-dependencies',
            title: 'Check External Dependencies',
            description: 'Verify status of external services and databases',
            command: 'http:GET|/api/health/dependencies',
            order: 4,
            automatable: true,
          },
        ],
        triggers: {
          alertPatterns: ['error.rate', 'high.*error', 'failure.*rate'],
          conditions: ['severity == "P2_HIGH"', 'source == "monitoring"'],
        },
        metadata: {
          estimatedTime: 30,
          skillLevel: 'intermediate',
          lastTested: new Date(),
          successRate: 0.85,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0',
      },
      {
        id: 'service-down-response',
        title: 'Service Down Response',
        description: 'Emergency response procedure for service outages',
        category: 'Availability',
        tags: ['outage', 'service-down', 'emergency'],
        steps: [
          {
            id: 'verify-outage',
            title: 'Verify Service Outage',
            description: 'Confirm the service is actually down from multiple sources',
            command: 'http:GET|/api/health/service',
            order: 1,
            automatable: true,
          },
          {
            id: 'check-infrastructure',
            title: 'Check Infrastructure Status',
            description: 'Verify servers, load balancers, and network connectivity',
            command: 'k8s:kubectl get pods -n production',
            order: 2,
            automatable: true,
          },
          {
            id: 'restart-service',
            title: 'Attempt Service Restart',
            description: 'Restart the affected service if safe to do so',
            command: 'k8s:kubectl rollout restart deployment/api-service -n production',
            order: 3,
            automatable: false, // Requires manual approval for production
          },
          {
            id: 'update-status-page',
            title: 'Update Status Page',
            description: 'Inform users about the outage and expected resolution',
            order: 4,
            automatable: false,
          },
        ],
        triggers: {
          alertPatterns: ['service.*down', 'outage', 'unavailable'],
          conditions: ['severity == "P1_CRITICAL"'],
        },
        metadata: {
          estimatedTime: 15,
          skillLevel: 'advanced',
          lastTested: new Date(),
          successRate: 0.92,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.1',
      },
    ];

    for (const runbook of defaultRunbooks) {
      await this.saveRunbook(runbook);
    }

    this.logger.info(`Setup ${defaultRunbooks.length} default runbooks`);
  }
}