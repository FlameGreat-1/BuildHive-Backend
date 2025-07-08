import { 
  QuoteStatus, 
  QuoteItemType, 
  DeliveryMethod, 
  MaterialUnit 
} from '../../shared/types';
import { 
  PaymentStatus, 
  PaymentResult, 
  RefundData, 
  RefundResult, 
  InvoiceResult,
  PaymentIntentResponse,
  PaymentFeeCalculation,
  PaymentHistoryItem,
  PaymentMethodType
} from './payment.types';

export interface QuoteCreateData {
  clientId?: number;
  jobId?: number;
  title: string;
  description?: string;
  items: QuoteItemCreateData[];
  gstEnabled: boolean;
  validUntil: Date;
  termsConditions?: string;
  notes?: string;
}

export interface QuoteItemCreateData {
  itemType: QuoteItemType;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
}

export interface QuoteUpdateData {
  title?: string;
  description?: string;
  items?: QuoteItemUpdateData[];
  gstEnabled?: boolean;
  validUntil?: Date;
  termsConditions?: string;
  notes?: string;
}

export interface QuoteItemUpdateData {
  id?: number;
  itemType?: QuoteItemType;
  description?: string;
  quantity?: number;
  unit?: MaterialUnit;
  unitPrice?: number;
  sortOrder?: number;
}

export interface QuoteData {
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
  validUntil: Date;
  termsConditions?: string;
  notes?: string;
  items: QuoteItemData[];
  sentAt?: Date;
  viewedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Payment-related fields
  paymentIntentId?: string;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
  paidAt?: Date;
  refundId?: string;
  refundedAt?: Date;
  invoiceId?: string;
  invoiceUrl?: string;
  paymentMethodType?: PaymentMethodType;
}

export interface QuoteItemData {
  id: number;
  quoteId: number;
  itemType: QuoteItemType;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  totalPrice: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteWithRelations extends QuoteData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  tradieUsername: string;
  tradieEmail: string;
}

export interface QuoteWithPayment extends QuoteWithRelations {
  paymentFees?: PaymentFeeCalculation;
  paymentHistory?: PaymentHistoryItem[];
  canRefund?: boolean;
  refundableAmount?: number;
}

export interface QuoteFilterOptions {
  status?: QuoteStatus;
  clientId?: number;
  jobId?: number;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  paymentStatus?: PaymentStatus;
  hasPendingPayment?: boolean;
}

export interface QuoteSummary {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  accepted: number;
  rejected: number;
  expired: number;
  cancelled: number;
  // Payment-related summary
  paid: number;
  pendingPayment: number;
  refunded: number;
  totalRevenue: number;
  pendingRevenue: number;
}

