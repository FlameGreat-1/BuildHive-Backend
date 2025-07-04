export const CLIENT_CONSTANTS = {
  TAGS: {
    VIP: 'vip',
    REPEAT_CUSTOMER: 'repeat_customer',
    HIGH_VALUE: 'high_value',
    DIFFICULT: 'difficult',
    PREFERRED: 'preferred',
    CORPORATE: 'corporate',
    RESIDENTIAL: 'residential'
  },
  
  VALIDATION: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    EMAIL_MAX_LENGTH: 255,
    PHONE_MIN_LENGTH: 8,
    PHONE_MAX_LENGTH: 20,
    COMPANY_MAX_LENGTH: 100,
    ADDRESS_MAX_LENGTH: 500,
    NOTES_MAX_LENGTH: 2000,
    MAX_TAGS: 10
  }
} as const;

export const MATERIAL_CONSTANTS = {
  VALIDATION: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 200,
    MIN_QUANTITY: 0.01,
    MAX_QUANTITY: 99999.99,
    MIN_UNIT_COST: 0,
    MAX_UNIT_COST: 999999.99,
    SUPPLIER_MAX_LENGTH: 100
  },
  
  CALCULATION: {
    DECIMAL_PLACES: 2,
    TAX_RATE: 0.10
  }
} as const;


export const JOB_CONSTANTS = {
  STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ON_HOLD: 'on_hold'
  },
  
  TYPES: {
    ELECTRICAL: 'electrical',
    PLUMBING: 'plumbing',
    CARPENTRY: 'carpentry',
    PAINTING: 'painting',
    ROOFING: 'roofing',
    FLOORING: 'flooring',
    TILING: 'tiling',
    HVAC: 'hvac',
    LANDSCAPING: 'landscaping',
    CLEANING: 'cleaning',
    MAINTENANCE: 'maintenance',
    RENOVATION: 'renovation',
    INSTALLATION: 'installation',
    REPAIR: 'repair',
    INSPECTION: 'inspection',
    HANDYMAN: 'handyman',
    GENERAL: 'general',
    OTHER: 'other'
  },
  
  PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },
  
  TAGS: {
    INVOICED: 'invoiced',
    PAID: 'paid',
    UNPAID: 'unpaid',
    REPEAT_CLIENT: 'repeat_client',
    EMERGENCY: 'emergency',
    WARRANTY: 'warranty',
    FOLLOW_UP: 'follow_up'
  },
  
  MATERIAL_UNITS: {
    PIECE: 'piece',
    METER: 'meter',
    SQUARE_METER: 'square_meter',
    CUBIC_METER: 'cubic_meter',
    KILOGRAM: 'kilogram',
    LITER: 'liter',
    HOUR: 'hour',
    DAY: 'day',
    SET: 'set',
    BOX: 'box'
  },
  
  VALIDATION: {
    TITLE_MIN_LENGTH: 3,
    TITLE_MAX_LENGTH: 200,
    DESCRIPTION_MAX_LENGTH: 2000,
    CLIENT_NAME_MAX_LENGTH: 100,
    COMPANY_NAME_MAX_LENGTH: 100,
    ADDRESS_MAX_LENGTH: 500,
    CITY_MAX_LENGTH: 50,
    STATE_MAX_LENGTH: 50,
    POSTCODE_MAX_LENGTH: 10,
    PHONE_MAX_LENGTH: 20,
    EMAIL_MAX_LENGTH: 255,
    MATERIAL_NAME_MAX_LENGTH: 200,
    SUPPLIER_NAME_MAX_LENGTH: 100,
    NOTES_MAX_LENGTH: 1000,
    MAX_MATERIALS_PER_JOB: 100,
    MAX_ATTACHMENTS_PER_JOB: 20,
    MAX_FILES_PER_JOB: 20,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MIN_ESTIMATED_DURATION: 0.5,
    MAX_ESTIMATED_DURATION: 720,
    MIN_HOURS_WORKED: 0,
    MAX_HOURS_WORKED: 1000,
    MIN_UNIT_COST: 0,
    MAX_UNIT_COST: 999999.99,
    MIN_QUANTITY: 0.01,
    MAX_QUANTITY: 99999.99
  },
  
  FILE_TYPES: {
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    ALLOWED_EXTENSIONS: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.pdf',
      '.doc',
      '.docx',
      '.txt'
    ]
  },

  FILE_UPLOAD: {
    UPLOAD_PATH: 'uploads/jobs',
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    ALLOWED_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  },

  RATE_LIMITS: {
    JOB_CREATION: {
      WINDOW_MS: 15 * 60 * 1000,
      MAX_REQUESTS: 10
    },
    FILE_UPLOAD: {
      WINDOW_MS: 15 * 60 * 1000,
      MAX_REQUESTS: 20
    },
    JOB_UPDATE: {
      WINDOW_MS: 15 * 60 * 1000,
      MAX_REQUESTS: 50
    },
    GENERAL: {
      WINDOW_MS: 15 * 60 * 1000,
      MAX_REQUESTS: 100
    }
  },

  CALCULATIONS: {
    DEFAULT_HOURLY_RATE: 75,
    OVERHEAD_PERCENTAGE: 0.15,
    TAX_RATE: 0.10
  },
  
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1
  },
  
  SEARCH: {
    MIN_SEARCH_LENGTH: 2,
    MAX_SEARCH_LENGTH: 100
  },
  
  CACHE: {
    JOB_LIST_TTL: 300,
    JOB_DETAILS_TTL: 600,
    CLIENT_LIST_TTL: 300,
    MATERIAL_LIST_TTL: 300
  },
  
  REDIS_KEYS: {
    JOB_PREFIX: 'job:',
    CLIENT_PREFIX: 'client:',
    MATERIAL_PREFIX: 'material:',
    JOB_LIST_PREFIX: 'job_list:',
    CLIENT_LIST_PREFIX: 'client_list:',
    JOB_STATS_PREFIX: 'job_stats:'
  },
  
  EVENTS: {
    JOB_CREATED: 'job.created',
    JOB_UPDATED: 'job.updated',
    JOB_DELETED: 'job.deleted',
    JOB_STATUS_CHANGED: 'job.status_changed',
    CLIENT_CREATED: 'client.created',
    CLIENT_UPDATED: 'client.updated',
    MATERIAL_ADDED: 'material.added',
    MATERIAL_UPDATED: 'material.updated',
    FILE_UPLOADED: 'file.uploaded'
  },
  
  ERROR_CODES: {
    JOB_NOT_FOUND: 'JOB_NOT_FOUND',
    CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
    MATERIAL_NOT_FOUND: 'MATERIAL_NOT_FOUND',
    UNAUTHORIZED_JOB_ACCESS: 'UNAUTHORIZED_JOB_ACCESS',
    INVALID_JOB_STATUS: 'INVALID_JOB_STATUS',
    INVALID_JOB_TYPE: 'INVALID_JOB_TYPE',
    INVALID_PRIORITY: 'INVALID_PRIORITY',
    INVALID_MATERIAL_UNIT: 'INVALID_MATERIAL_UNIT',
    FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    DUPLICATE_CLIENT_EMAIL: 'DUPLICATE_CLIENT_EMAIL',
    INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
    MATERIALS_LIMIT_EXCEEDED: 'MATERIALS_LIMIT_EXCEEDED',
    ATTACHMENTS_LIMIT_EXCEEDED: 'ATTACHMENTS_LIMIT_EXCEEDED'
  },
  
  PERMISSIONS: {
    ROLES: {
      TRADIE: 'tradie',
      ENTERPRISE: 'enterprise'
    },
    ACTIONS: {
      CREATE_JOB: 'create_job',
      READ_JOB: 'read_job',
      UPDATE_JOB: 'update_job',
      DELETE_JOB: 'delete_job',
      MANAGE_CLIENTS: 'manage_clients',
      UPLOAD_FILES: 'upload_files'
    }
  }
} as const;

