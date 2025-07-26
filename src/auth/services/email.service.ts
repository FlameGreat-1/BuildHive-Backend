import nodemailer from 'nodemailer';
import { environment } from '../../config/auth';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { logger } from '../../shared/utils';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: environment.EMAIL_SERVICE,
      auth: {
        user: environment.EMAIL_USER,
        pass: environment.EMAIL_PASSWORD
      }
    });
  }

  async sendVerificationEmail(email: string, username: string, token: string): Promise<void> {
    const verificationUrl = `${environment.CORS_ORIGIN}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Verify Your BuildHive Account',
      html: this.getVerificationEmailTemplate(username, verificationUrl)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Verification email sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send verification email', { email, error: error.message });
      throw new AppError(
        'Failed to send verification email',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async sendPasswordResetEmail(email: string, username: string, token: string): Promise<void> {
    const resetUrl = `${environment.CORS_ORIGIN}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Reset Your BuildHive Password',
      html: this.getPasswordResetEmailTemplate(username, resetUrl)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Password reset email sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send password reset email', { email, error: error.message });
      throw new AppError(
        'Failed to send password reset email',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async sendPasswordChangedNotification(email: string, username: string): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'BuildHive Password Changed',
      html: this.getPasswordChangedEmailTemplate(username)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Password changed notification sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send password changed notification', { email, error: error.message });
    }
  }

  async sendLoginNotification(email: string, username: string, loginDetails: {
    ip: string;
    userAgent: string;
    timestamp: Date;
    location?: string;
  }): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'New Login to Your BuildHive Account',
      html: this.getLoginNotificationTemplate(username, loginDetails)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Login notification sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send login notification', { email, error: error.message });
    }
  }

  async sendWelcomeEmail(email: string, username: string, role: string): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Welcome to BuildHive!',
      html: this.getWelcomeEmailTemplate(username, role)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Welcome email sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send welcome email', { email, error: error.message });
    }
  }

  async sendAccountLockedNotification(email: string, username: string, unlockTime: Date): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'BuildHive Account Temporarily Locked',
      html: this.getAccountLockedEmailTemplate(username, unlockTime)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Account locked notification sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send account locked notification', { email, error: error.message });
    }
  }

  async sendCreditLowBalanceAlert(email: string, username: string, currentBalance: number): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Low Credit Balance Alert - BuildHive',
      html: this.getCreditLowBalanceTemplate(username, currentBalance)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Credit low balance alert sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send credit low balance alert', { email, error: error.message });
    }
  }

  async sendCreditCriticalBalanceAlert(email: string, username: string, currentBalance: number): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'URGENT: Critical Credit Balance - BuildHive',
      html: this.getCreditCriticalBalanceTemplate(username, currentBalance)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Credit critical balance alert sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send credit critical balance alert', { email, error: error.message });
    }
  }

  async sendCreditTrialNotification(email: string, username: string, creditsAwarded: number): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Welcome! Your Free Credits Are Ready - BuildHive',
      html: this.getCreditTrialTemplate(username, creditsAwarded)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Credit trial notification sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send credit trial notification', { email, error: error.message });
    }
  }

  async sendCreditPurchaseConfirmation(email: string, username: string, purchaseData: {
    id: number;
    creditsAmount: number;
    bonusCredits: number;
    purchasePrice: number;
    currency: string;
  }): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Credit Purchase Confirmed - BuildHive',
      html: this.getCreditPurchaseConfirmationTemplate(username, purchaseData)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Credit purchase confirmation sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send credit purchase confirmation', { email, error: error.message });
    }
  }

  async sendCreditRefundNotification(email: string, username: string, creditsRefunded: number, reason: string): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Credit Refund Processed - BuildHive',
      html: this.getCreditRefundTemplate(username, creditsRefunded, reason)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Credit refund notification sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send credit refund notification', { email, error: error.message });
    }
  }

  async sendCreditExpiryNotification(email: string, username: string, creditsExpired: number): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Credits Expired - BuildHive',
      html: this.getCreditExpiryTemplate(username, creditsExpired)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Credit expiry notification sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send credit expiry notification', { email, error: error.message });
    }
  }

  async sendCreditAutoTopupNotification(email: string, username: string, creditsAdded: number, amount: number): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: 'Auto Top-up Completed - BuildHive',
      html: this.getCreditAutoTopupTemplate(username, creditsAdded, amount)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Credit auto topup notification sent successfully', { email, username });
    } catch (error: any) {
      logger.error('Failed to send credit auto topup notification', { email, error: error.message });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email service connection test failed', { error });
      return false;
    }
  }

  async sendJobNotificationEmail(email: string, subject: string, message: string): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: subject,
      html: this.getJobNotificationTemplate(subject, message)
    };
  
    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Job notification email sent successfully', { email });
    } catch (error: any) {
      logger.error('Failed to send job notification email', { email, error: error.message });
    }
  }
  
  async sendApplicationNotificationEmail(email: string, applicationData: any): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: `New Application for "${applicationData.jobTitle}"`,
      html: this.getApplicationNotificationTemplate(applicationData)
    };
  
    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Application notification email sent successfully', { email });
    } catch (error: any) {
      logger.error('Failed to send application notification email', { email, error: error.message });
    }
  }
  
  async sendApplicationStatusEmail(email: string, username: string, jobTitle: string, status: string): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: `Application ${status} - ${jobTitle}`,
      html: this.getApplicationStatusTemplate(username, jobTitle, status)
    };
  
    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Application status email sent successfully', { email });
    } catch (error: any) {
      logger.error('Failed to send application status email', { email, error: error.message });
    }
  }
  
  async sendJobAssignmentEmail(email: string, username: string, jobTitle: string): Promise<void> {
    const mailOptions = {
      from: environment.EMAIL_FROM,
      to: email,
      subject: `Job Assignment Confirmed - ${jobTitle}`,
      html: this.getJobAssignmentTemplate(username, jobTitle)
    };
  
    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Job assignment email sent successfully', { email });
    } catch (error: any) {
      logger.error('Failed to send job assignment email', { email, error: error.message });
    }
  }  

  private getVerificationEmailTemplate(username: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your BuildHive Account</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">Welcome to BuildHive!</h1>
          <p>Hi ${username},</p>
          <p>Thank you for registering with BuildHive. To complete your registration, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p>This verification link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            If you didn't create an account with BuildHive, please ignore this email.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetEmailTemplate(username: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your BuildHive Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">Password Reset Request</h1>
          <p>Hi ${username},</p>
          <p>We received a request to reset your BuildHive account password. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This password reset link will expire in 30 minutes for security reasons.</p>
          <p><strong>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</strong></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            For security reasons, this link can only be used once and will expire soon.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordChangedEmailTemplate(username: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>BuildHive Password Changed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">Password Changed Successfully</h1>
          <p>Hi ${username},</p>
          <p>This email confirms that your BuildHive account password has been successfully changed.</p>
          <p><strong>When:</strong> ${new Date().toLocaleString()}</p>
          <p>If you made this change, no further action is required.</p>
          <p><strong>If you didn't change your password:</strong></p>
          <ul>
            <li>Your account may have been compromised</li>
            <li>Please contact our support team immediately</li>
            <li>Consider enabling two-factor authentication for added security</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/contact-support" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Contact Support</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated security notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getLoginNotificationTemplate(username: string, loginDetails: {
    ip: string;
    userAgent: string;
    timestamp: Date;
    location?: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Login to Your BuildHive Account</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">New Login Detected</h1>
          <p>Hi ${username},</p>
          <p>We detected a new login to your BuildHive account:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Time:</strong> ${loginDetails.timestamp.toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${loginDetails.ip}</p>
            ${loginDetails.location ? `<p><strong>Location:</strong> ${loginDetails.location}</p>` : ''}
            <p><strong>Device:</strong> ${loginDetails.userAgent}</p>
          </div>
          <p>If this was you, no further action is required.</p>
          <p><strong>If this wasn't you:</strong></p>
          <ul>
            <li>Change your password immediately</li>
            <li>Review your account activity</li>
            <li>Contact our support team</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/account/security" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Secure My Account</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated security notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getAccountLockedEmailTemplate(username: string, unlockTime: Date): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>BuildHive Account Temporarily Locked</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc3545;">Account Temporarily Locked</h1>
          <p>Hi ${username},</p>
          <p>Your BuildHive account has been temporarily locked due to multiple failed login attempts.</p>
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p><strong>Account will be unlocked at:</strong> ${unlockTime.toLocaleString()}</p>
          </div>
          <p>This is a security measure to protect your account from unauthorized access attempts.</p>
          <p><strong>What you can do:</strong></p>
          <ul>
            <li>Wait for the automatic unlock time</li>
            <li>Reset your password if you've forgotten it</li>
            <li>Contact support if you need immediate assistance</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/forgot-password" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated security notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(username: string, role: string): string {
    const roleSpecificContent = this.getRoleSpecificWelcomeContent(role);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to BuildHive</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">Welcome to BuildHive, ${username}!</h1>
          <p>Your account has been successfully verified and activated.</p>
          ${roleSpecificContent}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/dashboard" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Get Started</a>
          </div>
          <p>If you have any questions, feel free to contact our support team.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            Thank you for choosing BuildHive!
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getRoleSpecificWelcomeContent(role: string): string {
    switch (role) {
      case 'client':
        return `
          <p>As a client, you can now:</p>
          <ul>
            <li>Post jobs and find qualified tradies</li>
            <li>Browse tradie profiles and reviews</li>
            <li>Manage your projects and communications</li>
          </ul>
        `;
      case 'tradie':
        return `
          <p>As a tradie, you can now:</p>
          <ul>
            <li>Browse and apply for jobs</li>
            <li>Build your professional profile</li>
            <li>Manage your business tools and invoicing</li>
          </ul>
        `;
      case 'enterprise':
        return `
          <p>As an enterprise user, you can now:</p>
          <ul>
            <li>Manage your team and assign jobs</li>
            <li>Post jobs and manage workflows</li>
            <li>Access advanced reporting and analytics</li>
          </ul>
        `;
      default:
        return '<p>You can now access all the features available for your account type.</p>';
    }
  }

  private getCreditLowBalanceTemplate(username: string, currentBalance: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Low Credit Balance Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ffc107;">Low Credit Balance Alert</h1>
          <p>Hi ${username},</p>
          <p>Your BuildHive credit balance is running low.</p>
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p><strong>Current Balance:</strong> ${currentBalance} credits</p>
          </div>
          <p>To continue applying for jobs and accessing premium features, consider topping up your credits.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/credits/purchase" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Top Up Credits</a>
          </div>
          <p>Need help? Contact our support team anytime.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getCreditCriticalBalanceTemplate(username: string, currentBalance: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Critical Credit Balance Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc3545;">URGENT: Critical Credit Balance</h1>
          <p>Hi ${username},</p>
          <p>Your BuildHive credit balance is critically low and requires immediate attention.</p>
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p><strong>Current Balance:</strong> ${currentBalance} credits</p>
            <p><strong>Status:</strong> Critical - Service interruption imminent</p>
          </div>
          <p><strong>Action Required:</strong> Top up your credits immediately to avoid service interruption.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/credits/purchase" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Top Up Now</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an urgent automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getCreditTrialTemplate(username: string, creditsAwarded: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome! Your Free Credits Are Ready</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #28a745;">Welcome! Your Free Credits Are Ready</h1>
          <p>Hi ${username},</p>
          <p>Congratulations! Your BuildHive account has been activated and we've added free trial credits to get you started.</p>
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p><strong>Free Credits Awarded:</strong> ${creditsAwarded} credits</p>
          </div>
          <p>You can now start applying for jobs and exploring all the features BuildHive has to offer!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/jobs" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Browse Jobs</a>
          </div>
          <p>Need help getting started? Check out our <a href="${environment.CORS_ORIGIN}/help/credits">credits guide</a>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            Welcome to BuildHive!
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getCreditPurchaseConfirmationTemplate(username: string, purchaseData: {
    id: number;
    creditsAmount: number;
    bonusCredits: number;
    purchasePrice: number;
    currency: string;
  }): string {
    const totalCredits = purchaseData.creditsAmount + purchaseData.bonusCredits;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Credit Purchase Confirmed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #28a745;">Credit Purchase Confirmed</h1>
          <p>Hi ${username},</p>
          <p>Your credit purchase has been successfully processed and added to your account.</p>
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p><strong>Purchase ID:</strong> #${purchaseData.id}</p>
            <p><strong>Credits Purchased:</strong> ${purchaseData.creditsAmount} credits</p>
            <p><strong>Bonus Credits:</strong> ${purchaseData.bonusCredits} credits</p>
            <p><strong>Total Credits Added:</strong> ${totalCredits} credits</p>
            <p><strong>Amount Paid:</strong> ${purchaseData.currency} ${purchaseData.purchasePrice}</p>
          </div>
          <p>Your credits are now available and ready to use!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/dashboard/credits" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Credits</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            Thank you for your purchase!
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getCreditRefundTemplate(username: string, creditsRefunded: number, reason: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Credit Refund Processed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">Credit Refund Processed</h1>
          <p>Hi ${username},</p>
          <p>A credit refund has been processed for your account.</p>
          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <p><strong>Credits Refunded:</strong> ${creditsRefunded} credits</p>
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
          <p>The refunded credits have been added back to your account balance.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/dashboard/credits" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Balance</a>
          </div>
          <p>If you have any questions, please contact our support team.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getCreditExpiryTemplate(username: string, creditsExpired: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Credits Expired</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ffc107;">Credits Expired</h1>
          <p>Hi ${username},</p>
          <p>Some of your BuildHive credits have expired and have been removed from your account.</p>
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p><strong>Credits Expired:</strong> ${creditsExpired} credits</p>
          </div>
          <p>To avoid future credit expiry, consider purchasing credits more frequently or enabling auto top-up.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/credits/purchase" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Purchase Credits</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getCreditAutoTopupTemplate(username: string, creditsAdded: number, amount: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Auto Top-up Completed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #28a745;">Auto Top-up Completed</h1>
          <p>Hi ${username},</p>
          <p>Your auto top-up has been successfully processed and credits have been added to your account.</p>
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p><strong>Credits Added:</strong> ${creditsAdded} credits</p>
            <p><strong>Amount Charged:</strong> $${amount}</p>
          </div>
          <p>Your account balance has been automatically topped up to ensure uninterrupted service.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/dashboard/credits" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Balance</a>
          </div>
          <p>You can manage your auto top-up settings anytime in your account dashboard.</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${environment.CORS_ORIGIN}/settings/auto-topup" style="background-color: #6c757d; color: white; padding: 10px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Manage Auto Top-up</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getJobNotificationTemplate(subject: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">${subject}</h1>
          <p>${message}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/dashboard" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }
  
  private getApplicationNotificationTemplate(applicationData: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Application Received</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c5aa0;">New Application Received!</h1>
          <p>You have received a new application for your job posting.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Job Title:</strong> ${applicationData.jobTitle}</p>
            <p><strong>Quoted Price:</strong> $${applicationData.customQuote}</p>
            <p><strong>Proposed Timeline:</strong> ${applicationData.proposedTimeline}</p>
            <p><strong>Application Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p>Review the application details and tradie profile to make your decision.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/jobs/${applicationData.jobId}/applications" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Review Application</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }
  
  private getApplicationStatusTemplate(username: string, jobTitle: string, status: string): string {
    const statusColor = status === 'selected' ? '#28a745' : status === 'rejected' ? '#dc3545' : '#ffc107';
    const statusMessage = status === 'selected' ? 'Congratulations! Application Selected' : 
                         status === 'rejected' ? 'Application Status Update' : 
                         'Application Under Review';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Application ${status.charAt(0).toUpperCase() + status.slice(1)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: ${statusColor};">${statusMessage}</h1>
          <p>Hi ${username},</p>
          <p>We have an update regarding your application for the job: "<strong>${jobTitle}</strong>"</p>
          <div style="background-color: ${status === 'selected' ? '#d4edda' : status === 'rejected' ? '#f8d7da' : '#fff3cd'}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <p><strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}</p>
            <p><strong>Updated:</strong> ${new Date().toLocaleString()}</p>
          </div>
          ${status === 'selected' ? 
            '<p>The client has selected your application! They will contact you soon with further details about the job.</p>' :
            status === 'rejected' ? 
            '<p>While your application was not selected this time, we encourage you to keep applying for other opportunities on BuildHive.</p>' :
            '<p>Your application is currently being reviewed by the client. We will notify you once a decision has been made.</p>'
          }
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/applications" style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View My Applications</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }
  
  private getJobAssignmentTemplate(username: string, jobTitle: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Job Assignment Confirmed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #28a745;">Job Assignment Confirmed!</h1>
          <p>Hi ${username},</p>
          <p>Congratulations! You have been officially assigned to a job through BuildHive.</p>
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p><strong>Job Title:</strong> ${jobTitle}</p>
            <p><strong>Assignment Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Status:</strong> Assigned</p>
          </div>
          <p>The client will contact you directly with additional details, timeline, and any specific requirements for the job.</p>
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Wait for the client to contact you with job details</li>
            <li>Prepare any necessary tools and materials</li>
            <li>Review the job requirements carefully</li>
            <li>Contact support if you have any questions</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${environment.CORS_ORIGIN}/jobs/assigned" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Assigned Jobs</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from BuildHive.
          </p>
        </div>
      </body>
      </html>
    `;
  }  

}
