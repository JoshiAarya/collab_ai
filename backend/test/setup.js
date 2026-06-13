// Runs before each test file is imported — required env must exist before
// modules like config and EncryptionService load.
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LOG_LEVEL = 'error';
