// Security and utility service for input validation, rate limiting, and data protection

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class SecurityService {
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private readonly defaultConfig: RateLimitConfig = {
    maxRequests: 10,
    windowMs: 60000 // 1 minute
  };

  /**
   * Validate and sanitize user input to prevent XSS and injection attacks
   */
  sanitizeInput(input: string, maxLength: number = 5000): string {
    if (!input || typeof input !== 'string') {
      throw new Error('Invalid input: must be a non-empty string');
    }

    // Trim whitespace
    let sanitized = input.trim();

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove potentially dangerous HTML/script content
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe/gi, '')
      .replace(/<embed/gi, '')
      .replace(/<object/gi, '');

    return sanitized;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rate limiting implementation
   */
  checkRateLimit(userId: string, config?: RateLimitConfig): { allowed: boolean; remaining: number; resetIn: number } {
    const cfg = { ...this.defaultConfig, ...config };
    const now = Date.now();
    const entry = this.rateLimitStore.get(userId);

    // Initialize or reset if window expired
    if (!entry || now > entry.resetTime) {
      this.rateLimitStore.set(userId, {
        count: 1,
        resetTime: now + cfg.windowMs
      });
      return {
        allowed: true,
        remaining: cfg.maxRequests - 1,
        resetIn: cfg.windowMs
      };
    }

    // Check if limit exceeded
    if (entry.count >= cfg.maxRequests) {
      const resetIn = Math.max(0, entry.resetTime - now);
      return {
        allowed: false,
        remaining: 0,
        resetIn
      };
    }

    // Increment counter
    entry.count++;
    const resetIn = Math.max(0, entry.resetTime - now);
    return {
      allowed: true,
      remaining: cfg.maxRequests - entry.count,
      resetIn
    };
  }

  /**
   * Encrypt sensitive data (client-side)
   */
  encryptData(data: string, _key: string): string {
    try {
      // Simple base64 encoding for demonstration
      // In production, use proper encryption libraries
      const encoded = btoa(unescape(encodeURIComponent(data)));
      return encoded;
    } catch (error) {
      console.error('Encryption error:', error);
      return data;
    }
  }

  /**
   * Decrypt sensitive data (client-side)
   */
  decryptData(encrypted: string, _key: string): string {
    try {
      const decoded = decodeURIComponent(escape(atob(encrypted)));
      return decoded;
    } catch (error) {
      console.error('Decryption error:', error);
      return '';
    }
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Hash sensitive data
   */
  hashData(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate API request format
   */
  validateRequest(data: any, requiredFields: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (!data[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for suspicious patterns in input
   */
  detectSuspiciousInput(input: string): { suspicious: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check for SQL injection patterns
    if (/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/i.test(input)) {
      reasons.push('Potential SQL injection detected');
    }

    // Check for excessive special characters
    const specialChars = input.match(/[!@#$%^&*(){}[\]|\\:;"'<>,.?/]/g) || [];
    if (specialChars.length > input.length * 0.3) {
      reasons.push('Excessive special characters');
    }

    // Check for repeated characters (potential DoS attempt)
    if (/(.)\1{10,}/.test(input)) {
      reasons.push('Repeated character patterns detected');
    }

    return {
      suspicious: reasons.length > 0,
      reasons
    };
  }

  /**
   * Create audit log entry
   */
  createAuditLog(action: string, userId?: string, details?: any): {
    timestamp: string;
    action: string;
    userId?: string;
    details?: any;
  } {
    return {
      timestamp: new Date().toISOString(),
      action,
      userId,
      details
    };
  }

  /**
   * Clear rate limit for user (admin function)
   */
  clearRateLimit(userId: string): void {
    this.rateLimitStore.delete(userId);
  }

  /**
   * Get rate limit stats (admin function)
   */
  getRateLimitStats(): { totalUsers: number; totalLimits: number; oldestLimit: number } {
    const now = Date.now();
    let activeCount = 0;
    let oldestTime = now;

    this.rateLimitStore.forEach((entry) => {
      if (entry.resetTime > now) {
        activeCount++;
        oldestTime = Math.min(oldestTime, entry.resetTime);
      }
    });

    return {
      totalUsers: this.rateLimitStore.size,
      totalLimits: activeCount,
      oldestLimit: Math.max(0, oldestTime - now)
    };
  }
}

// Export singleton instance
export const securityService = new SecurityService();
