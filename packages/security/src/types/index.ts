export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecuritySeverity;
  source: string;
  details: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: GeoLocation;
}

export enum SecurityEventType {
  THREAT_DETECTED = 'threat_detected',
  ACCESS_ANOMALY = 'access_anomaly',
  DDOS_ATTACK = 'ddos_attack',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  VULNERABILITY_FOUND = 'vulnerability_found',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_BREACH = 'data_breach',
  MALICIOUS_REQUEST = 'malicious_request',
  UNUSUAL_BEHAVIOR = 'unusual_behavior'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface ThreatSignature {
  id: string;
  name: string;
  pattern: string | RegExp;
  type: ThreatType;
  severity: SecuritySeverity;
  description: string;
  mitigation: string;
  enabled: boolean;
  lastUpdated: Date;
}

export enum ThreatType {
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  CSRF = 'csrf',
  COMMAND_INJECTION = 'command_injection',
  PATH_TRAVERSAL = 'path_traversal',
  MALWARE = 'malware',
  PHISHING = 'phishing',
  BRUTE_FORCE = 'brute_force',
  DDOS = 'ddos',
  INSIDER_THREAT = 'insider_threat'
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  requirements: ComplianceRequirement[];
  enabled: boolean;
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  controls: ComplianceControl[];
}

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  implementation: string;
  status: ComplianceStatus;
  evidence: string[];
  lastAssessed: Date;
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  NOT_ASSESSED = 'not_assessed'
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  outcome: AuditOutcome;
  hash: string;
  previousHash?: string;
  blockchainTxId?: string;
}

export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  DENIED = 'denied',
  ERROR = 'error'
}

export interface AccessPattern {
  userId: string;
  ipAddresses: string[];
  userAgents: string[];
  locations: GeoLocation[];
  timePattern: TimePattern;
  resourceAccess: ResourceAccess[];
  score: number;
}

export interface TimePattern {
  typicalHours: number[];
  typicalDays: number[];
  timezone: string;
  frequency: AccessFrequency;
}

export enum AccessFrequency {
  VERY_LOW = 'very_low',
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export interface ResourceAccess {
  resource: string;
  methods: string[];
  frequency: number;
  lastAccessed: Date;
}

export interface DDoSMetrics {
  requestsPerSecond: number;
  uniqueIPs: number;
  averageResponseTime: number;
  errorRate: number;
  bandwidthUsage: number;
  suspiciousPatterns: SuspiciousPattern[];
}

export interface SuspiciousPattern {
  type: PatternType;
  confidence: number;
  description: string;
  sourceIPs: string[];
  requestCount: number;
  timeWindow: number;
}

export enum PatternType {
  VOLUME_SPIKE = 'volume_spike',
  GEOGRAPHICAL_ANOMALY = 'geographical_anomaly',
  REQUEST_PATTERN = 'request_pattern',
  USER_AGENT_ANOMALY = 'user_agent_anomaly',
  RATE_ANOMALY = 'rate_anomaly'
}

export interface SecurityScore {
  overall: number;
  categories: SecurityScoreCategory[];
  timestamp: Date;
  recommendations: SecurityRecommendation[];
  trend: ScoreTrend;
}

export interface SecurityScoreCategory {
  name: string;
  score: number;
  weight: number;
  factors: SecurityFactor[];
}

export interface SecurityFactor {
  name: string;
  value: number;
  weight: number;
  impact: number;
  description: string;
}

export interface SecurityRecommendation {
  priority: RecommendationPriority;
  category: string;
  title: string;
  description: string;
  impact: number;
  effort: number;
  resources: string[];
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ScoreTrend {
  direction: TrendDirection;
  change: number;
  period: string;
  confidence: number;
}

export enum TrendDirection {
  IMPROVING = 'improving',
  STABLE = 'stable',
  DECLINING = 'declining'
}

export interface Vulnerability {
  id: string;
  cve?: string;
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  cvss: CVSSScore;
  affected: AffectedComponent[];
  discovered: Date;
  status: VulnerabilityStatus;
  remediation: RemediationInfo;
  references: string[];
}

export enum VulnerabilitySeverity {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CVSSScore {
  version: string;
  vector: string;
  baseScore: number;
  temporalScore?: number;
  environmentalScore?: number;
}

export interface AffectedComponent {
  name: string;
  version: string;
  type: ComponentType;
  path?: string;
}

export enum ComponentType {
  DEPENDENCY = 'dependency',
  OS_PACKAGE = 'os_package',
  CONTAINER_IMAGE = 'container_image',
  APPLICATION = 'application'
}

export enum VulnerabilityStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
  ACCEPTED_RISK = 'accepted_risk'
}

export interface RemediationInfo {
  action: string;
  priority: RecommendationPriority;
  effort: string;
  timeline: string;
  resources: string[];
}

export interface SecurityConfiguration {
  threatDetection: ThreatDetectionConfig;
  compliance: ComplianceConfig;
  auditTrail: AuditTrailConfig;
  anomalyDetection: AnomalyDetectionConfig;
  ddosProtection: DDoSProtectionConfig;
  vulnerabilityScanning: VulnerabilityScanningConfig;
  scoring: SecurityScoringConfig;
}

export interface ThreatDetectionConfig {
  enabled: boolean;
  sensitivity: ThreatSensitivity;
  customRules: ThreatSignature[];
  responseActions: ResponseAction[];
  alertChannels: AlertChannel[];
}

export enum ThreatSensitivity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  PARANOID = 'paranoid'
}

export interface ResponseAction {
  trigger: SecurityEventType;
  action: ActionType;
  parameters: Record<string, any>;
  enabled: boolean;
}

export enum ActionType {
  ALERT = 'alert',
  BLOCK_IP = 'block_ip',
  RATE_LIMIT = 'rate_limit',
  QUARANTINE = 'quarantine',
  LOG_ENHANCED = 'log_enhanced',
  TRIGGER_WORKFLOW = 'trigger_workflow'
}

export interface AlertChannel {
  type: AlertChannelType;
  config: Record<string, any>;
  severity: SecuritySeverity[];
  enabled: boolean;
}

export enum AlertChannelType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  PAGERDUTY = 'pagerduty'
}