export const CLIENT_CONSTANTS = {
  TAGS: {
    VIP: 'vip',
    REPEAT_CUSTOMER: 'repeat_customer',
    HIGH_VALUE: 'high_value',
    DIFFICULT: 'difficult',
    PREFERRED: 'preferred',
    CORPORATE: 'corporate',
    RESIDENTIAL: 'residential'
  },
  
  VALIDATION: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    EMAIL_MAX_LENGTH: 255,
    PHONE_MIN_LENGTH: 8,
    PHONE_MAX_LENGTH: 20,
    COMPANY_MAX_LENGTH: 100,
    ADDRESS_MAX_LENGTH: 500,
    NOTES_MAX_LENGTH: 2000,
    MAX_TAGS: 10
  },

  VIP_THRESHOLDS: {
    REVENUE: 10000,
    JOB_COUNT: 10
  }
} as const;

export const MATERIAL_CONSTANTS = {
  VALIDATION: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 200,
    MIN_QUANTITY: 0.01,
    MAX_QUANTITY: 99999.99,
    MIN_UNIT_COST: 0,
    MAX_UNIT_COST: 999999.99,
    SUPPLIER_MAX_LENGTH: 100
  },
  
  CALCULATION: {
    DECIMAL_PLACES: 2,
    TAX_RATE: 0.10
  }
} as const;

