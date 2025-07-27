export const MARKETPLACE_JOB_TYPES = {
    ELECTRICAL: 'electrical',
    PLUMBING: 'plumbing',
    CARPENTRY: 'carpentry',
    PAINTING: 'painting',
    ROOFING: 'roofing',
    HVAC: 'hvac',
    LANDSCAPING: 'landscaping',
    CLEANING: 'cleaning',
    HANDYMAN: 'handyman',
    GENERAL: 'general'
  } as const;
  
  export const MARKETPLACE_JOB_STATUS = {
    AVAILABLE: 'available',
    IN_REVIEW: 'in_review',
    ASSIGNED: 'assigned',
    COMPLETED: 'completed',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  } as const;
  
  export const APPLICATION_STATUS = {
    SUBMITTED: 'submitted',
    UNDER_REVIEW: 'under_review',
    SELECTED: 'selected',
    REJECTED: 'rejected',
    WITHDRAWN: 'withdrawn'
  } as const;
  
  export const URGENCY_LEVEL = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  } as const;
  
  export const MARKETPLACE_CREDIT_COSTS = {
    BASE_APPLICATION_COST: 2,
    URGENCY_MULTIPLIERS: {
      [URGENCY_LEVEL.LOW]: 1.0,
      [URGENCY_LEVEL.MEDIUM]: 1.2,
      [URGENCY_LEVEL.HIGH]: 1.5,
      [URGENCY_LEVEL.URGENT]: 2.0
    },
    JOB_TYPE_MULTIPLIERS: {
      [MARKETPLACE_JOB_TYPES.ELECTRICAL]: 1.5,
      [MARKETPLACE_JOB_TYPES.PLUMBING]: 1.5,
      [MARKETPLACE_JOB_TYPES.ROOFING]: 1.3,
      [MARKETPLACE_JOB_TYPES.HVAC]: 1.3,
      [MARKETPLACE_JOB_TYPES.CARPENTRY]: 1.2,
      [MARKETPLACE_JOB_TYPES.PAINTING]: 1.0,
      [MARKETPLACE_JOB_TYPES.LANDSCAPING]: 1.0,
      [MARKETPLACE_JOB_TYPES.CLEANING]: 0.8,
      [MARKETPLACE_JOB_TYPES.HANDYMAN]: 1.0,
      [MARKETPLACE_JOB_TYPES.GENERAL]: 1.0
    }
  } as const;
  
  export const MARKETPLACE_LIMITS = {
    JOB_TITLE_MIN_LENGTH: 5,
    JOB_TITLE_MAX_LENGTH: 200,
    JOB_DESCRIPTION_MIN_LENGTH: 20,
    JOB_DESCRIPTION_MAX_LENGTH: 2000,
    LOCATION_MIN_LENGTH: 3,
    LOCATION_MAX_LENGTH: 100,
    MAX_ESTIMATED_BUDGET: 1000000,
    MIN_ESTIMATED_BUDGET: 50,
    MAX_PHOTOS_PER_JOB: 10,
    MAX_PHOTO_SIZE_MB: 5,
    JOB_EXPIRY_DAYS: 30,
    MAX_APPLICATIONS_PER_JOB: 50,
    APPLICATION_TIMELINE_MIN_LENGTH: 10,
    APPLICATION_TIMELINE_MAX_LENGTH: 500,
    APPLICATION_APPROACH_MIN_LENGTH: 20,
    APPLICATION_APPROACH_MAX_LENGTH: 1000,
    APPLICATION_COVER_MESSAGE_MAX_LENGTH: 500,
    APPLICATION_EXPERIENCE_MAX_LENGTH: 1000,
    APPLICATION_QUESTIONS_MAX_LENGTH: 500,
    APPLICATION_OFFERS_MAX_LENGTH: 500,
    MATERIALS_LIST_MAX_LENGTH: 1000,
    MAX_AVAILABILITY_DATES: 10,
    MAX_ADDITIONAL_PHOTOS: 5,
    SELECTION_REASON_MAX_LENGTH: 500,
    MAX_CUSTOM_QUOTE: 1000000,
    MIN_CUSTOM_QUOTE: 10,
    MAX_SEARCH_RESULTS: 100,
    MAX_JOBS_PER_HOUR: 10,
    MAX_SEARCHES_PER_MINUTE: 30,
    MAX_BULK_OPERATIONS: 50
  } as const;
  
  export const MARKETPLACE_SEARCH_LIMITS = {
    MAX_SEARCH_QUERY_LENGTH: 100,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MAX_BUDGET_RANGE: 1000000,
    MAX_LOCATION_RADIUS_KM: 100
  } as const;
  
  export const MARKETPLACE_NOTIFICATION_TYPES = {
    NEW_JOB_POSTED: 'new_job_posted',
    APPLICATION_RECEIVED: 'application_received',
    APPLICATION_SELECTED: 'application_selected',
    APPLICATION_REJECTED: 'application_rejected',
    JOB_ASSIGNED: 'job_assigned',
    JOB_EXPIRED: 'job_expired',
    INSUFFICIENT_CREDITS: 'insufficient_credits',
    APPLICATION_WITHDRAWN: 'application_withdrawn',
    JOB_CANCELLED: 'job_cancelled'
  } as const;
  
  export const MARKETPLACE_SORT_OPTIONS = {
    DATE_POSTED: 'date_posted',
    BUDGET_HIGH_TO_LOW: 'budget_desc',
    BUDGET_LOW_TO_HIGH: 'budget_asc',
    URGENCY: 'urgency',
    LOCATION: 'location',
    APPLICATION_COUNT: 'application_count'
  } as const;
  
  export const MARKETPLACE_FILTER_OPTIONS = {
    JOB_TYPES: Object.values(MARKETPLACE_JOB_TYPES),
    URGENCY_LEVELS: Object.values(URGENCY_LEVEL),
    STATUSES: Object.values(MARKETPLACE_JOB_STATUS),
    BUDGET_RANGES: [
      { min: 0, max: 500, label: 'Under $500' },
      { min: 500, max: 1000, label: '$500 - $1,000' },
      { min: 1000, max: 2500, label: '$1,000 - $2,500' },
      { min: 2500, max: 5000, label: '$2,500 - $5,000' },
      { min: 5000, max: 10000, label: '$5,000 - $10,000' },
      { min: 10000, max: 1000000, label: '$10,000+' }
    ]
  } as const;
  
  export const MARKETPLACE_ANALYTICS_PERIODS = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    QUARTERLY: 'quarterly',
    YEARLY: 'yearly'
  } as const;
  
  export const MARKETPLACE_DASHBOARD_METRICS = {
    TRADIE: {
      TOTAL_APPLICATIONS: 'total_applications',
      SUCCESSFUL_APPLICATIONS: 'successful_applications',
      CONVERSION_RATE: 'conversion_rate',
      CREDITS_SPENT: 'credits_spent',
      AVERAGE_QUOTE: 'average_quote',
      LAST_APPLICATION: 'last_application'
    },
    CLIENT: {
      TOTAL_JOBS_POSTED: 'total_jobs_posted',
      TOTAL_APPLICATIONS_RECEIVED: 'total_applications_received',
      TOTAL_HIRES_MADE: 'total_hires_made',
      AVERAGE_APPLICATIONS_PER_JOB: 'average_applications_per_job',
      AVERAGE_HIRE_TIME: 'average_hire_time',
      LAST_JOB_POSTED: 'last_job_posted'
    }
  } as const;
  
  export const MARKETPLACE_VALIDATION_RULES = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^\+?[\d\s\-\(\)]{10,}$/,
    ABN_REGEX: /^\d{11}$/,
    POSTCODE_REGEX: /^\d{4}$/,
    CURRENCY_REGEX: /^\d+(\.\d{1,2})?$/,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  } as const;
  
  export const MARKETPLACE_CACHE_KEYS = {
    JOB_LIST: 'marketplace:jobs:list',
    JOB_DETAIL: 'marketplace:job:detail',
    APPLICATION_LIST: 'marketplace:applications:list',
    TRADIE_STATS: 'marketplace:tradie:stats',
    CLIENT_STATS: 'marketplace:client:stats',
    CREDIT_COST: 'marketplace:credit:cost',
    SEARCH_RESULTS: 'marketplace:search:results'
  } as const;
  
  export const MARKETPLACE_CACHE_TTL = {
    JOB_LIST: 300,
    JOB_DETAIL: 600,
    APPLICATION_LIST: 180,
    TRADIE_STATS: 3600,
    CLIENT_STATS: 3600,
    CREDIT_COST: 1800,
    SEARCH_RESULTS: 300
  } as const;
  
  export const MARKETPLACE_REDIS_CHANNELS = {
    NEW_JOB_POSTED: 'marketplace:job:posted',
    APPLICATION_SUBMITTED: 'marketplace:application:submitted',
    TRADIE_SELECTED: 'marketplace:tradie:selected',
    JOB_ASSIGNED: 'marketplace:job:assigned',
    JOB_EXPIRED: 'marketplace:job:expired',
    CREDIT_DEDUCTED: 'marketplace:credit:deducted'
  } as const;
  
  export const MARKETPLACE_ERROR_CODES = {
    JOB_NOT_FOUND: 'MARKETPLACE_JOB_NOT_FOUND',
    APPLICATION_NOT_FOUND: 'APPLICATION_NOT_FOUND',
    DUPLICATE_APPLICATION: 'DUPLICATE_APPLICATION',
    INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS_FOR_APPLICATION',
    JOB_EXPIRED: 'MARKETPLACE_JOB_EXPIRED',
    INVALID_JOB_STATUS: 'INVALID_MARKETPLACE_JOB_STATUS',
    UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_MARKETPLACE_ACCESS',
    SELECTION_FAILED: 'TRADIE_SELECTION_FAILED',
    ASSIGNMENT_FAILED: 'JOB_ASSIGNMENT_FAILED',
    CREDIT_CALCULATION_FAILED: 'CREDIT_COST_CALCULATION_FAILED'
  } as const;
  
  export const MARKETPLACE_SUCCESS_MESSAGES = {
    JOB_CREATED: 'Marketplace job created successfully',
    JOB_UPDATED: 'Marketplace job updated successfully',
    APPLICATION_SUBMITTED: 'Job application submitted successfully',
    APPLICATION_UPDATED: 'Application status updated successfully',
    TRADIE_SELECTED: 'Tradie selected successfully',
    JOB_ASSIGNED: 'Job assigned successfully',
    SEARCH_COMPLETED: 'Search completed successfully',
    ANALYTICS_RETRIEVED: 'Analytics data retrieved successfully'
  } as const;
  
  export const MARKETPLACE_PERMISSIONS = {
    CREATE_JOB: 'marketplace:create_job',
    VIEW_JOBS: 'marketplace:view_jobs',
    APPLY_TO_JOB: 'marketplace:apply_to_job',
    REVIEW_APPLICATIONS: 'marketplace:review_applications',
    SELECT_TRADIE: 'marketplace:select_tradie',
    VIEW_ANALYTICS: 'marketplace:view_analytics',
    MANAGE_NOTIFICATIONS: 'marketplace:manage_notifications'
  } as const;
  
  export const MARKETPLACE_RATE_LIMITS = {
    JOB_CREATION: { windowMs: 10 * 60 * 1000, max: 20 },
    APPLICATION_SUBMISSION: { windowMs: 2 * 60 * 1000, max: 10 },
    SEARCH_REQUESTS: { windowMs: 1 * 60 * 1000, max: 60 },
    ANALYTICS_REQUESTS: { windowMs: 5 * 60 * 1000, max: 20 },
    TRADIE_SELECTION: { windowMs: 10 * 60 * 1000, max: 15 }
  } as const;
  
  export type MarketplaceJobType = typeof MARKETPLACE_JOB_TYPES[keyof typeof MARKETPLACE_JOB_TYPES];
  export type MarketplaceJobStatus = typeof MARKETPLACE_JOB_STATUS[keyof typeof MARKETPLACE_JOB_STATUS];
  export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];
  export type UrgencyLevel = typeof URGENCY_LEVEL[keyof typeof URGENCY_LEVEL];
  export type MarketplaceNotificationType = typeof MARKETPLACE_NOTIFICATION_TYPES[keyof typeof MARKETPLACE_NOTIFICATION_TYPES];
  export type MarketplaceSortOption = typeof MARKETPLACE_SORT_OPTIONS[keyof typeof MARKETPLACE_SORT_OPTIONS];
  export type MarketplaceAnalyticsPeriod = typeof MARKETPLACE_ANALYTICS_PERIODS[keyof typeof MARKETPLACE_ANALYTICS_PERIODS];
  