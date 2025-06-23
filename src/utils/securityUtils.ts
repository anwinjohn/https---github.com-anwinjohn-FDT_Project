import CryptoJS from 'crypto-js';

export class SecurityUtils {
  /**
   * Generate a cryptographically secure random string
   */
  static generateSecureRandom(length: number): string {
    return CryptoJS.lib.WordArray.random(length / 2).toString();
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Validate timestamp to prevent replay attacks
   */
  static isValidTimestamp(timestamp: string, maxAge: number = 300): boolean {
    try {
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      return Math.abs(currentTime - requestTime) <= maxAge;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  /**
   * Validate JWT structure without verification
   */
  static isValidJWTStructure(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Try to decode each part
      atob(parts[0]); // header
      atob(parts[1]); // payload
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract JWT payload without verification (for client-side checks only)
   */
  static extractJWTPayload(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  }

  /**
   * Check if JWT is expired (client-side check only)
   */
  static isJWTExpired(token: string, bufferSeconds: number = 30): boolean {
    try {
      const payload = this.extractJWTPayload(token);
      if (!payload || !payload.exp) return true;
      
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < (currentTime + bufferSeconds);
    } catch {
      return true;
    }
  }

  /**
   * Generate a secure hash for client-side operations
   */
  static generateHash(data: string, salt?: string): string {
    const saltToUse = salt || CryptoJS.lib.WordArray.random(128/8).toString();
    return CryptoJS.SHA256(data + saltToUse).toString();
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Password must be at least 8 characters long');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Password must contain lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Password must contain uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Password must contain numbers');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('Password must contain special characters');

    return {
      isValid: score >= 4,
      score,
      feedback
    };
  }

  /**
   * Rate limiting helper for client-side
   */
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests: number[] = [];
    
    return {
      isAllowed(): boolean {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Remove old requests
        while (requests.length > 0 && requests[0] < windowStart) {
          requests.shift();
        }
        
        if (requests.length >= maxRequests) {
          return false;
        }
        
        requests.push(now);
        return true;
      },
      
      getRemainingRequests(): number {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Count valid requests
        const validRequests = requests.filter(time => time >= windowStart);
        return Math.max(0, maxRequests - validRequests.length);
      }
    };
  }
}

export default SecurityUtils;