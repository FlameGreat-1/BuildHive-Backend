import { 
  JobApplicationDatabaseRecord,
  CreateJobApplicationRequest,
  UpdateJobApplicationRequest,
  JobApplicationResponse,
  JobApplicationListResponse
} from '../../shared/types';

import {
  ApplicationStatus,
  MarketplaceJobType,
  UrgencyLevel,
  MarketplaceNotificationType,
  APPLICATION_STATUS
} from '../../config/feeds';

import { MarketplaceJobSummary, MarketplaceJobEntity } from './marketplace.types';

export interface JobApplicationEntity extends Omit<JobApplicationDatabaseRecord, 'created_at' | 'updated_at' | 'application_timestamp'> {
  createdAt: Date;
  updatedAt: Date;
  applicationTimestamp: Date;
  isWithdrawable: boolean;
  canBeModified: boolean;
  timeUntilWithdrawalDeadline?: number;
}

export interface JobApplicationCreateData {
  marketplaceJobId: number;
  customQuote: number;
  proposedTimeline: string;
  approachDescription: string;
  materialsList?: string;
  availabilityDates: Date[];
  coverMessage?: string;
  relevantExperience?: string;
  additionalPhotos?: string[];
  questionsForClient?: string;
  specialOffers?: string;
}

export interface JobApplicationUpdateData {
  customQuote?: number;
  proposedTimeline?: string;
  approachDescription?: string;
  materialsList?: string;
  availabilityDates?: Date[];
  coverMessage?: string;
  relevantExperience?: string;
  additionalPhotos?: string[];
  questionsForClient?: string;
  specialOffers?: string;
  status?: ApplicationStatus;
}

export interface JobApplicationDetails extends JobApplicationEntity {
  marketplaceJob: {
    id: number;
    title: string;
    description: string;
    jobType: MarketplaceJobType;
    location: string;
    estimatedBudget?: number;
    urgencyLevel: UrgencyLevel;
    dateRequired: Date;
    clientName: string;
    clientCompany?: string;
  };
  tradie: {
    id: number;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    profile: {
      businessName?: string;
      abn?: string;
      serviceTypes: string[];
      hourlyRate?: number;
      location: string;
      rating?: number;
      reviewCount: number;
      completedJobs: number;
      yearsExperience?: number;
      qualifications: string[];
      insuranceDetails?: {
        hasPublicLiability: boolean;
        hasWorkersComp: boolean;
        expiryDate?: Date;
      };
    };
    marketplaceStats: {
      totalApplications: number;
      successfulApplications: number;
      conversionRate: number;
      averageQuote: number;
      lastApplicationAt?: Date;
    };
  };
  creditTransaction: {
    transactionId: number;
    creditsUsed: number;
    baseCost: number;
    urgencyMultiplier: number;
    jobTypeMultiplier: number;
    finalCost: number;
  };
  timeline: Array<{
    status: ApplicationStatus;
    timestamp: Date;
    reason?: string;
    updatedBy?: number;
  }>;
}

export interface JobApplicationSummary {
  id: number;
  marketplaceJobId: number;
  tradieId: number;
  customQuote: number;
  proposedTimeline: string;
  status: ApplicationStatus;
  applicationTimestamp: Date;
  creditsUsed: number;
  tradieName: string;
  tradieRating?: number;
  tradieCompletedJobs: number;
  jobTitle: string;
  jobType: MarketplaceJobType;
  jobLocation: string;
  isSelected: boolean;
  canWithdraw: boolean;
}

export interface JobApplicationFilters {
  status?: ApplicationStatus;
  marketplaceJobId?: number;
  tradieId?: number;
  jobType?: MarketplaceJobType;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  minQuote?: number;
  maxQuote?: number;
  location?: string;
}

export interface JobApplicationListParams {
  page: number;
  limit: number;
  sortBy: 'application_timestamp' | 'custom_quote' | 'tradie_rating' | 'status';
  sortOrder: 'asc' | 'desc';
  filters: JobApplicationFilters;
}

