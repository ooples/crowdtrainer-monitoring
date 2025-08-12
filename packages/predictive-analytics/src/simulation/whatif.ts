import { WhatIfScenarioInput, WhatIfScenarioOutput } from '../types';

interface RiskAssessment {
  risk: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  likelihood: number;
}

interface CostProjection {
  category: string;
  currentCost: number;
  projectedCost: number;
  difference: number;
  confidence: number;
}

export class WhatIfSimulator {

  constructor() {}

  async runScenarios(input: WhatIfScenarioInput): Promise<WhatIfScenarioOutput> {
    this.validateInput(input);

    const scenarios = [];
    
    // Process each scenario
    for (const scenario of input.scenarios) {
      const scenarioResult = await this.processScenario(scenario, input);
      scenarios.push(scenarioResult);
    }
    
    // Generate comparisons
    const comparisons = this.compareScenarios(scenarios, input);
    
    return {
      scenarios,
      comparisons
    };
  }

  private validateInput(input: WhatIfScenarioInput): void {
    if (!input.baselineMetrics || Object.keys(input.baselineMetrics).length === 0) {
      throw new Error('Baseline metrics are required');
    }

    if (!input.scenarios || input.scenarios.length === 0) {
      throw new Error('At least one scenario is required');
    }

    // Validate each scenario
    for (const scenario of input.scenarios) {
      if (!scenario.id || !scenario.name) {
        throw new Error('Scenario ID and name are required');
      }

      if (!scenario.changes || scenario.changes.length === 0) {
        throw new Error(`Scenario ${scenario.id} must have at least one change`);
      }

      // Validate changes
      for (const change of scenario.changes) {
        if (!change.parameter || typeof change.value !== 'number') {
          throw new Error(`Invalid change in scenario ${scenario.id}`);
        }

        if (!['absolute', 'percentage', 'multiplier'].includes(change.type)) {
          throw new Error(`Invalid change type in scenario ${scenario.id}: ${change.type}`);
        }
      }
    }

    // Validate constraints
    if (input.constraints) {
      for (const constraint of input.constraints) {
        if (!constraint.parameter) {
          throw new Error('Constraint parameter is required');
        }
      }
    }
  }

  private async processScenario(scenario: any, input: WhatIfScenarioInput) {
    // Apply changes to baseline metrics
    const modifiedMetrics = this.applyChanges(input.baselineMetrics, scenario.changes);
    
    // Validate constraints
    const constraintViolations = this.checkConstraints(modifiedMetrics, input.constraints || []);
    
    // Project outcomes using Monte Carlo simulation
    const projectedOutcome = await this.projectOutcome(
      input.baselineMetrics, 
      modifiedMetrics, 
      scenario
    );
    
    // Assess risks
    const risks = this.assessRisks(
      input.baselineMetrics, 
      modifiedMetrics, 
      projectedOutcome,
      constraintViolations
    );
    
    // Project costs
    const costs = this.projectCosts(input.baselineMetrics, modifiedMetrics, scenario);
    
    // Create timeline
    const timeline = this.createTimeline(scenario, projectedOutcome);
    
    return {
      id: scenario.id,
      name: scenario.name,
      projectedOutcome,
      risks,
      costs,
      timeline
    };
  }

  private applyChanges(baseline: Record<string, number>, changes: any[]): Record<string, number> {
    const modified = { ...baseline };
    
    for (const change of changes) {
      const currentValue = baseline[change.parameter];
      
      if (currentValue === undefined) {
        console.warn(`Parameter ${change.parameter} not found in baseline metrics`);
        modified[change.parameter] = change.value;
        continue;
      }
      
      switch (change.type) {
        case 'absolute':
          modified[change.parameter] = change.value;
          break;
        case 'percentage':
          modified[change.parameter] = currentValue * (1 + change.value / 100);
          break;
        case 'multiplier':
          modified[change.parameter] = currentValue * change.value;
          break;
        default:
          throw new Error(`Unknown change type: ${change.type}`);
      }
    }
    
    return modified;
  }

