export interface Job {
  id: number;
  tradieId: number;
  clientId: number;
  title: string;
  description: string;
  jobType: JobType;
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
  startDate: Date;
  dueDate: Date;
  estimatedDuration: number;
  hoursWorked: number;
  totalCost?: number;
  notes: string[];
  tags: JobTag[];
  materials: Material[];
  attachments: JobAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobData {
  title: string;
  description: string;
  jobType: JobType;
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
  startDate: Date;
  dueDate: Date;
  estimatedDuration: number;
  materials?: CreateMaterialData[];
  notes?: string[];
}

export interface UpdateJobData {
  title?: string;
  description?: string;
  status?: JobStatus;
  priority?: JobPriority;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  siteAddress?: string;
  siteCity?: string;
  siteState?: string;
  sitePostcode?: string;
  siteAccessInstructions?: string;
  startDate?: Date;
  dueDate?: Date;
  estimatedDuration?: number;
  hoursWorked?: number;
  notes?: string[];
  tags?: JobTag[];
}

export interface JobFilter {
  status?: JobStatus;
  jobType?: JobType;
  priority?: JobPriority;
  clientId?: number;
  startDate?: Date;
  endDate?: Date;
  tags?: JobTag[];
  search?: string;
  isOverdue?: boolean;  
}

export interface JobSortOptions {
  field: JobSortField;
  order: SortOrder;
}

export interface JobListOptions {
  page: number;
  limit: number;
  filter?: JobFilter;
  sort?: JobSortOptions;
}

export interface JobSummary {
  total: number;
  pending: number;
  active: number;
  completed: number;
  cancelled: number;
  onHold: number;
  totalRevenue: number;
  averageHours: number;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  pendingJobs: number;
  overdueJobs: number;
  averageJobValue: number;
}

export interface Client {
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
  tags: ClientTag[];
  totalJobs: number;
  totalRevenue: number;
  lastJobDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrichedClient extends Client {
  reference: string;
  isVIP: boolean;
  value: number;
  lifetimeValue?: number;
  rating?: number;
  jobCount?: number;
}

export interface CreateClientData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  notes?: string;
  tags?: ClientTag[];
  reference?: string;  
  isVIP?: boolean;      
  value?: number;
}

export interface UpdateClientData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  notes?: string;
  tags?: ClientTag[];
  reference?: string;
  isVIP?: boolean;
  value?: number;
}

export interface ClientFilter {
  search?: string;
  tags?: ClientTag[];
  hasJobs?: boolean;
  minRevenue?: number;
  maxRevenue?: number;
  lastJobAfter?: Date;
  lastJobBefore?: Date;
}

export interface ClientSortOptions {
  field: ClientSortField;
  order: SortOrder;
}

export interface ClientListOptions {
  page: number;
  limit: number;
  filter?: ClientFilter;
  sort?: ClientSortOptions;
}

