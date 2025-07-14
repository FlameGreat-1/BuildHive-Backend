import { WebhookEventType, WebhookEventDatabaseRecord } from '../../shared/types';

export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: any;
    previous_attributes?: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string;
    idempotency_key?: string;
  };
  type: string;
}

export interface WebhookEventPayload {
  stripeEventId: string;
  eventType: WebhookEventType;
  data: Record<string, any>;
  processed: boolean;
  retryCount?: number;
}

export interface WebhookProcessingResult {
  success: boolean;
  processed: boolean;
  eventId: string | null;
  message: string;
}

export interface PaymentIntentWebhookData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  customer?: string;
  metadata?: Record<string, any>;
  last_payment_error?: {
    code: string;
    message: string;
    type: string;
  };
}

export interface PaymentMethodWebhookData {
  id: string;
  type: string;
  customer?: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export interface ChargeWebhookData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_intent?: string;
  payment_method?: string;
  failure_code?: string;
  failure_message?: string;
  dispute?: {
    id: string;
    amount: number;
    reason: string;
    status: string;
  };
}

export interface WebhookEventHandler {
  eventType: WebhookEventType;
  handler: (data: any) => Promise<WebhookProcessingResult>;
  retryable: boolean;
  maxRetries: number;
}

export interface WebhookRetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface WebhookValidationResult {
  isValid: boolean;
  errors?: string[];
  event?: StripeWebhookEvent;
  error?: string;
}

export interface WebhookProcessingContext {
  eventId: string;
  eventType: WebhookEventType;
  attempt: number;
  maxAttempts: number;
  processingStarted: Date;
  requestId: string;
}

export interface WebhookEventFilter {
  eventType?: WebhookEventType;
  processed?: boolean;
  startDate?: Date;
  endDate?: Date;
  retryCount?: number;
}

export interface WebhookEventSummary {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  pendingEvents: number;
  eventsByType: Record<WebhookEventType, number>;
}

export interface WebhookSignatureValidation {
  timestamp: number;
  signatures: string[];
  payload: string;
  secret: string;
}

export interface WebhookDeadLetterEvent {
  originalEventId: string;
  eventType: WebhookEventType;
  failureReason: string;
  attemptCount: number;
  lastAttemptAt: Date;
  data: Record<string, any>;
}

export interface WebhookBatchProcessingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    eventId: string;
    error: string;
  }>;
}

export interface WebhookEventRequest {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string;
    idempotency_key?: string;
  };
  stripeEventId?: string;
}

export type WebhookEventEntity = WebhookEventDatabaseRecord;