export interface QuoteListResult {
  quotes: QuoteWithRelations[];
  summary: QuoteSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface QuoteStatusUpdateData {
  status: QuoteStatus;
  reason?: string;
}

export interface QuoteDeliveryData {
  quoteId: number;
  deliveryMethods: DeliveryMethod[];
  recipientEmail?: string;
  recipientPhone?: string;
  customMessage?: string;
}

export interface QuoteDeliveryResult {
  success: boolean;
  deliveryStatus: {
    email?: boolean;
    sms?: boolean;
    pdf?: boolean;
    portal?: boolean;
  };
  trackingId: string;
  errors?: string[];
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

export interface QuoteCalculation {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  itemTotals: {
    [key: number]: number;
  };
  paymentFees?: PaymentFeeCalculation;
  finalAmount?: number;
}

export interface QuoteTemplate {
  id: number;
  tradieId: number;
  name: string;
  description?: string;
  items: QuoteItemCreateData[];
  termsConditions?: string;
  gstEnabled: boolean;
  validityDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteNotification {
  id: number;
  quoteId: number;
  type: string;
  recipientId: number;
  recipientType: 'tradie' | 'client';
  channel: string;
  message: string;
  sentAt: Date;
  readAt?: Date;
}

export interface QuoteExpiryCheck {
  quoteId: number;
  quoteNumber: string;
  tradieId: number;
  clientId: number;
  validUntil: Date;
  daysUntilExpiry: number;
}

export interface QuoteAnalytics {
  totalQuotes: number;
  acceptanceRate: number;
  averageQuoteValue: number;
  averageResponseTime: number;
  topPerformingServices: {
    jobType: string;
    count: number;
    averageValue: number;
  }[];
  monthlyTrends: {
    month: string;
    quotesCreated: number;
    quotesAccepted: number;
    totalValue: number;
  }[];
  // Payment analytics
  paymentMetrics: {
    totalPaid: number;
    averagePaymentTime: number;
    paymentSuccessRate: number;
    refundRate: number;
    totalRefunded: number;
  };
}

// New Payment-Specific Interfaces for Quotes

export interface QuotePaymentData {
  quoteId: number;
  quoteNumber: string;
  paymentMethodId: string;
  clientId: number;
  tradieId: number;
  amount: number;
  currency: string;
  clientEmail: string;
  tradieEmail: string;
  description: string;
}

export interface QuotePaymentResult {
  quote: QuoteData;
  paymentResult: PaymentResult;
  invoiceUrl?: string;
  receiptUrl?: string;
}

export interface QuotePaymentIntentData {
  quoteId: number;
  quoteNumber: string;
  clientId: number;
  tradieId: number;
  amount: number;
  currency: string;
  clientEmail: string;
  tradieEmail: string;
  jobId?: number;
}

export interface QuotePaymentIntentResult {
  quote: QuoteData;
  paymentIntent: PaymentIntentResponse;
  fees: PaymentFeeCalculation;
}

export interface QuoteRefundData {
  quoteId: number;
  quoteNumber: string;
  paymentId: string;
  amount?: number;
  reason: string;
  tradieId: number;
  clientId: number;
}

export interface QuoteRefundResult {
  quote: QuoteData;
  refundResult: RefundResult;
}

export interface QuoteInvoiceData {
  quoteId: number;
  quoteNumber: string;
  paymentId: string;
  clientId: number;
  tradieId: number;
  jobId?: number;
}

export interface QuoteInvoiceResult {
  quote: QuoteData;
  invoiceResult: InvoiceResult;
}

export interface QuotePaymentSummary {
  quoteId: number;
  quoteNumber: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethodType;
  paidAmount: number;
  refundedAmount: number;
  outstandingAmount: number;
  paymentDate?: Date;
  refundDate?: Date;
  canRefund: boolean;
  fees: PaymentFeeCalculation;
}

export interface QuoteRepository {
  create(tradieId: number, data: QuoteCreateData): Promise<QuoteData>;
  findById(id: number): Promise<QuoteWithRelations | null>;
  findByNumber(quoteNumber: string): Promise<QuoteWithRelations | null>;
  findByTradie(tradieId: number, filters: QuoteFilterOptions): Promise<QuoteListResult>;
  findByClient(clientId: number, filters: QuoteFilterOptions): Promise<QuoteListResult>;
  update(id: number, tradieId: number, data: QuoteUpdateData): Promise<QuoteData>;
  updateStatus(id: number, tradieId: number, data: QuoteStatusUpdateData): Promise<QuoteData>;
  delete(id: number, tradieId: number): Promise<void>;
  findExpiring(hours: number): Promise<QuoteExpiryCheck[]>;
  expireQuotes(): Promise<number>;
  getAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<QuoteAnalytics>;
  // Payment-related repository methods
  updatePaymentStatus(quoteId: number, paymentStatus: PaymentStatus, paymentId?: string): Promise<QuoteData>;
  findByPaymentStatus(paymentStatus: PaymentStatus, limit?: number): Promise<QuoteWithRelations[]>;
  getPaymentSummary(quoteId: number): Promise<QuotePaymentSummary>;
}

export interface QuoteService {
  createQuote(tradieId: number, data: QuoteCreateData): Promise<QuoteData>;
  getQuote(id: number, userId: number, userRole: string): Promise<QuoteWithRelations>;
  getQuoteByNumber(quoteNumber: string): Promise<QuoteWithRelations>;
  getQuotes(tradieId: number, filters: QuoteFilterOptions): Promise<QuoteListResult>;
  updateQuote(id: number, tradieId: number, data: QuoteUpdateData): Promise<QuoteData>;
  updateQuoteStatus(id: number, tradieId: number, data: QuoteStatusUpdateData): Promise<QuoteData>;
  deleteQuote(id: number, tradieId: number): Promise<void>;
  sendQuote(id: number, tradieId: number, deliveryData: QuoteDeliveryData): Promise<QuoteDeliveryResult>;
  viewQuote(quoteNumber: string): Promise<QuoteWithRelations>;
  acceptQuote(quoteNumber: string, clientId: number): Promise<QuoteData>;
  rejectQuote(quoteNumber: string, clientId: number, reason?: string): Promise<QuoteData>;
  calculateQuote(items: QuoteItemCreateData[], gstEnabled: boolean): QuoteCalculation;
  generateQuoteNumber(): Promise<string>;
  checkExpiry(): Promise<void>;
  getAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<QuoteAnalytics>;
  
  // Payment integration methods
  createPaymentIntent(quoteNumber: string, clientId: number): Promise<QuotePaymentIntentResult>;
  acceptQuoteWithPayment(quoteNumber: string, clientId: number, paymentMethodId: string): Promise<QuotePaymentResult>;
  processQuotePayment(paymentData: QuotePaymentData): Promise<QuotePaymentResult>;
  refundQuotePayment(refundData: QuoteRefundData): Promise<QuoteRefundResult>;
  generateQuoteInvoice(invoiceData: QuoteInvoiceData): Promise<QuoteInvoiceResult>;
  getQuotePaymentSummary(quoteId: number): Promise<QuotePaymentSummary>;
  calculateQuoteWithFees(items: QuoteItemCreateData[], gstEnabled: boolean): QuoteCalculation;
  getQuoteWithPaymentDetails(quoteNumber: string): Promise<QuoteWithPayment>;
  handlePaymentWebhook(quoteId: number, paymentStatus: PaymentStatus, paymentId?: string): Promise<void>;
}

export interface AIPricingService {
  getSuggestedPricing(request: AIPricingRequest): Promise<AIPricingResponse>;
  analyzeJobComplexity(jobDescription: string, jobType: string): Promise<number>;
  generatePricingBreakdown(baseRate: number, duration: number, complexity: number): Promise<AIPricingResponse['breakdown']>;
}
