import * as crypto from 'crypto';
import { promisify } from 'util';
import { SecuritySeverity, SecurityEventType, GeoLocation } from '../types';

/**
 * Cryptographic utilities for security operations
 */
export class CryptoUtils {
  /**
   * Generate a secure random hash
   */
  static generateHash(data: string, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Generate HMAC signature
   */
  static generateHMAC(data: string, secret: string, algorithm: string = 'sha256'): string {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }

  /**
   * Encrypt data using AES
   */
  static encrypt(text: string, key: string): { encrypted: string; iv: string } {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt data using AES
   */
  static decrypt(encryptedData: { encrypted: string; iv: string }, key: string): string {
    const algorithm = 'aes-256-cbc';
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generate secure random UUID
   */
  static generateSecureId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate blockchain-ready hash chain
   */
  static generateBlockchainHash(data: string, previousHash?: string): string {
    const input = previousHash ? `${previousHash}${data}` : data;
    return this.generateHash(input, 'sha256');
  }
}

/**
 * IP address utilities
 */
export class IPUtils {
  private static readonly privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^127\./,
    /^169\.254\./,
    /^fe80:/i,
    /^::1$/,
    /^fc00:/i,
    /^fd00:/i
  ];

  /**
   * Check if IP address is private
   */
  static isPrivateIP(ip: string): boolean {
    return this.privateRanges.some(range => range.test(ip));
  }

  /**
   * Check if IP address is valid
   */
  static isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Get IP address class (A, B, C)
   */
  static getIPClass(ip: string): string {
    if (!this.isValidIP(ip)) return 'invalid';
    
    const firstOctet = parseInt(ip.split('.')[0]);
    if (firstOctet >= 1 && firstOctet <= 126) return 'A';
    if (firstOctet >= 128 && firstOctet <= 191) return 'B';
    if (firstOctet >= 192 && firstOctet <= 223) return 'C';
    if (firstOctet >= 224 && firstOctet <= 239) return 'D';
    return 'E';
  }

  /**
   * Calculate IP distance (simplified geographical distance)
   */
  static calculateIPDistance(ip1: string, ip2: string): number {
    // Simplified implementation - in reality would use GeoIP database
    const int1 = this.ipToInt(ip1);
    const int2 = this.ipToInt(ip2);
    return Math.abs(int1 - int2);
  }

  private static ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
}

/**
 * Pattern matching utilities for threat detection
 */
export class PatternUtils {
  private static readonly commonAttackPatterns = {
    sqlInjection: [
      /('|\\')|(;)|(\-\-)|(\s+(or|and)\s+)/i,
      /union\s+select/i,
      /information_schema/i,
      /drop\s+table/i
    ],
    xss: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on(load|error|click|mouseover|focus)=/i,
      /<iframe[^>]*>/gi
    ],
    commandInjection: [
      /;|\||&|`|\$\(|\${/,
      /\b(cat|ls|pwd|id|whoami|uname)\b/i,
      /\.\.\/|\.\.\\|\/etc\/passwd/i
    ],
    pathTraversal: [
      /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/i,
      /\/etc\/passwd|\/etc\/shadow|\/etc\/hosts/i,
      /windows\\system32/i
    ]
  };

  /**
   * Check if input matches attack patterns
   */
  static checkForAttackPatterns(input: string): { 
    isMatch: boolean; 
    patterns: string[]; 
    confidence: number;
  } {
    const matches: string[] = [];
    let confidence = 0;

    for (const [attackType, patterns] of Object.entries(this.commonAttackPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          matches.push(attackType);
          confidence += 0.2;
          break; // One match per attack type
        }
      }
    }

    return {
      isMatch: matches.length > 0,
      patterns: matches,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Calculate string entropy (useful for detecting encoded/encrypted content)
   */
  static calculateEntropy(str: string): number {
    const frequencies = new Map<string, number>();
    
    // Count character frequencies
    for (const char of str) {
      frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }
    
    // Calculate Shannon entropy
    let entropy = 0;
    const length = str.length;
    
    for (const count of frequencies.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  }

  /**
   * Detect suspicious user agent patterns
   */
  static isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|httpie/i,
      /python|java|perl|ruby/i,
      /^$/,  // Empty user agent
      /.{300,}/,  // Extremely long user agent
      /[<>{}]/   // Contains HTML/script characters
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }
}

/**
 * Statistical utilities for anomaly detection
 */
export class StatsUtils {
  /**
   * Calculate Z-score for anomaly detection
   */
  static calculateZScore(value: number, mean: number, standardDeviation: number): number {
    if (standardDeviation === 0) return 0;
    return (value - mean) / standardDeviation;
  }

  /**
   * Calculate mean of array
   */
  static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Detect outliers using IQR method
   */
  static detectOutliers(values: number[]): { outliers: number[]; threshold: { lower: number; upper: number } } {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    
    const lowerThreshold = q1 - 1.5 * iqr;
    const upperThreshold = q3 + 1.5 * iqr;
    
    const outliers = values.filter(value => value < lowerThreshold || value > upperThreshold);
    
    return {
      outliers,
      threshold: { lower: lowerThreshold, upper: upperThreshold }
    };
  }

  /**
   * Calculate percentile
   */
  static percentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate moving average
   */
  static movingAverage(values: number[], window: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const end = i + 1;
      const slice = values.slice(start, end);
      result.push(this.mean(slice));
    }
    
    return result;
  }
}

/**
 * Time-based utilities
 */
export class TimeUtils {
  /**
   * Check if timestamp is within business hours
   */
  static isBusinessHours(timestamp: Date, timezone: string = 'UTC'): boolean {
    const hour = timestamp.getHours();
    return hour >= 9 && hour <= 17; // 9 AM to 5 PM
  }

  /**
   * Check if timestamp is on weekend
   */
  static isWeekend(timestamp: Date): boolean {
    const day = timestamp.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Calculate time difference in milliseconds
   */
  static timeDiff(start: Date, end: Date): number {
    return end.getTime() - start.getTime();
  }

  /**
   * Format duration in human readable format
   */
  static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Get time bucket for aggregation
   */
  static getTimeBucket(timestamp: Date, bucketSize: number): Date {
    const bucketMs = bucketSize * 1000;
    const time = timestamp.getTime();
    const bucketTime = Math.floor(time / bucketMs) * bucketMs;
    return new Date(bucketTime);
  }
}

/**
 * Geolocation utilities
 */
export class GeoUtils {
  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if location change is suspicious
   */
  static isSuspiciousLocationChange(
    prevLocation: GeoLocation,
    currentLocation: GeoLocation,
    timeDiffMs: number
  ): { isSuspicious: boolean; reason?: string } {
    if (!prevLocation.latitude || !prevLocation.longitude || 
        !currentLocation.latitude || !currentLocation.longitude) {
      return { isSuspicious: false };
    }

    const distance = this.calculateDistance(
      prevLocation.latitude,
      prevLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    // Calculate maximum possible travel distance
    const maxSpeed = 1000; // km/h (commercial aircraft)
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    const maxDistance = maxSpeed * timeDiffHours;

    if (distance > maxDistance) {
      return {
        isSuspicious: true,
        reason: `Impossible travel: ${distance.toFixed(2)}km in ${TimeUtils.formatDuration(timeDiffMs)}`
      };
    }

    // Check for different countries in short time
    if (distance > 100 && timeDiffMs < 30 * 60 * 1000) { // 100km in 30 minutes
      return {
        isSuspicious: true,
        reason: 'Rapid geographical change'
      };
    }

    return { isSuspicious: false };
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimitUtils {
  /**
   * Check if request exceeds rate limit using sliding window
   */
  static checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
    requests: Map<string, number[]>
  ): { allowed: boolean; resetTime: Date } {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get existing requests for this key
    const keyRequests = requests.get(key) || [];
    
    // Remove old requests outside window
    const validRequests = keyRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    const allowed = validRequests.length < limit;
    
    if (allowed) {
      validRequests.push(now);
      requests.set(key, validRequests);
    }
    
    const resetTime = new Date(now + windowMs);
    
    return { allowed, resetTime };
  }

  /**
   * Calculate current rate
   */
  static calculateRate(timestamps: number[], windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    const validRequests = timestamps.filter(timestamp => timestamp > windowStart);
    return validRequests.length / (windowMs / 1000); // requests per second
  }
}

/**
 * Security scoring utilities
 */
export class ScoringUtils {
  /**
   * Calculate weighted score
   */
  static calculateWeightedScore(factors: Array<{ value: number; weight: number }>): number {
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const weightedSum = factors.reduce((sum, factor) => sum + (factor.value * factor.weight), 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Map severity to numeric score
   */
  static severityToScore(severity: SecuritySeverity): number {
    const scores = {
      [SecuritySeverity.LOW]: 0.25,
      [SecuritySeverity.MEDIUM]: 0.5,
      [SecuritySeverity.HIGH]: 0.75,
      [SecuritySeverity.CRITICAL]: 1.0
    };
    return scores[severity] || 0;
  }

  /**
   * Calculate risk score based on multiple factors
   */
  static calculateRiskScore(
    threatCount: number,
    vulnerabilityCount: number,
    complianceScore: number,
    anomalyCount: number
  ): number {
    // Normalize factors to 0-1 scale
    const normalizedThreats = Math.min(threatCount / 100, 1);
    const normalizedVulns = Math.min(vulnerabilityCount / 50, 1);
    const normalizedCompliance = 1 - (complianceScore / 100);
    const normalizedAnomalies = Math.min(anomalyCount / 20, 1);
    
    // Calculate weighted risk score
    return this.calculateWeightedScore([
      { value: normalizedThreats, weight: 0.3 },
      { value: normalizedVulns, weight: 0.25 },
      { value: normalizedCompliance, weight: 0.25 },
      { value: normalizedAnomalies, weight: 0.2 }
    ]) * 100;
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Sanitize input string
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[\\\/]/g, '') // Remove slashes
      .trim();
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for dangerous file extensions
   */
  static isDangerousFile(filename: string): boolean {
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs',
      '.js', '.jar', '.php', '.asp', '.aspx', '.jsp'
    ];
    
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return dangerousExtensions.includes(extension);
  }
}

// Export all utilities as default
export default {
  CryptoUtils,
  IPUtils,
  PatternUtils,
  StatsUtils,
  TimeUtils,
  GeoUtils,
  RateLimitUtils,
  ScoringUtils,
  ValidationUtils
};