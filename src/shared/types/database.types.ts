export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

export interface DatabaseTransaction {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  transaction(): Promise<DatabaseTransaction>;
  end(): Promise<void>;
}

export enum UserRole {
  CLIENT = 'client',
  TRADIE = 'tradie',
  ENTERPRISE = 'enterprise'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended'
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook'
}

export enum JobStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold'
}

export enum JobType {
  ELECTRICAL = 'electrical',
  PLUMBING = 'plumbing',
  CARPENTRY = 'carpentry',
  PAINTING = 'painting',
  ROOFING = 'roofing',
  HVAC = 'hvac',
  LANDSCAPING = 'landscaping',
  CLEANING = 'cleaning',
  HANDYMAN = 'handyman',
  GENERAL = 'general'
}

export enum JobPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum JobTag {
  INVOICED = 'invoiced',
  PAID = 'paid',
  UNPAID = 'unpaid',
  REPEAT_CLIENT = 'repeat_client',
  EMERGENCY = 'emergency',
  WARRANTY = 'warranty',
  FOLLOW_UP = 'follow_up'
}

export enum MaterialUnit {
  PIECE = 'piece',
  METER = 'meter',
  SQUARE_METER = 'square_meter',
  CUBIC_METER = 'cubic_meter',
  KILOGRAM = 'kilogram',
  LITER = 'liter',
  HOUR = 'hour',
  DAY = 'day',
  SET = 'set',
  BOX = 'box'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  CANCELED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REQUIRES_ACTION = 'requires_action'
}

