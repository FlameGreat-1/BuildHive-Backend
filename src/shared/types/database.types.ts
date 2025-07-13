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
  CANCELLED = 'cancelled'
}

export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
  FAILED = 'failed'
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
  credits: number;
  transaction_type: 'purchase' | 'usage' | 'refund' | 'bonus';
  description?: string;
  job_application_id?: number;
  created_at: Date;
}
