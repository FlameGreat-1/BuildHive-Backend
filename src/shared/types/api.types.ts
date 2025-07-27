import { PaymentStatus, PaymentMethod, PaymentType, RefundStatus, QuoteStatus, QuoteItemType, DeliveryMethod, CreditTransactionType, CreditTransactionStatus, CreditUsageType, CreditPackageType, AutoTopupStatus } from './database.types';
import { JobType } from './database.types';
import { CreditTransactionResponse } from '../../credits/types';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  meta: PaginationMeta;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role: string;
  authProvider?: string;
  socialId?: string;
  socialData?: SocialAuthData;
}

export interface SocialAuthData {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
}

export interface RegisterResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
  };
  requiresVerification: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    emailVerified: boolean;
    creditBalance: number;
    dailyUsage: number;
    monthlyUsage: number;
    dailySpent: number;
    monthlySpent: number;
    dailyTransactions: number;
    monthlyTransactions: number;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    phone?: string;
    smsNotifications?: boolean;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  resetTokenSent: boolean;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetConfirmResponse {
  success: boolean;
  message: string;
  passwordReset: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  passwordChanged: boolean;
}

export interface LogoutRequest {
  refreshToken?: string;
  logoutAllDevices?: boolean;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
  loggedOut: boolean;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
  statusCode: number;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  jobType: string;
  priority?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  siteAddress: string;
  siteCity: string;
  siteState: string;
  sitePostcode: string;
  siteAccessInstructions?: string;
  startDate: string;
  dueDate: string;
  estimatedDuration: number;
  materials?: CreateMaterialRequest[];
  notes?: string[];
}

export interface CreateMaterialRequest {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  supplier?: string;
}

export interface UpdateJobRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  hoursWorked?: number;
  materials?: UpdateMaterialRequest[];
  notes?: string[];
  tags?: string[];
}

export interface UpdateMaterialRequest {
  id?: number;
  name?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  supplier?: string;
}

