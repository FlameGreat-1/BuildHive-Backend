import winston from 'winston';
import { environment } from '../../config/auth';

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
];

if (environment.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat
    })
  );
}

export const logger = winston.createLogger({
  level: environment.LOG_LEVEL,
  format: logFormat,
  transports,
  exitOnError: false
});

export const logRegistrationAttempt = (
  email: string,
  authProvider: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Registration attempt', {
    email,
    authProvider,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logRegistrationError = (
  email: string,
  error: string,
  requestId: string
): void => {
  logger.error('Registration failed', {
    email,
    error,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logEmailVerification = (
  email: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Email verification attempt', {
    email,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobCreation = (
  tradieId: number,
  jobId: number,
  jobTitle: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Job creation attempt', {
    tradieId,
    jobId,
    jobTitle,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobUpdate = (
  tradieId: number,
  jobId: number,
  updateFields: string[],
  success: boolean,
  requestId: string
): void => {
  logger.info('Job update attempt', {
    tradieId,
    jobId,
    updateFields,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobDeletion = (
  tradieId: number,
  jobId: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Job deletion attempt', {
    tradieId,
    jobId,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobStatusChange = (
  tradieId: number,
  jobId: number,
  fromStatus: string,
  toStatus: string,
  requestId: string
): void => {
  logger.info('Job status change', {
    tradieId,
    jobId,
    fromStatus,
    toStatus,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logClientCreation = (
  tradieId: number,
  clientId: number,
  clientEmail: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Client creation attempt', {
    tradieId,
    clientId,
    clientEmail,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMaterialUpdate = (
  tradieId: number,
  jobId: number,
  materialCount: number,
  totalCost: number,
  requestId: string
): void => {
  logger.info('Material update', {
    tradieId,
    jobId,
    materialCount,
    totalCost,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logFileUpload = (
  tradieId: number,
  jobId: number,
  filename: string,
  fileSize: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('File upload attempt', {
    tradieId,
    jobId,
    filename,
    fileSize,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobError = (
  tradieId: number,
  jobId: number | null,
  operation: string,
  error: string,
  requestId: string
): void => {
  logger.error('Job operation failed', {
    tradieId,
    jobId,
    operation,
    error,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteCreation = (
  tradieId: number,
  quoteId: number,
  quoteNumber: string,
  clientId: number,
  totalAmount: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Quote creation attempt', {
    tradieId,
    quoteId,
    quoteNumber,
    clientId,
    totalAmount,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteUpdate = (
  tradieId: number,
  quoteId: number,
  quoteNumber: string,
  updateFields: string[],
  success: boolean,
  requestId: string
): void => {
  logger.info('Quote update attempt', {
    tradieId,
    quoteId,
    quoteNumber,
    updateFields,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteStatusChange = (
  tradieId: number,
  quoteId: number,
  quoteNumber: string,
  fromStatus: string,
  toStatus: string,
  requestId: string
): void => {
  logger.info('Quote status change', {
    tradieId,
    quoteId,
    quoteNumber,
    fromStatus,
    toStatus,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteSent = (
  tradieId: number,
  quoteId: number,
  quoteNumber: string,
  clientId: number,
  deliveryMethods: string[],
  success: boolean,
  requestId: string
): void => {
  logger.info('Quote sent attempt', {
    tradieId,
    quoteId,
    quoteNumber,
    clientId,
    deliveryMethods,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteViewed = (
  quoteId: number,
  quoteNumber: string,
  clientId: number,
  viewedAt: string,
  requestId: string
): void => {
  logger.info('Quote viewed', {
    quoteId,
    quoteNumber,
    clientId,
    viewedAt,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteAccepted = (
  tradieId: number,
  quoteId: number,
  quoteNumber: string,
  clientId: number,
  totalAmount: number,
  requestId: string
): void => {
  logger.info('Quote accepted', {
    tradieId,
    quoteId,
    quoteNumber,
    clientId,
    totalAmount,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteRejected = (
  tradieId: number,
  quoteId: number,
  quoteNumber: string,
  clientId: number,
  reason: string,
  requestId: string
): void => {
  logger.info('Quote rejected', {
    tradieId,
    quoteId,
    quoteNumber,
    clientId,
    reason,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteDeletion = (
  tradieId: number,
  quoteId: number,
  quoteNumber: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Quote deletion attempt', {
    tradieId,
    quoteId,
    quoteNumber,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logAIPricingRequest = (
  tradieId: number,
  jobType: string,
  estimatedDuration: number,
  suggestedTotal: number,
  confidence: number,
  requestId: string
): void => {
  logger.info('AI pricing request', {
    tradieId,
    jobType,
    estimatedDuration,
    suggestedTotal,
    confidence,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logQuoteError = (
  tradieId: number,
  quoteId: number | null,
  operation: string,
  error: string,
  requestId: string
): void => {
  logger.error('Quote operation failed', {
    tradieId,
    quoteId,
    operation,
    error,
    requestId,
    timestamp: new Date().toISOString()
  });
};
