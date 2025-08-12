/**
 * Code-Level Insights Implementation
 * 
 * Git-integrated code analysis system that provides insights into which
 * code changes caused issues, with blame information and change impact analysis.
 */

import { EventEmitter } from 'events';
import { simpleGit, SimpleGit } from 'simple-git';
import { ErrorData } from '../clustering/errors';

export interface CodeInsightsConfig {
  /** Git repository path */
  gitRepository: string;
  /** Include git blame information */
  includeBlame?: boolean;
  /** Maximum number of commits to analyze */
  maxCommits?: number;
  /** Include diff analysis */
  includeDiff?: boolean;
  /** Cache insights for performance */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** File extensions to analyze */
  fileExtensions?: string[];
  /** Directories to exclude */
  excludeDirectories?: string[];
}

export interface CommitInfo {
  /** Commit hash */
  hash: string;
  /** Commit message */
  message: string;
  /** Author information */
  author: {
    name: string;
    email: string;
  };
  /** Commit date */
  date: Date;
  /** Files changed in this commit */
  files: string[];
  /** Commit statistics */
  stats: {
    /** Lines added */
    insertions: number;
    /** Lines deleted */
    deletions: number;
    /** Files changed */
    filesChanged: number;
  };
}

export interface BlameInfo {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Blame information for the line */
  blame: {
    /** Commit hash */
    commit: string;
    /** Author */
    author: string;
    /** Date */
    date: Date;
    /** Line content */
    content: string;
  };
}

export interface FileChangeInfo {
  /** File path */
  file: string;
  /** Change type */
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Lines changed */
  linesChanged: number;
  /** Complexity delta */
  complexityDelta?: number;
  /** Risk score (0-1) */
  riskScore: number;
}

export interface CodeInsight {
  /** Error information */
  error: ErrorData;
  /** Related commits */
  relatedCommits: CommitInfo[];
  /** Blame information */
  blameInfo?: BlameInfo[];
  /** Recent changes to error location */
  recentChanges: FileChangeInfo[];
  /** Risk assessment */
  riskAssessment: {
    /** Overall risk score (0-1) */
    overallRisk: number;
    /** Risk factors */
    factors: Array<{
      /** Factor name */
      name: string;
      /** Factor score (0-1) */
      score: number;
      /** Factor description */
      description: string;
    }>;
  };
  /** Code suggestions */
  suggestions: Array<{
    /** Suggestion type */
    type: 'fix' | 'refactor' | 'test' | 'monitoring';
    /** Suggestion text */
    text: string;
    /** Priority (1-5) */
    priority: number;
  }>;
  /** Analysis metadata */
  metadata: {
    /** Analysis timestamp */
    analyzedAt: number;
    /** Analysis duration in ms */
    analysisDuration: number;
    /** Commits analyzed */
    commitsAnalyzed: number;
    /** Files analyzed */
    filesAnalyzed: number;
  };
}

export interface CodeHotspot {
  /** File path */
  file: string;
  /** Line range */
  lineRange: { start: number; end: number };
  /** Error frequency */
  errorCount: number;
  /** Recent commit count */
  commitCount: number;
  /** Hotspot score (0-1) */
  score: number;
  /** Contributing authors */
  authors: Array<{
    name: string;
    commitCount: number;
  }>;
}

interface CacheEntry {
  /** Cache key */
  key: string;
  /** Cached insight */
  insight: CodeInsight;
  /** Cache timestamp */
  timestamp: number;
  /** TTL */
  ttl: number;
}

export class CodeInsights extends EventEmitter {
  private config: Required<CodeInsightsConfig>;
  private git: SimpleGit;
  private cache: Map<string, CacheEntry> = new Map();
  private hotspots: Map<string, CodeHotspot> = new Map();

