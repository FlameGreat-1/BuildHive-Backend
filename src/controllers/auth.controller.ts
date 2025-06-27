import { Request, Response, NextFunction } from 'express';
import { logger, createLogContext } from '@/utils/logger';
import { ERROR_CODES, HTTP_STATUS_CODES, RATE_LIMIT_CONSTANTS } from '@/utils/constants';
import { AuthService } from '@/services/auth.service';
import { 
  RegisterRequest, 
  LoginRequest, 
  VerificationRequest, 
  PasswordResetRequest,
  UserType 
} from '@/types/auth.types';
import { 
  ApiError, 
  ErrorSeverity, 
  ApiResponse, 
  ValidationResult,
  ValidationError 
} from '@/types/common.types';

const authService = AuthService.getInstance();

interface AuthControllerConfig {
  enableRateLimiting: boolean;
  enableDeviceFingerprinting: boolean;
  enableGeoBlocking: boolean;
  maxRequestsPerMinute: number;
  suspiciousActivityThreshold: number;
}

interface RequestContext {
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  geoLocation?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
  requestId: string;
  timestamp: Date;
}

interface DeviceInfo {
  deviceId: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  location?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
}

export class AuthController {
  private static instance: AuthController;
  private config: AuthControllerConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): AuthController {
    if (!AuthController.instance) {
      AuthController.instance = new AuthController();
    }
    return AuthController.instance;
  }

  private loadConfiguration(): AuthControllerConfig {
    return {
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      enableDeviceFingerprinting: process.env.ENABLE_DEVICE_FINGERPRINTING === 'true',
      enableGeoBlocking: process.env.ENABLE_GEO_BLOCKING === 'true',
      maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60'),
      suspiciousActivityThreshold: parseInt(process.env.SUSPICIOUS_ACTIVITY_THRESHOLD || '10'),
    };
  }

  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withMetadata({ 
        endpoint: 'register',
        userType: req.body.userType,
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.info('Registration request received', logContext);

      const validation = this.validateRegistrationRequest(req.body);
      if (!validation.isValid) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
        return;
      }

      const deviceInfo = this.extractDeviceInfo(req, requestContext);

      const registerData: RegisterRequest = {
        email: req.body.email.toLowerCase().trim(),
        password: req.body.password,
        firstName: req.body.firstName.trim(),
        lastName: req.body.lastName.trim(),
        phone: req.body.phone.trim(),
        userType: req.body.userType,
        acceptTerms: req.body.acceptTerms,
        marketingConsent: req.body.marketingConsent || false,
        source: req.body.source || 'web',
      };

      const result = await authService.register(registerData, deviceInfo);

      const duration = Date.now() - startTime;
      logger.info('Registration successful', {
        ...logContext,
        userId: result.user.id,
        duration,
      });

      logger.performance('auth_register', duration, logContext);

      const successResponse: ApiResponse<typeof result> = {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.CREATED).json(successResponse);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Registration failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withMetadata({ 
        endpoint: 'login',
        email: req.body.email,
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.info('Login request received', logContext);

      const validation = this.validateLoginRequest(req.body);
      if (!validation.isValid) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
        return;
      }

      const deviceInfo = this.extractDeviceInfo(req, requestContext);

      const loginData: LoginRequest = {
        email: req.body.email.toLowerCase().trim(),
        password: req.body.password,
        rememberMe: req.body.rememberMe || false,
      };

      const result = await authService.login(loginData, deviceInfo);

      const duration = Date.now() - startTime;
      
      if (result.success) {
        logger.info('Login successful', {
          ...logContext,
          userId: result.user?.id,
          userType: result.user?.userType,
          duration,
        });

        logger.performance('auth_login', duration, logContext);

        if (result.tokens) {
          this.setAuthCookies(res, result.tokens);
        }

        const successResponse: ApiResponse<typeof result> = {
          success: true,
          message: result.message,
          data: result,
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.OK).json(successResponse);
      } else {
        logger.warn('Login partially successful', {
          ...logContext,
          userId: result.user?.id,
          nextStep: result.nextStep,
          duration,
        });

        const partialResponse: ApiResponse<typeof result> = {
          success: false,
          message: result.message,
          data: result,
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.ACCEPTED).json(partialResponse);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Login failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      next(error);
    }
  };

  public verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withUser(req.body.userId)
      .withMetadata({ 
        endpoint: 'verify-email',
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.info('Email verification request received', logContext);

      const validation = this.validateVerificationRequest(req.body, 'email');
      if (!validation.isValid) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
        return;
      }

      const verificationData: VerificationRequest = {
        userId: req.body.userId,
        token: req.body.token,
        type: 'email',
      };

      const result = await authService.verifyEmail(verificationData);

      const duration = Date.now() - startTime;
      logger.info('Email verification successful', {
        ...logContext,
        duration,
        nextStep: result.nextStep,
      });

      logger.performance('auth_verify_email', duration, logContext);

      const successResponse: ApiResponse<typeof result> = {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(successResponse);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Email verification failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      next(error);
    }
  };

  public verifyPhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withUser(req.body.userId)
      .withMetadata({ 
        endpoint: 'verify-phone',
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.info('Phone verification request received', logContext);

      const validation = this.validateVerificationRequest(req.body, 'phone');
      if (!validation.isValid) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
        return;
      }

      const verificationData: VerificationRequest = {
        userId: req.body.userId,
        code: req.body.code,
        type: 'phone',
      };

      const result = await authService.verifyPhone(verificationData);

      const duration = Date.now() - startTime;
      logger.info('Phone verification successful', {
        ...logContext,
        duration,
        nextStep: result.nextStep,
      });

      logger.performance('auth_verify_phone', duration, logContext);

      const successResponse: ApiResponse<typeof result> = {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(successResponse);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Phone verification failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      next(error);
    }
  };

  public requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withMetadata({ 
        endpoint: 'request-password-reset',
        email: req.body.email,
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.info('Password reset request received', logContext);

      const validation = this.validatePasswordResetRequest(req.body);
      if (!validation.isValid) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
        return;
      }

      const deviceInfo = this.extractDeviceInfo(req, requestContext);

      const result = await authService.requestPasswordReset(req.body.email.toLowerCase().trim(), deviceInfo);

      const duration = Date.now() - startTime;
      logger.info('Password reset request processed', {
        ...logContext,
        duration,
      });

      logger.performance('auth_password_reset_request', duration, logContext);

      const successResponse: ApiResponse<typeof result> = {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(successResponse);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Password reset request failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      next(error);
    }
  };

  public refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withMetadata({ 
        endpoint: 'refresh-token',
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.debug('Token refresh request received', logContext);

      const refreshTokenValue = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!refreshTokenValue) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Refresh token is required',
          errors: [{ field: 'refreshToken', message: 'Refresh token is required', code: ERROR_CODES.VAL_REQUIRED_FIELD }],
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
        return;
      }

      const deviceInfo = this.extractDeviceInfo(req, requestContext);

      const result = await authService.refreshAccessToken(refreshTokenValue, deviceInfo);

      const duration = Date.now() - startTime;
      logger.debug('Token refresh successful', {
        ...logContext,
        userId: result.user.id,
        duration,
      });

      logger.performance('auth_token_refresh', duration, logContext);

      this.setAuthCookies(res, result.tokens);

      const successResponse: ApiResponse<typeof result> = {
        success: true,
        message: 'Tokens refreshed successfully',
        data: result,
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(successResponse);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Token refresh failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.AUTH_TOKEN_INVALID,
      });

      this.clearAuthCookies(res);

      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withUser((req as any).user?.userId)
      .withMetadata({ 
        endpoint: 'logout',
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.info('Logout request received', logContext);

      const userId = (req as any).user?.userId;
      const sessionId = (req as any).user?.sessionId;

      if (!userId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
        return;
      }

      const deviceInfo = this.extractDeviceInfo(req, requestContext);

      const result = await authService.logout(userId, sessionId, deviceInfo);

      const duration = Date.now() - startTime;
      logger.info('Logout successful', {
        ...logContext,
        duration,
      });

      logger.performance('auth_logout', duration, logContext);

      this.clearAuthCookies(res);

      const successResponse: ApiResponse<typeof result> = {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(successResponse);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Logout failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      next(error);
    }
  };
  
  public getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withUser((req as any).user?.userId)
      .withMetadata({ 
        endpoint: 'get-profile',
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.debug('Profile request received', logContext);

      const userId = (req as any).user?.userId;
      
      if (!userId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
        return;
      }

      const user = (req as any).user;

      const duration = Date.now() - startTime;
      logger.debug('Profile retrieved successfully', {
        ...logContext,
        duration,
      });

      logger.performance('auth_get_profile', duration, logContext);

      const successResponse: ApiResponse<any> = {
        success: true,
        message: 'Profile retrieved successfully',
        data: { user },
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(successResponse);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Profile retrieval failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      next(error);
    }
  };

  public validateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestContext = this.extractRequestContext(req);
    const logContext = createLogContext()
      .withRequest(requestContext.requestId, req.method, req.originalUrl)
      .withMetadata({ 
        endpoint: 'validate-token',
        requestId: requestContext.requestId 
      })
      .build();

    try {
      logger.debug('Token validation request received', logContext);

      const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
      
      if (!token) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Token is required',
          errors: [{ field: 'token', message: 'Token is required', code: ERROR_CODES.VAL_REQUIRED_FIELD }],
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
        return;
      }

      const result = await authService.validateUserToken(token);

      const duration = Date.now() - startTime;
      
      if (result.isValid) {
        logger.debug('Token validation successful', {
          ...logContext,
          userId: result.payload?.userId,
          duration,
        });

        logger.performance('auth_validate_token', duration, logContext);

        const successResponse: ApiResponse<any> = {
          success: true,
          message: 'Token is valid',
          data: { 
            valid: true,
            payload: result.payload,
            user: result.user
          },
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.OK).json(successResponse);
      } else {
        logger.warn('Token validation failed', {
          ...logContext,
          duration,
        });

        const errorResponse: ApiResponse<any> = {
          success: false,
          message: 'Token is invalid or expired',
          data: { valid: false },
          timestamp: new Date().toISOString(),
          requestId: requestContext.requestId,
        };

        res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.warn('Token validation failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.AUTH_TOKEN_INVALID,
      });

      const errorResponse: ApiResponse<any> = {
        success: false,
        message: 'Token is invalid or expired',
        data: { valid: false },
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
    }
  };

  public healthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestContext = this.extractRequestContext(req);
    
    try {
      const healthResponse: ApiResponse<any> = {
        success: true,
        message: 'Auth service is healthy',
        data: {
          service: 'auth',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.APP_VERSION || '1.0.0',
        },
        timestamp: new Date().toISOString(),
        requestId: requestContext.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(healthResponse);

    } catch (error) {
      next(error);
    }
  };

  private validateRegistrationRequest(body: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!body.email) {
      errors.push({ field: 'email', message: 'Email is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push({ field: 'email', message: 'Invalid email format', code: ERROR_CODES.VAL_INVALID_EMAIL });
    }

    if (!body.password) {
      errors.push({ field: 'password', message: 'Password is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    } else if (body.password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters', code: ERROR_CODES.VAL_WEAK_PASSWORD });
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(body.password)) {
      errors.push({ field: 'password', message: 'Password must contain uppercase, lowercase, number and special character', code: ERROR_CODES.VAL_WEAK_PASSWORD });
    }

    if (!body.firstName || body.firstName.trim().length < 2) {
      errors.push({ field: 'firstName', message: 'First name must be at least 2 characters', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    }

    if (!body.lastName || body.lastName.trim().length < 2) {
      errors.push({ field: 'lastName', message: 'Last name must be at least 2 characters', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    }

    if (!body.phone) {
      errors.push({ field: 'phone', message: 'Phone number is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    } else if (!/^\+?[\d\s\-\(\)]{10,}$/.test(body.phone)) {
      errors.push({ field: 'phone', message: 'Invalid phone number format', code: ERROR_CODES.VAL_INVALID_PHONE });
    }

    if (!body.userType) {
      errors.push({ field: 'userType', message: 'User type is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    } else if (!Object.values(UserType).includes(body.userType)) {
      errors.push({ field: 'userType', message: 'Invalid user type', code: ERROR_CODES.VAL_INVALID_USER_TYPE });
    }

    if (!body.acceptTerms) {
      errors.push({ field: 'acceptTerms', message: 'Terms and conditions must be accepted', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateLoginRequest(body: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!body.email) {
      errors.push({ field: 'email', message: 'Email is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push({ field: 'email', message: 'Invalid email format', code: ERROR_CODES.VAL_INVALID_EMAIL });
    }

    if (!body.password) {
      errors.push({ field: 'password', message: 'Password is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateVerificationRequest(body: any, type: 'email' | 'phone'): ValidationResult {
    const errors: ValidationError[] = [];

    if (!body.userId) {
      errors.push({ field: 'userId', message: 'User ID is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    } else if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(body.userId)) {
      errors.push({ field: 'userId', message: 'Invalid user ID format', code: ERROR_CODES.VAL_INVALID_FORMAT });
    }

    if (type === 'email') {
      if (!body.token) {
        errors.push({ field: 'token', message: 'Verification token is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
      } else if (body.token.length !== 64) {
        errors.push({ field: 'token', message: 'Invalid token format', code: ERROR_CODES.VAL_INVALID_FORMAT });
      }
    } else if (type === 'phone') {
      if (!body.code) {
        errors.push({ field: 'code', message: 'Verification code is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
      } else if (!/^\d{6}$/.test(body.code)) {
        errors.push({ field: 'code', message: 'Verification code must be 6 digits', code: ERROR_CODES.VAL_INVALID_FORMAT });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validatePasswordResetRequest(body: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!body.email) {
      errors.push({ field: 'email', message: 'Email is required', code: ERROR_CODES.VAL_REQUIRED_FIELD });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push({ field: 'email', message: 'Invalid email format', code: ERROR_CODES.VAL_INVALID_EMAIL });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private extractRequestContext(req: Request): RequestContext {
    const crypto = require('crypto');
    
    return {
      ipAddress: this.getClientIpAddress(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      deviceFingerprint: req.headers['x-device-fingerprint'] as string,
      geoLocation: this.extractGeoLocation(req),
      requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
      timestamp: new Date(),
    };
  }

  private getClientIpAddress(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      '0.0.0.0'
    ).split(',')[0].trim();
  }

  private extractGeoLocation(req: Request): { country: string; city: string; coordinates?: [number, number] } | undefined {
    if (!this.config.enableGeoBlocking) {
      return undefined;
    }

    return {
      country: req.headers['cf-ipcountry'] as string || req.headers['x-country'] as string || 'unknown',
      city: req.headers['cf-ipcity'] as string || req.headers['x-city'] as string || 'unknown',
      coordinates: req.headers['x-coordinates'] ? 
        JSON.parse(req.headers['x-coordinates'] as string) : undefined,
    };
  }

  private extractDeviceInfo(req: Request, context: RequestContext): DeviceInfo {
    const userAgent = req.headers['user-agent'] || '';
    
    return {
      deviceId: context.deviceFingerprint || this.generateDeviceId(context),
      deviceType: this.detectDeviceType(userAgent),
      browser: this.detectBrowser(userAgent),
      os: this.detectOperatingSystem(userAgent),
      ipAddress: context.ipAddress,
      location: context.geoLocation,
    };
  }

  private generateDeviceId(context: RequestContext): string {
    const crypto = require('crypto');
    const deviceString = `${context.ipAddress}-${context.userAgent}`;
    return crypto.createHash('sha256').update(deviceString).digest('hex').substring(0, 16);
  }

  private detectDeviceType(userAgent: string): string {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    } else if (/Tablet/.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  private detectBrowser(userAgent: string): string {
    if (/Chrome/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent)) return 'Safari';
    if (/Edge/.test(userAgent)) return 'Edge';
    if (/Opera/.test(userAgent)) return 'Opera';
    return 'unknown';
  }

  private detectOperatingSystem(userAgent: string): string {
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac OS/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iOS/.test(userAgent)) return 'iOS';
    return 'unknown';
  }

  private setAuthCookies(res: Response, tokens: any): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: tokens.expiresIn * 1000,
      path: '/',
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/auth/refresh' });
  }

  public getConfig(): Readonly<AuthControllerConfig> {
    return { ...this.config };
  }
}

export const authController = AuthController.getInstance();

export const register = authController.register;
export const login = authController.login;
export const verifyEmail = authController.verifyEmail;
export const verifyPhone = authController.verifyPhone;
export const requestPasswordReset = authController.requestPasswordReset;
export const refreshToken = authController.refreshToken;
export const logout = authController.logout;
export const getProfile = authController.getProfile;
export const validateToken = authController.validateToken;
export const healthCheck = authController.healthCheck;

