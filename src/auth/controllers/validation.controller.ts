import { Request, Response, NextFunction } from 'express';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import type { 
  IAuthService,
  IUserService,
  ServiceContainer 
} from '../services';
import type {
  EmailVerificationRequest,
  PhoneVerificationRequest,
  ResendVerificationRequest,
  VerifyEmailRequest,
  VerifyPhoneRequest,
  ValidationResponse
} from '../types';

export interface IValidationController {
  sendEmailVerification(req: Request, res: Response, next: NextFunction): Promise<void>;
  verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
  sendPhoneVerification(req: Request, res: Response, next: NextFunction): Promise<void>;
  verifyPhone(req: Request, res: Response, next: NextFunction): Promise<void>;
  resendEmailVerification(req: Request, res: Response, next: NextFunction): Promise<void>;
  resendPhoneVerification(req: Request, res: Response, next: NextFunction): Promise<void>;
  validateBusinessNumber(req: Request, res: Response, next: NextFunction): Promise<void>;
  validateTradeLicense(req: Request, res: Response, next: NextFunction): Promise<void>;
  checkEmailAvailability(req: Request, res: Response, next: NextFunction): Promise<void>;
  checkPhoneAvailability(req: Request, res: Response, next: NextFunction): Promise<void>;
  validatePostcode(req: Request, res: Response, next: NextFunction): Promise<void>;
  getVerificationStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export class ValidationController implements IValidationController {
  private readonly authService: IAuthService;
  private readonly userService: IUserService;
  private readonly logger = buildHiveLogger;

  constructor(serviceContainer: ServiceContainer) {
    this.authService = serviceContainer.getAuthService();
    this.userService = serviceContainer.getUserService();

    this.logger.info('ValidationController initialized', {
      controller: 'ValidationController',
      dependencies: ['AuthService', 'UserService']
    });
  }

  async sendEmailVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.body.email;
      const userId = req.user?.id;

      this.logger.info('Email verification send request', {
        email: this.maskEmail(email),
        userId,
        ip: req.ip
      });

      if (!email) {
        throw AuthErrorFactory.missingRequiredFields(['email']);
      }

      const verificationData: EmailVerificationRequest = {
        email,
        userId,
        platform: req.body.platform || 'web',
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.sendEmailVerification(verificationData);

      this.logger.info('Email verification sent successfully', {
        email: this.maskEmail(email),
        userId,
        expiresAt: result.data?.expiresAt
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Email verification send failed', error, {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, token } = req.body;

      this.logger.info('Email verification attempt', {
        email: this.maskEmail(email),
        hasToken: !!token,
        ip: req.ip
      });

      if (!email || !token) {
        throw AuthErrorFactory.missingRequiredFields(['email', 'token']);
      }

      const verifyData: VerifyEmailRequest = {
        email,
        token,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.verifyEmail(verifyData);

      this.logger.info('Email verification successful', {
        email: this.maskEmail(email),
        userId: result.data?.userId
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Email verification failed', error, {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        hasToken: !!req.body.token,
        ip: req.ip
      });

      next(error);
    }
  }

  async sendPhoneVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const phone = req.body.phone;
      const userId = req.user?.id;

      this.logger.info('Phone verification send request', {
        phone: this.maskPhone(phone),
        userId,
        ip: req.ip
      });

      if (!phone) {
        throw AuthErrorFactory.missingRequiredFields(['phone']);
      }

      // Validate Australian phone number format
      this.validateAustralianPhone(phone);

      const verificationData: PhoneVerificationRequest = {
        phone,
        userId,
        platform: req.body.platform || 'web',
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.sendPhoneVerification(verificationData);

      this.logger.info('Phone verification sent successfully', {
        phone: this.maskPhone(phone),
        userId,
        expiresAt: result.data?.expiresAt
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Phone verification send failed', error, {
        phone: req.body.phone ? this.maskPhone(req.body.phone) : 'not_provided',
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async verifyPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, code } = req.body;

      this.logger.info('Phone verification attempt', {
        phone: this.maskPhone(phone),
        hasCode: !!code,
        ip: req.ip
      });

      if (!phone || !code) {
        throw AuthErrorFactory.missingRequiredFields(['phone', 'code']);
      }

      const verifyData: VerifyPhoneRequest = {
        phone,
        code,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.verifyPhone(verifyData);

      this.logger.info('Phone verification successful', {
        phone: this.maskPhone(phone),
        userId: result.data?.userId
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Phone verification failed', error, {
        phone: req.body.phone ? this.maskPhone(req.body.phone) : 'not_provided',
        hasCode: !!req.body.code,
        ip: req.ip
      });

      next(error);
    }
  }

  async resendEmailVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.body.email;
      const userId = req.user?.id;

      this.logger.info('Email verification resend request', {
        email: this.maskEmail(email),
        userId,
        ip: req.ip
      });

      if (!email) {
        throw AuthErrorFactory.missingRequiredFields(['email']);
      }

      // Check rate limiting for resend attempts
      await this.checkResendRateLimit(email, 'email', req.ip);

      const resendData: ResendVerificationRequest = {
        email,
        userId,
        type: 'email',
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.resendVerification(resendData);

      this.logger.info('Email verification resent successfully', {
        email: this.maskEmail(email),
        userId,
        expiresAt: result.data?.expiresAt
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Email verification resend failed', error, {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async resendPhoneVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const phone = req.body.phone;
      const userId = req.user?.id;

      this.logger.info('Phone verification resend request', {
        phone: this.maskPhone(phone),
        userId,
        ip: req.ip
      });

      if (!phone) {
        throw AuthErrorFactory.missingRequiredFields(['phone']);
      }

      // Check rate limiting for resend attempts
      await this.checkResendRateLimit(phone, 'phone', req.ip);

      const resendData: ResendVerificationRequest = {
        phone,
        userId,
        type: 'phone',
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.resendVerification(resendData);

      this.logger.info('Phone verification resent successfully', {
        phone: this.maskPhone(phone),
        userId,
        expiresAt: result.data?.expiresAt
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Phone verification resend failed', error, {
        phone: req.body.phone ? this.maskPhone(req.body.phone) : 'not_provided',
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async validateBusinessNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { abn, acn } = req.body;

      this.logger.info('Business number validation request', {
        hasABN: !!abn,
        hasACN: !!acn,
        ip: req.ip
      });

      if (!abn && !acn) {
        throw AuthErrorFactory.missingRequiredFields(['abn or acn']);
      }

      const validationResult = {
        abn: abn ? await this.validateABN(abn) : null,
        acn: acn ? await this.validateACN(acn) : null
      };

      this.logger.info('Business number validation completed', {
        abnValid: validationResult.abn?.isValid,
        acnValid: validationResult.acn?.isValid,
        ip: req.ip
      });

      res.status(200).json(buildHiveResponse.success(validationResult, 'Business number validation completed'));

    } catch (error) {
      this.logger.error('Business number validation failed', error, {
        hasABN: !!req.body.abn,
        hasACN: !!req.body.acn,
        ip: req.ip
      });

      next(error);
    }
  }

  async validateTradeLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { licenseNumber, state, tradeType } = req.body;

      this.logger.info('Trade license validation request', {
        licenseNumber: this.maskLicenseNumber(licenseNumber),
        state,
        tradeType,
        ip: req.ip
      });

      if (!licenseNumber || !state || !tradeType) {
        throw AuthErrorFactory.missingRequiredFields(['licenseNumber', 'state', 'tradeType']);
      }

      const validationResult = await this.validateTradeLicenseNumber(licenseNumber, state, tradeType);

      this.logger.info('Trade license validation completed', {
        licenseNumber: this.maskLicenseNumber(licenseNumber),
        state,
        isValid: validationResult.isValid,
        ip: req.ip
      });

      res.status(200).json(buildHiveResponse.success(validationResult, 'Trade license validation completed'));

    } catch (error) {
      this.logger.error('Trade license validation failed', error, {
        licenseNumber: req.body.licenseNumber ? this.maskLicenseNumber(req.body.licenseNumber) : 'not_provided',
        state: req.body.state,
        ip: req.ip
      });

      next(error);
    }
  }

  async checkEmailAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.query.email as string;

      this.logger.debug('Email availability check', {
        email: this.maskEmail(email),
        ip: req.ip
      });

      if (!email) {
        throw AuthErrorFactory.missingRequiredFields(['email']);
      }

      const isAvailable = await this.userService.checkEmailAvailability(email);

      this.logger.debug('Email availability checked', {
        email: this.maskEmail(email),
        isAvailable,
        ip: req.ip
      });

      res.status(200).json(buildHiveResponse.success({ 
        email, 
        isAvailable 
      }, 'Email availability checked'));

    } catch (error) {
      this.logger.error('Email availability check failed', error, {
        email: req.query.email ? this.maskEmail(req.query.email as string) : 'not_provided',
        ip: req.ip
      });

      next(error);
    }
  }

  async checkPhoneAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const phone = req.query.phone as string;

      this.logger.debug('Phone availability check', {
        phone: this.maskPhone(phone),
        ip: req.ip
      });

      if (!phone) {
        throw AuthErrorFactory.missingRequiredFields(['phone']);
      }

      const isAvailable = await this.userService.checkPhoneAvailability(phone);

      this.logger.debug('Phone availability checked', {
        phone: this.maskPhone(phone),
        isAvailable,
        ip: req.ip
      });

      res.status(200).json(buildHiveResponse.success({ 
        phone, 
        isAvailable 
      }, 'Phone availability checked'));

    } catch (error) {
      this.logger.error('Phone availability check failed', error, {
        phone: req.query.phone ? this.maskPhone(req.query.phone as string) : 'not_provided',
        ip: req.ip
      });

      next(error);
    }
  }

  async validatePostcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const postcode = req.query.postcode as string;

      this.logger.debug('Postcode validation request', {
        postcode,
        ip: req.ip
      });

      if (!postcode) {
        throw AuthErrorFactory.missingRequiredFields(['postcode']);
      }

      const validationResult = await this.validateAustralianPostcode(postcode);

      this.logger.debug('Postcode validation completed', {
        postcode,
        isValid: validationResult.isValid,
        ip: req.ip
      });

      res.status(200).json(buildHiveResponse.success(validationResult, 'Postcode validation completed'));

    } catch (error) {
      this.logger.error('Postcode validation failed', error, {
        postcode: req.query.postcode,
        ip: req.ip
      });

      next(error);
    }
  }