  constructor(config: CodeInsightsConfig) {
    super();
    this.config = {
      includeBlame: true,
      maxCommits: 100,
      includeDiff: true,
      enableCaching: true,
      cacheTtl: 30 * 60 * 1000, // 30 minutes
      fileExtensions: ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.php'],
      excludeDirectories: ['node_modules', '.git', 'dist', 'build', 'coverage'],
      ...config
    };

    this.git = simpleGit(this.config.gitRepository);
    this.setupCacheCleanup();
  }

  /**
   * Get code insights for an error
   */
  async getInsights(error: ErrorData): Promise<CodeInsight> {
    const startTime = Date.now();
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedInsight(error.id);
      if (cached) {
        return cached;
      }
    }

    // Perform analysis
    const insight = await this.analyzeError(error);
    insight.metadata.analysisDuration = Date.now() - startTime;

    // Cache result
    if (this.config.enableCaching) {
      this.cacheInsight(error.id, insight);
    }

    // Update hotspots
    await this.updateHotspots(error, insight);

    this.emit('insightGenerated', insight);
    
    return insight;
  }

  /**
   * Get code insights for multiple errors in batch
   */
  async getInsightsBatch(errors: ErrorData[]): Promise<CodeInsight[]> {
    const insights: CodeInsight[] = [];
    
    // Process in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < errors.length; i += concurrency) {
      const batch = errors.slice(i, i + concurrency);
      const batchInsights = await Promise.all(
        batch.map(error => this.getInsights(error))
      );
      insights.push(...batchInsights);
    }

    return insights;
  }

  /**
   * Get code hotspots
   */
  getHotspots(options: {
    minScore?: number;
    limit?: number;
    sortBy?: 'score' | 'errorCount' | 'commitCount';
  } = {}): CodeHotspot[] {
    const { minScore = 0.5, limit = 20, sortBy = 'score' } = options;
    
    let hotspots = Array.from(this.hotspots.values())
      .filter(h => h.score >= minScore);

    // Sort hotspots
    switch (sortBy) {
      case 'errorCount':
        hotspots.sort((a, b) => b.errorCount - a.errorCount);
        break;
      case 'commitCount':
        hotspots.sort((a, b) => b.commitCount - a.commitCount);
        break;
      case 'score':
      default:
        hotspots.sort((a, b) => b.score - a.score);
        break;
    }

    return hotspots.slice(0, limit);
  }

  /**
   * Analyze commit impact on error rates
   */
  async analyzeCommitImpact(commitHash: string): Promise<{
    commit: CommitInfo;
    impact: {
      /** Risk score of this commit (0-1) */
      riskScore: number;
      /** Files with high risk */
      riskyFiles: Array<{
        file: string;
        risk: number;
        reasons: string[];
      }>;
      /** Predicted error types */
      predictedErrorTypes: string[];
    };
  }> {
    const commit = await this.getCommitInfo(commitHash);
    if (!commit) {
      throw new Error(`Commit ${commitHash} not found`);
    }

    // Analyze commit for risk factors
    const riskScore = await this.calculateCommitRisk(commit);
    const riskyFiles = await this.analyzeFileRisks(commit.files);
    const predictedErrorTypes = await this.predictErrorTypes(commit);

    return {
      commit,
      impact: {
        riskScore,
        riskyFiles,
        predictedErrorTypes
      }
    };
  }

  /**
   * Get blame information for a file and line
   */
  async getBlameInfo(file: string, line: number): Promise<BlameInfo | null> {
    try {
      const blame = await this.git.raw(['blame', '-L', `${line},${line}`, file]);
      const blameMatch = blame.match(/^(\w+)\s+.*?\((.*?)\s+(\d{4}-\d{2}-\d{2}.*?)\)\s+(.*)$/);
      
      if (!blameMatch) return null;

      const [, commit, author, dateStr, content] = blameMatch;
      
      return {
        file,
        line,
        blame: {
          commit: commit.trim(),
          author: author.trim(),
          date: new Date(dateStr.trim()),
          content: content.trim()
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Find commits that changed a specific file/line
   */
  async findCommitsForLocation(file: string, startLine?: number, endLine?: number): Promise<CommitInfo[]> {
    try {
      let logArgs = ['--follow', '--oneline'];
      
      if (startLine !== undefined) {
        const lineRange = endLine !== undefined ? `${startLine},${endLine}` : `${startLine}`;
        logArgs.push('-L', lineRange);
      }
      
      logArgs.push(file);
      
      const log = await this.git.log({
        file,
        maxCount: this.config.maxCommits
      });

      return await Promise.all(
        log.all.map(commit => this.getCommitInfo(commit.hash))
      ).then(commits => commits.filter(Boolean) as CommitInfo[]);
    } catch (error) {
      return [];
    }
  }

  /**
   * Analyze code complexity trends
   */
  async analyzeComplexityTrends(file: string, days: number = 30): Promise<{
    file: string;
    trend: Array<{
      date: Date;
      complexity: number;
      commit: string;
    }>;
    currentComplexity: number;
    averageComplexity: number;
    isIncreasing: boolean;
  }> {
    const commits = await this.findCommitsForLocation(file);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const recentCommits = commits.filter(commit => commit.date >= cutoffDate);
    const trend: Array<{ date: Date; complexity: number; commit: string }> = [];
    
    for (const commit of recentCommits) {
      const complexity = await this.calculateFileComplexity(file, commit.hash);
      trend.push({
        date: commit.date,
        complexity,
        commit: commit.hash
      });
    }
    
    trend.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    const currentComplexity = trend.length > 0 ? trend[trend.length - 1].complexity : 0;
    const averageComplexity = trend.length > 0 
      ? trend.reduce((sum, item) => sum + item.complexity, 0) / trend.length 
      : 0;
    
    const isIncreasing = trend.length >= 2 && 
      trend[trend.length - 1].complexity > trend[0].complexity;

    return {
      file,
      trend,
      currentComplexity,
      averageComplexity,
      isIncreasing
    };
  }

  // Private methods
  private async analyzeError(error: ErrorData): Promise<CodeInsight> {
    let commitsAnalyzed = 0;
    let filesAnalyzed = 0;

    // Find related commits
    const relatedCommits: CommitInfo[] = [];
    
    if (error.filename) {
      const commits = await this.findCommitsForLocation(error.filename, error.lineno);
      relatedCommits.push(...commits.slice(0, 10)); // Limit to recent commits
      commitsAnalyzed += commits.length;
      filesAnalyzed++;
    }

    // Get blame information
    let blameInfo: BlameInfo[] = [];
    if (this.config.includeBlame && error.filename && error.lineno) {
      const blame = await this.getBlameInfo(error.filename, error.lineno);
      if (blame) {
        blameInfo.push(blame);
      }
    }

    // Analyze recent changes
    const recentChanges = await this.analyzeRecentChanges(error);
    filesAnalyzed += recentChanges.length;

    // Risk assessment
    const riskAssessment = await this.assessRisk(error, relatedCommits, recentChanges);

    // Generate suggestions
    const suggestions = await this.generateSuggestions(error, relatedCommits, riskAssessment);

    return {
      error,
      relatedCommits,
      blameInfo,
      recentChanges,
      riskAssessment,
      suggestions,
      metadata: {
        analyzedAt: Date.now(),
        analysisDuration: 0, // Set by caller
        commitsAnalyzed,
        filesAnalyzed
      }
    };
  }

  private async getCommitInfo(hash: string): Promise<CommitInfo | null> {
    try {
      const show = await this.git.show([hash, '--stat', '--format=fuller']);
      const commit = await this.git.log(['-1', hash]);
      
      if (commit.all.length === 0) return null;
      
      const commitData = commit.all[0];
      
      // Parse stats from show output
      const statsMatch = show.match(/(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/);
      const stats = {
        filesChanged: statsMatch ? parseInt(statsMatch[1], 10) : 0,
        insertions: statsMatch && statsMatch[2] ? parseInt(statsMatch[2], 10) : 0,
        deletions: statsMatch && statsMatch[3] ? parseInt(statsMatch[3], 10) : 0
      };

      return {
        hash,
        message: commitData.message,
        author: {
          name: commitData.author_name,
          email: commitData.author_email
        },
        date: new Date(commitData.date),
        files: commitData.diff?.files?.map(f => f.file) || [],
        stats
      };
    } catch (error) {
      return null;
    }
  }

  private async analyzeRecentChanges(error: ErrorData): Promise<FileChangeInfo[]> {
    const changes: FileChangeInfo[] = [];
    
    if (!error.filename) return changes;

    try {
      // Get recent commits affecting the error file
      const log = await this.git.log({
        file: error.filename,
        maxCount: 10
      });

      for (const commit of log.all) {
        const diff = await this.git.diffSummary([`${commit.hash}^`, commit.hash]);
        
        for (const file of diff.files) {
          if (!this.shouldAnalyzeFile(file.file)) continue;
          
          const riskScore = await this.calculateFileRisk(file);
          
          changes.push({
            file: file.file,
            type: this.mapChangeType(file),
            linesChanged: ('insertions' in file ? (file.insertions ?? 0) : 0) + 
                         ('deletions' in file ? (file.deletions ?? 0) : 0),
            riskScore
          });
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return changes;
  }

  private async assessRisk(
    error: ErrorData,
    commits: CommitInfo[],
    changes: FileChangeInfo[]
  ): Promise<CodeInsight['riskAssessment']> {
    const factors: Array<{ name: string; score: number; description: string }> = [];
    
    // Recent activity factor
    const recentCommits = commits.filter(c => 
      Date.now() - c.date.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    
    if (recentCommits.length > 3) {
      factors.push({
        name: 'high_activity',
        score: 0.7,
        description: `High recent activity: ${recentCommits.length} commits in last 7 days`
      });
    }

    // File complexity factor
    if (error.filename) {
      const complexity = await this.calculateFileComplexity(error.filename);
      if (complexity > 20) {
        factors.push({
          name: 'high_complexity',
          score: 0.8,
          description: `High file complexity: ${complexity}`
        });
      }
    }

    // Large changes factor
    const largeChanges = changes.filter(c => c.linesChanged > 100);
    if (largeChanges.length > 0) {
      factors.push({
        name: 'large_changes',
        score: 0.6,
        description: `Large recent changes: ${largeChanges.length} files with >100 lines changed`
      });
    }

    // Error pattern factor
    if (error.message.includes('TypeError') || error.message.includes('undefined')) {
      factors.push({
        name: 'common_error_pattern',
        score: 0.4,
        description: 'Common error pattern that often indicates code quality issues'
      });
    }

    // Multiple authors factor
    const authors = new Set(commits.map(c => c.author.email));
    if (authors.size > 3) {
      factors.push({
        name: 'multiple_authors',
        score: 0.5,
        description: `Multiple authors working on same code: ${authors.size}`
      });
    }

    // Calculate overall risk
    const overallRisk = factors.length > 0
      ? factors.reduce((sum, factor) => sum + factor.score, 0) / factors.length
      : 0.1;

    return {
      overallRisk: Math.min(1, overallRisk),
      factors
    };
  }

  private async generateSuggestions(
    error: ErrorData,
    commits: CommitInfo[],
    riskAssessment: CodeInsight['riskAssessment']
  ): Promise<CodeInsight['suggestions']> {
    const suggestions: CodeInsight['suggestions'] = [];

    // High-risk code suggestions
    if (riskAssessment.overallRisk > 0.7) {
      suggestions.push({
        type: 'refactor',
        text: 'Consider refactoring this code area due to high risk score',
        priority: 4
      });
    }

    // Error type specific suggestions
    if (error.type === 'TypeError') {
      suggestions.push({
        type: 'fix',
        text: 'Add null/undefined checks to prevent TypeError',
        priority: 5
      });
    }

    if (error.message.includes('Cannot read property')) {
      suggestions.push({
        type: 'fix',
        text: 'Use optional chaining (?.) to safely access object properties',
        priority: 5
      });
    }

    // Recent changes suggestions
    if (commits.length > 5) {
      suggestions.push({
        type: 'test',
        text: 'Add comprehensive tests due to frequent changes in this area',
        priority: 3
      });
    }

    // Monitoring suggestions
    suggestions.push({
      type: 'monitoring',
      text: 'Add error tracking and alerts for this error pattern',
      priority: 2
    });

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  private async updateHotspots(error: ErrorData, insight: CodeInsight): Promise<void> {
    if (!error.filename) return;

    const key = `${error.filename}:${error.lineno || 0}`;
    let hotspot = this.hotspots.get(key);

    if (!hotspot) {
      hotspot = {
        file: error.filename,
        lineRange: { 
          start: error.lineno || 1, 
          end: error.lineno || 1 
        },
        errorCount: 0,
        commitCount: 0,
        score: 0,
        authors: []
      };
      this.hotspots.set(key, hotspot);
    }

    // Update hotspot data
    hotspot.errorCount++;
    hotspot.commitCount = insight.relatedCommits.length;
    
    // Update authors
    const authorMap = new Map<string, number>();
    insight.relatedCommits.forEach(commit => {
      const count = authorMap.get(commit.author.name) || 0;
      authorMap.set(commit.author.name, count + 1);
    });
    
    hotspot.authors = Array.from(authorMap.entries())
      .map(([name, commitCount]) => ({ name, commitCount }))
      .sort((a, b) => b.commitCount - a.commitCount);

    // Calculate hotspot score
    hotspot.score = this.calculateHotspotScore(hotspot);
  }

  private calculateHotspotScore(hotspot: CodeHotspot): number {
    // Score based on error frequency and commit activity
    const errorWeight = 0.6;
    const commitWeight = 0.4;
    
    const errorScore = Math.min(1, hotspot.errorCount / 10); // Normalize to 0-1
    const commitScore = Math.min(1, hotspot.commitCount / 20); // Normalize to 0-1
    
    return (errorScore * errorWeight) + (commitScore * commitWeight);
  }

  private async calculateCommitRisk(commit: CommitInfo): Promise<number> {
    let risk = 0;

    // Size factor
    if (commit.stats.filesChanged > 10) risk += 0.3;
    if (commit.stats.insertions + commit.stats.deletions > 500) risk += 0.3;

    // Message analysis
    const message = commit.message.toLowerCase();
    if (message.includes('fix') || message.includes('bug')) risk += 0.2;
    if (message.includes('refactor') || message.includes('rewrite')) risk += 0.4;
    if (message.includes('quick') || message.includes('hotfix')) risk += 0.5;

    return Math.min(1, risk);
  }

  private async analyzeFileRisks(files: string[]): Promise<Array<{
    file: string;
    risk: number;
    reasons: string[];
  }>> {
    const results: Array<{ file: string; risk: number; reasons: string[] }> = [];

    for (const file of files) {
      if (!this.shouldAnalyzeFile(file)) continue;

      const reasons: string[] = [];
      let risk = 0;

      // File type risk
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        risk += 0.2;
      }

      // Path risk
      if (file.includes('core/') || file.includes('lib/')) {
        risk += 0.3;
        reasons.push('Core/library file');
      }

      // Size risk (simplified)
      const complexity = await this.calculateFileComplexity(file);
      if (complexity > 20) {
        risk += 0.4;
        reasons.push('High complexity');
      }

      results.push({ file, risk: Math.min(1, risk), reasons });
    }

    return results.sort((a, b) => b.risk - a.risk);
  }

  private async predictErrorTypes(commit: CommitInfo): Promise<string[]> {
    const predictions: string[] = [];
    
    // Simple heuristic-based prediction
    const message = commit.message.toLowerCase();
    
    if (message.includes('null') || message.includes('undefined')) {
      predictions.push('TypeError');
      predictions.push('ReferenceError');
    }
    
    if (message.includes('async') || message.includes('promise')) {
      predictions.push('UnhandledPromiseRejectionWarning');
    }
    
    if (message.includes('api') || message.includes('request')) {
      predictions.push('NetworkError');
    }

    return predictions;
  }

  private async calculateFileComplexity(file: string, commit?: string): Promise<number> {
    try {
      // Simple complexity calculation based on file content
      const content = commit 
        ? await this.git.show([`${commit}:${file}`])
        : await this.git.raw(['show', `HEAD:${file}`]);

      // Count complexity indicators
      let complexity = 0;
      complexity += (content.match(/if\s*\(/g) || []).length;
      complexity += (content.match(/for\s*\(/g) || []).length;
      complexity += (content.match(/while\s*\(/g) || []).length;
      complexity += (content.match(/switch\s*\(/g) || []).length;
      complexity += (content.match(/catch\s*\(/g) || []).length;
      complexity += (content.match(/function\s+/g) || []).length;
      complexity += (content.match(/=>\s*{/g) || []).length;

      return complexity;
    } catch (error) {
      return 0;
    }
  }

  private async calculateFileRisk(file: any): Promise<number> {
    let risk = 0;
    
    // Change size risk
    const totalChanges = ('insertions' in file ? (file.insertions ?? 0) : 0) + 
                         ('deletions' in file ? (file.deletions ?? 0) : 0);
    if (totalChanges > 100) risk += 0.4;
    else if (totalChanges > 50) risk += 0.2;
    
    // File type risk
    if (this.isHighRiskFile(file.file)) risk += 0.3;
    
    // Binary/minified file risk
    if (file.binary) risk += 0.8;
    
    return Math.min(1, risk);
  }

  private mapChangeType(file: any): 'added' | 'modified' | 'deleted' | 'renamed' {
    const insertions = 'insertions' in file ? (file.insertions ?? 0) : 0;
    const deletions = 'deletions' in file ? (file.deletions ?? 0) : 0;
    if (insertions > 0 && deletions === 0) return 'added';
    if (insertions === 0 && deletions > 0) return 'deleted';
    if (file.file !== file.from) return 'renamed';
    return 'modified';
  }

  private shouldAnalyzeFile(file: string): boolean {
    // Check file extension
    const hasValidExtension = this.config.fileExtensions.some(ext => 
      file.endsWith(ext)
    );
    
    if (!hasValidExtension) return false;

    // Check excluded directories
    const isExcluded = this.config.excludeDirectories.some(dir => 
      file.includes(`${dir}/`) || file.startsWith(`${dir}/`)
    );
    
    return !isExcluded;
  }

  private isHighRiskFile(file: string): boolean {
    const highRiskPatterns = [
      /\/core\//,
      /\/lib\//,
      /\/utils\//,
      /\/config\//,
      /index\./,
      /main\./,
      /app\./
    ];

    return highRiskPatterns.some(pattern => pattern.test(file));
  }

  private getCachedInsight(errorId: string): CodeInsight | null {
    const cached = this.cache.get(errorId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(errorId);
      return null;
    }

    return cached.insight;
  }

  private cacheInsight(errorId: string, insight: CodeInsight): void {
    const entry: CacheEntry = {
      key: errorId,
      insight,
      timestamp: Date.now(),
      ttl: this.config.cacheTtl
    };

    this.cache.set(errorId, entry);

    // Limit cache size
    if (this.cache.size > 1000) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.cache.delete(oldest[0]);
    }
  }

  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }
}

export default CodeInsights;