export interface ComplianceConfig {
  frameworks: string[];
  automatedReporting: boolean;
  retentionPeriod: string;
  evidenceCollection: boolean;
}

export interface AuditTrailConfig {
  enabled: boolean;
  blockchain: BlockchainConfig;
  retention: string;
  encryption: EncryptionConfig;
  immutable: boolean;
}

export interface BlockchainConfig {
  enabled: boolean;
  network: string;
  contract?: string;
  confirmations: number;
}

export interface EncryptionConfig {
  algorithm: string;
  keyRotation: string;
  keyManagement: string;
}

export interface AnomalyDetectionConfig {
  enabled: boolean;
  mlModel: MLModelConfig;
  sensitivity: number;
  trainingPeriod: string;
  features: string[];
}

export interface MLModelConfig {
  algorithm: string;
  parameters: Record<string, any>;
  retraining: string;
  accuracy: number;
}

export interface DDoSProtectionConfig {
  enabled: boolean;
  thresholds: DDoSThresholds;
  mitigation: MitigationConfig;
  whitelists: string[];
}

export interface DDoSThresholds {
  requestsPerSecond: number;
  uniqueIPsPerSecond: number;
  errorRatePercent: number;
  responseTimeMs: number;
}

export interface MitigationConfig {
  autoBlock: boolean;
  rateLimiting: RateLimitingConfig;
  challengeResponse: boolean;
  geoBlocking: GeoBlockingConfig;
}

export interface RateLimitingConfig {
  windowMs: number;
  maxRequests: number;
  skipWhitelisted: boolean;
}

export interface GeoBlockingConfig {
  enabled: boolean;
  blockedCountries: string[];
  allowedCountries: string[];
}

export interface VulnerabilityScanningConfig {
  enabled: boolean;
  schedule: string;
  scanners: ScannerConfig[];
  autoRemediation: boolean;
}

export interface ScannerConfig {
  name: string;
  type: ScannerType;
  config: Record<string, any>;
  enabled: boolean;
}

export enum ScannerType {
  DEPENDENCY = 'dependency',
  CONTAINER = 'container',
  INFRASTRUCTURE = 'infrastructure',
  WEB_APPLICATION = 'web_application'
}

export interface SecurityScoringConfig {
  enabled: boolean;
  updateFrequency: string;
  weights: Record<string, number>;
  benchmarks: Record<string, number>;
}

// Monitoring integration types
export interface SecurityMetrics {
  threatsDetected: number;
  threatsBlocked: number;
  complianceScore: number;
  vulnerabilities: VulnerabilityCount;
  auditEvents: number;
  anomaliesDetected: number;
  ddosAttacks: number;
  securityScore: number;
}

export interface VulnerabilityCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

// Event handlers
export type SecurityEventHandler = (event: SecurityEvent) => void | Promise<void>;
export type ThreatDetectedHandler = (threat: ThreatSignature, event: SecurityEvent) => void | Promise<void>;
export type AnomalyDetectedHandler = (anomaly: AccessPattern) => void | Promise<void>;
export type ComplianceViolationHandler = (violation: ComplianceRequirement) => void | Promise<void>;
export type VulnerabilityFoundHandler = (vulnerability: Vulnerability) => void | Promise<void>;