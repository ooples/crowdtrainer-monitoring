import { EventEmitter } from 'events';
import {
  AuditEntry,
  AuditOutcome,
  SecurityEvent,
  AuditTrailConfig,
  BlockchainConfig,
  EncryptionConfig
} from '../types';
import { CryptoUtils, TimeUtils } from '../utils';

/**
 * Tamper-proof audit trail system with blockchain integration
 * Provides immutable audit logging with cryptographic verification
 */
export class AuditTrail extends EventEmitter {
  private config: AuditTrailConfig;
  private blockchain: BlockchainIntegration;
  private encryption: EncryptionManager;
  private auditEntries: Map<string, AuditEntry> = new Map();
  private merkleTree: MerkleTree;
  private isRunning = false;
  private batchTimer?: NodeJS.Timeout;
  private pendingEntries: AuditEntry[] = [];

  constructor(config: AuditTrailConfig) {
    super();
    this.config = config;
    this.blockchain = new BlockchainIntegration(config.blockchain);
    this.encryption = new EncryptionManager(config.encryption);
    this.merkleTree = new MerkleTree();
  }

  /**
   * Start audit trail system
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    await this.blockchain.initialize();
    await this.encryption.initialize();

    // Start batch processing
    this.startBatchProcessing();

    this.emit('audit:started');
  }

  /**
   * Stop audit trail system
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Process remaining entries
    if (this.pendingEntries.length > 0) {
      await this.processBatch();
    }

    await this.blockchain.disconnect();
    this.emit('audit:stopped');
  }

  /**
   * Log an audit entry
   */
  async logEntry(entry: Partial<AuditEntry>): Promise<AuditEntry> {
    const auditEntry: AuditEntry = {
      id: entry.id || CryptoUtils.generateSecureId(),
      timestamp: entry.timestamp || new Date(),
      userId: entry.userId,
      action: entry.action || 'unknown',
      resource: entry.resource || 'unknown',
      details: entry.details || {},
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      sessionId: entry.sessionId,
      outcome: entry.outcome || AuditOutcome.SUCCESS,
      hash: '',
      previousHash: this.getLastHash(),
      blockchainTxId: undefined
    };

    // Calculate entry hash
    auditEntry.hash = this.calculateEntryHash(auditEntry);

    // Add to pending entries for batch processing
    this.pendingEntries.push(auditEntry);
    this.auditEntries.set(auditEntry.id, auditEntry);

    // Emit event
    this.emit('audit:entry', auditEntry);

    // Process immediately if not in batch mode or if high priority
    if (!this.config.blockchain.enabled || this.isHighPriority(auditEntry)) {
      await this.processEntry(auditEntry);
    }

    return auditEntry;
  }

  /**
   * Log from security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<AuditEntry> {
    return this.logEntry({
      action: `security_${event.type}`,
      resource: 'security_system',
      details: {
        eventType: event.type,
        severity: event.severity,
        source: event.source,
        eventDetails: event.details
      },
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      outcome: AuditOutcome.SUCCESS
    });
  }

  /**
   * Log user action
   */
  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    outcome: AuditOutcome,
    details: Record<string, any> = {},
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<AuditEntry> {
    return this.logEntry({
      userId,
      action,
      resource,
      outcome,
      details,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      sessionId: metadata?.sessionId
    });
  }

  /**
   * Log system action
   */
  async logSystemAction(
    action: string,
    resource: string,
    outcome: AuditOutcome,
    details: Record<string, any> = {}
  ): Promise<AuditEntry> {
    return this.logEntry({
      action,
      resource,
      outcome,
      details: {
        ...details,
        systemAction: true
      }
    });
  }

  /**
   * Verify audit trail integrity
   */
  async verifyIntegrity(entries?: AuditEntry[]): Promise<VerificationResult> {
    const entriesToVerify = entries || Array.from(this.auditEntries.values());
    const result: VerificationResult = {
      isValid: true,
      totalEntries: entriesToVerify.length,
      validEntries: 0,
      invalidEntries: [],
      merkleRoot: '',
      blockchainVerification: null
    };

    // Sort entries by timestamp
    const sortedEntries = entriesToVerify.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    let previousHash: string | undefined;

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      const isValid = await this.verifyEntry(entry, previousHash);

      if (isValid) {
        result.validEntries++;
      } else {
        result.invalidEntries.push({
          entry,
          reason: 'Hash verification failed'
        });
        result.isValid = false;
      }

      previousHash = entry.hash;
    }

