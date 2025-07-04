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
