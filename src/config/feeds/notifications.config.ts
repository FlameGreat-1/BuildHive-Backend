import { MARKETPLACE_NOTIFICATION_TYPES } from './constants';

export const MARKETPLACE_NOTIFICATION_CONFIG = {
  EMAIL_TEMPLATES: {
    [MARKETPLACE_NOTIFICATION_TYPES.NEW_JOB_POSTED]: {
      subject: 'New Job Available: {{jobTitle}}',
      template: 'marketplace/new-job-posted',
      variables: ['jobTitle', 'jobType', 'location', 'estimatedBudget', 'urgencyLevel', 'dateRequired', 'jobUrl'],
      priority: 'normal',
      sendImmediately: false,
      batchable: true
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_RECEIVED]: {
      subject: 'New Application for {{jobTitle}}',
      template: 'marketplace/application-received',
      variables: ['jobTitle', 'tradieName', 'customQuote', 'proposedTimeline', 'applicationUrl'],
      priority: 'high',
      sendImmediately: true,
      batchable: false
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: {
      subject: 'Congratulations! You\'ve been selected for {{jobTitle}}',
      template: 'marketplace/application-selected',
      variables: ['jobTitle', 'clientName', 'jobDetails', 'contactInfo', 'nextSteps'],
      priority: 'high',
      sendImmediately: true,
      batchable: false
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_REJECTED]: {
      subject: 'Application Update for {{jobTitle}}',
      template: 'marketplace/application-rejected',
      variables: ['jobTitle', 'feedback', 'similarJobs'],
      priority: 'normal',
      sendImmediately: false,
      batchable: true
    },
    [MARKETPLACE_NOTIFICATION_TYPES.JOB_ASSIGNED]: {
      subject: 'Job Assignment Confirmed: {{jobTitle}}',
      template: 'marketplace/job-assigned',
      variables: ['jobTitle', 'tradieName', 'startDate', 'jobManagementUrl'],
      priority: 'high',
      sendImmediately: true,
      batchable: false
    },
    [MARKETPLACE_NOTIFICATION_TYPES.JOB_EXPIRED]: {
      subject: 'Your Job Listing Has Expired: {{jobTitle}}',
      template: 'marketplace/job-expired',
      variables: ['jobTitle', 'applicationCount', 'repostUrl'],
      priority: 'normal',
      sendImmediately: false,
      batchable: true
    },
    [MARKETPLACE_NOTIFICATION_TYPES.INSUFFICIENT_CREDITS]: {
      subject: 'Insufficient Credits for Job Application',
      template: 'marketplace/insufficient-credits',
      variables: ['jobTitle', 'requiredCredits', 'currentBalance', 'topupUrl'],
      priority: 'normal',
      sendImmediately: true,
      batchable: false
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_WITHDRAWN]: {
      subject: 'Application Withdrawn for {{jobTitle}}',
      template: 'marketplace/application-withdrawn',
      variables: ['jobTitle', 'tradieName', 'withdrawalReason'],
      priority: 'low',
      sendImmediately: false,
      batchable: true
    },
    [MARKETPLACE_NOTIFICATION_TYPES.JOB_CANCELLED]: {
      subject: 'Job Cancelled: {{jobTitle}}',
      template: 'marketplace/job-cancelled',
      variables: ['jobTitle', 'cancellationReason', 'refundInfo'],
      priority: 'high',
      sendImmediately: true,
      batchable: false
    }
  },

  SMS_TEMPLATES: {
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: {
      message: 'Congratulations! You\'ve been selected for {{jobTitle}}. Check your email for details.',
      maxLength: 160,
      priority: 'high',
      sendImmediately: true
    },
    [MARKETPLACE_NOTIFICATION_TYPES.JOB_ASSIGNED]: {
      message: 'Job assignment confirmed for {{jobTitle}}. Start date: {{startDate}}',
      maxLength: 160,
      priority: 'high',
      sendImmediately: true
    },
    [MARKETPLACE_NOTIFICATION_TYPES.INSUFFICIENT_CREDITS]: {
      message: 'Insufficient credits for job application. Current balance: {{currentBalance}}. Top up now.',
      maxLength: 160,
      priority: 'normal',
      sendImmediately: true
    }
  },

  PUSH_NOTIFICATION_TEMPLATES: {
    [MARKETPLACE_NOTIFICATION_TYPES.NEW_JOB_POSTED]: {
      title: 'New Job Available',
      body: '{{jobType}} job in {{location}} - {{estimatedBudget}}',
      icon: 'job-notification',
      sound: 'default',
      badge: true,
      data: {
        type: 'new_job',
        jobId: '{{jobId}}',
        action: 'view_job'
      }
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_RECEIVED]: {
      title: 'New Application Received',
      body: 'You have a new application for {{jobTitle}}',
      icon: 'application-notification',
      sound: 'default',
      badge: true,
      data: {
        type: 'application_received',
        jobId: '{{jobId}}',
        applicationId: '{{applicationId}}',
        action: 'view_applications'
      }
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: {
      title: 'Application Selected!',
      body: 'Congratulations! You\'ve been selected for {{jobTitle}}',
      icon: 'success-notification',
      sound: 'success',
      badge: true,
      data: {
        type: 'application_selected',
        jobId: '{{jobId}}',
        applicationId: '{{applicationId}}',
        action: 'view_job_details'
      }
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_REJECTED]: {
      title: 'Application Update',
      body: 'Your application for {{jobTitle}} was not selected',
      icon: 'info-notification',
      sound: 'default',
      badge: false,
      data: {
        type: 'application_rejected',
        jobId: '{{jobId}}',
        applicationId: '{{applicationId}}',
        action: 'view_similar_jobs'
      }
    }
  },

  IN_APP_NOTIFICATION_TEMPLATES: {
    [MARKETPLACE_NOTIFICATION_TYPES.NEW_JOB_POSTED]: {
      title: 'New {{jobType}} Job Available',
      message: 'A new {{jobType}} job has been posted in {{location}} with an estimated budget of {{estimatedBudget}}',
      actionText: 'View Job',
      actionUrl: '/marketplace/jobs/{{jobId}}',
      category: 'job_opportunity',
      priority: 'normal',
      persistent: false,
      autoHide: true,
      hideAfterSeconds: 10
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_RECEIVED]: {
      title: 'New Application Received',
      message: '{{tradieName}} has applied for your job "{{jobTitle}}" with a quote of {{customQuote}}',
      actionText: 'Review Application',
      actionUrl: '/marketplace/jobs/{{jobId}}/applications/{{applicationId}}',
      category: 'application_management',
      priority: 'high',
      persistent: true,
      autoHide: false
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: {
      title: 'Application Selected!',
      message: 'Congratulations! {{clientName}} has selected you for "{{jobTitle}}"',
      actionText: 'View Job Details',
      actionUrl: '/jobs/{{existingJobId}}',
      category: 'job_assignment',
      priority: 'high',
      persistent: true,
      autoHide: false
    },
    [MARKETPLACE_NOTIFICATION_TYPES.INSUFFICIENT_CREDITS]: {
      title: 'Insufficient Credits',
      message: 'You need {{requiredCredits}} credits to apply for this job. Your current balance is {{currentBalance}}',
      actionText: 'Buy Credits',
      actionUrl: '/credits/purchase',
      category: 'credit_management',
      priority: 'normal',
      persistent: true,
      autoHide: false
    }
  },

  NOTIFICATION_DELIVERY_SETTINGS: {
    EMAIL: {
      enabled: true,
      batchSize: 100,
      batchIntervalMinutes: 5,
      retryAttempts: 3,
      retryDelayMinutes: 15,
      provider: 'sendgrid',
      fromAddress: 'notifications@buildhive.com',
      fromName: 'BuildHive Marketplace'
    },
    SMS: {
      enabled: false,
      provider: 'twilio',
      retryAttempts: 2,
      retryDelayMinutes: 5,
      rateLimitPerMinute: 60
    },
    PUSH: {
      enabled: true,
      provider: 'firebase',
      batchSize: 1000,
      retryAttempts: 3,
      retryDelayMinutes: 10,
      timeToLive: 86400
    },
    IN_APP: {
      enabled: true,
      maxNotificationsPerUser: 50,
      autoCleanupAfterDays: 30,
      realTimeDelivery: true
    }
  },

  NOTIFICATION_PREFERENCES: {
    DEFAULT_USER_PREFERENCES: {
      email: {
        [MARKETPLACE_NOTIFICATION_TYPES.NEW_JOB_POSTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_RECEIVED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_REJECTED]: false,
        [MARKETPLACE_NOTIFICATION_TYPES.JOB_ASSIGNED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.JOB_EXPIRED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.INSUFFICIENT_CREDITS]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_WITHDRAWN]: false,
        [MARKETPLACE_NOTIFICATION_TYPES.JOB_CANCELLED]: true
      },
      sms: {
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.JOB_ASSIGNED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.INSUFFICIENT_CREDITS]: false
      },
      push: {
        [MARKETPLACE_NOTIFICATION_TYPES.NEW_JOB_POSTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_RECEIVED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_REJECTED]: false
      },
      inApp: {
        [MARKETPLACE_NOTIFICATION_TYPES.NEW_JOB_POSTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_RECEIVED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_REJECTED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.JOB_ASSIGNED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.JOB_EXPIRED]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.INSUFFICIENT_CREDITS]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_WITHDRAWN]: true,
        [MARKETPLACE_NOTIFICATION_TYPES.JOB_CANCELLED]: true
      }
    },
    FREQUENCY_SETTINGS: {
      IMMEDIATE: 'immediate',
      HOURLY: 'hourly',
      DAILY: 'daily',
      WEEKLY: 'weekly',
      NEVER: 'never'
    },
    QUIET_HOURS: {
      enabled: true,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'Australia/Sydney',
      applyToWeekends: false
    }
  },

  NOTIFICATION_TRIGGERS: {
    [MARKETPLACE_NOTIFICATION_TYPES.NEW_JOB_POSTED]: {
      event: 'marketplace_job_created',
      conditions: ['job.status === "available"', 'job.expires_at > now()'],
      targetAudience: 'relevant_tradies',
      audienceFilters: ['job_type_match', 'location_proximity', 'active_users'],
      delay: 0,
      batchable: true
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_RECEIVED]: {
      event: 'job_application_submitted',
      conditions: ['application.status === "submitted"'],
      targetAudience: 'job_client',
      audienceFilters: [],
      delay: 0,
      batchable: false
    },
    [MARKETPLACE_NOTIFICATION_TYPES.APPLICATION_SELECTED]: {
      event: 'tradie_selected',
      conditions: ['selection.confirmed === true'],
      targetAudience: 'selected_tradie',
      audienceFilters: [],
      delay: 0,
      batchable: false
    }
  }
} as const;

export const getNotificationTemplate = (type: string, channel: 'email' | 'sms' | 'push' | 'inApp') => {
  const templates = {
    email: MARKETPLACE_NOTIFICATION_CONFIG.EMAIL_TEMPLATES,
    sms: MARKETPLACE_NOTIFICATION_CONFIG.SMS_TEMPLATES,
    push: MARKETPLACE_NOTIFICATION_CONFIG.PUSH_NOTIFICATION_TEMPLATES,
    inApp: MARKETPLACE_NOTIFICATION_CONFIG.IN_APP_NOTIFICATION_TEMPLATES
  };

  return templates[channel][type as keyof typeof templates[typeof channel]];
};

export const getUserNotificationPreferences = (userId: number) => {
  return MARKETPLACE_NOTIFICATION_CONFIG.NOTIFICATION_PREFERENCES.DEFAULT_USER_PREFERENCES;
};
