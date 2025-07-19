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

  async sendSMS(phone: string, message: string): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('SMS service is not configured, skipping SMS');
      return;
    }

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      logger.info('SMS sent successfully', { phone: this.maskPhoneNumber(phone) });
    } catch (error: any) {
      logger.error('Failed to send SMS', { 
        phone: this.maskPhoneNumber(phone), 
        error: error.message 
      });
    }
  }

  async sendCreditLowBalanceAlert(phone: string, username: string, currentBalance: number): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('SMS service is not configured, skipping credit low balance SMS');
      return;
    }

    const message = `BuildHive Alert: Hi ${username}, your credit balance is low (${currentBalance} credits). Top up now to continue applying for jobs.`;

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      logger.info('Credit low balance SMS sent successfully', { phone: this.maskPhoneNumber(phone) });
    } catch (error: any) {
      logger.error('Failed to send credit low balance SMS', { 
        phone: this.maskPhoneNumber(phone), 
        error: error.message 
      });
    }
  }

  async sendCreditCriticalBalanceAlert(phone: string, username: string, currentBalance: number): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('SMS service is not configured, skipping credit critical balance SMS');
      return;
    }

    const message = `URGENT - BuildHive: Hi ${username}, critical credit balance (${currentBalance} credits). Top up immediately to avoid service interruption.`;

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      logger.info('Credit critical balance SMS sent successfully', { phone: this.maskPhoneNumber(phone) });
    } catch (error: any) {
      logger.error('Failed to send credit critical balance SMS', { 
        phone: this.maskPhoneNumber(phone), 
        error: error.message 
      });
    }
  }

  async sendCreditPurchaseConfirmation(phone: string, username: string, totalCredits: number): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('SMS service is not configured, skipping credit purchase confirmation SMS');
      return;
    }

    const message = `BuildHive: Hi ${username}, credit purchase confirmed! ${totalCredits} credits added to your account. Start applying for jobs now.`;

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      logger.info('Credit purchase confirmation SMS sent successfully', { phone: this.maskPhoneNumber(phone) });
    } catch (error: any) {
      logger.error('Failed to send credit purchase confirmation SMS', { 
        phone: this.maskPhoneNumber(phone), 
        error: error.message 
      });
    }
  }

  async sendCreditAutoTopupNotification(phone: string, username: string, creditsAdded: number): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('SMS service is not configured, skipping credit auto topup SMS');
      return;
    }

    const message = `BuildHive: Hi ${username}, auto top-up completed! ${creditsAdded} credits added to your account automatically.`;

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      logger.info('Credit auto topup SMS sent successfully', { phone: this.maskPhoneNumber(phone) });
    } catch (error: any) {
      logger.error('Failed to send credit auto topup SMS', { 
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