  private checkConstraints(metrics: Record<string, number>, constraints: any[]): string[] {
    const violations = [];
    
    for (const constraint of constraints) {
      const value = metrics[constraint.parameter];
      
      if (value === undefined) continue;
      
      if (constraint.min !== undefined && value < constraint.min) {
        violations.push(`${constraint.parameter} below minimum: ${value} < ${constraint.min}`);
      }
      
      if (constraint.max !== undefined && value > constraint.max) {
        violations.push(`${constraint.parameter} above maximum: ${value} > ${constraint.max}`);
      }
      
      // Check dependencies
      if (constraint.dependencies) {
        for (const dep of constraint.dependencies) {
          const depValue = metrics[dep];
          if (depValue !== undefined && depValue > value) {
            violations.push(`Dependency violation: ${dep} (${depValue}) > ${constraint.parameter} (${value})`);
          }
        }
      }
    }
    
    return violations;
  }

  private async projectOutcome(
    baseline: Record<string, number>, 
    modified: Record<string, number>,
    scenario: any
  ): Promise<any[]> {
    const outcome = [];
    
    for (const [parameter, currentValue] of Object.entries(baseline)) {
      const projectedValue = modified[parameter] || currentValue;
      const change = projectedValue - currentValue;
      const changePercentage = currentValue !== 0 ? (change / currentValue) * 100 : 0;
      
      // Run Monte Carlo simulation for confidence estimation
      const confidence = await this.calculateConfidence(
        parameter, 
        currentValue, 
        projectedValue,
        scenario
      );
      
      outcome.push({
        parameter,
        currentValue: Math.round(currentValue * 100) / 100,
        projectedValue: Math.round(projectedValue * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercentage: Math.round(changePercentage * 100) / 100,
        confidence: Math.round(confidence * 100) / 100
      });
    }
    
    return outcome;
  }

  private async calculateConfidence(
    parameter: string,
    currentValue: number,
    projectedValue: number,
    scenario: any
  ): Promise<number> {
    // Base confidence on scenario complexity and parameter volatility
    let baseConfidence = 0.7;
    
    // Adjust for scenario duration
    if (scenario.duration) {
      const durationFactor = Math.min(1, scenario.duration / 30); // 30 days reference
      baseConfidence *= (1 - durationFactor * 0.2); // Decrease confidence for longer durations
    }
    
    // Adjust for change magnitude
    const changeMagnitude = Math.abs(projectedValue - currentValue) / (currentValue || 1);
    if (changeMagnitude > 1) { // More than 100% change
      baseConfidence *= 0.8;
    } else if (changeMagnitude > 0.5) { // More than 50% change
      baseConfidence *= 0.9;
    }
    
    // Parameter-specific adjustments
    const parameterReliability = this.getParameterReliability(parameter);
    baseConfidence *= parameterReliability;
    
    return Math.max(0.1, Math.min(1.0, baseConfidence));
  }

  private getParameterReliability(parameter: string): number {
    // Define reliability scores for different types of parameters
    const reliabilityMap: Record<string, number> = {
      'cpu_usage': 0.9,
      'memory_usage': 0.9,
      'disk_usage': 0.8,
      'network_latency': 0.7,
      'request_rate': 0.6,
      'error_rate': 0.5,
      'user_count': 0.4,
      'revenue': 0.3,
      'conversion_rate': 0.4,
      'churn_rate': 0.3
    };
    
    return reliabilityMap[parameter.toLowerCase()] || 0.6; // Default reliability
  }

  private assessRisks(
    _baseline: Record<string, number>,
    _modified: Record<string, number>,
    projectedOutcome: any[],
    constraintViolations: string[]
  ): RiskAssessment[] {
    const risks: RiskAssessment[] = [];
    
    // Performance risks
    const performanceParams = ['cpu_usage', 'memory_usage', 'response_time', 'error_rate'];
    for (const param of performanceParams) {
      const outcome = projectedOutcome.find(o => o.parameter === param);
      if (outcome && outcome.changePercentage > 50) {
        risks.push({
          risk: `High ${param.replace('_', ' ')} increase`,
          probability: Math.min(0.9, Math.abs(outcome.changePercentage) / 100),
          impact: outcome.changePercentage > 100 ? 'high' : 'medium',
          mitigation: this.getPerformanceMitigation(param),
          likelihood: outcome.confidence
        });
      }
    }
    
    // Capacity risks
    const capacityParams = ['storage_usage', 'bandwidth_usage', 'concurrent_users'];
    for (const param of capacityParams) {
      const outcome = projectedOutcome.find(o => o.parameter === param);
      if (outcome && outcome.changePercentage > 80) {
        risks.push({
          risk: `Capacity constraint for ${param.replace('_', ' ')}`,
          probability: 0.7,
          impact: 'high',
          mitigation: `Scale up ${param.replace('_', ' ')} infrastructure`,
          likelihood: outcome.confidence
        });
      }
    }
    
    // Financial risks
    const costParams = ['infrastructure_cost', 'operational_cost', 'total_cost'];
    for (const param of costParams) {
      const outcome = projectedOutcome.find(o => o.parameter === param);
      if (outcome && outcome.changePercentage > 50) {
        risks.push({
          risk: `Significant cost increase in ${param.replace('_', ' ')}`,
          probability: 0.8,
          impact: outcome.changePercentage > 100 ? 'high' : 'medium',
          mitigation: 'Implement cost optimization measures and budget adjustments',
          likelihood: outcome.confidence
        });
      }
    }
    
    // Business risks
    const businessParams = ['user_satisfaction', 'conversion_rate', 'revenue'];
    for (const param of businessParams) {
      const outcome = projectedOutcome.find(o => o.parameter === param);
      if (outcome && outcome.changePercentage < -20) {
        risks.push({
          risk: `Negative impact on ${param.replace('_', ' ')}`,
          probability: Math.min(0.9, Math.abs(outcome.changePercentage) / 100),
          impact: outcome.changePercentage < -50 ? 'high' : 'medium',
          mitigation: this.getBusinessMitigation(param),
          likelihood: outcome.confidence
        });
      }
    }
    
    // Constraint violation risks
    for (const violation of constraintViolations) {
      risks.push({
        risk: `Constraint violation: ${violation}`,
        probability: 0.9,
        impact: 'high',
        mitigation: 'Adjust scenario parameters to satisfy constraints',
        likelihood: 0.9
      });
    }
    
    // Integration risks
    const significantChanges = projectedOutcome.filter(o => Math.abs(o.changePercentage) > 30);
    if (significantChanges.length > 3) {
      risks.push({
        risk: 'Multiple simultaneous changes increase integration complexity',
        probability: 0.6,
        impact: 'medium',
        mitigation: 'Phase changes gradually and implement comprehensive testing',
        likelihood: 0.7
      });
    }
    
    return risks
      .sort((a, b) => (b.probability * this.getImpactWeight(b.impact)) - (a.probability * this.getImpactWeight(a.impact)))
      .slice(0, 8); // Top 8 risks
  }

  private getPerformanceMitigation(param: string): string {
    const mitigations: Record<string, string> = {
      'cpu_usage': 'Implement CPU scaling and optimize CPU-intensive operations',
      'memory_usage': 'Add memory capacity and optimize memory allocation',
      'response_time': 'Optimize application performance and scale infrastructure',
      'error_rate': 'Implement better error handling and monitoring'
    };
    
    return mitigations[param] || 'Monitor and optimize system performance';
  }

  private getBusinessMitigation(param: string): string {
    const mitigations: Record<string, string> = {
      'user_satisfaction': 'Implement user feedback systems and improve user experience',
      'conversion_rate': 'Optimize conversion funnel and A/B test improvements',
      'revenue': 'Review pricing strategy and implement revenue optimization'
    };
    
    return mitigations[param] || 'Implement business improvement measures';
  }

  private getImpactWeight(impact: string): number {
    const weights = { low: 1, medium: 2, high: 3 };
    return weights[impact as keyof typeof weights] || 1;
  }

  private projectCosts(
    baseline: Record<string, number>,
    modified: Record<string, number>,
    _scenario: any
  ): CostProjection[] {
    const costCategories = [
      'infrastructure',
      'personnel',
      'software_licenses',
      'support',
      'maintenance',
      'development',
      'marketing'
    ];
    
    const costs: CostProjection[] = [];
    
    for (const category of costCategories) {
      const currentCostParam = `${category}_cost`;
      const currentCost = baseline[currentCostParam] || 0;
      
      if (currentCost === 0) continue; // Skip if no baseline cost
      
      // Calculate cost impact based on related parameters
      let projectedCost = currentCost;
      let confidence = 0.7;
      
      switch (category) {
        case 'infrastructure':
          projectedCost = this.calculateInfrastructureCost(baseline, modified, currentCost);
          confidence = 0.8;
          break;
        case 'personnel':
          projectedCost = this.calculatePersonnelCost(baseline, modified, currentCost);
          confidence = 0.6;
          break;
        case 'software_licenses':
          projectedCost = this.calculateLicenseCost(baseline, modified, currentCost);
          confidence = 0.9;
          break;
        default:
          // Default scaling based on overall system scaling
          const scalingFactor = this.calculateOverallScalingFactor(baseline, modified);
          projectedCost = currentCost * scalingFactor;
      }
      
      const difference = projectedCost - currentCost;
      
      costs.push({
        category,
        currentCost: Math.round(currentCost * 100) / 100,
        projectedCost: Math.round(projectedCost * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        confidence: Math.round(confidence * 100) / 100
      });
    }
    
    return costs;
  }

  private calculateInfrastructureCost(
    baseline: Record<string, number>,
    modified: Record<string, number>,
    currentCost: number
  ): number {
    // Infrastructure costs scale with resource usage
    const resourceParams = ['cpu_usage', 'memory_usage', 'storage_usage', 'bandwidth_usage'];
    let scalingFactor = 1;
    
    for (const param of resourceParams) {
      const baseValue = baseline[param];
      const modifiedValue = modified[param];
      
      if (baseValue && modifiedValue) {
        const paramScaling = modifiedValue / baseValue;
        scalingFactor *= Math.pow(paramScaling, 0.25); // Each parameter contributes 25%
      }
    }
    
    return currentCost * scalingFactor;
  }

  private calculatePersonnelCost(
    baseline: Record<string, number>,
    modified: Record<string, number>,
    currentCost: number
  ): number {
    // Personnel costs scale with complexity and team size needs
    let scalingFactor = 1;
    
    const complexityIndicators = ['feature_count', 'service_count', 'user_count'];
    for (const param of complexityIndicators) {
      const baseValue = baseline[param];
      const modifiedValue = modified[param];
      
      if (baseValue && modifiedValue) {
        const growth = modifiedValue / baseValue;
        if (growth > 1.5) { // More than 50% growth
          scalingFactor *= 1 + (growth - 1) * 0.3; // 30% of growth translates to personnel needs
        }
      }
    }
    
    return currentCost * scalingFactor;
  }

  private calculateLicenseCost(
    baseline: Record<string, number>,
    modified: Record<string, number>,
    currentCost: number
  ): number {
    // License costs typically scale linearly with usage
    const usageParam = modified['user_count'] || modified['concurrent_users'] || modified['request_rate'];
    const baseUsage = baseline['user_count'] || baseline['concurrent_users'] || baseline['request_rate'];
    
    if (usageParam && baseUsage) {
      return currentCost * (usageParam / baseUsage);
    }
    
    return currentCost;
  }

  private calculateOverallScalingFactor(
    baseline: Record<string, number>,
    modified: Record<string, number>
  ): number {
    const scalingParams = ['user_count', 'request_rate', 'data_volume'];
    let totalScaling = 0;
    let validParams = 0;
    
    for (const param of scalingParams) {
      const baseValue = baseline[param];
      const modifiedValue = modified[param];
      
      if (baseValue && modifiedValue && baseValue > 0) {
        totalScaling += modifiedValue / baseValue;
        validParams++;
      }
    }
    
    return validParams > 0 ? totalScaling / validParams : 1;
  }

  private createTimeline(scenario: any, projectedOutcome: any[]) {
    const duration = scenario.duration || 30; // Default 30 days
    const phases = [];
    
    // Simple 3-phase timeline
    phases.push({
      phase: 'Planning & Preparation',
      duration: Math.max(1, Math.floor(duration * 0.2)),
      milestones: [
        'Finalize implementation plan',
        'Allocate resources',
        'Setup monitoring and rollback procedures'
      ]
    });
    
    phases.push({
      phase: 'Implementation',
      duration: Math.max(1, Math.floor(duration * 0.6)),
      milestones: [
        'Begin gradual rollout',
        'Monitor key metrics',
        'Adjust parameters as needed',
        'Complete full deployment'
      ]
    });
    
    phases.push({
      phase: 'Monitoring & Optimization',
      duration: Math.max(1, Math.floor(duration * 0.2)),
      milestones: [
        'Validate projected outcomes',
        'Optimize based on real data',
        'Document lessons learned'
      ]
    });
    
    // Add scenario-specific milestones
    const significantChanges = projectedOutcome
      .filter(o => Math.abs(o.changePercentage) > 50)
      .slice(0, 3);
    
    if (significantChanges.length > 0) {
      phases[1].milestones.push(
        ...significantChanges.map(c => `Monitor ${c.parameter} closely for ${c.changePercentage > 0 ? 'increases' : 'decreases'}`)
      );
    }
    
    return phases;
  }

  private compareScenarios(scenarios: any[], _input: WhatIfScenarioInput) {
    if (scenarios.length < 2) {
      return {
        scenarioIds: scenarios.map(s => s.id),
        bestCase: scenarios[0]?.id || '',
        worstCase: scenarios[0]?.id || '',
        mostLikely: scenarios[0]?.id || '',
        recommendations: ['Add more scenarios for meaningful comparison']
      };
    }
    
    // Score scenarios based on multiple criteria
    const scoredScenarios = scenarios.map(scenario => {
      let score = 0;
      let confidence = 0;
      
      // Positive impact scoring
      for (const outcome of scenario.projectedOutcome) {
        if (this.isPositiveMetric(outcome.parameter)) {
          score += outcome.changePercentage * 0.01 * outcome.confidence;
        } else {
          score -= outcome.changePercentage * 0.01 * outcome.confidence;
        }
        confidence += outcome.confidence;
      }
      
      // Risk penalty
      const highRisks = scenario.risks.filter((r: any) => r.impact === 'high').length;
      const mediumRisks = scenario.risks.filter((r: any) => r.impact === 'medium').length;
      score -= (highRisks * 0.3 + mediumRisks * 0.1);
      
      // Cost penalty
      const totalCostIncrease = scenario.costs.reduce((sum: number, cost: any) => 
        sum + Math.max(0, cost.difference), 0);
      score -= totalCostIncrease * 0.0001; // Small penalty per cost unit
      
      confidence = confidence / scenario.projectedOutcome.length;
      
      return {
        id: scenario.id,
        name: scenario.name,
        score: Math.round(score * 100) / 100,
        confidence: Math.round(confidence * 100) / 100
      };
    });
    
    // Sort scenarios
    scoredScenarios.sort((a, b) => b.score - a.score);
    
    const bestCase = scoredScenarios[0].id;
    const worstCase = scoredScenarios[scoredScenarios.length - 1].id;
    
    // Most likely is the one with highest confidence among top half
    const topHalf = scoredScenarios.slice(0, Math.ceil(scoredScenarios.length / 2));
    const mostLikely = topHalf.sort((a, b) => b.confidence - a.confidence)[0].id;
    
    // Generate recommendations
    const recommendations = [];
    
    const bestScenario = scenarios.find(s => s.id === bestCase);
    const worstScenario = scenarios.find(s => s.id === worstCase);
    
    if (bestScenario && worstScenario) {
      recommendations.push(`${bestScenario.name} shows the most favorable outcomes overall`);
      recommendations.push(`${worstScenario.name} has the highest risks and should be avoided`);
      
      const lowRiskScenarios = scenarios.filter(s => 
        s.risks.filter((r: any) => r.impact === 'high').length === 0
      );
      
      if (lowRiskScenarios.length > 0) {
        recommendations.push(`Consider ${lowRiskScenarios[0].name} for lowest risk implementation`);
      }
      
      const highConfidenceScenarios = scoredScenarios.filter(s => s.confidence > 0.8);
      if (highConfidenceScenarios.length > 0) {
        recommendations.push(`Scenarios with highest confidence: ${highConfidenceScenarios.map(s => s.name).join(', ')}`);
      }
      
      recommendations.push('Consider phased implementation starting with lower-risk scenarios');
      recommendations.push('Implement comprehensive monitoring before proceeding with any scenario');
    }
    
    return {
      scenarioIds: scenarios.map(s => s.id),
      bestCase,
      worstCase,
      mostLikely,
      recommendations
    };
  }

  private isPositiveMetric(parameter: string): boolean {
    const positiveMetrics = [
      'throughput', 'performance', 'user_satisfaction', 'conversion_rate', 
      'revenue', 'uptime', 'availability', 'success_rate'
    ];
    
    return positiveMetrics.some(metric => 
      parameter.toLowerCase().includes(metric)
    );
  }
}