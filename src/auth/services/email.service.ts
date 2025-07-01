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