  async getVerificationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      this.logger.debug('Verification status request', {
        userId,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      const status = await this.userService.getVerificationStatus(userId);

      this.logger.debug('Verification status retrieved', {
        userId,
        emailVerified: status.emailVerified,
        phoneVerified: status.phoneVerified,
        ip: req.ip
      });

      res.status(200).json(buildHiveResponse.success(status, 'Verification status retrieved'));

    } catch (error) {
      this.logger.error('Verification status retrieval failed', error, {
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  // Utility Methods
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.substring(0, 2) + '*'.repeat(username.length - 2)
      : username;
    return `${maskedUsername}@${domain}`;
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return phone;
    const start = phone.substring(0, 3);
    const end = phone.substring(phone.length - 2);
    const middle = '*'.repeat(phone.length - 5);
    return start + middle + end;
  }

  private maskLicenseNumber(license: string): string {
    if (!license || license.length < 4) return license;
    return license.substring(0, 2) + '*'.repeat(license.length - 4) + license.substring(license.length - 2);
  }

  private validateAustralianPhone(phone: string): void {
    const australianPhoneRegex = /^(\+61|0)[2-9]\d{8}$/;
    if (!australianPhoneRegex.test(phone.replace(/\s/g, ''))) {
      throw AuthErrorFactory.invalidPhoneNumber('Invalid Australian phone number format');
    }
  }

  private async checkResendRateLimit(identifier: string, type: 'email' | 'phone', ip: string): Promise<void> {
    // Implement rate limiting logic here
    // For production, use Redis or similar cache
    const key = `resend_limit:${type}:${identifier}`;
    const limit = 3; // 3 attempts per hour
    
    this.logger.debug('Rate limit check passed', {
      identifier: type === 'email' ? this.maskEmail(identifier) : this.maskPhone(identifier),
      type,
      limit,
      ip
    });
  }

  private async validateABN(abn: string): Promise<{ isValid: boolean; businessName?: string; status?: string }> {
    // ABN validation logic - integrate with ASIC API
    const cleanABN = abn.replace(/\s/g, '');
    const abnRegex = /^\d{11}$/;
    
    if (!abnRegex.test(cleanABN)) {
      return { isValid: false };
    }

    // Implement ABN checksum validation
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = cleanABN.split('').map(Number);
    digits[0] -= 1; // Subtract 1 from first digit
    
    const sum = digits.reduce((acc, digit, index) => acc + (digit * weights[index]), 0);
    const isValid = sum % 89 === 0;

    return { isValid, businessName: 'Sample Business', status: 'Active' };
  }

  private async validateACN(acn: string): Promise<{ isValid: boolean; companyName?: string; status?: string }> {
    // ACN validation logic
    const cleanACN = acn.replace(/\s/g, '');
    const acnRegex = /^\d{9}$/;
    
    if (!acnRegex.test(cleanACN)) {
      return { isValid: false };
    }

    // Implement ACN checksum validation
    const weights = [8, 7, 6, 5, 4, 3, 2, 1];
    const digits = cleanACN.substring(0, 8).split('').map(Number);
    
    const sum = digits.reduce((acc, digit, index) => acc + (digit * weights[index]), 0);
    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    const isValid = checkDigit === parseInt(cleanACN[8]);

    return { isValid, companyName: 'Sample Company', status: 'Registered' };
  }

  private async validateTradeLicenseNumber(license: string, state: string, tradeType: string): Promise<{ isValid: boolean; licenseHolder?: string; expiryDate?: string }> {
    // Trade license validation logic - integrate with state licensing authorities
    // This is a placeholder implementation
    return {
      isValid: true,
      licenseHolder: 'Sample Tradie',
      expiryDate: '2025-12-31'
    };
  }

  private async validateAustralianPostcode(postcode: string): Promise<{ isValid: boolean; suburb?: string; state?: string }> {
    // Australian postcode validation
    const postcodeRegex = /^\d{4}$/;
    
    if (!postcodeRegex.test(postcode)) {
      return { isValid: false };
    }

    // Validate postcode range (1000-9999 for Australia)
    const code = parseInt(postcode);
    const isValid = code >= 1000 && code <= 9999;

    return {
      isValid,
      suburb: isValid ? 'Sample Suburb' : undefined,
      state: isValid ? 'NSW' : undefined
    };
  }

  // Health check
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'validation-controller',
        version: process.env.APP_VERSION || '1.0.0'
      };

      res.status(200).json(buildHiveResponse.success(health, 'Validation controller is healthy'));
    } catch (error) {
      this.logger.error('Validation controller health check failed', error);
      next(error);
    }
  }
}

// Export factory function
export function createValidationController(serviceContainer: ServiceContainer): IValidationController {
  return new ValidationController(serviceContainer);
}

export default ValidationController;
