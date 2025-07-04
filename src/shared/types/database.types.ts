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
