import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const key = process.env.REPORT_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      'Invalid REPORT_ENCRYPTION_KEY configuration'
    );
  }

  return Buffer.from(key, 'hex');
}

// Encrypt confidential medical information
export function encryptData(data) {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv
  );

  const plaintext = JSON.stringify(data);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  return {
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    encryptedData: encrypted.toString('hex')
  };
}

// Decrypt authorized medical information
export function decryptData(data) {
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(data.iv, 'hex')
  );

  decipher.setAuthTag(
    Buffer.from(data.authTag, 'hex')
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(data.encryptedData, 'hex')
    ),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}