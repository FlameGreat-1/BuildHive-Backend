import { QuoteData } from './quote.types';

export interface PaymentIntentData {
  quoteId: number;
  amount: number;
  currency: string;
  clientId: number;
  tradieId: number;
  description: string;
  metadata: {
    quoteNumber: string;
    jobId?: number;
    clientEmail: string;
    tradieEmail: string;
  };
}

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  createdAt: Date;
}

export interface PaymentConfirmationData {
  paymentIntentId: string;
  quoteId: number;
  amount: number;
  currency: string;
  paymentMethodId: string;
  clientId: number;
  tradieId: number;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: Date;
  failureReason?: string;
  receiptUrl?: string;
}

export interface RefundData {
  paymentId: string;
  quoteId: number;
  amount?: number;
  reason: RefundReason;
  tradieId: number;
  clientId: number;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  processedAt?: Date;
  failureReason?: string;
}

export interface InvoiceData {
  quoteId: number;
  paymentId: string;
  clientId: number;
  tradieId: number;
  amount: number;
  currency: string;
  items: InvoiceItem[];
  dueDate: Date;
  metadata: {
    quoteNumber: string;
    jobId?: number;
  };
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  itemType: string;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
  invoiceUrl: string;
  pdfUrl: string;
  status: InvoiceStatus;
  createdAt: Date;
}

export interface PaymentWebhookData {
  eventType: PaymentWebhookEventType;
  paymentIntentId?: string;
  paymentId?: string;
  refundId?: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  status: string;
  metadata: {
    quoteId: number;
    clientId: number;
    tradieId: number;
    quoteNumber: string;
  };
  timestamp: Date;
}

export interface PaymentFeeCalculation {
  subtotal: number;
  stripeFee: number;
  platformFee: number;
  tradieAmount: number;
  totalFees: number;
}

export interface PaymentMethodData {
  paymentMethodId: string;
  type: PaymentMethodType;
  card?: {
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
  clientId: number;
}

export interface PaymentHistoryItem {
  id: string;
  quoteId: number;
  quoteNumber: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethodType;
  createdAt: Date;
  paidAt?: Date;
  refundedAt?: Date;
  failureReason?: string;
}

export interface PaymentAnalytics {
  totalPayments: number;
  totalAmount: number;
  successfulPayments: number;
  failedPayments: number;
  refundedPayments: number;
  averagePaymentAmount: number;
  paymentMethodBreakdown: {
    [key in PaymentMethodType]: number;
  };
  monthlyTrends: {
    month: string;
    paymentsCount: number;
    totalAmount: number;
    successRate: number;
  }[];
}

export type PaymentIntentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded';

export type RefundReason = 
  | 'requested_by_customer'
  | 'duplicate'
  | 'fraudulent'
  | 'quote_cancelled'
  | 'service_not_provided'
  | 'other';

export type RefundStatus = 
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type InvoiceStatus = 
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export type PaymentWebhookEventType = 
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'charge.dispute.created'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'refund.created'
  | 'refund.updated';

export type PaymentMethodType = 
  | 'card'
  | 'bank_transfer'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay';

export interface PaymentIntegrationService {
  createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntentResponse>;
  confirmPayment(data: PaymentConfirmationData): Promise<PaymentResult>;
  processRefund(data: RefundData): Promise<RefundResult>;
  generateInvoice(data: InvoiceData): Promise<InvoiceResult>;
  handleWebhook(webhookData: PaymentWebhookData): Promise<void>;
  calculateFees(amount: number): PaymentFeeCalculation;
  getPaymentHistory(userId: number, userType: 'client' | 'tradie'): Promise<PaymentHistoryItem[]>;
  getPaymentAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<PaymentAnalytics>;
  validatePaymentMethod(paymentMethodId: string): Promise<boolean>;
  savePaymentMethod(data: PaymentMethodData): Promise<void>;
}

export interface QuotePaymentData extends QuoteData {
  paymentIntentId?: string;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
  paidAt?: Date;
  refundId?: string;
  refundedAt?: Date;
  invoiceId?: string;
  invoiceUrl?: string;
}

export interface PaymentNotificationData {
  quoteId: number;
  clientId: number;
  tradieId: number;
  paymentStatus: PaymentStatus;
  amount: number;
  currency: string;
  eventType: string;
}

export interface QuoteRefundData {
  quoteId: number;
  quoteNumber: string;
  paymentId: string;
  amount: number;
  reason: string;
  tradieId: number;
  clientId: number;
}

export interface QuoteInvoiceData {
  quoteId: number;
  quoteNumber: string;
  paymentId: string;
  clientId: number;
  tradieId: number;
  jobId?: number;
}

export interface QuotePaymentSummary {
  quoteId: number;
  quoteNumber: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  paidAt?: Date;
  refundId?: string;
  refundedAt?: Date;
  refundableAmount: number;
  canRefund: boolean;
}

export interface QuoteWithPayment extends QuoteData {
  paymentFees: PaymentFeeCalculation;
  paymentHistory: PaymentHistoryItem[];
  canRefund: boolean;
  refundableAmount: number;
}

export interface PaymentIntentResult {
  quote: QuoteData;
  paymentIntent: PaymentIntentResponse;
}

export interface QuotePaymentResult {
  quote: QuoteData;
  paymentResult: PaymentResult;
}

export interface QuoteRefundResult {
  quote: QuoteData;
  refundResult: RefundResult;
}

export interface QuoteInvoiceResult {
  quote: QuoteData;
  invoiceResult: InvoiceResult;
}
