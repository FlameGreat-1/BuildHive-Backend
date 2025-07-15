import { PaymentStatus, PaymentMethod, PaymentType, RefundStatus } from './database.types';

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
export type DeliveryMethod = 'email' | 'sms' | 'pdf' | 'portal';
export type QuoteItemType = 'labour' | 'material' | 'equipment' | 'other';
export type Currency = 'AUD' | 'USD';
export type JobStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'on_hold';
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

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
  priority?: JobPriority;
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
  status?: JobStatus;
  priority?: JobPriority;
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
  status: JobStatus;
  priority: JobPriority;
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
  status?: JobStatus;
  jobType?: string;
  priority?: JobPriority;
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
  currency: Currency;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
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
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  requiresAction?: boolean;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
  processingFee?: number;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  description?: string;
  metadata?: Record<string, any>;
  automaticPaymentMethods?: boolean;
  returnUrl?: string;
  userId?: number;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
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
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
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
  type: PaymentMethod;
  setAsDefault?: boolean;
}

export interface PaymentMethodResponse {
  id: number;
  type: PaymentMethod;
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
  currency: Currency;
  dueDate: string;
  description?: string;
  userId?: number;
  metadata?: Record<string, any>;
  invoiceNumber?: string;
  status?: PaymentStatus;
  autoSend?: boolean;
}

export interface InvoiceResponse {
  id: number;
  invoiceNumber: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
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
  status: PaymentStatus;
  reason?: string;
  paidAt?: Date;
}

export interface UpdateInvoiceStatusResponse {
  invoiceId: number;
  status: PaymentStatus;
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
  currency: Currency;
  status: PaymentStatus;
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
  status: RefundStatus;
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
  status: RefundStatus;
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
  status: PaymentStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  creditsIncluded: number;
  price: number;
  currency: Currency;
  stripeSubscriptionId: string;
}

export interface CreditPurchaseRequest {
  credits: number;
  paymentMethodId?: string;
}

export interface CreditBalanceResponse {
  userId: number;
  currentBalance: number;
  totalPurchased: number;
  totalUsed: number;
  lastTransaction?: {
    credits: number;
    type: string;
    description?: string;
    createdAt: string;
  };
}

export interface CreditTransactionResponse {
  id: number;
  credits: number;
  transactionType: string;
  description?: string;
  createdAt: string;
}

export interface PaymentLinkRequest {
  amount: number;
  currency: Currency;
  description?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface PaymentLinkResponse {
  id: string;
  url: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  expiresAt?: string;
  createdAt: string;
}

export interface ApplePaySessionRequest {
  validationUrl: string;
  displayName: string;
  domainName: string;
  amount?: number;
  currency?: Currency;
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
  currency: Currency;
  description?: string;
  metadata?: Record<string, any>;
  userId?: number;
  paymentType?: PaymentType;
  returnUrl?: string;
}

export interface ApplePayPaymentResponse {
  paymentIntentId: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
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
  currency: Currency;
}

export interface GooglePayTokenResponse {
  token: string;
  paymentMethod: any;
  success: boolean;
}

export interface GooglePayPaymentRequest {
  paymentToken: string;
  paymentType?: PaymentType;
  amount: number;
  currency: Currency;
  description?: string;
  metadata?: Record<string, any>;
  userId?: number;
  returnUrl?: string;
}

export interface GooglePayPaymentResponse {
  paymentIntentId: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
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
  currency?: Currency;
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
  eventType: WebhookEventType;
  data: Record<string, any>;
}

export interface WebhookEventResponse {
  id: number;
  stripeEventId: string;
  eventType: WebhookEventType;
  processed: boolean;
  data: Record<string, any>;
  retryCount: number;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  processedAt?: string;
}

export interface PaymentFilterRequest {
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentType?: PaymentType;
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
  currency: Currency;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  status: PaymentStatus;
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
