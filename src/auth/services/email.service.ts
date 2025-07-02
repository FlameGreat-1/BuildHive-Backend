import nodemailer from 'nodemailer';
import { environment } from '../../config/auth';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { logger } from '../../shared/utils';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
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

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email service connection test failed', { error });
      return false;
    }
  }
}