export interface JobApplicationSearchParams extends JobApplicationFilters {
  query?: string;
  sortBy?: 'application_timestamp' | 'custom_quote' | 'tradie_rating';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TradieApplicationHistory {
  totalApplications: number;
  successfulApplications: number;
  pendingApplications: number;
  rejectedApplications: number;
  withdrawnApplications: number;
  conversionRate: number;
  totalCreditsSpent: number;
  averageQuote: number;
  applications: JobApplicationSummary[];
  recentActivity: Array<{
    applicationId: number;
    jobTitle: string;
    action: string;
    timestamp: Date;
    status: ApplicationStatus;
  }>;
}

export interface ClientApplicationReview {
  marketplaceJobId: number;
  jobTitle: string;
  totalApplications: number;
  newApplications: number;
  reviewedApplications: number;
  applications: Array<{
    id: number;
    tradie: {
      id: number;
      name: string;
      businessName?: string;
      rating?: number;
      completedJobs: number;
      avatar?: string;
      location: string;
    };
    application: {
      customQuote: number;
      proposedTimeline: string;
      approachDescription: string;
      coverMessage?: string;
      relevantExperience?: string;
      applicationTimestamp: Date;
      status: ApplicationStatus;
    };
    marketplaceStats: {
      totalApplications: number;
      successfulApplications: number;
      conversionRate: number;
    };
    isRecommended: boolean;
    matchScore: number;
  }>;
  recommendations: {
    topRated: number[];
    bestValue: number[];
    quickestStart: number[];
    mostExperienced: number[];
  };
}

export interface ApplicationStatusUpdate {
  applicationId: number;
  newStatus: ApplicationStatus;
  reason?: string;
  feedback?: string;
  updatedBy: number;
  timestamp: Date;
  notifyTradie: boolean;
  notifyClient: boolean;
}

export interface ApplicationWithdrawal {
  applicationId: number;
  reason: string;
  refundCredits: boolean;
  refundAmount?: number;
  withdrawnAt: Date;
  canReapply: boolean;
  reapplyAfter?: Date;
}

export interface ApplicationValidationResult {
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
  creditCheck: {
    hasEnoughCredits: boolean;
    requiredCredits: number;
    currentBalance: number;
    shortfall?: number;
  };
  eligibilityCheck: {
    canApply: boolean;
    hasAlreadyApplied: boolean;
    profileComplete: boolean;
    meetsCriteria: boolean;
    reasons?: string[];
  };
}

export interface ApplicationAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalApplications: number;
    successfulApplications: number;
    conversionRate: number;
    averageQuote: number;
    totalCreditsSpent: number;
    averageResponseTime: number;
  };
  trends: {
    applicationsByDate: Array<{
      date: Date;
      count: number;
      successCount: number;
    }>;
    quotesByJobType: Record<MarketplaceJobType, {
      averageQuote: number;
      applicationCount: number;
      successRate: number;
    }>;
    performanceByLocation: Record<string, {
      applicationCount: number;
      successRate: number;
      averageQuote: number;
    }>;
  };
  insights: {
    bestPerformingJobTypes: MarketplaceJobType[];
    optimalQuoteRange: {
      min: number;
      max: number;
    };
    peakApplicationTimes: Array<{
      hour: number;
      successRate: number;
    }>;
    competitionAnalysis: {
      averageApplicationsPerJob: number;
      yourRanking: number;
      improvementAreas: string[];
    };
  };
}

export interface ApplicationNotificationData {
  applicationId: number;
  tradieId: number;
  clientId: number;
  marketplaceJobId: number;
  notificationType: MarketplaceNotificationType;
  data: {
    jobTitle: string;
    tradieName: string;
    clientName: string;
    customQuote?: number;
    status?: ApplicationStatus;
    reason?: string;
    feedback?: string;
  };
  channels: Array<'email' | 'sms' | 'push' | 'in_app'>;
  scheduledFor?: Date;
}

export interface ApplicationBulkOperation {
  operation: 'approve' | 'reject' | 'withdraw';
  applicationIds: number[];
  reason?: string;
  feedback?: string;
  notifyTradies: boolean;
  results: Array<{
    applicationId: number;
    success: boolean;
    error?: string;
    newStatus?: ApplicationStatus;
  }>;
}

export type ApplicationEventType = 
  | 'application_submitted'
  | 'application_updated'
  | 'application_reviewed'
  | 'application_selected'
  | 'application_rejected'
  | 'application_withdrawn';

export interface ApplicationEvent {
  type: ApplicationEventType;
  applicationId: number;
  marketplaceJobId: number;
  tradieId: number;
  clientId?: number;
  timestamp: Date;
  data: Record<string, any>;
  metadata: {
    source: string;
    version: string;
    requestId: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface ApplicationPermissions {
  canView: boolean;
  canEdit: boolean;
  canWithdraw: boolean;
  canUpdateStatus: boolean;
  canViewContactInfo: boolean;
  canCommunicate: boolean;
}

export interface ApplicationMatchingCriteria {
  jobType: MarketplaceJobType;
  location: string;
  maxDistance: number;
  budgetRange: {
    min?: number;
    max?: number;
  };
  urgencyLevel: UrgencyLevel;
  requiredSkills: string[];
  preferredQualifications: string[];
  minimumRating?: number;
  minimumCompletedJobs?: number;
}

export interface ApplicationRecommendation {
  applicationId: number;
  matchScore: number;
  reasons: string[];
  strengths: string[];
  concerns: string[];
  recommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
}