    // Verify Merkle tree
    if (sortedEntries.length > 0) {
      const hashes = sortedEntries.map(entry => entry.hash);
      this.merkleTree.build(hashes);
      result.merkleRoot = this.merkleTree.getRoot();
    }

    // Verify blockchain integrity if enabled
    if (this.config.blockchain.enabled) {
      result.blockchainVerification = await this.verifyBlockchainIntegrity(sortedEntries);
    }

    this.emit('audit:verification', result);
    return result;
  }

  /**
   * Query audit entries
   */
  async queryEntries(query: AuditQuery): Promise<AuditQueryResult> {
    let entries = Array.from(this.auditEntries.values());

    // Apply filters
    if (query.userId) {
      entries = entries.filter(entry => entry.userId === query.userId);
    }

    if (query.action) {
      entries = entries.filter(entry => entry.action.includes(query.action!));
    }

    if (query.resource) {
      entries = entries.filter(entry => entry.resource.includes(query.resource!));
    }

    if (query.outcome) {
      entries = entries.filter(entry => entry.outcome === query.outcome);
    }

    if (query.startTime) {
      entries = entries.filter(entry => entry.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      entries = entries.filter(entry => entry.timestamp <= query.endTime!);
    }

    if (query.ipAddress) {
      entries = entries.filter(entry => entry.ipAddress === query.ipAddress);
    }

    // Sort entries
    entries.sort((a, b) => {
      if (query.sortBy === 'timestamp') {
        return query.sortOrder === 'desc' 
          ? b.timestamp.getTime() - a.timestamp.getTime()
          : a.timestamp.getTime() - b.timestamp.getTime();
      }
      return 0;
    });

    // Apply pagination
    const total = entries.length;
    const offset = (query.page - 1) * query.limit;
    const paginatedEntries = entries.slice(offset, offset + query.limit);

    return {
      entries: paginatedEntries,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit)
    };
  }

  /**
   * Export audit trail
   */
  async exportAuditTrail(format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    const entries = Array.from(this.auditEntries.values()).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    switch (format) {
      case 'json':
        return JSON.stringify({
          exportTimestamp: new Date().toISOString(),
          totalEntries: entries.length,
          merkleRoot: this.merkleTree.getRoot(),
          entries: entries
        }, null, 2);

      case 'csv':
        return this.exportToCSV(entries);

      case 'xml':
        return this.exportToXML(entries);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Calculate hash for an audit entry
   */
  private calculateEntryHash(entry: AuditEntry): string {
    const hashInput = [
      entry.id,
      entry.timestamp.toISOString(),
      entry.userId || '',
      entry.action,
      entry.resource,
      JSON.stringify(entry.details),
      entry.ipAddress || '',
      entry.userAgent || '',
      entry.sessionId || '',
      entry.outcome,
      entry.previousHash || ''
    ].join('|');

    return CryptoUtils.generateHash(hashInput, 'sha256');
  }

  /**
   * Verify a single audit entry
   */
  private async verifyEntry(entry: AuditEntry, expectedPreviousHash?: string): Promise<boolean> {
    // Verify hash
    const calculatedHash = this.calculateEntryHash(entry);
    if (calculatedHash !== entry.hash) {
      return false;
    }

    // Verify hash chain
    if (expectedPreviousHash !== undefined && entry.previousHash !== expectedPreviousHash) {
      return false;
    }

    // Verify blockchain transaction if available
    if (entry.blockchainTxId && this.config.blockchain.enabled) {
      return await this.blockchain.verifyTransaction(entry.blockchainTxId, entry.hash);
    }

    return true;
  }

  /**
   * Get the hash of the last audit entry
   */
  private getLastHash(): string | undefined {
    const entries = Array.from(this.auditEntries.values());
    if (entries.length === 0) return undefined;

    const lastEntry = entries.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    )[0];

    return lastEntry.hash;
  }

  /**
   * Process a single entry
   */
  private async processEntry(entry: AuditEntry): Promise<void> {
    try {
      // Encrypt if enabled
      if (this.config.encryption) {
        await this.encryption.encryptEntry(entry);
      }

      // Store in blockchain if enabled
      if (this.config.blockchain.enabled) {
        entry.blockchainTxId = await this.blockchain.storeEntry(entry);
      }

      // Add to Merkle tree
      this.merkleTree.addLeaf(entry.hash);

      this.emit('audit:processed', entry);

    } catch (error) {
      console.error(`Failed to process audit entry ${entry.id}:`, error);
      this.emit('audit:error', { entry, error });
    }
  }

  /**
   * Start batch processing
   */
  private startBatchProcessing(): void {
    if (!this.config.blockchain.enabled) return;

    const batchInterval = 60000; // 1 minute
    this.batchTimer = setTimeout(async () => {
      if (this.isRunning) {
        await this.processBatch();
        this.startBatchProcessing(); // Schedule next batch
      }
    }, batchInterval);
  }

  /**
   * Process pending entries in batch
   */
  private async processBatch(): Promise<void> {
    if (this.pendingEntries.length === 0) return;

    const batch = [...this.pendingEntries];
    this.pendingEntries = [];

    try {
      // Process each entry
      await Promise.all(batch.map(entry => this.processEntry(entry)));

      // Store batch in blockchain
      if (this.config.blockchain.enabled) {
        await this.blockchain.storeBatch(batch);
      }

      this.emit('audit:batch_processed', { count: batch.length });

    } catch (error) {
      console.error('Failed to process audit batch:', error);
      // Re-add failed entries to pending queue
      this.pendingEntries.unshift(...batch);
    }
  }

  /**
   * Check if entry is high priority
   */
  private isHighPriority(entry: AuditEntry): boolean {
    const highPriorityActions = [
      'security_threat_detected',
      'security_data_breach',
      'authentication_failure',
      'privilege_escalation',
      'admin_action'
    ];

    return highPriorityActions.some(action => entry.action.includes(action));
  }

  /**
   * Verify blockchain integrity
   */
  private async verifyBlockchainIntegrity(entries: AuditEntry[]): Promise<BlockchainVerificationResult> {
    if (!this.config.blockchain.enabled) {
      return { isValid: false, reason: 'Blockchain not enabled' };
    }

    try {
      const entriesWithTxId = entries.filter(entry => entry.blockchainTxId);
      let validTransactions = 0;

      for (const entry of entriesWithTxId) {
        const isValid = await this.blockchain.verifyTransaction(entry.blockchainTxId!, entry.hash);
        if (isValid) validTransactions++;
      }

      return {
        isValid: validTransactions === entriesWithTxId.length,
        totalEntries: entriesWithTxId.length,
        validTransactions,
        reason: validTransactions === entriesWithTxId.length ? 'All transactions valid' : 'Some transactions invalid'
      };

    } catch (error) {
      return {
        isValid: false,
        reason: `Blockchain verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(entries: AuditEntry[]): string {
    const headers = [
      'ID', 'Timestamp', 'User ID', 'Action', 'Resource', 
      'Outcome', 'IP Address', 'User Agent', 'Session ID', 
      'Hash', 'Previous Hash', 'Blockchain TX ID'
    ];

    const csvLines = [headers.join(',')];

    for (const entry of entries) {
      const row = [
        entry.id,
        entry.timestamp.toISOString(),
        entry.userId || '',
        entry.action,
        entry.resource,
        entry.outcome,
        entry.ipAddress || '',
        entry.userAgent || '',
        entry.sessionId || '',
        entry.hash,
        entry.previousHash || '',
        entry.blockchainTxId || ''
      ];

      csvLines.push(row.map(field => `"${field}"`).join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * Export to XML format
   */
  private exportToXML(entries: AuditEntry[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<auditTrail>\n';
    xml += `  <exportTimestamp>${new Date().toISOString()}</exportTimestamp>\n`;
    xml += `  <totalEntries>${entries.length}</totalEntries>\n`;
    xml += '  <entries>\n';

    for (const entry of entries) {
      xml += '    <entry>\n';
      xml += `      <id>${entry.id}</id>\n`;
      xml += `      <timestamp>${entry.timestamp.toISOString()}</timestamp>\n`;
      xml += `      <userId>${entry.userId || ''}</userId>\n`;
      xml += `      <action>${entry.action}</action>\n`;
      xml += `      <resource>${entry.resource}</resource>\n`;
      xml += `      <outcome>${entry.outcome}</outcome>\n`;
      xml += `      <ipAddress>${entry.ipAddress || ''}</ipAddress>\n`;
      xml += `      <userAgent>${entry.userAgent || ''}</userAgent>\n`;
      xml += `      <sessionId>${entry.sessionId || ''}</sessionId>\n`;
      xml += `      <hash>${entry.hash}</hash>\n`;
      xml += `      <previousHash>${entry.previousHash || ''}</previousHash>\n`;
      xml += `      <blockchainTxId>${entry.blockchainTxId || ''}</blockchainTxId>\n`;
      xml += '    </entry>\n';
    }

    xml += '  </entries>\n';
    xml += '</auditTrail>\n';

    return xml;
  }
}

/**
 * Blockchain integration for immutable storage
 */
class BlockchainIntegration {
  private config: BlockchainConfig;
  private isConnected = false;

  constructor(config: BlockchainConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    // In production, this would initialize connection to blockchain network
    console.log(`Initializing blockchain connection to ${this.config.network}`);
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async storeEntry(entry: AuditEntry): Promise<string> {
    if (!this.isConnected) throw new Error('Blockchain not connected');

    // In production, this would create a blockchain transaction
    const txId = CryptoUtils.generateSecureId();
    console.log(`Stored audit entry ${entry.id} in blockchain transaction ${txId}`);
    return txId;
  }

  async storeBatch(entries: AuditEntry[]): Promise<string[]> {
    return Promise.all(entries.map(entry => this.storeEntry(entry)));
  }

  async verifyTransaction(txId: string, expectedHash: string): Promise<boolean> {
    if (!this.isConnected) return false;

    // In production, this would verify the transaction on blockchain
    console.log(`Verifying blockchain transaction ${txId} for hash ${expectedHash}`);
    return true; // Mock verification
  }
}

/**
 * Encryption manager for sensitive audit data
 */
class EncryptionManager {
  private config: EncryptionConfig;
  private encryptionKey?: string;

  constructor(config: EncryptionConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // In production, this would initialize encryption keys
    this.encryptionKey = CryptoUtils.generateHash('encryption_key');
  }

  async encryptEntry(entry: AuditEntry): Promise<void> {
    if (!this.encryptionKey) return;

    // Encrypt sensitive fields
    if (entry.details) {
      const encrypted = CryptoUtils.encrypt(
        JSON.stringify(entry.details),
        this.encryptionKey
      );
      entry.details = { encrypted: encrypted.encrypted, iv: encrypted.iv };
    }
  }

  async decryptEntry(entry: AuditEntry): Promise<void> {
    if (!this.encryptionKey || !entry.details?.encrypted) return;

    const decrypted = CryptoUtils.decrypt(
      { encrypted: entry.details.encrypted, iv: entry.details.iv },
      this.encryptionKey
    );
    entry.details = JSON.parse(decrypted);
  }
}

/**
 * Merkle tree for efficient verification
 */
class MerkleTree {
  private leaves: string[] = [];
  private tree: string[][] = [];

  addLeaf(hash: string): void {
    this.leaves.push(hash);
    this.rebuildTree();
  }

  build(hashes: string[]): void {
    this.leaves = [...hashes];
    this.rebuildTree();
  }

  getRoot(): string {
    if (this.tree.length === 0) return '';
    return this.tree[this.tree.length - 1][0] || '';
  }

  private rebuildTree(): void {
    if (this.leaves.length === 0) return;

    this.tree = [this.leaves];

    while (this.tree[this.tree.length - 1].length > 1) {
      const currentLevel = this.tree[this.tree.length - 1];
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left; // Duplicate if odd number
        const combined = CryptoUtils.generateHash(left + right);
        nextLevel.push(combined);
      }

      this.tree.push(nextLevel);
    }
  }
}

// Supporting interfaces
interface AuditQuery {
  userId?: string;
  action?: string;
  resource?: string;
  outcome?: AuditOutcome;
  startTime?: Date;
  endTime?: Date;
  ipAddress?: string;
  page: number;
  limit: number;
  sortBy?: 'timestamp';
  sortOrder?: 'asc' | 'desc';
}

interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface VerificationResult {
  isValid: boolean;
  totalEntries: number;
  validEntries: number;
  invalidEntries: { entry: AuditEntry; reason: string }[];
  merkleRoot: string;
  blockchainVerification: BlockchainVerificationResult | null;
}

interface BlockchainVerificationResult {
  isValid: boolean;
  totalEntries?: number;
  validTransactions?: number;
  reason: string;
}