export interface JobResponse {
  id: number;
  tradieId: number;
  clientId: number;
  title: string;
  description: string;
  jobType: string;
  status: string;
  priority: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  siteAddress: string;
  siteCity: string;
  siteState: string;
  sitePostcode: string;
  siteAccessInstructions?: string;
  startDate: string;
  dueDate: string;
  estimatedDuration: number;
  hoursWorked: number;
  notes: string[];
  tags: string[];
  materials: MaterialResponse[];
  attachments: AttachmentResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface MaterialResponse {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  supplier?: string;
}

export interface AttachmentResponse {
  id: number;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface JobListResponse {
  jobs: JobResponse[];
  summary: {
    total: number;
    pending: number;
    active: number;
    completed: number;
    cancelled: number;
    onHold: number;
  };
}

export interface ClientResponse {
  id: number;
  tradieId: number;
  name: string;
  email: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  notes?: string;
  tags: string[];
  totalJobs: number;
  totalRevenue: number;
  lastJobDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobFilterRequest {
  status?: string;
  jobType?: string;
  priority?: string;
  clientId?: number;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateQuoteRequest {
  clientId?: number;
  jobId?: number;
  title: string;
  description?: string;
  items: CreateQuoteItemRequest[];
  gstEnabled: boolean;
  validUntil: string;
  termsConditions?: string;
  notes?: string;
}

export interface CreateQuoteItemRequest {
  itemType: QuoteItemType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface UpdateQuoteRequest {
  title?: string;
  description?: string;
  items?: UpdateQuoteItemRequest[];
  gstEnabled?: boolean;
  validUntil?: string;
  termsConditions?: string;
  notes?: string;
}

export interface UpdateQuoteItemRequest {
  id?: number;
  itemType?: QuoteItemType;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  sortOrder?: number;
}

export interface QuoteResponse {
  id: number;
  tradieId: number;
  clientId: number;
  jobId?: number;
  quoteNumber: string;
  title: string;
  description?: string;
  status: QuoteStatus;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  gstEnabled: boolean;
  validUntil: string;
  termsConditions?: string;
  notes?: string;
  items: QuoteItemResponse[];
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItemResponse {
  id: number;
  itemType: QuoteItemType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  sortOrder: number;
}

export interface QuoteListResponse {
  quotes: QuoteResponse[];
  summary: {
    total: number;
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    expired: number;
  };
}

export interface QuoteFilterRequest {
  status?: QuoteStatus;
  clientId?: number;
  jobId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AIPricingRequest {
  jobDescription: string;
  jobType: string;
  tradieHourlyRate: number;
  estimatedDuration?: number;
  location?: string;
}

export interface AIPricingResponse {
  suggestedTotal: number;
  complexityFactor: number;
  breakdown: {
    labour: number;
    materials: number;
    markup: number;
  };
  reasoning: string;
  confidence: number;
}

export interface SendQuoteRequest {
  quoteId: number;
  deliveryMethod: DeliveryMethod[];
  recipientEmail?: string;
  recipientPhone?: string;
  customMessage?: string;
}

export interface SendQuoteResponse {
  success: boolean;
  deliveryStatus: {
    email?: boolean;
    sms?: boolean;
    pdf?: boolean;
  };
  trackingId: string;
}

export interface CreatePaymentRequest {
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentType: string;
  description?: string;
  metadata?: Record<string, any>;
  invoiceId?: number;
  creditsToPurchase?: number;
  subscriptionPlan?: string;
  userId?: number;
  automaticPaymentMethods?: boolean;
  returnUrl?: string;
}

export interface CreatePaymentResponse {
  paymentId: number;
  stripePaymentIntentId?: string;
  clientSecret?: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  requiresAction?: boolean;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
  processingFee?: number;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentType: string;
  description?: string;
  metadata?: Record<string, any>;
  automaticPaymentMethods?: boolean;
  returnUrl?: string;
  userId?: number;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
  requiresAction: boolean;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
  processingFee: number;
}

export interface PaymentStatusRequest {
  paymentId: number;
}

export interface PaymentStatusResponse {
  paymentId: number;
  status: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  processedAt?: string;
  failureReason?: string;
  creditsAwarded?: number;
}

export interface PaymentHistoryRequest {
  userId: number;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface PaymentHistoryResponse {
  payments: PaymentResponse[];
  totalCount: number;
  summary: {
    totalAmount: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
  };
}

export interface CreatePaymentMethodRequest {
  stripePaymentMethodId: string;
  type: string;
  setAsDefault?: boolean;
}

export interface PaymentMethodResponse {
  id: number;
  type: string;
  cardLastFour?: string;
  cardBrand?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  isDefault: boolean;
  createdAt: string;
}

export interface AttachPaymentMethodResponse {
  success: boolean;
  paymentMethodId: string;
  customerId: string;
  attached: boolean;
}

export interface DetachPaymentMethodResponse {
  success: boolean;
  paymentMethodId: string;
  detached: boolean;
}

export interface SetDefaultPaymentMethodResponse {
  success: boolean;
  paymentMethodId: string;
  isDefault: boolean;
}

export interface CreateInvoiceRequest {
  quoteId?: number;
  amount: number;
  currency: string;
  dueDate: string;
  description?: string;
  userId?: number;
  metadata?: Record<string, any>;
  invoiceNumber?: string;
  status?: string;
  autoSend?: boolean;
}

export interface InvoiceResponse {
  id: number;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  description?: string;
  processingFee?: number;
  metadata?: Record<string, any>;
  paymentLink?: string;
  stripeInvoiceId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInvoiceStatusRequest {
  invoiceId: number;
  status: string;
  reason?: string;
  paidAt?: Date;
}

export interface UpdateInvoiceStatusResponse {
  invoiceId: number;
  status: string;
  updatedAt: string;
  success: boolean;
}

export interface InvoiceListResponse {
  invoices: InvoiceResponse[];
  totalCount: number;
  page: number;
  limit: number;
}

export interface InvoiceDetailsResponse {
  id: number;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  description?: string;
  processingFee?: number;
  metadata?: Record<string, any>;
  paymentLink?: string;
  stripeInvoiceId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  payments: PaymentResponse[];
  refunds: RefundResponse[];
}

export interface CreateRefundRequest {
  paymentId: number;
  amount?: number;
  reason?: string;
  description?: string;
  userId?: number;
  metadata?: Record<string, any>;
}

export interface CreateRefundResponse {
  id: number;
  paymentId: number;
  amount: number;
  status: string;
  reason?: string;
  description?: string;
  stripeRefundId?: string;
  success: boolean;
  createdAt: string;
}

export interface RefundResponse {
  id: number;
  paymentId: number;
  amount: number;
  status: string;
  reason?: string;
  description?: string;
  stripeRefundId?: string;
  processedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface RefundListResponse {
  refunds: RefundResponse[];
  totalCount: number;
  summary: {
    totalRefunded: number;
    pendingRefunds: number;
    processedRefunds: number;
  };
}

export interface SubscriptionRequest {
  plan: string;
  paymentMethodId?: string;
}

export interface SubscriptionResponse {
  id: number;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  creditsIncluded: number;
  price: number;
  currency: string;
  stripeSubscriptionId: string;
}

export interface PaymentLinkRequest {
  amount: number;
  currency: string;
  description?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface PaymentLinkResponse {
  id: string;
  url: string;
  amount: number;
  currency: string;
  status: string;
  expiresAt?: string;
  createdAt: string;
}

export interface ApplePaySessionRequest {
  validationUrl: string;
  displayName: string;
  domainName: string;
  amount?: number;
  currency?: string;
  countryCode?: string;
  merchantName?: string;
  description?: string;
  requiresShipping?: boolean;
}

export interface ApplePaySessionResponse {
  merchantSession: any;
  success?: boolean;
  session?: any;
  merchantIdentifier?: string;
  domainName?: string;
  displayName?: string;
}

export interface ApplePayValidationRequest {
  validationUrl: string;
  displayName: string;
  domainName: string;
}

export interface ApplePayValidationResponse {
  merchantSession: any;
  success: boolean;
}

export interface ApplePayPaymentRequest {
  paymentData: any;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  userId?: number;
  paymentType?: string;
  returnUrl?: string;
}

export interface ApplePayPaymentResponse {
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  clientSecret?: string;
  requiresAction: boolean;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
  transactionId: string;
  success: boolean;
  processingFee?: number;
}

export interface GooglePayTokenRequest {
  paymentToken: string;
  amount: number;
  currency: string;
}

export interface GooglePayTokenResponse {
  token: string;
  paymentMethod: any;
  success: boolean;
}

export interface GooglePayPaymentRequest {
  paymentToken: string;
  paymentType?: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  userId?: number;
  returnUrl?: string;
}

export interface GooglePayPaymentResponse {
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  clientSecret?: string;
  requiresAction: boolean;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
  transactionId: string;
  success: boolean;
  processingFee?: number;
}

export interface GooglePayConfigRequest {
  amount?: number;
  currency?: string;
  merchantName?: string;
  description?: string;
}

export interface GooglePayConfigResponse {
  merchantId: string;
  environment: string;
  apiVersion: number;
  apiVersionMinor: number;
  allowedPaymentMethods: Array<{
    type: string;
    parameters: {
      allowedAuthMethods: string[];
      allowedCardNetworks: string[];
    };
    tokenizationSpecification: {
      type: string;
      parameters: {
        gateway: string;
        gatewayMerchantId: string;
      };
    };
  }>;
  merchantInfo: {
    merchantName: string;
  };
  transactionInfo: {
    totalPriceStatus: string;
    totalPrice: string;
    currencyCode: string;
  };
}

export interface WebhookEventRequest {
  stripeEventId: string;
  eventType: string;
  data: Record<string, any>;
}

export interface WebhookEventResponse {
  id: number;
  stripeEventId: string;
  eventType: string;
  processed: boolean;
  data: Record<string, any>;
  retryCount: number;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  processedAt?: string;
}

export interface PaymentFilterRequest {
  status?: string;
  paymentMethod?: string;
  paymentType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentListResponse {
  payments: PaymentResponse[];
  summary: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    totalAmount: number;
  };
}

export interface PaymentResponse {
  id: number;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentType: string;
  status: string;
  description?: string;
  creditsAwarded?: number;
  stripeFee?: number;
  platformFee?: number;
  processingFee?: number;
  netAmount?: number;
  processedAt?: string;
  createdAt: string;
}

export enum WebhookEventType {
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REQUIRES_ACTION = 'payment_requires_action',
  PAYMENT_METHOD_ATTACHED = 'payment_method_attached',
  REFUND_CREATED = 'refund_created',
  CHARGE_DISPUTE_CREATED = 'charge_dispute_created',
  CHARGE_FAILED = 'charge_failed'
}

export interface CreditBalanceRequest {
  userId?: number;
}

export interface CreditBalanceResponse {
  userId: number;
  currentBalance: number;
  totalPurchased: number;
  totalUsed: number;
  totalRefunded: number;
  lastPurchaseAt?: string;
  lastUsageAt?: string;
  autoTopupEnabled: boolean;
  lowBalanceThreshold?: number;
}

export interface CreditPurchaseRequest {
  packageType: CreditPackageType;
  paymentMethodId?: string;
  autoTopup?: boolean;
  metadata?: Record<string, any>;
}

export interface CreditPurchaseResponse {
  id: number;
  packageType: CreditPackageType;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  purchasePrice: number;
  currency: string;
  status: CreditTransactionStatus;
  paymentId: number;
  expiresAt?: string;
  createdAt: string;
}

export interface CreditUsageRequest {
  usageType: CreditUsageType;
  creditsToUse: number;
  referenceId?: number;
  referenceType?: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface CreditUsageResponse {
  id: number;
  usageType: CreditUsageType;
  creditsUsed: number;
  remainingBalance: number;
  referenceId?: number;
  referenceType?: string;
  description: string;
  success: boolean;
  createdAt: string;
}

export interface CreditTransactionRequest {
  transactionType?: CreditTransactionType;
  status?: CreditTransactionStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreditTransactionListResponse {
  transactions: CreditTransactionResponse[];
  summary: {
    total: number;
    totalCredits: number;
    purchased: number;
    used: number;
    refunded: number;
    bonus: number;
  };
}

export interface CreditPackageResponse {
  packageType: CreditPackageType;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  price: number;
  currency: string;
  savings?: number;
  popular?: boolean;
  description: string;
}

export interface CreditPackageListResponse {
  packages: CreditPackageResponse[];
  currentBalance: number;
  recommendedPackage?: CreditPackageType;
}

export interface AutoTopupRequest {
  enabled: boolean;
  triggerBalance: number;
  topupAmount: number;
  packageType: CreditPackageType;
  paymentMethodId: number;
}

export interface AutoTopupResponse {
  id: number;
  status: AutoTopupStatus;
  triggerBalance: number;
  topupAmount: number;
  packageType: CreditPackageType;
  paymentMethodId: number;
  lastTriggeredAt?: string;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditNotificationRequest {
  lowBalanceThreshold: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
}

export interface CreditNotificationResponse {
  lowBalanceThreshold: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  lastNotificationSent?: string;
}

export interface CreditDashboardResponse {
  currentBalance: number;
  totalPurchased: number;
  totalUsed: number;
  monthlyUsage: {
    month: string;
    creditsUsed: number;
    jobApplications: number;
    profileBoosts: number;
    premiumUnlocks: number;
  }[];
  recentTransactions: CreditTransactionResponse[];
  autoTopupStatus: AutoTopupResponse;
  usageBreakdown: {
    jobApplications: number;
    profileBoosts: number;
    premiumUnlocks: number;
    directMessages: number;
    other: number;
  };
  projectedDepletion?: string;
}

export interface CreditRefundRequest {
  transactionId: number;
  reason: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CreditRefundResponse {
  id: number;
  transactionId: number;
  creditsRefunded: number;
  reason: string;
  status: CreditTransactionStatus;
  processedAt?: string;
  createdAt: string;
}
export interface JobApplicationCreditRequest {
  jobId: number;
  creditsRequired: number;
  applicationData?: Record<string, any>;
}

export interface JobApplicationCreditResponse {
  success: boolean;
  creditsUsed: number;
  remainingBalance: number;
  applicationId: number;
  jobId: number;
  transactionId: number;
}

export interface ProfileBoostRequest {
  boostType: string;
  duration: number;
  creditsRequired: number;
}

export interface ProfileBoostResponse {
  success: boolean;
  boostType: string;
  duration: number;
  creditsUsed: number;
  remainingBalance: number;
  expiresAt: string;
  transactionId: number;
}

export interface PremiumJobUnlockRequest {
  jobId: number;
  creditsRequired: number;
}

export interface PremiumJobUnlockResponse {
  success: boolean;
  jobId: number;
  creditsUsed: number;
  remainingBalance: number;
  jobDetails: Record<string, any>;
  transactionId: number;
}

export interface CreditFilterRequest {
  transactionType?: CreditTransactionType;
  usageType?: CreditUsageType;
  status?: CreditTransactionStatus;
  startDate?: string;
  endDate?: string;
  minCredits?: number;
  maxCredits?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreditAnalyticsResponse {
  totalUsers: number;
  totalCreditsIssued: number;
  totalCreditsUsed: number;
  totalRevenue: number;
  averageCreditsPerUser: number;
  topUsageTypes: {
    type: CreditUsageType;
    count: number;
    percentage: number;
  }[];
  monthlyTrends: {
    month: string;
    purchases: number;
    usage: number;
    revenue: number;
  }[];
  packagePopularity: {
    packageType: CreditPackageType;
    purchases: number;
    revenue: number;
  }[];
}

// ==================== MARKETPLACE JOB TYPES ====================

export interface CreateMarketplaceJobRequest {
  title: string;
  description: string;
  jobType: string;
  location: string;
  estimatedBudget?: number;
  dateRequired: string;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'urgent';
  photos?: string[];
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  requiresVerification?: boolean;
}

export interface MarketplaceJobResponse {
  id: number;
  clientId: number;
  title: string;
  description: string;
  jobType: string;
  location: string;
  estimatedBudget?: number;
  dateRequired: string;
  urgencyLevel: string;
  photos: string[];
  status: MarketplaceJobStatus;
  applicationCount: number;
  viewCount: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceJobPreviewResponse {
  id: number;
  title: string;
  jobType: string;
  location: string;
  estimatedBudget?: number;
  dateRequired: string;
  urgencyLevel: string;
  applicationCount: number;
  creditsRequired: number;
  createdAt: string;
  hasApplied?: boolean;
}

export interface MarketplaceJobListResponse {
  jobs: MarketplaceJobPreviewResponse[];
  summary: {
    total: number;
    available: number;
    inReview: number;
    assigned: number;
    completed: number;
    expired: number;
  };
}

export interface MarketplaceJobFilterRequest {
  jobType?: string;
  location?: string;
  urgencyLevel?: string;
  minBudget?: number;
  maxBudget?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: MarketplaceJobStatus;
  excludeApplied?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateMarketplaceJobRequest {
  title?: string;
  description?: string;
  estimatedBudget?: number;
  dateRequired?: string;
  urgencyLevel?: string;
  status?: MarketplaceJobStatus;
}

// ==================== JOB APPLICATION TYPES ====================

export interface CreateJobApplicationRequest {
  marketplaceJobId: number;
  customQuote: number;
  proposedTimeline: string;
  approachDescription: string;
  materialsList?: string;
  availabilityDates: string[];
  coverMessage?: string;
  relevantExperience?: string;
  additionalPhotos?: string[];
  questionsForClient?: string;
  specialOffers?: string;
}

export interface JobApplicationResponse {
  id: number;
  marketplaceJobId: number;
  tradieId: number;
  customQuote: number;
  proposedTimeline: string;
  approachDescription: string;
  materialsList?: string;
  availabilityDates: string[];
  coverMessage?: string;
  relevantExperience?: string;
  additionalPhotos: string[];
  questionsForClient?: string;
  specialOffers?: string;
  creditsUsed: number;
  status: ApplicationStatus;
  applicationTimestamp: string;
  createdAt: string;
  updatedAt: string;
  tradie?: {
    id: number;
    name: string;
    email: string;
    phone: string;
    hourlyRate: number;
    rating: number;
    completedJobs: number;
    profilePhoto?: string;
    abn?: string;
    qualifications: string[];
    serviceTypes: string[];
  };
}

export interface JobApplicationListResponse {
  applications: JobApplicationResponse[];
  summary: {
    total: number;
    submitted: number;
    underReview: number;
    selected: number;
    rejected: number;
  };
}

export interface JobApplicationFilterRequest {
  marketplaceJobId?: number;
  tradieId?: number;
  status?: ApplicationStatus;
  minQuote?: number;
  maxQuote?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateApplicationStatusRequest {
  applicationId: number;
  status: ApplicationStatus;
  reason?: string;
  feedback?: string;
}

export interface UpdateApplicationStatusResponse {
  applicationId: number;
  status: ApplicationStatus;
  updatedAt: string;
  success: boolean;
  jobAssigned?: boolean;
  newJobId?: number;
}

// ==================== CLIENT REVIEW & SELECTION TYPES ====================

export interface ClientApplicationReviewRequest {
  marketplaceJobId: number;
  page?: number;
  limit?: number;
  sortBy?: 'quote' | 'rating' | 'experience' | 'timeline';
  sortOrder?: 'asc' | 'desc';
}

export interface ClientApplicationReviewResponse {
  marketplaceJob: MarketplaceJobResponse;
  applications: JobApplicationResponse[];
  totalApplications: number;
  averageQuote: number;
  quoteRange: {
    min: number;
    max: number;
  };
}

export interface SelectTradieRequest {
  marketplaceJobId: number;
  selectedApplicationId: number;
  selectionReason?: string;
  negotiatedQuote?: number;
  projectStartDate?: string;
}

export interface SelectTradieResponse {
  success: boolean;
  marketplaceJobId: number;
  selectedApplicationId: number;
  selectedTradieId: number;
  newJobId: number;
  jobCreated: boolean;
  notificationsSent: boolean;
  assignmentTimestamp: string;
}

// ==================== MARKETPLACE ANALYTICS TYPES ====================

export interface MarketplaceAnalyticsResponse {
  totalJobs: number;
  totalApplications: number;
  averageApplicationsPerJob: number;
  totalCreditsSpent: number;
  conversionRate: number;
  topJobTypes: {
    jobType: string;
    count: number;
    percentage: number;
  }[];
  locationStats: {
    location: string;
    jobCount: number;
    applicationCount: number;
  }[];
  monthlyTrends: {
    month: string;
    jobsPosted: number;
    applicationsSubmitted: number;
    creditsSpent: number;
    conversions: number;
  }[];
}

export interface TradieMarketplaceStatsResponse {
  totalApplications: number;
  successfulApplications: number;
  totalCreditsSpent: number;
  averageCreditsPerApplication: number;
  conversionRate: number;
  applicationHistory: {
    date: string;
    applicationsCount: number;
    creditsSpent: number;
    successRate: number;
  }[];
  topJobTypes: {
    jobType: string;
    applications: number;
    successRate: number;
  }[];
}

// ==================== MARKETPLACE CREDIT INTEGRATION TYPES ====================

export interface MarketplaceJobApplicationCreditRequest {
  marketplaceJobId: number;
  applicationData: CreateJobApplicationRequest;
}

export interface MarketplaceJobApplicationCreditResponse {
  success: boolean;
  applicationId: number;
  creditsUsed: number;
  remainingBalance: number;
  transactionId: number;
  applicationSubmitted: boolean;
}

export interface MarketplaceCreditCostRequest {
  marketplaceJobId: number;
  jobType?: string;
  urgencyLevel?: string;
}

export interface MarketplaceCreditCostResponse {
  marketplaceJobId: number;
  creditsRequired: number;
  baseCost: number;
  urgencyMultiplier: number;
  jobTypeMultiplier: number;
  finalCost: number;
}

// ==================== MARKETPLACE NOTIFICATION TYPES ====================

export interface MarketplaceNotificationRequest {
  userId: number;
  notificationType: 'new_job' | 'application_status' | 'job_assigned' | 'application_received';
  marketplaceJobId?: number;
  applicationId?: number;
  message: string;
  metadata?: Record<string, any>;
}

export interface MarketplaceNotificationResponse {
  id: number;
  userId: number;
  notificationType: string;
  message: string;
  read: boolean;
  marketplaceJobId?: number;
  applicationId?: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

// ==================== MARKETPLACE SEARCH TYPES ====================

export interface MarketplaceSearchRequest {
  query?: string;
  jobType?: string;
  location?: string;
  minBudget?: number;
  maxBudget?: number;
  urgencyLevel?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  excludeApplied?: boolean;
  page?: number;
  limit?: number;
}

export interface MarketplaceSearchResponse {
  jobs: MarketplaceJobPreviewResponse[];
  totalResults: number;
  searchQuery: string;
  filters: {
    jobTypes: string[];
    locations: string[];
    budgetRanges: {
      min: number;
      max: number;
      count: number;
    }[];
  };
  suggestions: string[];
}

// ==================== MARKETPLACE DASHBOARD TYPES ====================

export interface ClientMarketplaceDashboardResponse {
  activeJobs: number;
  totalApplicationsReceived: number;
  averageApplicationsPerJob: number;
  recentJobs: MarketplaceJobResponse[];
  pendingReviews: {
    jobId: number;
    title: string;
    applicationCount: number;
    postedAt: string;
  }[];
  completedHires: number;
}

export interface TradieMarketplaceDashboardResponse {
  availableJobs: number;
  appliedJobs: number;
  successfulApplications: number;
  creditsRemaining: number;
  recentApplications: {
    jobId: number;
    jobTitle: string;
    status: ApplicationStatus;
    appliedAt: string;
    creditsUsed: number;
  }[];
  recommendedJobs: MarketplaceJobPreviewResponse[];
}

export type MarketplaceJobType = JobType;

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'API_ERROR'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string = 'DATABASE_ERROR',
    public detail?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}
