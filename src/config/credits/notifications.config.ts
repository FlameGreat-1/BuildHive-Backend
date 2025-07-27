import { CreditUsageType } from '../../shared/types';

export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannel[];
  template: string;
  priority: NotificationPriority;
  throttleMinutes: number;
  maxPerDay: number;
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'in_app';
  enabled: boolean;
  template?: string;
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum NotificationType {
  LOW_BALANCE = 'low_balance',
  CRITICAL_BALANCE = 'critical_balance',
  PURCHASE_SUCCESS = 'purchase_success',
  PURCHASE_FAILED = 'purchase_failed',
  USAGE_SUCCESS = 'usage_success',
  USAGE_FAILED = 'usage_failed',
  REFUND_PROCESSED = 'refund_processed',
  AUTO_TOPUP_SUCCESS = 'auto_topup_success',
  AUTO_TOPUP_FAILED = 'auto_topup_failed',
  CREDITS_EXPIRED = 'credits_expired',
  CREDITS_EXPIRING = 'credits_expiring',
  MONTHLY_SUMMARY = 'monthly_summary'
}

export const NOTIFICATION_CONFIGS: Record<NotificationType, NotificationConfig> = {
  [NotificationType.LOW_BALANCE]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'low_balance_email' },
      { type: 'push', enabled: true, template: 'low_balance_push' },
      { type: 'in_app', enabled: true, template: 'low_balance_in_app' }
    ],
    template: 'low_balance_notification',
    priority: NotificationPriority.MEDIUM,
    throttleMinutes: 60,
    maxPerDay: 3
  },
  [NotificationType.CRITICAL_BALANCE]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'critical_balance_email' },
      { type: 'sms', enabled: true, template: 'critical_balance_sms' },
      { type: 'push', enabled: true, template: 'critical_balance_push' },
      { type: 'in_app', enabled: true, template: 'critical_balance_in_app' }
    ],
    template: 'critical_balance_notification',
    priority: NotificationPriority.HIGH,
    throttleMinutes: 30,
    maxPerDay: 5
  },
  [NotificationType.PURCHASE_SUCCESS]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'purchase_success_email' },
      { type: 'push', enabled: true, template: 'purchase_success_push' },
      { type: 'in_app', enabled: true, template: 'purchase_success_in_app' }
    ],
    template: 'purchase_success_notification',
    priority: NotificationPriority.MEDIUM,
    throttleMinutes: 0,
    maxPerDay: 20
  },
  [NotificationType.PURCHASE_FAILED]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'purchase_failed_email' },
      { type: 'push', enabled: true, template: 'purchase_failed_push' },
      { type: 'in_app', enabled: true, template: 'purchase_failed_in_app' }
    ],
    template: 'purchase_failed_notification',
    priority: NotificationPriority.HIGH,
    throttleMinutes: 5,
    maxPerDay: 10
  },
  [NotificationType.USAGE_SUCCESS]: {
    enabled: false,
    channels: [
      { type: 'in_app', enabled: true, template: 'usage_success_in_app' }
    ],
    template: 'usage_success_notification',
    priority: NotificationPriority.LOW,
    throttleMinutes: 0,
    maxPerDay: 100
  },
  [NotificationType.USAGE_FAILED]: {
    enabled: true,
    channels: [
      { type: 'push', enabled: true, template: 'usage_failed_push' },
      { type: 'in_app', enabled: true, template: 'usage_failed_in_app' }
    ],
    template: 'usage_failed_notification',
    priority: NotificationPriority.MEDIUM,
    throttleMinutes: 5,
    maxPerDay: 20
  },
  [NotificationType.REFUND_PROCESSED]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'refund_processed_email' },
      { type: 'push', enabled: true, template: 'refund_processed_push' },
      { type: 'in_app', enabled: true, template: 'refund_processed_in_app' }
    ],
    template: 'refund_processed_notification',
    priority: NotificationPriority.MEDIUM,
    throttleMinutes: 0,
    maxPerDay: 10
  },
  [NotificationType.AUTO_TOPUP_SUCCESS]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'auto_topup_success_email' },
      { type: 'push', enabled: true, template: 'auto_topup_success_push' },
      { type: 'in_app', enabled: true, template: 'auto_topup_success_in_app' }
    ],
    template: 'auto_topup_success_notification',
    priority: NotificationPriority.MEDIUM,
    throttleMinutes: 0,
    maxPerDay: 5
  },
  [NotificationType.AUTO_TOPUP_FAILED]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'auto_topup_failed_email' },
      { type: 'sms', enabled: true, template: 'auto_topup_failed_sms' },
      { type: 'push', enabled: true, template: 'auto_topup_failed_push' },
      { type: 'in_app', enabled: true, template: 'auto_topup_failed_in_app' }
    ],
    template: 'auto_topup_failed_notification',
    priority: NotificationPriority.HIGH,
    throttleMinutes: 15,
    maxPerDay: 3
  },
  [NotificationType.CREDITS_EXPIRED]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'credits_expired_email' },
      { type: 'push', enabled: true, template: 'credits_expired_push' },
      { type: 'in_app', enabled: true, template: 'credits_expired_in_app' }
    ],
    template: 'credits_expired_notification',
    priority: NotificationPriority.MEDIUM,
    throttleMinutes: 0,
    maxPerDay: 1
  },
  [NotificationType.CREDITS_EXPIRING]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'credits_expiring_email' },
      { type: 'push', enabled: true, template: 'credits_expiring_push' },
      { type: 'in_app', enabled: true, template: 'credits_expiring_in_app' }
    ],
    template: 'credits_expiring_notification',
    priority: NotificationPriority.MEDIUM,
    throttleMinutes: 1440, // 24 hours
    maxPerDay: 1
  },
  [NotificationType.MONTHLY_SUMMARY]: {
    enabled: true,
    channels: [
      { type: 'email', enabled: true, template: 'monthly_summary_email' },
      { type: 'in_app', enabled: true, template: 'monthly_summary_in_app' }
    ],
    template: 'monthly_summary_notification',
    priority: NotificationPriority.LOW,
    throttleMinutes: 0,
    maxPerDay: 1
  }
};

