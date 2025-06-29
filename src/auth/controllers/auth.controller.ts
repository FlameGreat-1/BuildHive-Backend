import { Request, Response, NextFunction } from 'express';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import type { 
  IAuthService, 
  IUserService,
  ServiceContainer 
} from '../services';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  LogoutRequest,
  AuthResponse,
  UserResponse
} from '../types';

export interface IAuthController {
  register(req: Request, res: Response, next: NextFunction): Promise<void>;
  login(req: Request, res: Response, next: NextFunction): Promise<void>;
  logout(req: Request, res: Response, next: NextFunction): Promise<void>;
  refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
  forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
  resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
  changePassword(req: Request, res: Response, next: NextFunction): Promise<void>;
  getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export class AuthController implements IAuthController {
  private readonly authService: IAuthService;
  private readonly userService: IUserService;
  private readonly logger = buildHiveLogger;

  constructor(serviceContainer: ServiceContainer) {
    this.authService = serviceContainer.getAuthService();
    this.userService = serviceContainer.getUserService();

    this.logger.info('AuthController initialized', {
      controller: 'AuthController',
      dependencies: ['AuthService', 'UserService']
    });
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Registration attempt', {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        role: req.body.role,
        platform: req.body.platform || 'web',
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      const registerData: RegisterRequest = {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        role: req.body.role,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        address: req.body.address,
        platform: req.body.platform || 'web',
        referralCode: req.body.referralCode,
        marketingConsent: req.body.marketingConsent || false,
        termsAccepted: req.body.termsAccepted,
        privacyPolicyAccepted: req.body.privacyPolicyAccepted,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          registrationSource: req.body.source || 'direct',
          timestamp: new Date()
        }
      };

      const result = await this.authService.register(registerData);

      this.logger.info('Registration successful', {
        userId: result.data.user.id,
        email: this.maskEmail(result.data.user.email),
        role: result.data.user.role,
        requiresVerification: !result.data.user.isEmailVerified
      });

      res.status(201).json(result);

    } catch (error) {
      this.logger.error('Registration failed', error, {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        role: req.body.role,
        ip: req.ip
      });

      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Login attempt', {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        platform: req.body.platform || 'web',
        rememberMe: req.body.rememberMe || false,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      const loginData: LoginRequest = {
        email: req.body.email,
        password: req.body.password,
        platform: req.body.platform || 'web',
        rememberMe: req.body.rememberMe || false,
        deviceInfo: {
          userAgent: req.get('User-Agent') || '',
          ipAddress: req.ip || '',
          deviceType: this.detectDeviceType(req.get('User-Agent') || ''),
          location: req.body.location
        }
      };

      const result = await this.authService.login(loginData);

      // Set secure HTTP-only cookies for tokens
      this.setAuthCookies(res, result.data.tokens);

      this.logger.info('Login successful', {
        userId: result.data.user.id,
        email: this.maskEmail(result.data.user.email),
        role: result.data.user.role,
        sessionId: result.data.session?.id,
        tokenExpiry: result.data.tokens.accessToken.expiresAt
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Login failed', error, {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const sessionId = req.session?.id;

      this.logger.info('Logout attempt', {
        userId,
        sessionId,
        ip: req.ip
      });

      const logoutData: LogoutRequest = {
        userId: userId!,
        sessionId: sessionId,
        allDevices: req.body.allDevices || false,
        reason: req.body.reason || 'user_initiated'
      };

      const result = await this.authService.logout(logoutData);

      // Clear auth cookies
      this.clearAuthCookies(res);

      this.logger.info('Logout successful', {
        userId,
        sessionId,
        allDevices: logoutData.allDevices
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Logout failed', error, {
        userId: req.user?.id,
        sessionId: req.session?.id
      });

      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

      this.logger.info('Token refresh attempt', {
        hasRefreshToken: !!refreshToken,
        userId: req.user?.id,
        ip: req.ip
      });

      if (!refreshToken) {
        throw AuthErrorFactory.missingRefreshToken();
      }

      const refreshData: RefreshTokenRequest = {
        refreshToken,
        deviceInfo: {
          userAgent: req.get('User-Agent') || '',
          ipAddress: req.ip || '',
          deviceType: this.detectDeviceType(req.get('User-Agent') || '')
        }
      };

      const result = await this.authService.refreshToken(refreshData);

      // Update auth cookies with new tokens
      this.setAuthCookies(res, result.data.tokens);

      this.logger.info('Token refresh successful', {
        userId: result.data.user.id,
        newTokenExpiry: result.data.tokens.accessToken.expiresAt
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Token refresh failed', error, {
        userId: req.user?.id,
        ip: req.ip
      });

      // Clear invalid cookies
      this.clearAuthCookies(res);
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Password reset request', {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        ip: req.ip
      });

      const forgotPasswordData: ForgotPasswordRequest = {
        email: req.body.email,
        platform: req.body.platform || 'web',
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.forgotPassword(forgotPasswordData);

      this.logger.info('Password reset email sent', {
        email: this.maskEmail(req.body.email),
        resetTokenExpiry: result.data?.expiresAt
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Password reset request failed', error, {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        ip: req.ip
      });

      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Password reset attempt', {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        hasToken: !!req.body.token,
        ip: req.ip
      });

