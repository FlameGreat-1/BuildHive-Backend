import { 
  MarketplaceJobEntity,
  MarketplaceJobCreateData,
  MarketplaceJobSummary,
  MarketplaceJobDetails,
  MarketplaceJobFilters,
  MarketplaceJobSearchParams,
  MarketplaceCreditCost,
  MarketplaceJobValidationResult
} from '../types';
import {
  MARKETPLACE_JOB_TYPES,
  MARKETPLACE_JOB_STATUS,
  URGENCY_LEVEL,
  MARKETPLACE_CREDIT_COSTS,
  MARKETPLACE_LIMITS,
  MARKETPLACE_VALIDATION_RULES,
  MARKETPLACE_FILTER_OPTIONS,
  MARKETPLACE_SORT_OPTIONS
} from '../../config/feeds';

export const validateMarketplaceJobData = (jobData: MarketplaceJobCreateData): MarketplaceJobValidationResult => {
  const errors: Array<{ field: string; message: string; code: string }> = [];
  const warnings: Array<{ field: string; message: string }> = [];

  if (!jobData.title || jobData.title.trim().length < MARKETPLACE_LIMITS.JOB_TITLE_MIN_LENGTH) {
    errors.push({
      field: 'title',
      message: `Job title must be at least ${MARKETPLACE_LIMITS.JOB_TITLE_MIN_LENGTH} characters long`,
      code: 'TITLE_TOO_SHORT'
    });
  }

  if (jobData.title && jobData.title.length > MARKETPLACE_LIMITS.JOB_TITLE_MAX_LENGTH) {
    errors.push({
      field: 'title',
      message: `Job title cannot exceed ${MARKETPLACE_LIMITS.JOB_TITLE_MAX_LENGTH} characters`,
      code: 'TITLE_TOO_LONG'
    });
  }

  if (!jobData.description || jobData.description.trim().length < MARKETPLACE_LIMITS.JOB_DESCRIPTION_MIN_LENGTH) {
    errors.push({
      field: 'description',
      message: `Job description must be at least ${MARKETPLACE_LIMITS.JOB_DESCRIPTION_MIN_LENGTH} characters long`,
      code: 'DESCRIPTION_TOO_SHORT'
    });
  }

  if (jobData.description && jobData.description.length > MARKETPLACE_LIMITS.JOB_DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: 'description',
      message: `Job description cannot exceed ${MARKETPLACE_LIMITS.JOB_DESCRIPTION_MAX_LENGTH} characters`,
      code: 'DESCRIPTION_TOO_LONG'
    });
  }

  if (!jobData.job_type || !Object.values(MARKETPLACE_JOB_TYPES).includes(jobData.job_type as any)) {
    errors.push({
      field: 'jobType',
      message: 'Invalid job type',
      code: 'INVALID_JOB_TYPE'
    });
  }

  if (!jobData.location || jobData.location.trim().length < MARKETPLACE_LIMITS.LOCATION_MIN_LENGTH) {
    errors.push({
      field: 'location',
      message: `Location must be at least ${MARKETPLACE_LIMITS.LOCATION_MIN_LENGTH} characters long`,
      code: 'LOCATION_TOO_SHORT'
    });
  }

  if (jobData.estimated_budget !== undefined) {
    if (jobData.estimated_budget < MARKETPLACE_LIMITS.MIN_ESTIMATED_BUDGET) {
      errors.push({
        field: 'estimatedBudget',
        message: `Estimated budget must be at least $${MARKETPLACE_LIMITS.MIN_ESTIMATED_BUDGET}`,
        code: 'BUDGET_TOO_LOW'
      });
    }

    if (jobData.estimated_budget > MARKETPLACE_LIMITS.MAX_ESTIMATED_BUDGET) {
      errors.push({
        field: 'estimatedBudget',
        message: `Estimated budget cannot exceed $${MARKETPLACE_LIMITS.MAX_ESTIMATED_BUDGET}`,
        code: 'BUDGET_TOO_HIGH'
      });
    }
  }

  if (!jobData.date_required) {
    errors.push({
      field: 'dateRequired',
      message: 'Date required is mandatory',
      code: 'DATE_REQUIRED_MISSING'
    });
  } else {
    const dateRequired = new Date(jobData.date_required);
    const now = new Date();
    if (dateRequired <= now) {
      errors.push({
        field: 'dateRequired',
        message: 'Date required must be in the future',
        code: 'INVALID_DATE_REQUIRED'
      });
    }
  }

  if (!jobData.urgency_level || !Object.values(URGENCY_LEVEL).includes(jobData.urgency_level as any)) {
    errors.push({
      field: 'urgencyLevel',
      message: 'Invalid urgency level',
      code: 'INVALID_URGENCY_LEVEL'
    });
  }

  if (!jobData.client_name || jobData.client_name.trim().length === 0) {
    errors.push({
      field: 'clientName',
      message: 'Client name is required',
      code: 'CLIENT_NAME_REQUIRED'
    });
  }

  if (!jobData.client_email || !MARKETPLACE_VALIDATION_RULES.EMAIL_REGEX.test(jobData.client_email)) {
    errors.push({
      field: 'clientEmail',
      message: 'Valid client email is required',
      code: 'INVALID_CLIENT_EMAIL'
    });
  }

  if (jobData.client_phone && !MARKETPLACE_VALIDATION_RULES.PHONE_REGEX.test(jobData.client_phone)) {
    warnings.push({
      field: 'clientPhone',
      message: 'Client phone number format may be invalid'
    });
  }

  if (jobData.photos && jobData.photos.length > MARKETPLACE_LIMITS.MAX_PHOTOS_PER_JOB) {
    errors.push({
      field: 'photos',
      message: `Maximum ${MARKETPLACE_LIMITS.MAX_PHOTOS_PER_JOB} photos allowed`,
      code: 'TOO_MANY_PHOTOS'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const sanitizeMarketplaceJobData = (jobData: MarketplaceJobCreateData): MarketplaceJobCreateData => {
  const sanitizeString = (input: string): string => {
    return input.trim().replace(/[<>]/g, '').replace(/\s+/g, ' ');
  };

  return {
    ...jobData,
    title: sanitizeString(jobData.title.trim()),
    description: sanitizeString(jobData.description.trim()),
    location: sanitizeString(jobData.location.trim()),
    client_name: sanitizeString(jobData.client_name.trim()),
    client_email: jobData.client_email.trim().toLowerCase(),
    client_phone: jobData.client_phone?.trim(),
    client_company: jobData.client_company ? sanitizeString(jobData.client_company.trim()) : undefined
  };
};

export const calculateCreditCost = (jobType: string, urgencyLevel: string): MarketplaceCreditCost => {
  const baseCost = MARKETPLACE_CREDIT_COSTS.BASE_APPLICATION_COST;
  const urgencyMultiplier = MARKETPLACE_CREDIT_COSTS.URGENCY_MULTIPLIERS[urgencyLevel as keyof typeof MARKETPLACE_CREDIT_COSTS.URGENCY_MULTIPLIERS] || 1.0;
  const jobTypeMultiplier = MARKETPLACE_CREDIT_COSTS.JOB_TYPE_MULTIPLIERS[jobType as keyof typeof MARKETPLACE_CREDIT_COSTS.JOB_TYPE_MULTIPLIERS] || 1.0;
  const finalCost = Math.ceil(baseCost * urgencyMultiplier * jobTypeMultiplier);

  return {
    marketplaceJobId: 0,
    jobType: jobType as any,
    urgencyLevel: urgencyLevel as any,
    baseCost,
    urgencyMultiplier,
    jobTypeMultiplier,
    finalCost,
    calculation: {
      step1: `Base cost: ${baseCost} credits`,
      step2: `Urgency multiplier (${urgencyLevel}): ${urgencyMultiplier}x`,
      step3: `Job type multiplier (${jobType}): ${jobTypeMultiplier}x`
    }
  };
};

export const buildSearchQuery = (searchParams: MarketplaceJobSearchParams): {
  whereClause: string;
  orderClause: string;
  parameters: any[];
} => {
  const conditions: string[] = ['mj.status = $1', 'mj.expires_at > NOW()'];
  const parameters: any[] = ['available'];
  let paramIndex = 2;

  if (searchParams.query) {
    conditions.push(`(mj.title ILIKE $${paramIndex} OR mj.description ILIKE $${paramIndex})`);
    parameters.push(`%${searchParams.query}%`);
    paramIndex++;
  }

  if (searchParams.job_type) {
    conditions.push(`mj.job_type = $${paramIndex}`);
    parameters.push(searchParams.job_type);
    paramIndex++;
  }

  if (searchParams.location) {
    conditions.push(`mj.location ILIKE $${paramIndex}`);
    parameters.push(`%${searchParams.location}%`);
    paramIndex++;
  }

  if (searchParams.urgency_level) {
    conditions.push(`mj.urgency_level = $${paramIndex}`);
    parameters.push(searchParams.urgency_level);
    paramIndex++;
  }

  if (searchParams.min_budget !== undefined) {
    conditions.push(`mj.estimated_budget >= $${paramIndex}`);
    parameters.push(searchParams.min_budget);
    paramIndex++;
  }

  if (searchParams.max_budget !== undefined) {
    conditions.push(`mj.estimated_budget <= $${paramIndex}`);
    parameters.push(searchParams.max_budget);
    paramIndex++;
  }

  if (searchParams.date_range) {
    conditions.push(`mj.date_required >= $${paramIndex}`);
    parameters.push(searchParams.date_range.start_date);
    paramIndex++;
    conditions.push(`mj.date_required <= $${paramIndex}`);
    parameters.push(searchParams.date_range.end_date);
    paramIndex++;
  }

  if (searchParams.excludeApplied && searchParams.tradie_id) {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM job_applications ja 
      WHERE ja.marketplace_job_id = mj.id 
      AND ja.tradie_id = $${paramIndex}
    )`);
    parameters.push(searchParams.tradie_id);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const orderClause = buildOrderClause(searchParams.sortBy, searchParams.sortOrder);

  return {
    whereClause,
    orderClause,
    parameters
  };
};

export const buildOrderClause = (sortBy?: string, sortOrder?: 'asc' | 'desc'): string => {
  const order = sortOrder?.toUpperCase() || 'DESC';
  
  switch (sortBy) {
    case MARKETPLACE_SORT_OPTIONS.DATE_POSTED:
      return `ORDER BY mj.created_at ${order}`;
    case MARKETPLACE_SORT_OPTIONS.BUDGET_HIGH_TO_LOW:
      return 'ORDER BY mj.estimated_budget DESC NULLS LAST';
    case MARKETPLACE_SORT_OPTIONS.BUDGET_LOW_TO_HIGH:
      return 'ORDER BY mj.estimated_budget ASC NULLS LAST';
    case MARKETPLACE_SORT_OPTIONS.URGENCY:
      return `ORDER BY CASE mj.urgency_level 
        WHEN 'urgent' THEN 4 
        WHEN 'high' THEN 3 
        WHEN 'medium' THEN 2 
        ELSE 1 END DESC`;
    case MARKETPLACE_SORT_OPTIONS.APPLICATION_COUNT:
      return `ORDER BY mj.application_count ${order}`;
    default:
      return `ORDER BY mj.created_at ${order}`;
  }
};

export const formatJobSummary = (job: MarketplaceJobEntity, creditCost?: number, hasApplied?: boolean): MarketplaceJobSummary => {
  return {
    id: job.id,
    title: job.title,
    job_type: job.job_type,
    location: job.location,
    estimated_budget: job.estimated_budget,
    urgency_level: job.urgency_level,
    application_count: job.application_count,
    status: job.status,
    created_at: job.created_at,
    days_until_expiry: job.days_until_expiry,
    creditCost: creditCost || 0,
    hasApplied: hasApplied || false
  };
};

export const formatJobDetails = (job: MarketplaceJobEntity, creditCost: MarketplaceCreditCost): MarketplaceJobDetails => {
  return {
    ...job,
    client: {
      id: job.client_id,
      name: job.client_name,
      email: job.client_email,
      phone: job.client_phone,
      company: job.client_company,
      isVerified: false
    },
    applications: {
      count: job.application_count,
      hasUserApplied: false,
      userApplicationId: undefined
    },
    creditCost: {
      baseCost: creditCost.baseCost,
      urgencyMultiplier: creditCost.urgencyMultiplier,
      jobTypeMultiplier: creditCost.jobTypeMultiplier,
      finalCost: creditCost.finalCost
    },
    relatedJobs: []
  };
};

export const isJobExpired = (job: MarketplaceJobEntity): boolean => {
  return new Date(job.expires_at) <= new Date();
};

export const canJobBeModified = (job: MarketplaceJobEntity): boolean => {
  return job.status === MARKETPLACE_JOB_STATUS.AVAILABLE && !isJobExpired(job);
};

export const getJobStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    [MARKETPLACE_JOB_STATUS.AVAILABLE]: '#28a745',
    [MARKETPLACE_JOB_STATUS.IN_REVIEW]: '#ffc107',
    [MARKETPLACE_JOB_STATUS.ASSIGNED]: '#17a2b8',
    [MARKETPLACE_JOB_STATUS.COMPLETED]: '#6c757d',
    [MARKETPLACE_JOB_STATUS.EXPIRED]: '#dc3545',
    [MARKETPLACE_JOB_STATUS.CANCELLED]: '#6c757d'
  };
  return statusColors[status] || '#6c757d';
};

export const getUrgencyColor = (urgencyLevel: string): string => {
  const urgencyColors: Record<string, string> = {
    [URGENCY_LEVEL.LOW]: '#28a745',
    [URGENCY_LEVEL.MEDIUM]: '#ffc107',
    [URGENCY_LEVEL.HIGH]: '#fd7e14',
    [URGENCY_LEVEL.URGENT]: '#dc3545'
  };
  return urgencyColors[urgencyLevel] || '#6c757d';
};

export const getJobTypeIcon = (jobType: string): string => {
  const jobTypeIcons: Record<string, string> = {
    [MARKETPLACE_JOB_TYPES.ELECTRICAL]: 'electrical-services',
    [MARKETPLACE_JOB_TYPES.PLUMBING]: 'plumbing',
    [MARKETPLACE_JOB_TYPES.CARPENTRY]: 'carpenter',
    [MARKETPLACE_JOB_TYPES.PAINTING]: 'format-paint',
    [MARKETPLACE_JOB_TYPES.ROOFING]: 'roofing',
    [MARKETPLACE_JOB_TYPES.HVAC]: 'hvac',
    [MARKETPLACE_JOB_TYPES.LANDSCAPING]: 'grass',
    [MARKETPLACE_JOB_TYPES.CLEANING]: 'cleaning-services',
    [MARKETPLACE_JOB_TYPES.HANDYMAN]: 'handyman',
    [MARKETPLACE_JOB_TYPES.GENERAL]: 'construction'
  };
  return jobTypeIcons[jobType] || 'work';
};

export const formatCurrency = (amount?: number): string => {
  if (amount === undefined || amount === null) {
    return 'Budget not specified';
  }
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-AU');
};

export const formatDaysUntilExpiry = (daysUntilExpiry: number): string => {
  if (daysUntilExpiry <= 0) {
    return 'Expired';
  }
  if (daysUntilExpiry === 1) {
    return 'Expires tomorrow';
  }
  if (daysUntilExpiry <= 7) {
    return `Expires in ${daysUntilExpiry} days`;
  }
  return `Expires in ${Math.ceil(daysUntilExpiry / 7)} weeks`;
};

export const generateJobSlug = (title: string, id: number): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `${slug}-${id}`;
};

export const extractLocationDetails = (location: string): {
  suburb?: string;
  state?: string;
  postcode?: string;
} => {
  const parts = location.split(',').map(part => part.trim());
  
  if (parts.length >= 3) {
    return {
      suburb: parts[0],
      state: parts[1],
      postcode: parts[2]
    };
  }
  
  if (parts.length === 2) {
    return {
      suburb: parts[0],
      state: parts[1]
    };
  }
  
  return {
    suburb: location
  };
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const filterJobsByLocation = (jobs: MarketplaceJobSummary[], userLocation: { lat: number; lon: number }, maxDistance: number): MarketplaceJobSummary[] => {
  return jobs.filter(job => {
    const jobLocation = extractLocationDetails(job.location);
    return true;
  });
};

export const groupJobsByType = (jobs: MarketplaceJobSummary[]): Record<string, MarketplaceJobSummary[]> => {
  return jobs.reduce((groups, job) => {
    const type = job.job_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(job);
    return groups;
  }, {} as Record<string, MarketplaceJobSummary[]>);
};

export const groupJobsByUrgency = (jobs: MarketplaceJobSummary[]): Record<string, MarketplaceJobSummary[]> => {
  return jobs.reduce((groups, job) => {
    const urgency = job.urgency_level;
    if (!groups[urgency]) {
      groups[urgency] = [];
    }
    groups[urgency].push(job);
    return groups;
  }, {} as Record<string, MarketplaceJobSummary[]>);
};

export const sortJobsByRelevance = (jobs: MarketplaceJobSummary[], tradieProfile: {
  serviceTypes: string[];
  location: string;
  hourlyRate?: number;
}): MarketplaceJobSummary[] => {
  return jobs.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (tradieProfile.serviceTypes.includes(a.job_type)) scoreA += 10;
    if (tradieProfile.serviceTypes.includes(b.job_type)) scoreB += 10;

    if (a.location.toLowerCase().includes(tradieProfile.location.toLowerCase())) scoreA += 5;
    if (b.location.toLowerCase().includes(tradieProfile.location.toLowerCase())) scoreB += 5;

    const urgencyScores = {
      [URGENCY_LEVEL.URGENT]: 4,
      [URGENCY_LEVEL.HIGH]: 3,
      [URGENCY_LEVEL.MEDIUM]: 2,
      [URGENCY_LEVEL.LOW]: 1
    };
    scoreA += urgencyScores[a.urgency_level] || 0;
    scoreB += urgencyScores[b.urgency_level] || 0;

    return scoreB - scoreA;
  });
};

export const getJobRecommendations = (jobs: MarketplaceJobSummary[], tradieProfile: {
  serviceTypes: string[];
  location: string;
  completedJobs: number;
  rating?: number;
}, limit: number = 5): MarketplaceJobSummary[] => {
  const relevantJobs = sortJobsByRelevance(jobs, tradieProfile);
  return relevantJobs.slice(0, limit);
};

export const validateJobFilters = (filters: MarketplaceJobFilters): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (filters.min_budget !== undefined && filters.min_budget < 0) {
    errors.push('Minimum budget cannot be negative');
  }

  if (filters.max_budget !== undefined && filters.max_budget < 0) {
    errors.push('Maximum budget cannot be negative');
  }

  if (filters.min_budget !== undefined && filters.max_budget !== undefined && filters.min_budget > filters.max_budget) {
    errors.push('Minimum budget cannot be greater than maximum budget');
  }

  if (filters.date_range) {
    if (filters.date_range.start_date > filters.date_range.end_date) {
      errors.push('Start date cannot be after end date');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const buildFilterSummary = (filters: MarketplaceJobFilters): string => {
  const parts: string[] = [];

  if (filters.job_type) {
    parts.push(`Type: ${filters.job_type}`);
  }

  if (filters.location) {
    parts.push(`Location: ${filters.location}`);
  }

  if (filters.urgency_level) {
    parts.push(`Urgency: ${filters.urgency_level}`);
  }

  if (filters.min_budget !== undefined || filters.max_budget !== undefined) {
    if (filters.min_budget !== undefined && filters.max_budget !== undefined) {
      parts.push(`Budget: ${formatCurrency(filters.min_budget)} - ${formatCurrency(filters.max_budget)}`);
    } else if (filters.min_budget !== undefined) {
      parts.push(`Budget: ${formatCurrency(filters.min_budget)}+`);
    } else if (filters.max_budget !== undefined) {
      parts.push(`Budget: Up to ${formatCurrency(filters.max_budget)}`);
    }
  }

  if (filters.date_range) {
    parts.push(`Date: ${filters.date_range.start_date.toLocaleDateString()} - ${filters.date_range.end_date.toLocaleDateString()}`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
};

export const generateCacheKey = (prefix: string, params: Record<string, any>): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {} as Record<string, any>);

  const paramString = JSON.stringify(sortedParams);
  return `${prefix}:${Buffer.from(paramString).toString('base64')}`;
};

export const isValidJobStatus = (status: string): boolean => {
  return Object.values(MARKETPLACE_JOB_STATUS).includes(status as any);
};

export const getNextValidStatuses = (currentStatus: string): string[] => {
  const statusTransitions: Record<string, string[]> = {
    [MARKETPLACE_JOB_STATUS.AVAILABLE]: [MARKETPLACE_JOB_STATUS.IN_REVIEW, MARKETPLACE_JOB_STATUS.ASSIGNED, MARKETPLACE_JOB_STATUS.EXPIRED, MARKETPLACE_JOB_STATUS.CANCELLED],
    [MARKETPLACE_JOB_STATUS.IN_REVIEW]: [MARKETPLACE_JOB_STATUS.AVAILABLE, MARKETPLACE_JOB_STATUS.ASSIGNED, MARKETPLACE_JOB_STATUS.CANCELLED],
    [MARKETPLACE_JOB_STATUS.ASSIGNED]: [MARKETPLACE_JOB_STATUS.COMPLETED, MARKETPLACE_JOB_STATUS.CANCELLED],
    [MARKETPLACE_JOB_STATUS.COMPLETED]: [],
    [MARKETPLACE_JOB_STATUS.EXPIRED]: [MARKETPLACE_JOB_STATUS.AVAILABLE],
    [MARKETPLACE_JOB_STATUS.CANCELLED]: []
  };

  return statusTransitions[currentStatus] || [];
};

export const canTransitionToStatus = (currentStatus: string, newStatus: string): boolean => {
  const validTransitions = getNextValidStatuses(currentStatus);
  return validTransitions.includes(newStatus);
};