export interface Material {
  id: number;
  jobId: number;
  name: string;
  quantity: number;
  unit: MaterialUnit;
  unitCost: number;
  totalCost: number;
  supplier?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMaterialData {
  name: string;
  quantity: number;
  unit: MaterialUnit;
  unitCost: number;
  supplier?: string;
  notes?: string;
}

export interface UpdateMaterialData {
  name?: string;
  quantity?: number;
  unit?: MaterialUnit;
  unitCost?: number;
  supplier?: string;
  notes?: string;
}

export interface JobAttachment {
  id: number;
  jobId: number;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  path: string;
  size: number;
  uploadedAt: Date;
}

export interface CreateAttachmentData {
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface JobEvent {
  type: JobEventType;
  jobId: number;
  tradieId: number;
  data: Record<string, any>;
  timestamp: Date;
}

export interface JobStatistics {
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  pendingJobs: number;
  totalRevenue: number;
  totalHours: number;
  averageJobDuration: number;
  completionRate: number;
  clientCount: number;
  materialCosts: number;
  jobsByStatus: Record<JobStatus, number>;
  jobsByType: Record<JobType, number>;
  jobsByPriority: Record<JobPriority, number>;
  monthlyStats: Array<{
    month: string;
    jobsCompleted: number;
    revenue: number;
  }>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ClientService {
  createClient(tradieId: number, data: CreateClientData): Promise<Client>;
  getClientById(clientId: number, tradieId: number): Promise<Client>;
  getAllClientsByTradieId(tradieId: number): Promise<Client[]>;
  getClientsByTradieId(tradieId: number, options?: ClientListOptions): Promise<{
    clients: Client[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  updateClient(clientId: number, tradieId: number, data: UpdateClientData): Promise<Client>;
  deleteClient(clientId: number, tradieId: number): Promise<boolean>;
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
  FLOORING = 'flooring',
  TILING = 'tiling',
  HVAC = 'hvac',
  LANDSCAPING = 'landscaping',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
  RENOVATION = 'renovation',
  INSTALLATION = 'installation',
  REPAIR = 'repair',
  INSPECTION = 'inspection',
  HANDYMAN = 'handyman',
  GENERAL = 'general',
  OTHER = 'other'
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

export enum ClientTag {
  VIP = 'vip',
  REPEAT_CUSTOMER = 'repeat_customer',
  HIGH_VALUE = 'high_value',
  DIFFICULT = 'difficult',
  PREFERRED = 'preferred',
  CORPORATE = 'corporate',
  RESIDENTIAL = 'residential'
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

export enum JobSortField {
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  START_DATE = 'start_date',
  DUE_DATE = 'due_date',
  TITLE = 'title',
  STATUS = 'status',
  PRIORITY = 'priority',
  CLIENT_NAME = 'client_name'
}

export enum ClientSortField {
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  NAME = 'name',
  TOTAL_JOBS = 'total_jobs',
  TOTAL_REVENUE = 'total_revenue',
  LAST_JOB_DATE = 'last_job_date'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export enum JobEventType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  STATUS_CHANGED = 'status_changed',
  MATERIAL_ADDED = 'material_added',
  MATERIAL_UPDATED = 'material_updated',
  MATERIAL_REMOVED = 'material_removed',
  ATTACHMENT_ADDED = 'attachment_added',
  ATTACHMENT_REMOVED = 'attachment_removed',
  CLIENT_UPDATED = 'client_updated'
}

export type JobRepository = {
  create(tradieId: number, data: CreateJobData): Promise<Job>;
  findById(id: number): Promise<Job | null>;
  findByTradieId(tradieId: number, options?: JobListOptions): Promise<Job[]>;
  update(id: number, data: UpdateJobData): Promise<Job | null>;
  delete(id: number): Promise<boolean>;
  count(tradieId: number, filter?: JobFilter): Promise<number>;
  getSummary(tradieId: number): Promise<JobSummary>;
  getStatistics(tradieId: number): Promise<JobStatistics>;
};

export type ClientRepository = {
  create(tradieId: number, data: CreateClientData): Promise<Client>;
  findById(id: number): Promise<Client | null>;
  findByTradieId(tradieId: number, options?: ClientListOptions): Promise<Client[]>;
  findByEmail(tradieId: number, email: string): Promise<Client | null>;
  update(id: number, data: UpdateClientData): Promise<Client | null>;
  delete(id: number): Promise<boolean>;
  count(tradieId: number, filter?: ClientFilter): Promise<number>;
  updateStats(clientId: number): Promise<void>;
};

export type MaterialRepository = {
  create(jobId: number, data: CreateMaterialData): Promise<Material>;
  findByJobId(jobId: number): Promise<Material[]>;
  update(id: number, data: UpdateMaterialData): Promise<Material | null>;
  delete(id: number): Promise<boolean>;
  deleteByJobId(jobId: number): Promise<boolean>;
};

export type AttachmentRepository = {
  create(jobId: number, data: CreateAttachmentData): Promise<JobAttachment>;
  findByJobId(jobId: number): Promise<JobAttachment[]>;
  findById(id: number): Promise<JobAttachment | null>;
  delete(id: number): Promise<boolean>;
  deleteByJobId(jobId: number): Promise<boolean>;
};