      const resetPasswordData: ResetPasswordRequest = {
        email: req.body.email,
        token: req.body.token,
        newPassword: req.body.newPassword,
        confirmPassword: req.body.confirmPassword,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.resetPassword(resetPasswordData);

      this.logger.info('Password reset successful', {
        email: this.maskEmail(req.body.email),
        userId: result.data?.userId
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Password reset failed', error, {
        email: req.body.email ? this.maskEmail(req.body.email) : 'not_provided',
        hasToken: !!req.body.token,
        ip: req.ip
      });

      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      this.logger.info('Password change attempt', {
        userId,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      const changePasswordData: ChangePasswordRequest = {
        userId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        confirmPassword: req.body.confirmPassword,
        logoutAllDevices: req.body.logoutAllDevices || false,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.authService.changePassword(changePasswordData);

      if (changePasswordData.logoutAllDevices) {
        this.clearAuthCookies(res);
      }

      this.logger.info('Password change successful', {
        userId,
        logoutAllDevices: changePasswordData.logoutAllDevices
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Password change failed', error, {
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      this.logger.debug('Get current user request', {
        userId,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      const result = await this.userService.getUserById(userId);

      this.logger.debug('Current user retrieved', {
        userId,
        role: result.data.role,
        isEmailVerified: result.data.isEmailVerified,
        isPhoneVerified: result.data.isPhoneVerified
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Get current user failed', error, {
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      this.logger.info('Profile update attempt', {
        userId,
        fieldsToUpdate: Object.keys(req.body),
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      const updateData = {
        userId,
        ...req.body,
        updatedBy: userId,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.userService.updateUser(userId, updateData);

      this.logger.info('Profile update successful', {
        userId,
        updatedFields: Object.keys(req.body)
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile update failed', error, {
        userId: req.user?.id,
        fieldsToUpdate: Object.keys(req.body),
        ip: req.ip
      });

      next(error);
    }
  }

  // Utility Methods
  private setAuthCookies(res: Response, tokens: any): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
      path: '/'
    };

    // Set access token cookie (shorter expiry)
    res.cookie('accessToken', tokens.accessToken.token, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Set refresh token cookie (longer expiry)
    res.cookie('refreshToken', tokens.refreshToken.token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    this.logger.debug('Auth cookies set', {
      accessTokenExpiry: tokens.accessToken.expiresAt,
      refreshTokenExpiry: tokens.refreshToken.expiresAt,
      secure: cookieOptions.secure,
      domain: cookieOptions.domain
    });
  }

  private clearAuthCookies(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
      path: '/'
    };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    this.logger.debug('Auth cookies cleared');
  }

  private detectDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.substring(0, 2) + '*'.repeat(username.length - 2)
      : username;
    
    return `${maskedUsername}@${domain}`;
  }

  private validateRequestData(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw AuthErrorFactory.missingRequiredFields(missingFields);
    }
  }

  private sanitizeUserData(userData: any): any {
    // Remove sensitive fields from response
    const { password, resetToken, verificationToken, ...sanitized } = userData;
    return sanitized;
  }

  // Health check endpoint
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'auth-controller',
        version: process.env.APP_VERSION || '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        dependencies: {
          authService: 'connected',
          userService: 'connected'
        }
      };

      res.status(200).json(buildHiveResponse.success(health, 'Auth controller is healthy'));

    } catch (error) {
      this.logger.error('Health check failed', error);
      next(error);
    }
  }

  // Rate limiting info endpoint
  async getRateLimitInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rateLimitInfo = {
        remaining: parseInt(res.get('X-RateLimit-Remaining') || '0'),
        limit: parseInt(res.get('X-RateLimit-Limit') || '0'),
        reset: parseInt(res.get('X-RateLimit-Reset') || '0'),
        retryAfter: res.get('Retry-After')
      };

      res.status(200).json(buildHiveResponse.success(rateLimitInfo, 'Rate limit information'));

    } catch (error) {
      this.logger.error('Rate limit info failed', error);
      next(error);
    }
  }
}

// Export factory function for dependency injection
export function createAuthController(serviceContainer: ServiceContainer): IAuthController {
  return new AuthController(serviceContainer);
}

export default AuthController;
