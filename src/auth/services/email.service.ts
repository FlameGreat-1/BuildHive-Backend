import nodemailer from 'nodemailer';
import { buildHiveLogger, AuthErrorFactory } from '../../shared';
import { getEmailConfig } from '../../config';
import type { IEmailService } from './index';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface EmailVerificationData {
  username: string;
  verificationLink: string;
  expiresIn: string;
}

export interface PasswordResetData {
  username: string;
  resetLink: string;
  expiresIn: string;
}

export interface WelcomeEmailData {
  username: string;
  role: string;
  loginLink: string;
  supportEmail: string;
}

export interface AccountStatusData {
  username: string;
  status: string;
  reason?: string;
  supportEmail: string;
  appealLink?: string;
}

export interface SubscriptionUpdateData {
  username: string;
  plan: string;
  startDate: string;
  endDate?: string;
  billingAmount?: number;
  managementLink: string;
}

export interface CreditTransactionData {
  username: string;
  transactionType: string;
  amount: number;
  newBalance: number;
  description: string;
  transactionDate: string;
  accountLink: string;
}

export class EmailService implements IEmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly emailConfig = getEmailConfig();
  private readonly logger = buildHiveLogger;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || 'https://buildhive.com.au';
    
    this.transporter = nodemailer.createTransporter({
      host: this.emailConfig.smtp.host,
      port: this.emailConfig.smtp.port,
      secure: this.emailConfig.smtp.secure,
      auth: {
        user: this.emailConfig.smtp.user,
        pass: this.emailConfig.smtp.password
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
    });

    this.logger.info('EmailService initialized', {
      service: 'EmailService',
      host: this.emailConfig.smtp.host,
      port: this.emailConfig.smtp.port,
      secure: this.emailConfig.smtp.secure,
      pooled: true
    });

    this.verifyConnection();
  }

  async sendVerificationEmail(email: string, token: string, username: string): Promise<void> {
    try {
      this.logger.info('Sending verification email', {
        email: this.maskEmail(email),
        username
      });

      const verificationLink = `${this.baseUrl}/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
      
      const templateData: EmailVerificationData = {
        username,
        verificationLink,
        expiresIn: '24 hours'
      };

      const template = this.generateVerificationEmailTemplate(templateData);
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      await this.sendEmail(emailOptions);

      this.logger.info('Verification email sent successfully', {
        email: this.maskEmail(email),
        username
      });

    } catch (error) {
      this.logger.error('Failed to send verification email', error, {
        email: this.maskEmail(email),
        username
      });

      throw AuthErrorFactory.emailSendFailed('Failed to send verification email', error);
    }
  }

  async sendPasswordResetEmail(email: string, token: string, username: string): Promise<void> {
    try {
      this.logger.info('Sending password reset email', {
        email: this.maskEmail(email),
        username
      });

      const resetLink = `${this.baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      
      const templateData: PasswordResetData = {
        username,
        resetLink,
        expiresIn: '10 minutes'
      };

      const template = this.generatePasswordResetTemplate(templateData);
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      await this.sendEmail(emailOptions);

      this.logger.info('Password reset email sent successfully', {
        email: this.maskEmail(email),
        username
      });

    } catch (error) {
      this.logger.error('Failed to send password reset email', error, {
        email: this.maskEmail(email),
        username
      });

      throw AuthErrorFactory.emailSendFailed('Failed to send password reset email', error);
    }
  }

  async sendWelcomeEmail(email: string, username: string, role: string): Promise<void> {
    try {
      this.logger.info('Sending welcome email', {
        email: this.maskEmail(email),
        username,
        role
      });

      const templateData: WelcomeEmailData = {
        username,
        role: this.formatRole(role),
        loginLink: `${this.baseUrl}/auth/login`,
        supportEmail: this.emailConfig.supportEmail
      };

      const template = this.generateWelcomeEmailTemplate(templateData);
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      await this.sendEmail(emailOptions);

      this.logger.info('Welcome email sent successfully', {
        email: this.maskEmail(email),
        username,
        role
      });

    } catch (error) {
      this.logger.error('Failed to send welcome email', error, {
        email: this.maskEmail(email),
        username,
        role
      });

      throw AuthErrorFactory.emailSendFailed('Failed to send welcome email', error);
    }
  }

  async sendAccountStatusEmail(email: string, username: string, status: string, reason?: string): Promise<void> {
    try {
      this.logger.info('Sending account status email', {
        email: this.maskEmail(email),
        username,
        status,
        hasReason: !!reason
      });

      const templateData: AccountStatusData = {
        username,
        status: this.formatStatus(status),
        reason,
        supportEmail: this.emailConfig.supportEmail,
        appealLink: status === 'suspended' ? `${this.baseUrl}/support/appeal` : undefined
      };

      const template = this.generateAccountStatusTemplate(templateData);
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      await this.sendEmail(emailOptions);

      this.logger.info('Account status email sent successfully', {
        email: this.maskEmail(email),
        username,
        status
      });

    } catch (error) {
      this.logger.error('Failed to send account status email', error, {
        email: this.maskEmail(email),
        username,
        status
      });

      throw AuthErrorFactory.emailSendFailed('Failed to send account status email', error);
    }
  }

  async sendSubscriptionUpdateEmail(email: string, username: string, plan: string): Promise<void> {
    try {
      this.logger.info('Sending subscription update email', {
        email: this.maskEmail(email),
        username,
        plan
      });

      const templateData: SubscriptionUpdateData = {
        username,
        plan: this.formatPlan(plan),
        startDate: new Date().toLocaleDateString('en-AU'),
        managementLink: `${this.baseUrl}/account/subscription`
      };

      const template = this.generateSubscriptionUpdateTemplate(templateData);
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      await this.sendEmail(emailOptions);

      this.logger.info('Subscription update email sent successfully', {
        email: this.maskEmail(email),
        username,
        plan
      });

    } catch (error) {
      this.logger.error('Failed to send subscription update email', error, {
        email: this.maskEmail(email),
        username,
        plan
      });

      throw AuthErrorFactory.emailSendFailed('Failed to send subscription update email', error);
    }
  }

  async sendCreditTransactionEmail(email: string, username: string, transaction: any): Promise<void> {
    try {
      this.logger.info('Sending credit transaction email', {
        email: this.maskEmail(email),
        username,
        transactionType: transaction.type,
        amount: transaction.amount
      });

      const templateData: CreditTransactionData = {
        username,
        transactionType: this.formatTransactionType(transaction.type),
        amount: transaction.amount,
        newBalance: transaction.newBalance || 0,
        description: transaction.description || '',
        transactionDate: new Date(transaction.timestamp).toLocaleDateString('en-AU'),
        accountLink: `${this.baseUrl}/account/credits`
      };

      const template = this.generateCreditTransactionTemplate(templateData);
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      await this.sendEmail(emailOptions);

      this.logger.info('Credit transaction email sent successfully', {
        email: this.maskEmail(email),
        username,
        transactionType: transaction.type
      });

    } catch (error) {
      this.logger.error('Failed to send credit transaction email', error, {
        email: this.maskEmail(email),
        username,
        transactionType: transaction.type
      });

      throw AuthErrorFactory.emailSendFailed('Failed to send credit transaction email', error);
    }
  }

  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: {
          name: 'BuildHive Australia',
          address: this.emailConfig.fromEmail
        },
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        headers: {
          'X-Mailer': 'BuildHive-Email-Service',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.debug('Email sent successfully', {
        messageId: result.messageId,
        to: this.maskEmail(options.to),
        subject: options.subject
      });

    } catch (error) {
      this.logger.error('Failed to send email', error, {
        to: this.maskEmail(options.to),
        subject: options.subject
      });
      throw error;
    }
  }

  private generateVerificationEmailTemplate(data: EmailVerificationData): EmailTemplate {
    const subject = 'Verify Your BuildHive Account';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to BuildHive!</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.username},</h2>
            <p>Thanks for joining BuildHive Australia! Please verify your email address to complete your account setup.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${data.verificationLink}" class="button">Verify Email Address</a>
            <p>This verification link will expire in ${data.expiresIn}.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 BuildHive Australia. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to BuildHive!
      
      Hi ${data.username},
      
      Thanks for joining BuildHive Australia! Please verify your email address to complete your account setup.
      
      Verification Link: ${data.verificationLink}
      
      This verification link will expire in ${data.expiresIn}.
      
      If you didn't create this account, please ignore this email.
      
      © 2025 BuildHive Australia. All rights reserved.
    `;

    return { subject, html, text };
  }

  private generatePasswordResetTemplate(data: PasswordResetData): EmailTemplate {
    const subject = 'Reset Your BuildHive Password';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.username},</h2>
            <p>We received a request to reset your BuildHive password.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${data.resetLink}" class="button">Reset Password</a>
            <div class="warning">
              <strong>Important:</strong> This reset link will expire in ${data.expiresIn} for security reasons.
            </div>
            <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>© 2025 BuildHive Australia. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      Hi ${data.username},
      
      We received a request to reset your BuildHive password.
      
      Reset Link: ${data.resetLink}
      
      IMPORTANT: This reset link will expire in ${data.expiresIn} for security reasons.
      
      If you didn't request this password reset, please ignore this email and your password will remain unchanged.
      
      © 2025 BuildHive Australia. All rights reserved.
    `;

    return { subject, html, text };
  }

  private generateWelcomeEmailTemplate(data: WelcomeEmailData): EmailTemplate {
    const subject = `Welcome to BuildHive, ${data.username}!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #059669; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .features { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to BuildHive!</h1>
          </div>
          <div class="content">
            <h2>G'day ${data.username}!</h2>
            <p>Welcome to BuildHive Australia - your trusted marketplace for connecting with quality tradies and clients.</p>
            <p>Your account has been successfully created as a <strong>${data.role}</strong>.</p>
            
            <div class="features">
              <h3>What's next?</h3>
              <ul>
                <li>Complete your profile to get better matches</li>
                <li>Browse available ${data.role === 'Tradie' ? 'jobs' : 'tradies'} in your area</li>
                <li>Start building your reputation with reviews</li>
                <li>Access our 24/7 support team</li>
              </ul>
            </div>
            
            <a href="${data.loginLink}" class="button">Get Started</a>
            
            <p>If you have any questions, feel free to contact our support team at ${data.supportEmail}</p>
          </div>
          <div class="footer">
            <p>© 2025 BuildHive Australia. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to BuildHive!
      
      G'day ${data.username}!
      
      Welcome to BuildHive Australia - your trusted marketplace for connecting with quality tradies and clients.
      
      Your account has been successfully created as a ${data.role}.
      
      What's next?
      - Complete your profile to get better matches
      - Browse available ${data.role === 'Tradie' ? 'jobs' : 'tradies'} in your area
      - Start building your reputation with reviews
      - Access our 24/7 support team
      
      Get Started: ${data.loginLink}
      
      If you have any questions, feel free to contact our support team at ${data.supportEmail}
      
      © 2025 BuildHive Australia. All rights reserved.
    `;

    return { subject, html, text };
  }

  private maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.substring(0, 2) + '*'.repeat(username.length - 2)
      : username;
    return `${maskedUsername}@${domain}`;
  }

  private formatRole(role: string): string {
    const roleMap: Record<string, string> = {
      'client': 'Client',
      'tradie': 'Tradie',
      'enterprise': 'Enterprise'
    };
    return roleMap[role.toLowerCase()] || role;
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'active': 'Active',
      'inactive': 'Inactive',
      'suspended': 'Suspended',
      'pending': 'Pending Verification'
    };
    return statusMap[status.toLowerCase()] || status;
  }

  private formatPlan(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
  }

  private formatTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      'purchase': 'Credit Purchase',
      'usage': 'Credit Usage',
      'refund': 'Credit Refund',
      'bonus': 'Bonus Credits'
    };
    return typeMap[type.toLowerCase()] || type;
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.info('Email service connection verified successfully');
    } catch (error) {
      this.logger.error('Email service connection failed', error);
      throw AuthErrorFactory.emailConfigurationError('Email service connection failed', error);
    }
  }
}
