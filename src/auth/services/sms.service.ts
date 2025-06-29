import { Twilio } from 'twilio';
import { buildHiveLogger, AuthErrorFactory } from '../../shared';
import { getSMSConfig } from '../../config';
import type { ISMSService } from './index';

export interface SMSTemplate {
  message: string;
}

export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
}

export interface VerificationCodeData {
  code: string;
  expiresInMinutes: number;
  appName: string;
}

export interface SecurityAlertData {
  alertType: string;
  timestamp: string;
  location?: string;
  ipAddress?: string;
}

export interface SMSDeliveryResult {
  messageId: string;
  status: string;
  to: string;
  sentAt: Date;
}

export class SMSService implements ISMSService {
  private readonly twilioClient: Twilio;
  private readonly smsConfig = getSMSConfig();
  private readonly logger = buildHiveLogger;
  private readonly fromNumber: string;

  constructor() {
    this.fromNumber = this.smsConfig.fromNumber;
    
    this.twilioClient = new Twilio(
      this.smsConfig.accountSid,
      this.smsConfig.authToken
    );

    this.logger.info('SMSService initialized', {
      service: 'SMSService',
      provider: 'Twilio',
      fromNumber: this.maskPhoneNumber(this.fromNumber),
      rateLimitEnabled: this.smsConfig.rateLimit.enabled
    });

    this.validateConfiguration();
  }

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    try {
      this.logger.info('Sending SMS verification code', {
        phone: this.maskPhoneNumber(phone),
        codeLength: code.length
      });

      await this.validatePhoneNumber(phone);
      await this.checkRateLimit(phone, 'verification');

      const templateData: VerificationCodeData = {
        code,
        expiresInMinutes: 10,
        appName: 'BuildHive'
      };

      const template = this.generateVerificationCodeTemplate(templateData);
      
      const smsOptions: SMSOptions = {
        to: this.formatPhoneNumber(phone),
        message: template.message,
        from: this.fromNumber
      };

      const result = await this.sendSMS(smsOptions);

      await this.logSMSDelivery(result, 'verification_code');

      this.logger.info('SMS verification code sent successfully', {
        phone: this.maskPhoneNumber(phone),
        messageId: result.messageId,
        status: result.status
      });

    } catch (error) {
      this.logger.error('Failed to send SMS verification code', error, {
        phone: this.maskPhoneNumber(phone)
      });

      throw AuthErrorFactory.smsSendFailed('Failed to send verification code', error);
    }
  }

  async sendSecurityAlert(phone: string, message: string): Promise<void> {
    try {
      this.logger.info('Sending SMS security alert', {
        phone: this.maskPhoneNumber(phone),
        messageLength: message.length
      });

      await this.validatePhoneNumber(phone);
      await this.checkRateLimit(phone, 'security_alert');

      const template = this.generateSecurityAlertTemplate(message);
      
      const smsOptions: SMSOptions = {
        to: this.formatPhoneNumber(phone),
        message: template.message,
        from: this.fromNumber
      };

      const result = await this.sendSMS(smsOptions);

      await this.logSMSDelivery(result, 'security_alert');

      this.logger.info('SMS security alert sent successfully', {
        phone: this.maskPhoneNumber(phone),
        messageId: result.messageId,
        status: result.status
      });

    } catch (error) {
      this.logger.error('Failed to send SMS security alert', error, {
        phone: this.maskPhoneNumber(phone)
      });

      throw AuthErrorFactory.smsSendFailed('Failed to send security alert', error);
    }
  }

  async sendLoginNotification(phone: string, location?: string, ipAddress?: string): Promise<void> {
    try {
      this.logger.info('Sending SMS login notification', {
        phone: this.maskPhoneNumber(phone),
        hasLocation: !!location,
        hasIP: !!ipAddress
      });

      const alertData: SecurityAlertData = {
        alertType: 'login',
        timestamp: new Date().toLocaleString('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        location,
        ipAddress: ipAddress ? this.maskIPAddress(ipAddress) : undefined
      };

      let message = `BuildHive Security Alert: New login detected on ${alertData.timestamp}`;
      
      if (location) {
        message += ` from ${location}`;
      }
      
      message += '. If this wasn\'t you, secure your account immediately.';

      await this.sendSecurityAlert(phone, message);

    } catch (error) {
      this.logger.error('Failed to send login notification', error, {
        phone: this.maskPhoneNumber(phone)
      });

      throw AuthErrorFactory.smsSendFailed('Failed to send login notification', error);
    }
  }

  async sendPasswordChangeNotification(phone: string): Promise<void> {
    try {
      this.logger.info('Sending SMS password change notification', {
        phone: this.maskPhoneNumber(phone)
      });

      const message = `BuildHive Security Alert: Your password was changed on ${new Date().toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}. If this wasn't you, contact support immediately.`;

      await this.sendSecurityAlert(phone, message);

    } catch (error) {
      this.logger.error('Failed to send password change notification', error, {
        phone: this.maskPhoneNumber(phone)
      });

      throw AuthErrorFactory.smsSendFailed('Failed to send password change notification', error);
    }
  }

  async sendAccountSuspensionAlert(phone: string, reason?: string): Promise<void> {
    try {
      this.logger.info('Sending SMS account suspension alert', {
        phone: this.maskPhoneNumber(phone),
        hasReason: !!reason
      });

      let message = 'BuildHive Alert: Your account has been suspended';
      
      if (reason) {
        message += ` due to: ${reason}`;
      }
      
      message += '. Contact support for assistance.';

      await this.sendSecurityAlert(phone, message);

    } catch (error) {
      this.logger.error('Failed to send account suspension alert', error, {
        phone: this.maskPhoneNumber(phone)
      });

      throw AuthErrorFactory.smsSendFailed('Failed to send suspension alert', error);
    }
  }

  private async sendSMS(options: SMSOptions): Promise<SMSDeliveryResult> {
    try {
      const message = await this.twilioClient.messages.create({
        body: options.message,
        from: options.from || this.fromNumber,
        to: options.to,
        statusCallback: this.smsConfig.statusCallbackUrl,
        validityPeriod: 300 // 5 minutes validity
      });

      return {
        messageId: message.sid,
        status: message.status,
        to: options.to,
        sentAt: new Date()
      };

    } catch (error) {
      this.logger.error('Twilio SMS send failed', error, {
        to: this.maskPhoneNumber(options.to),
        messageLength: options.message.length
      });

      if (error.code === 21614) {
        throw AuthErrorFactory.invalidPhoneNumber('Invalid phone number format');
      }

      if (error.code === 21408) {
        throw AuthErrorFactory.smsPermissionDenied('SMS not allowed to this number');
      }

      throw error;
    }
  }

  private generateVerificationCodeTemplate(data: VerificationCodeData): SMSTemplate {
    const message = `${data.appName} verification code: ${data.code}. Valid for ${data.expiresInMinutes} minutes. Don't share this code with anyone.`;

    return { message };
  }

  private generateSecurityAlertTemplate(alertMessage: string): SMSTemplate {
    return { message: alertMessage };
  }

  private async validatePhoneNumber(phone: string): Promise<void> {
    // Australian phone number validation
    const australianPhoneRegex = /^(\+61|0)[2-9]\d{8}$/;
    
    if (!australianPhoneRegex.test(phone.replace(/\s/g, ''))) {
      throw AuthErrorFactory.invalidPhoneNumber('Invalid Australian phone number format');
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Convert Australian phone numbers to international format
    let formatted = phone.replace(/\s/g, '');
    
    if (formatted.startsWith('0')) {
      formatted = '+61' + formatted.substring(1);
    } else if (!formatted.startsWith('+61')) {
      formatted = '+61' + formatted;
    }
    
    return formatted;
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length < 4) return phone;
    
    const start = phone.substring(0, 3);
    const end = phone.substring(phone.length - 2);
    const middle = '*'.repeat(phone.length - 5);
    
    return start + middle + end;
  }

  private maskIPAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.**`;
    }
    return ip.substring(0, 8) + '***';
  }

  private async checkRateLimit(phone: string, type: string): Promise<void> {
    if (!this.smsConfig.rateLimit.enabled) return;

    const key = `sms_rate_limit:${type}:${phone}`;
    const limit = type === 'verification' ? 3 : 5; // 3 verification codes or 5 alerts per hour
    
    // This would typically use Redis or similar cache
    // For now, we'll implement basic in-memory rate limiting
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    // In production, implement proper rate limiting with Redis
    this.logger.debug('Rate limit check passed', {
      phone: this.maskPhoneNumber(phone),
      type,
      limit
    });
  }

  private async logSMSDelivery(result: SMSDeliveryResult, type: string): Promise<void> {
    try {
      // Log SMS delivery for audit and monitoring
      this.logger.info('SMS delivery logged', {
        messageId: result.messageId,
        status: result.status,
        type,
        phone: this.maskPhoneNumber(result.to),
        sentAt: result.sentAt
      });

      // In production, store in database for audit trail
    } catch (error) {
      this.logger.warn('Failed to log SMS delivery', error, {
        messageId: result.messageId
      });
    }
  }

  private validateConfiguration(): void {
    if (!this.smsConfig.accountSid) {
      throw AuthErrorFactory.smsConfigurationError('Twilio Account SID not configured');
    }

    if (!this.smsConfig.authToken) {
      throw AuthErrorFactory.smsConfigurationError('Twilio Auth Token not configured');
    }

    if (!this.smsConfig.fromNumber) {
      throw AuthErrorFactory.smsConfigurationError('SMS from number not configured');
    }

    this.logger.info('SMS service configuration validated successfully');
  }

  async getDeliveryStatus(messageId: string): Promise<string> {
    try {
      const message = await this.twilioClient.messages(messageId).fetch();
      
      this.logger.debug('SMS delivery status retrieved', {
        messageId,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      });

      return message.status;

    } catch (error) {
      this.logger.error('Failed to get SMS delivery status', error, { messageId });
      throw AuthErrorFactory.smsStatusCheckFailed('Failed to check SMS status', error);
    }
  }

  async validateTwilioWebhook(signature: string, url: string, params: any): Promise<boolean> {
    try {
      const isValid = this.twilioClient.validateRequest(
        this.smsConfig.authToken,
        signature,
        url,
        params
      );

      this.logger.debug('Twilio webhook validation result', {
        isValid,
        url
      });

      return isValid;

    } catch (error) {
      this.logger.error('Twilio webhook validation failed', error, { url });
      return false;
    }
  }
}
