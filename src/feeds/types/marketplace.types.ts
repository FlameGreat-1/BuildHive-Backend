import { 
    MarketplaceJobDatabaseRecord, 
    JobApplicationDatabaseRecord,
    MarketplaceJobAssignmentDatabaseRecord,
    CreateMarketplaceJobRequest,
    UpdateMarketplaceJobRequest,
    MarketplaceJobResponse,
    MarketplaceJobListResponse,
    MarketplaceSearchRequest,
    MarketplaceSearchResponse
  } from '../../shared/types';
  
  import {
    Marketplacejob_type,
    MarketplaceJobStatus,
    UrgencyLevel,
    MarketplaceSortOption,
    MarketplaceAnalyticsPeriod,
    MARKETPLACE_JOB_TYPES,
    MARKETPLACE_JOB_STATUS,
    URGENCY_LEVEL,
    MARKETPLACE_SORT_OPTIONS,
    MARKETPLACE_FILTER_OPTIONS
  } from '../../config/feeds';
  
  export interface MarketplaceJobEntity extends Omit<MarketplaceJobDatabaseRecord, 'created_at' | 'updated_at'> {
    createdAt: Date;
    updatedAt: Date;
    applicationCount: number;
    isExpired: boolean;
    daysUntilExpiry: number;
    creditCostForApplication: number;
  }
  
  export interface MarketplaceJobCreateData {
    title: string;
    description: string;
    job_type: Marketplacejob_type;
    location: string;
    estimatedBudget?: number;
    dateRequired: Date;
    urgencyLevel: UrgencyLevel;
    photos?: string[];
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    clientCompany?: string;
  }
  
  export interface MarketplaceJobUpdateData {
    title?: string;
    description?: string;
    estimatedBudget?: number;
    dateRequired?: Date;
    urgencyLevel?: UrgencyLevel;
    photos?: string[];
    status?: MarketplaceJobStatus;
  }
  
  export interface MarketplaceJobFilters {
    job_type?: Marketplacejob_type;
    location?: string;
    urgencyLevel?: UrgencyLevel;
    minBudget?: number;
    maxBudget?: number;
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
    excludeApplied?: boolean;
    tradie_id?: number;
  }
  
  export interface MarketplaceJobSearchParams extends MarketplaceJobFilters {
    query?: string;
    sortBy?: MarketplaceSortOption;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    radius?: number;
  }
  
  export interface MarketplaceJobListParams {
    page: number;
    limit: number;
    sortBy: MarketplaceSortOption;
    sortOrder: 'asc' | 'desc';
    filters: MarketplaceJobFilters;
  }
  
  export interface MarketplaceJobSummary {
    id: number;
    title: string;
    job_type: Marketplacejob_type;
    location: string;
    estimatedBudget?: number;
    urgencyLevel: UrgencyLevel;
    applicationCount: number;
    status: MarketplaceJobStatus;
    createdAt: Date;
    daysUntilExpiry: number;
    creditCost: number;
    hasApplied?: boolean;
  }
  
  export interface MarketplaceJobDetails extends MarketplaceJobEntity {
    client: {
      id?: number;
      name: string;
      email: string;
      phone?: string;
      company?: string;
      isVerified: boolean;
    };
    applications?: {
      count: number;
      hasUserApplied: boolean;
      userApplicationId?: number;
    };
    creditCost: {
      baseCost: number;
      urgencyMultiplier: number;
      job_typeMultiplier: number;
      finalCost: number;
    };
    relatedJobs?: MarketplaceJobSummary[];
  }
  
  export interface MarketplaceJobStats {
    totalJobs: number;
    activeJobs: number;
    expiredJobs: number;
    assignedJobs: number;
    averageApplicationsPerJob: number;
    totalApplications: number;
    conversionRate: number;
    topjob_types: Array<{
      job_type: Marketplacejob_type;
      count: number;
      percentage: number;
    }>;
    topLocations: Array<{
      location: string;
      count: number;
      percentage: number;
    }>;
  }
  
  export interface MarketplaceJobAnalytics {
    period: MarketplaceAnalyticsPeriod;
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
    metrics: {
      jobsPosted: number;
      totalApplications: number;
      successfulAssignments: number;
      averageTimeToAssignment: number;
      creditsSpent: number;
      conversionRate: number;
    };
    trends: {
      jobPostingTrend: Array<{
        date: Date;
        count: number;
      }>;
      applicationTrend: Array<{
        date: Date;
        count: number;
      }>;
      assignmentTrend: Array<{
        date: Date;
        count: number;
      }>;
    };
    demographics: {
      job_typeDistribution: Record<Marketplacejob_type, number>;
      locationDistribution: Record<string, number>;
      urgencyDistribution: Record<UrgencyLevel, number>;
      budgetDistribution: Array<{
        range: string;
        count: number;
      }>;
    };
  }
  
  export interface ClientMarketplaceDashboard {
    overview: {
      totalJobsPosted: number;
      activeJobs: number;
      totalApplicationsReceived: number;
      totalHiresMade: number;
      averageApplicationsPerJob: number;
      averageHireTime: number;
    };
    recentJobs: MarketplaceJobSummary[];
    pendingApplications: number;
    notifications: Array<{
      id: number;
      type: string;
      message: string;
      createdAt: Date;
      read: boolean;
    }>;
    analytics: {
      applicationTrends: Array<{
        date: Date;
        applications: number;
      }>;
      jobPerformance: Array<{
        jobId: number;
        title: string;
        applications: number;
        status: MarketplaceJobStatus;
      }>;
    };
  }
  
  export interface MarketplaceJobAssignment {
    id: number;
    marketplace_job_id : number;
    selectedtradie_id: number;
    selectedApplicationId: number;
    existingJobId: number;
    selectionReason?: string;
    negotiatedQuote?: number;
    projectStartDate?: Date;
    assignmentTimestamp: Date;
    createdAt: Date;
    job: {
      title: string;
      job_type: Marketplacejob_type;
      location: string;
    };
    tradie: {
      id: number;
      name: string;
      email: string;
      phone?: string;
      avatar?: string;
    };
  }
  
  export interface TradieSelectionData {
    marketplace_job_id : number;
    selectedApplicationId: number;
    selectionReason?: string;
    negotiatedQuote?: number;
    projectStartDate?: Date;
  }
  
  export interface MarketplaceJobExpiry {
    jobId: number;
    title: string;
    expiresAt: Date;
    applicationCount: number;
    notificationSent: boolean;
  }
  
  export interface MarketplaceCreditCost {
    marketplace_job_id : number;
    job_type: Marketplacejob_type;
    urgencyLevel: UrgencyLevel;
    baseCost: number;
    urgencyMultiplier: number;
    job_typeMultiplier: number;
    finalCost: number;
    calculation: {
      step1: string;
      step2: string;
      step3: string;
    };
  }
  
  export interface MarketplaceNotificationData {
    userId: number;
    notificationType: string;
    title: string;
    message: string;
    marketplace_job_id ?: number;
    applicationId?: number;
    assignmentId?: number;
    data?: Record<string, any>;
    expiresAt?: Date;
  }
  
  export interface MarketplaceSearchResult {
    jobs: MarketplaceJobSummary[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    filters: MarketplaceJobFilters;
    searchQuery?: string;
    sortBy: MarketplaceSortOption;
    sortOrder: 'asc' | 'desc';
  }
  
  export interface MarketplaceJobValidationResult {
    isValid: boolean;
    errors: Array<{
      field: string;
      message: string;
      code: string;
    }>;
    warnings: Array<{
      field: string;
      message: string;
    }>;
  }
  
  export interface MarketplaceJobBulkOperation {
    operation: 'expire' | 'activate' | 'cancel';
    jobIds: number[];
    reason?: string;
    results: Array<{
      jobId: number;
      success: boolean;
      error?: string;
    }>;
  }
  
  export type MarketplaceJobEventType = 
    | 'job_created'
    | 'job_updated' 
    | 'job_expired'
    | 'job_assigned'
    | 'job_cancelled';
  
  export interface MarketplaceJobEvent {
    type: MarketplaceJobEventType;
    jobId: number;
    userId?: number;
    timestamp: Date;
    data: Record<string, any>;
    metadata: {
      source: string;
      version: string;
      requestId: string;
    };
  }
  
  export interface MarketplaceJobCache {
    key: string;
    data: any;
    expiresAt: Date;
    tags: string[];
  }
  
  export interface MarketplaceJobPermissions {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canAssign: boolean;
    canViewApplications: boolean;
    canManageApplications: boolean;
  }
  