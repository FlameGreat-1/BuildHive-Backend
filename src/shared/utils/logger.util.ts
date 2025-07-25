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

export const logPaymentAttempt = (
  userId: number,
  paymentId: number,
  amount: number,
  currency: string,
  paymentMethod: string,
  paymentType: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Payment attempt', {
    userId,
    paymentId,
    amount,
    currency,
    paymentMethod,
    paymentType,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logPaymentStatusChange = (
  userId: number,
  paymentId: number,
  fromStatus: string,
  toStatus: string,
  requestId: string
): void => {
  logger.info('Payment status change', {
    userId,
    paymentId,
    fromStatus,
    toStatus,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logStripeWebhook = (
  eventId: string,
  eventType: string,
  processed: boolean,
  requestId: string
): void => {
  logger.info('Stripe webhook received', {
    eventId,
    eventType,
    processed,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logCreditTransaction = (
  userId: number,
  transactionId: number,
  transactionType: string,
  credits: number,
  status: string,
  paymentId: number | null,
  referenceId: number | null,
  referenceType: string | null,
  requestId: string
): void => {
  logger.info('Credit transaction', {
    userId,
    transactionId,
    transactionType,
    credits,
    status,
    paymentId,
    referenceId,
    referenceType,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logSubscriptionChange = (
  userId: number,
  subscriptionId: number,
  plan: string,
  fromStatus: string,
  toStatus: string,
  requestId: string
): void => {
  logger.info('Subscription status change', {
    userId,
    subscriptionId,
    plan,
    fromStatus,
    toStatus,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logRefundRequest = (
  userId: number,
  paymentId: number,
  refundId: number,
  amount: number,
  reason: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Refund request', {
    userId,
    paymentId,
    refundId,
    amount,
    reason,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logInvoiceCreation = (
  userId: number,
  invoiceId: number,
  invoiceNumber: string,
  amount: number,
  quoteId: number | null,
  success: boolean,
  requestId: string
): void => {
  logger.info('Invoice creation attempt', {
    userId,
    invoiceId,
    invoiceNumber,
    amount,
    quoteId,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logPaymentMethodAdded = (
  userId: number,
  paymentMethodId: number,
  type: string,
  isDefault: boolean,
  success: boolean,
  requestId: string
): void => {
  logger.info('Payment method added', {
    userId,
    paymentMethodId,
    type,
    isDefault,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logPaymentError = (
  userId: number,
  paymentId: number | null,
  operation: string,
  error: string,
  requestId: string
): void => {
  logger.error('Payment operation failed', {
    userId,
    paymentId,
    operation,
    error,
    requestId,
    timestamp: new Date().toISOString()
  });
};


export const logCreditPurchase = (
  userId: number,
  purchaseId: number,
  packageType: string,
  creditsAmount: number,
  bonusCredits: number,
  purchasePrice: number,
  paymentId: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Credit purchase attempt', {
    userId,
    purchaseId,
    packageType,
    creditsAmount,
    bonusCredits,
    purchasePrice,
    paymentId,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logCreditUsage = (
  userId: number,
  usageId: number,
  usageType: string,
  creditsUsed: number,
  remainingBalance: number,
  referenceId: number | null,
  referenceType: string | null,
  success: boolean,
  requestId: string
): void => {
  logger.info('Credit usage attempt', {
    userId,
    usageId,
    usageType,
    creditsUsed,
    remainingBalance,
    referenceId,
    referenceType,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logCreditRefund = (
  userId: number,
  transactionId: number,
  creditsRefunded: number,
  reason: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Credit refund attempt', {
    userId,
    transactionId,
    creditsRefunded,
    reason,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logAutoTopup = (
  userId: number,
  topupId: number,
  triggerBalance: number,
  topupAmount: number,
  packageType: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Auto topup triggered', {
    userId,
    topupId,
    triggerBalance,
    topupAmount,
    packageType,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logCreditBalanceAlert = (
  userId: number,
  currentBalance: number,
  threshold: number,
  alertType: string,
  notificationSent: boolean,
  requestId: string
): void => {
  logger.info('Credit balance alert', {
    userId,
    currentBalance,
    threshold,
    alertType,
    notificationSent,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobApplicationCredit = (
  userId: number,
  jobId: number,
  applicationId: number,
  creditsUsed: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Job application credit usage', {
    userId,
    jobId,
    applicationId,
    creditsUsed,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logProfileBoostCredit = (
  userId: number,
  boostType: string,
  duration: number,
  creditsUsed: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Profile boost credit usage', {
    userId,
    boostType,
    duration,
    creditsUsed,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logPremiumJobUnlock = (
  userId: number,
  jobId: number,
  creditsUsed: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Premium job unlock credit usage', {
    userId,
    jobId,
    creditsUsed,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logCreditExpiry = (
  userId: number,
  transactionId: number,
  expiredCredits: number,
  expiryDate: string,
  requestId: string
): void => {
  logger.info('Credit expiry processed', {
    userId,
    transactionId,
    expiredCredits,
    expiryDate,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logCreditError = (
  userId: number,
  operation: string,
  error: string,
  metadata: Record<string, any>,
  requestId: string
): void => {
  logger.error('Credit operation failed', {
    userId,
    operation,
    error,
    metadata,
    requestId,
    timestamp: new Date().toISOString()
  });
};


export const logMarketplaceJobCreation = (
  clientId: number,
  marketplaceJobId: number,
  jobTitle: string,
  jobType: string,
  location: string,
  estimatedBudget: number | null,
  urgencyLevel: string,
  success: boolean,
  requestId: string
): void => {
  logger.info('Marketplace job creation attempt', {
    clientId,
    marketplaceJobId,
    jobTitle,
    jobType,
    location,
    estimatedBudget,
    urgencyLevel,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceJobViewed = (
  marketplaceJobId: number,
  viewerId: number,
  viewerRole: string,
  requestId: string
): void => {
  logger.info('Marketplace job viewed', {
    marketplaceJobId,
    viewerId,
    viewerRole,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceJobExpired = (
  marketplaceJobId: number,
  jobTitle: string,
  applicationCount: number,
  requestId: string
): void => {
  logger.info('Marketplace job expired', {
    marketplaceJobId,
    jobTitle,
    applicationCount,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceJobStatusChange = (
  clientId: number,
  marketplaceJobId: number,
  fromStatus: string,
  toStatus: string,
  requestId: string
): void => {
  logger.info('Marketplace job status change', {
    clientId,
    marketplaceJobId,
    fromStatus,
    toStatus,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobApplicationSubmission = (
  tradieId: number,
  marketplaceJobId: number,
  applicationId: number,
  customQuote: number,
  creditsUsed: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Job application submission attempt', {
    tradieId,
    marketplaceJobId,
    applicationId,
    customQuote,
    creditsUsed,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobApplicationStatusChange = (
  applicationId: number,
  tradieId: number,
  marketplaceJobId: number,
  fromStatus: string,
  toStatus: string,
  requestId: string
): void => {
  logger.info('Job application status change', {
    applicationId,
    tradieId,
    marketplaceJobId,
    fromStatus,
    toStatus,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobApplicationReview = (
  clientId: number,
  marketplaceJobId: number,
  applicationId: number,
  tradieId: number,
  reviewAction: string,
  requestId: string
): void => {
  logger.info('Job application review', {
    clientId,
    marketplaceJobId,
    applicationId,
    tradieId,
    reviewAction,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logTradieSelection = (
  clientId: number,
  marketplaceJobId: number,
  selectedTradieId: number,
  selectedApplicationId: number,
  selectionReason: string | null,
  negotiatedQuote: number | null,
  success: boolean,
  requestId: string
): void => {
  logger.info('Tradie selection attempt', {
    clientId,
    marketplaceJobId,
    selectedTradieId,
    selectedApplicationId,
    selectionReason,
    negotiatedQuote,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logJobAssignment = (
  assignmentId: number,
  marketplaceJobId: number,
  selectedTradieId: number,
  existingJobId: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Job assignment attempt', {
    assignmentId,
    marketplaceJobId,
    selectedTradieId,
    existingJobId,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceSearch = (
  userId: number | null,
  searchQuery: string | null,
  filters: Record<string, any>,
  resultsCount: number,
  requestId: string
): void => {
  logger.info('Marketplace search performed', {
    userId,
    searchQuery,
    filters,
    resultsCount,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceAnalytics = (
  userId: number,
  analyticsType: string,
  dateRange: string,
  dataPoints: Record<string, any>,
  requestId: string
): void => {
  logger.info('Marketplace analytics accessed', {
    userId,
    analyticsType,
    dateRange,
    dataPoints,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceNotification = (
  userId: number,
  notificationId: number,
  notificationType: string,
  marketplaceJobId: number | null,
  applicationId: number | null,
  sent: boolean,
  requestId: string
): void => {
  logger.info('Marketplace notification', {
    userId,
    notificationId,
    notificationType,
    marketplaceJobId,
    applicationId,
    sent,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceApplicationCredit = (
  userId: number,
  marketplaceJobId: number,
  applicationId: number,
  creditsUsed: number,
  urgencyMultiplier: number,
  jobTypeMultiplier: number,
  finalCost: number,
  success: boolean,
  requestId: string
): void => {
  logger.info('Marketplace application credit usage', {
    userId,
    marketplaceJobId,
    applicationId,
    creditsUsed,
    urgencyMultiplier,
    jobTypeMultiplier,
    finalCost,
    success,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logCreditCostCalculation = (
  marketplaceJobId: number,
  jobType: string,
  urgencyLevel: string,
  baseCost: number,
  urgencyMultiplier: number,
  jobTypeMultiplier: number,
  finalCost: number,
  requestId: string
): void => {
  logger.info('Credit cost calculation', {
    marketplaceJobId,
    jobType,
    urgencyLevel,
    baseCost,
    urgencyMultiplier,
    jobTypeMultiplier,
    finalCost,
    requestId,
    timestamp: new Date().toISOString()
  });
};

export const logMarketplaceError = (
  userId: number | null,
  operation: string,
  error: string,
  metadata: Record<string, any>,
  requestId: string
): void => {
  logger.error('Marketplace operation failed', {
    userId,
    operation,
    error,
    metadata,
    requestId,
    timestamp: new Date().toISOString()
  });
};
