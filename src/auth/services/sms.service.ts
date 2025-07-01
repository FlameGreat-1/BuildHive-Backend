import { environment } from '../../config/auth';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { logger } from '../../shared/utils';

export class SmsService {
  private twilioClient: any;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    
    if (this.isEnabled) {
      const twilio = require('twilio');
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  async sendVerificationSms(phone: string, code: string): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('SMS service is not configured, skipping SMS verification');
      return;
    }

    const message = `Your BuildHive verification code is: ${code}. This code will expire in 15 minutes.`;

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      logger.info('Verification SMS sent successfully', { phone: this.maskPhoneNumber(phone) });
    } catch (error: any) {
      logger.error('Failed to send verification SMS', { 
        phone: this.maskPhoneNumber(phone), 
        error: error.message 
      });
      
      throw new AppError(
        'Failed to send verification SMS',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async sendWelcomeSms(phone: string, username: string): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('SMS service is not configured, skipping welcome SMS');
      return;
    }

    const message = `Welcome to BuildHive, ${username}! Your account is now active. Start exploring opportunities today.`;

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      logger.info('Welcome SMS sent successfully', { phone: this.maskPhoneNumber(phone) });
    } catch (error: any) {
      logger.error('Failed to send welcome SMS', { 
        phone: this.maskPhoneNumber(phone), 
        error: error.message 
      });
    }
  }

  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length < 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }

  isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  async testConnection(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return true;
    } catch (error) {
      logger.error('SMS service connection test failed', { error });
      return false;
    }
  }
}