export const NOTIFICATION_SETTINGS = {
  DEFAULT_ENABLED: true,
  DEFAULT_EMAIL_ENABLED: true,
  DEFAULT_SMS_ENABLED: false,
  DEFAULT_PUSH_ENABLED: true,
  DEFAULT_IN_APP_ENABLED: true,
  MAX_NOTIFICATIONS_PER_HOUR: 10,
  MAX_NOTIFICATIONS_PER_DAY: 50,
  BATCH_SIZE: 100,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MINUTES: 5
};

export const USAGE_NOTIFICATION_THRESHOLDS: Record<CreditUsageType, number[]> = {
  [CreditUsageType.JOB_APPLICATION]: [5, 10, 15],
  [CreditUsageType.PROFILE_BOOST]: [2, 5, 8],
  [CreditUsageType.PREMIUM_JOB_UNLOCK]: [3, 7, 12],
  [CreditUsageType.DIRECT_MESSAGE]: [5, 10, 20],
  [CreditUsageType.FEATURED_LISTING]: [1, 2, 3],
  [CreditUsageType.MARKETPLACE_APPLICATION]: [3, 8, 15]
};

export const getNotificationConfig = (type: NotificationType): NotificationConfig => {
  return NOTIFICATION_CONFIGS[type];
};

export const isNotificationEnabled = (type: NotificationType, channel: string): boolean => {
  const config = getNotificationConfig(type);
  if (!config.enabled) return false;
  
  const channelConfig = config.channels.find(c => c.type === channel);
  return channelConfig?.enabled || false;
};

export const shouldThrottleNotification = (
  type: NotificationType,
  lastSentMinutes: number
): boolean => {
  const config = getNotificationConfig(type);
  return lastSentMinutes < config.throttleMinutes;
};
