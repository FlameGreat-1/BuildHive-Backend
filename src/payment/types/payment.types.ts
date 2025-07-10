import { 
  PaymentStatus, 
  PaymentMethod, 
  PaymentType,
  PaymentDatabaseRecord,
  PaymentMethodDatabaseRecord 
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
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  requiresAction: boolean;
  nextAction?: PaymentNextAction;
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
}

export interface CreatePaymentMethodResponse {
  paymentMethodId: string;
  type: PaymentMethod;
  card?: CardDetails;
  clientSecret?: string;
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
  expiresAt?: Date;
  created: Date;
}

export interface ApplePaySessionRequest {
  validationUrl: string;
  displayName: string;
  domainName: string;
}

export interface ApplePaySessionResponse {
  merchantSession: any;
  success: boolean;
}

export interface ApplePayPaymentRequest {
  paymentData: any;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
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
}

export interface GooglePayConfigResponse {
  merchantId: string;
  merchantName: string;
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

export type PaymentEntity = PaymentDatabaseRecord;
export type PaymentMethodEntity = PaymentMethodDatabaseRecord;