export enum PaymentMethod {
  CARD = 'card',
  STRIPE_CARD = 'stripe_card',
  CASH = 'cash',
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

export interface JobDatabaseRecord {
  id: number;
  tradie_id: number;
  client_id: number;
  title: string;
  description: string;
  job_type: JobType;
  status: JobStatus;
  priority: JobPriority;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_company?: string;
  site_address: string;
  site_city: string;
  site_state: string;
  site_postcode: string;
  site_access_instructions?: string;
  start_date: Date;
  due_date: Date;
  estimated_duration: number;
  hours_worked: number;
  notes: string[];
  tags: JobTag[];
  created_at: Date;
  updated_at: Date;
}

export interface MaterialDatabaseRecord {
  id: number;
  job_id: number;
  name: string;
  quantity: number;
  unit: MaterialUnit;
  unit_cost: number;
  total_cost: number;
  supplier?: string;
  created_at: Date;
  updated_at: Date;
}

export interface JobAttachmentDatabaseRecord {
  id: number;
  job_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: Date;
}

export interface ClientDatabaseRecord {
  id: number;
  tradie_id: number;
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
  total_jobs: number;
  total_revenue: number;
  last_job_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent', 
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum QuoteItemType {
  LABOUR = 'labour',
  MATERIAL = 'material', 
  EQUIPMENT = 'equipment',
  SUBCONTRACTOR = 'subcontractor',
  PERMIT = 'permit',
  TRAVEL = 'travel',
  MARKUP = 'markup',
  DISCOUNT = 'discount'
}

export enum DeliveryMethod {
  EMAIL = 'email',
  SMS = 'sms', 
  PDF = 'pdf',
  PORTAL = 'portal'
}

export interface QuoteDatabaseRecord {
  id: number;
  tradie_id: number;
  client_id: number;
  job_id?: number;
  quote_number: string;
  title: string;
  description?: string;
  status: QuoteStatus;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  gst_enabled: boolean;
  valid_until: Date;
  terms_conditions?: string;
  notes?: string;
  sent_at?: Date;
  viewed_at?: Date;
  accepted_at?: Date;
  rejected_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface QuoteItemDatabaseRecord {
  id: number;
  quote_id: number;
  item_type: QuoteItemType;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unit_price: number;
  total_price: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due'
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  FAILED = 'failed'  
}

export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
  FAILED = 'failed'
}

export interface PaymentDatabaseRecord {
  id: number;
  user_id: number;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_type: PaymentType;
  status: PaymentStatus;
  description?: string;
  metadata?: Record<string, any>;
  invoice_id?: number;
  subscription_id?: number;
  credits_purchased?: number;
  stripe_fee?: number;
  platform_fee?: number;
  processing_fee?: number;
  failure_reason?: string;
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
  status: InvoiceStatus;
  due_date: Date;
  description?: string;
  processing_fee?: number;
  metadata?: Record<string, any>;
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
  description?: string;
  status: RefundStatus;
  stripe_refund_id?: string;
  failure_reason?: string; 
  processed_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionDatabaseRecord {
  id: number;
  user_id: number;
  stripe_subscription_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
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
  transaction_type: CreditTransactionType;
  credits: number;
  status: CreditTransactionStatus;
  description: string;
  reference_id?: number;
  reference_type?: string;
  expires_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEventDatabaseRecord {
  id: number;
  stripe_event_id: string;
  event_type: string;
  processed: boolean;
  data: Record<string, any>;
  retry_count: number;
  failure_reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  processed_at?: Date;
}

export interface UserDatabaseRecord {
  id: number;
  username: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  status: UserStatus;
  auth_provider: AuthProvider;
  social_id?: string;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  login_attempts: number;
  locked_until?: Date;
  last_login_at?: Date;
  stripe_customer_id?: string;
  credit_balance: number;
  daily_usage: number;
  monthly_usage: number;
  daily_spent: number;
  monthly_spent: number;
  daily_transactions: number;
  monthly_transactions: number;
  subscription_id?: number;
  subscription_status?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProfileDatabaseRecord {
  id: number;
  user_id: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  preferences: Record<string, any>;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SessionDatabaseRecord {
  id: number;
  user_id: number;
  token: string;
  type: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseRecord {
  id: number;
  created_at: Date;
  updated_at: Date;
}

export enum CreditTransactionType {
  PURCHASE = 'purchase',
  USAGE = 'usage',
  REFUND = 'refund',
  BONUS = 'bonus',
  TRIAL = 'trial',
  SUBSCRIPTION = 'subscription',
  EXPIRY = 'expiry'
}

export enum CreditTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum CreditUsageType {
  JOB_APPLICATION = 'job_application',
  PROFILE_BOOST = 'profile_boost',
  PREMIUM_JOB_UNLOCK = 'premium_job_unlock',
  DIRECT_MESSAGE = 'direct_message',
  FEATURED_LISTING = 'featured_listing'
}

export enum CreditPackageType {
  STARTER = 'starter',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum AutoTopupStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  SUSPENDED = 'suspended',
  PROCESSING = 'processing'
}

export interface CreditBalanceDatabaseRecord {
  id: number;
  user_id: number;
  current_balance: number;
  total_purchased: number;
  total_used: number;
  total_refunded: number;
  last_purchase_at?: Date;
  last_usage_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreditPurchaseDatabaseRecord {
  id: number;
  user_id: number;
  payment_id: number;
  package_type: CreditPackageType;
  credits_amount: number;
  purchase_price: number;
  currency: string;
  bonus_credits: number;
  status: CreditTransactionStatus;
  expires_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreditUsageDatabaseRecord {
  id: number;
  user_id: number;
  transaction_id: number;
  usage_type: CreditUsageType;
  credits_used: number;
  reference_id?: number;
  reference_type?: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface AutoTopupDatabaseRecord {
  id: number;
  user_id: number;
  status: AutoTopupStatus;
  trigger_balance: number;
  topup_amount: number;
  package_type: CreditPackageType;
  payment_method_id: number;
  last_triggered_at?: Date;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreditNotificationDatabaseRecord {
  id: number;
  user_id: number;
  notification_type: string;
  threshold_balance: number;
  is_sent: boolean;
  sent_at?: Date;
  created_at: Date;
}

export interface CreditTransactionFilter {
  userId: number;
  page: number;
  limit: number;
  transactionType?: CreditTransactionType;
  status?: CreditTransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  minCredits?: number;
  maxCredits?: number;
  referenceType?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface AutoTopupSettings {
  enabled: boolean;
  triggerBalance: number;
  topupAmount: number;
  packageType: CreditPackageType;
  paymentMethodId: number;
}