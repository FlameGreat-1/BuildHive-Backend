import { 
  PaymentStatus, 
  PaymentMethod, 
  PaymentType,
  PaymentDatabaseRecord,
  PaymentMethodDatabaseRecord,
  InvoiceStatus,
  RefundStatus
} from '../../shared/types';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  clientSecret?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  requiresAction?: boolean;
  nextAction?: PaymentNextAction;
}

export interface PaymentNextAction {
  type: 'redirect_to_url' | 'use_stripe_sdk' | 'display_bank_transfer_instructions';
  redirectUrl?: string;
  bankTransferInstructions?: BankTransferInstructions;
}

export interface BankTransferInstructions {
  accountNumber: string;
  routingNumber: string;
  accountHolderName: string;
  reference: string;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
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
  currency: string;
  requiresAction: boolean;
  nextAction?: PaymentNextAction;
  processingFee: number;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface ConfirmPaymentResponse {
  paymentIntentId: string;
  status: PaymentStatus;
  requiresAction: boolean;
  amount: number;           
  currency: string;
  clientSecret?: string;
  nextAction?: PaymentNextAction;
  error?: PaymentError;
}

export interface PaymentError {
  code: string;
  message: string;
  type: 'card_error' | 'validation_error' | 'api_error' | 'authentication_error';
  declineCode?: string;
  param?: string;
}

export interface PaymentMethodDetails {
  id: string;
  type: PaymentMethod;
  card?: CardDetails;
  billing?: BillingDetails;
}

export interface CardDetails {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding: 'credit' | 'debit' | 'prepaid' | 'unknown';
  country?: string;
}

export interface BillingDetails {
  name?: string;
  email?: string;
  phone?: string;
  address?: Address;
}

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CreatePaymentMethodRequest {
  type: PaymentMethod;
  card?: {
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  };
  billingDetails?: BillingDetails;
  metadata?: Record<string, any>;
  setAsDefault?: boolean;
}

export interface CreatePaymentMethodResponse {
  id: number;
  paymentMethodId: string;
  type: PaymentMethod;
  card?: CardDetails;
  clientSecret?: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface AttachPaymentMethodRequest {
  paymentMethodId: string;
  customerId: string;
}

export interface DetachPaymentMethodRequest {
  paymentMethodId: string;
}

export interface PaymentLinkRequest {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  returnUrl?: string;
  automaticTax?: boolean;
}

export interface PaymentLinkResponse {
  id: string;
  url: string;
  amount: number;
  currency: string;
  status: 'active' | 'inactive';
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
  success: boolean;
  session?: any;
  merchantIdentifier?: string;
  domainName?: string;
  displayName: string;
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
  status: PaymentStatus;
  amount: number;
  currency: string;
  clientSecret?: string;
  requiresAction: boolean;
  nextAction?: PaymentNextAction;
  transactionId: string;
  success: boolean;
  processingFee?: number;
}

export interface GooglePayTokenRequest {
  paymentMethodData: {
    tokenizationData: {
      token: string;
      type: 'PAYMENT_GATEWAY';
    };
    type: 'CARD';
    info: {
      cardNetwork: string;
      cardDetails: string;
    };
  };
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  paymentToken: string;
}

export interface GooglePayTokenResponse {
  token: string;
  paymentMethod: any;
  success: boolean;
}

export interface GooglePayPaymentRequest {
  token: any;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  userId?: number;
  paymentToken: string;
  paymentType: string;
  returnUrl: string;
}

export interface GooglePayPaymentResponse {
  paymentIntentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  clientSecret?: string;
  requiresAction: boolean;
  nextAction?: PaymentNextAction;
  transactionId: string;
  success: boolean;
  processingFee?: number;
}

export interface PaymentHistoryItem {
  id: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  description?: string;
  creditsAwarded?: number;
  stripeFee?: number;
  platformFee?: number;
  netAmount?: number;
  processedAt?: string;
  createdAt: string;
}

export interface GooglePayConfigRequest {
  merchantId: string;
  environment: 'TEST' | 'PRODUCTION';
  amount: number;
  currency: string;
  merchantName: string;
  description: string;
}

export interface GooglePayConfigResponse {
  merchantId: string;
  merchantName: string;
  environment: string;
  merchantInfo?: any;
  apiVersionMinor?: number; 
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
  config?: {
    merchantId: string;
    environment: string;
    allowedPaymentMethods: any[];
  };
}

export interface PaymentFeeCalculation {
  subtotal: number;
  stripeFee: number;
  platformFee: number;
  total: number;
  netAmount: number;
}

export interface PaymentStatusUpdate {
  paymentId: number;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  processedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentListFilter {
  userId?: number;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentType?: PaymentType;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  averageAmount: number;
}

export interface PaymentMethodListFilter {
  userId: number;
  type?: PaymentMethod;
  isDefault?: boolean;
}

export interface SetDefaultPaymentMethodRequest {
  paymentMethodId: number;
  userId: number;
}

export interface PaymentRetryRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
}

export interface PaymentCancelRequest {
  paymentIntentId: string;
  reason?: string;
}

export interface PaymentMethodDatabaseRecordFixed extends Omit<PaymentMethodDatabaseRecord, 'card_last_four' | 'card_brand' | 'card_exp_month' | 'card_exp_year'> {
  card_last_four: string | null | undefined;
  card_brand: string | null | undefined;
  card_exp_month: number | null | undefined;
  card_exp_year: number | null | undefined;
}

export type PaymentEntity = PaymentDatabaseRecord;
export type PaymentMethodEntity = PaymentMethodDatabaseRecordFixed;

export interface CreateInvoiceRequest {
  amount: number;
  currency: string;
  description: string;
  dueDate?: Date;
  userId?: number;
  metadata?: Record<string, any>;
  quoteId?: number;
  invoiceNumber?: string;
  status?: InvoiceStatus;
  autoSend?: boolean;
}

export interface CreateInvoiceResponse {
  id: number;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paymentLink?: string;
  stripeInvoiceId?: string;
  processingFee?: number;
  success: boolean;
  createdAt: string;
}

export interface UpdateInvoiceStatusRequest {
  invoiceId: number;
  status: string;
  reason?: string;
  paidAt?: Date;
}

export interface UpdateInvoiceStatusResponse {
  invoiceId: number;
  status: InvoiceStatus;
  updatedAt: string;
  success: boolean;
}

export interface InvoiceListRequest {
  userId: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface InvoiceListResponse {
  invoices: any[];
  total: number;
  totalCount: number;
  page: number;
  limit: number;
}

export interface InvoiceDetailsResponse {
  invoice: any;
  payments: any[];
  refunds: any[];
  invoiceNumber: string;
  status: string;
}

export interface CreateRefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
  description?: string;  
  userId?: number;
  metadata?: Record<string, any>;
}

export interface UpdateRefundStatusRequest {
  refundId: number;
  status: string;
  reason?: string;
  processedAt?: Date;       
  failureReason?: string; 
}

export interface RefundListRequest {
  userId: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PaymentStatusRequest {
  paymentId: number;
}

export interface PaymentHistoryRequest {
  userId: number;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface PaymentMethodListRequest {
  userId: number;
  limit?: number;
  offset?: number;
  type?: string;
}

export type CreatePaymentRequest = CreatePaymentIntentRequest;
export type ApplePayValidationRequest = ApplePaySessionRequest;
export type ApplePayValidationResponse = ApplePaySessionResponse;

export interface PaymentService {
  getPaymentMethods(): Promise<PaymentMethod[]>;
}

export interface PaymentRepository {
  getPaymentById(id: number): Promise<PaymentDatabaseRecord | null>;
  getUserTotalAmount(userId: number): Promise<number>;
}

export interface InvoiceRepository {
  getInvoiceById(id: number): Promise<any>;
}

export interface RefundRepository {
  getRefundById(id: number): Promise<any>;
}

export interface WebhookRepository {
  getWebhookEventByStripeId(stripeId: string): Promise<any>;
}

export interface WebhookService {
  processWebhookEvent(payload: string, signature: string, requestId?: string): Promise<WebhookProcessingResult>;
  retryFailedWebhookEvent(eventId: number): Promise<WebhookProcessingResult>;
  retryWebhookEvent(eventId: string): Promise<WebhookProcessingResult>;
  getWebhookEvent(eventId: string): Promise<any>;
  getWebhookEventStatus(eventId: string): Promise<any>;
  listWebhookEvents(filters: any): Promise<any>;
  getWebhookStats(filters: any): Promise<any>;
  deleteWebhookEvent(eventId: string): Promise<boolean>;
  getUnprocessedEvents(limit?: number): Promise<WebhookEventDatabaseRecord[]>;
  markEventAsProcessed(eventId: number): Promise<WebhookEventDatabaseRecord>;
  cleanupOldEvents(olderThanDays?: number): Promise<number>;
  getWebhookHealth(): Promise<any>;
  validateWebhookEndpoint(endpointUrl: string): Promise<any>;
  getWebhookConfiguration(): Promise<any>;
  getEventsByDateRange(startDate: Date, endDate: Date, eventType?: string): Promise<WebhookEventDatabaseRecord[]>;
}

export interface ApplePayConfig {
  supportedNetworks: string[];
  merchantCapabilities: string[];
  supportedCountries: string[];
  supportedCurrencies: string[];
  merchantIdentifier: string;
  domainName: string;
}

export interface GooglePayConfig {
  supportedNetworks: string[];
  supportedAuthMethods: string[];
  supportedCountries: string[];
  supportedCurrencies: string[];
  merchantId: string;
  environment: string;
}

export interface PaymentStatusResponse {
  paymentId: number;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;  
  description?: string;      
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
  creditsAwarded?: number;   
  metadata?: Record<string, any>; 
}

export interface PaymentHistoryResponse {
  payments: PaymentHistoryItem[];
  totalCount: number;
  page: number;
  limit: number;
  summary: PaymentSummary;
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

export interface UpdateRefundStatusResponse {
  refundId: number;
  status: RefundStatus;
  updatedAt: string;
  success: boolean;
}

export interface RefundListResponse {
  refunds: any[];
  totalCount: number;
  summary: {
    totalRefunded: number;
    pendingRefunds: number;
    processedRefunds: number;
  };
}

export interface RefundDetailsResponse {
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
  updatedAt: string;
}

export interface SetDefaultPaymentMethodResponse {
  success: boolean;
  paymentMethodId: number;
  isDefault: boolean;
}

export interface PaymentMethodListResponse {
  paymentMethods: any[];
  totalCount: number;
  page: number;
  limit: number;
}
