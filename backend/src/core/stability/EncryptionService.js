/**
 * EncryptionService - PHASE 4 (AUDITED & CORRECTED)
 * AES-256-GCM encryption for API keys at rest
 * Authenticated encryption with proper key validation
 */

import crypto from 'crypto';
import logger from '../../utils/logger.js';

class EncryptionService {
  constructor() {
    // Load and validate encryption key from environment
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    
    if (!this.encryptionKey) {
      logger.error('ENCRYPTION_KEY not set in environment - FAILING FAST');
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Validate key format and length
    if (!/^[0-9a-f]{64}$/i.test(this.encryptionKey)) {
      logger.error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
      throw new Error('Invalid ENCRYPTION_KEY format');
    }

    // Ensure key is 32 bytes for AES-256
    this.keyBuffer = Buffer.from(this.encryptionKey, 'hex');
    
    if (this.keyBuffer.length !== 32) {
      logger.error('ENCRYPTION_KEY must be exactly 32 bytes');
      throw new Error('Invalid ENCRYPTION_KEY length');
    }
    
    this.algorithm = 'aes-256-gcm'; // Authenticated encryption
    this.ivLength = 12; // GCM recommended IV length
    this.authTagLength = 16; // GCM auth tag length
    
    logger.info('EncryptionService initialized with AES-256-GCM');
  }

  /**
   * Encrypt a string (API key) using AES-256-GCM
   */
  encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Invalid plaintext for encryption');
    }

    let iv, encrypted, authTag;
    
    try {
      // Generate random IV for each encryption
      iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.keyBuffer, iv);
      
      // Encrypt
      encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      authTag = cipher.getAuthTag();
      
      // Return IV:AuthTag:EncryptedData (all hex-encoded)
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
    } finally {
      // Secure zeroing of sensitive buffers
      if (iv) iv.fill(0);
      if (encrypted) encrypted.fill(0);
      if (authTag) authTag.fill(0);
    }
  }

  /**
   * Decrypt a string (API key) using AES-256-GCM
   */
  decrypt(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'string') {
      throw new Error('Invalid ciphertext for decryption');
    }

    let iv, authTag, encrypted, decrypted;
    
    try {
      // Split IV:AuthTag:EncryptedData
      const parts = ciphertext.split(':');
      
      // Check format (GCM has 3 parts, CBC has 2)
      if (parts.length === 3) {
        // New GCM format
        iv = Buffer.from(parts[0], 'hex');
        authTag = Buffer.from(parts[1], 'hex');
        encrypted = Buffer.from(parts[2], 'hex');
        
        // Create decipher
        const decipher = crypto.createDecipheriv(this.algorithm, this.keyBuffer, iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt
        decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final()
        ]);
        
        return decrypted.toString('utf8');
      } else if (parts.length === 2) {
        // Legacy CBC format - backward compatibility
        logger.warn('Decrypting legacy CBC format - should be migrated to GCM');
        iv = Buffer.from(parts[0], 'hex');
        encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.keyBuffer, iv);
        let result = decipher.update(encrypted, 'hex', 'utf8');
        result += decipher.final('utf8');
        
        return result;
      } else {
        throw new Error('Invalid ciphertext format');
      }
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Decryption failed');
    } finally {
      // Secure zeroing of sensitive buffers
      if (iv) iv.fill(0);
      if (authTag) authTag.fill(0);
      if (encrypted && Buffer.isBuffer(encrypted)) encrypted.fill(0);
      if (decrypted) decrypted.fill(0);
    }
  }

  /**
   * Check if a string is encrypted (has IV:AuthTag:Data or IV:Data format)
   */
  isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    
    // Encrypted format: hex_iv:hex_authtag:hex_data (GCM) or hex_iv:hex_data (CBC)
    const parts = value.split(':');
    if (parts.length !== 2 && parts.length !== 3) return false;
    
    // Check if all parts are valid hex
    const hexRegex = /^[0-9a-f]+$/i;
    return parts.every(part => hexRegex.test(part)) && 
           (parts[0].length === 24 || parts[0].length === 32); // GCM IV=12 bytes or CBC IV=16 bytes
  }

  /**
   * Encrypt API key if not already encrypted (migration-safe)
   */
  encryptIfNeeded(apiKey) {
    if (!apiKey) return null;
    
    if (this.isEncrypted(apiKey)) {
      return apiKey; // Already encrypted
    }
    
    // Encrypt plaintext key
    logger.info('Encrypting plaintext API key with AES-256-GCM');
    return this.encrypt(apiKey);
  }

  /**
   * Decrypt API key for runtime use
   * Never log decrypted keys
   */
  decryptForUse(encryptedKey) {
    if (!encryptedKey) return null;
    
    if (!this.isEncrypted(encryptedKey)) {
      // Backward compatibility: if not encrypted, return as-is
      logger.warn('API key not encrypted, returning plaintext (SECURITY RISK - should be migrated)');
      return encryptedKey;
    }
    
    return this.decrypt(encryptedKey);
  }

  /**
   * Securely compare two strings (constant-time to prevent timing attacks)
   */
  secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

export default new EncryptionService();
