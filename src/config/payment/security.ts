import crypto from 'crypto';

export const PAYMENT_SECURITY = {
  WEBHOOK: {
    SIGNATURE_HEADER: 'stripe-signature',
    TOLERANCE_SECONDS: 300,
    ALGORITHM: 'sha256'
  },
  
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    TAG_LENGTH: 16
  },

  PAYMENT_LINK: {
    EXPIRY_HOURS: 24,
    TOKEN_LENGTH: 32
  }
};

export const generateWebhookSecret = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const elements = signature.split(',');
  const signatureHash = elements.find(element => element.startsWith('v1='));
  
  if (!signatureHash) {
    return false;
  }

  const expectedSignature = signatureHash.split('=')[1];
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(computedSignature, 'hex')
  );
};

export const generatePaymentToken = (): string => {
  return crypto.randomBytes(PAYMENT_SECURITY.PAYMENT_LINK.TOKEN_LENGTH).toString('hex');
};

export const encryptSensitiveData = (data: string, key: string): {
  encrypted: string;
  iv: string;
  tag: string;
} => {
  const iv = crypto.randomBytes(PAYMENT_SECURITY.ENCRYPTION.IV_LENGTH);
  const cipher = crypto.createCipher(PAYMENT_SECURITY.ENCRYPTION.ALGORITHM, key);
  cipher.setAAD(Buffer.from('payment-data'));
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
};

export const decryptSensitiveData = (
  encryptedData: string,
  key: string,
  iv: string,
  tag: string
): string => {
  const decipher = crypto.createDecipher(PAYMENT_SECURITY.ENCRYPTION.ALGORITHM, key);
  decipher.setAAD(Buffer.from('payment-data'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

export const validatePaymentAmount = (amount: number, currency: string): boolean => {
  const minAmount = currency === 'USD' ? 50 : 50;
  const maxAmount = currency === 'USD' ? 10000000 : 10000000;
  
  return amount >= minAmount && amount <= maxAmount && Number.isInteger(amount);
};

export const sanitizePaymentMetadata = (metadata: Record<string, any>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  
  Object.keys(metadata).forEach(key => {
    if (typeof metadata[key] === 'string' || typeof metadata[key] === 'number') {
      sanitized[key] = String(metadata[key]).substring(0, 500);
    }
  });
  
  return sanitized;
};
