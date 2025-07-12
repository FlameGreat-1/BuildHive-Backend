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
  itemType: string;
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
  itemType?: string;
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
  status: string;
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
  itemType: string;
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
  status?: string;
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
  deliveryMethod: string[];
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

export interface CreateInvoiceRequest {
  quoteId?: number;
  amount: number;
  currency: string;
  dueDate: string;
  description?: string;
}

export interface InvoiceResponse {
  id: number;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paymentLink?: string;
  stripeInvoiceId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRefundRequest {
  paymentId: number;
  amount?: number;
  reason?: string;
}

export interface CreateRefundResponse {
  id: number;
  paymentId: number;
  amount: number;
  status: string;
  reason?: string;
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
  stripeRefundId?: string;
  processedAt?: string;
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
}

export interface ApplePaySessionResponse {
  merchantSession: any;
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

export interface GooglePayTokenRequest {
  paymentToken: string;
  amount: number;
  currency: string;
}

export interface WebhookEventRequest {
  stripeEventId: string;
  eventType: string;
  data: Record<string, any>;
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
  netAmount?: number;
  processedAt?: string;
  createdAt: string;
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REQUIRES_ACTION = 'requires_action'
}

export enum PaymentMethod {
  CARD = 'card',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  BANK_TRANSFER = 'bank_transfer'
}

export enum PaymentType {
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
  CREDIT_PURCHASE = 'credit_purchase',
  INVOICE_PAYMENT = 'invoice_payment',
  JOB_APPLICATION = 'job_application'
}

export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
  FAILED = 'failed'
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

export interface PaymentDatabaseRecord {
  id: number;
  user_id: number;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_type: string;
  status: string;
  description?: string;
  metadata?: any;
  invoice_id?: number;
  subscription_id?: number;
  credits_purchased?: number;
  stripe_fee?: number;
  platform_fee?: number;
  net_amount?: number;
  processed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethodDatabaseRecord {
  id: number;
  user_id: number;
  stripe_payment_method_id: string;
  type: string;
  card_last_four?: string;
  card_brand?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceDatabaseRecord {
  id: number;
  quote_id?: number;
  user_id: number;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: Date;
  payment_link?: string;
  stripe_invoice_id?: string;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RefundDatabaseRecord {
  id: number;
  payment_id: number;
  user_id: number;
  amount: number;
  reason?: string;
  status: string;
  stripe_refund_id?: string;
  processed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEventDatabaseRecord {
  id: number;
  stripe_event_id: string;
  event_type: string;
  processed: boolean;
  data: any;
  created_at: Date;
  processed_at?: Date;
}

export interface SubscriptionDatabaseRecord {
  id: number;
  user_id: number;
  stripe_subscription_id: string;
  plan: string;
  status: string;
  current_period_start: Date;
  current_period_end: Date;
  credits_included: number;
  price: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreditTransactionDatabaseRecord {
  id: number;
  user_id: number;
  payment_id?: number;
  credits: number;
  transaction_type: string;
  description?: string;
  job_application_id?: number;
  created_at: Date;
}
