import { logger, createLogContext } from '@/utils/logger';
import { ERROR_CODES, SECURITY_CONSTANTS, CACHE_CONSTANTS } from '@/utils/constants';
import { 
  generateTokenPair, 
  verifyToken, 
  refreshAccessToken, 
  trackLoginAttempt, 
  isAccountLocked,
  verifyPassword 
} from '@/config/auth';
import { setCache, getCache, deleteCache, publishEvent } from '@/config/redis';
import { 
  createUser, 
  getUserByEmail, 
  getUserById, 
  updateUser,
  verifyUserEmail,
  verifyUserPhone
} from '@/models/User';
import {
  UserType,
  UserStatus,
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  VerificationRequest,
  PasswordResetRequest,
  JWTPayload,
  ClientProfile,
  TradieProfile,
  EnterpriseProfile,
  UpdateUserData
} from '@/types/auth.types';
import {
  ApiError,
  ErrorSeverity,
  ValidationResult
} from '@/types/common.types';

interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  statusCode: number;
  name: string;
}

interface AuthServiceConfig {
  enableTwoFactor: boolean;
  enableDeviceTracking: boolean;
  enableGeoLocation: boolean;
  maxSessionsPerUser: number;
  passwordResetExpiry: number;
  verificationCodeExpiry: number;
}

interface LoginAttempt {
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  failureReason?: string;
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

interface SessionInfo {
  sessionId: string;
  userId: string;
  userType: UserType;
  deviceInfo: DeviceInfo;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export class AuthService {
  private static instance: AuthService;
  private config: AuthServiceConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private loadConfiguration(): AuthServiceConfig {
    return {
      enableTwoFactor: process.env.ENABLE_TWO_FACTOR === 'true',
      enableDeviceTracking: process.env.ENABLE_DEVICE_TRACKING === 'true',
      enableGeoLocation: process.env.ENABLE_GEO_LOCATION === 'true',
      maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5'),
      passwordResetExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY || String(60 * 60 * 1000)),
      verificationCodeExpiry: parseInt(process.env.VERIFICATION_CODE_EXPIRY || String(10 * 60 * 1000)),
    };
  }

  public async register(registerData: RegisterRequest, deviceInfo?: DeviceInfo): Promise<{
    user: any;
    message: string;
    nextStep: string;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({
        userType: registerData.userType,
        email: registerData.email,
        deviceInfo: deviceInfo?.deviceType,
      })
      .build();

    try {
      logger.info('Starting user registration', logContext);

      const validation = await this.validateRegistrationData(registerData);
      if (!validation.isValid) {
        throw new ApiError(
          `Registration validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          400,
          ERROR_CODES.VAL_INVALID_INPUT,
          ErrorSeverity.LOW
        );
      }

      const user = await createUser({
        email: registerData.email,
        password: registerData.password,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        phone: registerData.phone,
        userType: registerData.userType,
        metadata: {
          registrationSource: registerData.source || 'web',
          deviceInfo,
          termsAccepted: registerData.acceptTerms,
          marketingConsent: registerData.marketingConsent || false,
        },
      });

      await this.sendVerificationCommunications(user);

      await publishEvent('user.registered', {
        userId: user.id,
        userType: user.userType,
        email: user.email,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.info('User registration completed', {
        ...logContext,
        userId: user.id,
        duration,
      });

      logger.business('USER_REGISTERED', {
        ...logContext,
        userId: user.id,
        userType: user.userType,
      });

      logger.performance('user_registration', duration, logContext);

      return {
        user: this.sanitizeUserData(user),
        message: 'Registration successful. Please verify your email and phone number.',
        nextStep: this.getNextOnboardingStep(user.userType),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User registration failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        'Registration failed',
        500,
        ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
        ErrorSeverity.HIGH
      );
    }
  }

  public async login(loginData: LoginRequest, deviceInfo?: DeviceInfo): Promise<LoginResponse> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({
        email: loginData.email,
        deviceInfo: deviceInfo?.deviceType,
        ipAddress: deviceInfo?.ipAddress,
      })
      .build();

    try {
      logger.info('Starting user login', logContext);

      const isLocked = await isAccountLocked(loginData.email);
      if (isLocked) {
        logger.security('LOGIN_ATTEMPT_ON_LOCKED_ACCOUNT', 'auth_service', 0, {
          ...logContext,
          email: loginData.email,
        });

        throw new ApiError(
          'Account is temporarily locked due to multiple failed login attempts',
          423,
          ERROR_CODES.AUTH_ACCOUNT_LOCKED,
          ErrorSeverity.MEDIUM
        );
      }

      const user = await getUserByEmail(loginData.email, true);
      if (!user) {
        await trackLoginAttempt(loginData.email, false, deviceInfo?.ipAddress);
        
        logger.security('LOGIN_ATTEMPT_INVALID_EMAIL', 'auth_service', 0, {
          ...logContext,
          email: loginData.email,
        });

        throw new ApiError(
          'Invalid email or password',
          401,
          ERROR_CODES.AUTH_INVALID_CREDENTIALS,
          ErrorSeverity.LOW
        );
      }

      const isPasswordValid = await verifyPassword(loginData.password, user.passwordHash);
      if (!isPasswordValid) {
        await trackLoginAttempt(loginData.email, false, deviceInfo?.ipAddress);
        
        logger.security('LOGIN_ATTEMPT_INVALID_PASSWORD', 'auth_service', 0, {
          ...logContext,
          userId: user.id,
          email: loginData.email,
        });

        throw new ApiError(
          'Invalid email or password',
          401,
          ERROR_CODES.AUTH_INVALID_CREDENTIALS,
          ErrorSeverity.LOW
        );
      }

      if (user.status === UserStatus.SUSPENDED) {
        logger.security('LOGIN_ATTEMPT_SUSPENDED_USER', 'auth_service', 0, {
          ...logContext,
          userId: user.id,
        });

        throw new ApiError(
          'Account is suspended. Please contact support.',
          403,
          ERROR_CODES.AUTH_ACCOUNT_SUSPENDED,
          ErrorSeverity.MEDIUM
        );
      }

      if (user.status === UserStatus.PENDING_VERIFICATION) {
        return {
          success: false,
          message: 'Please verify your email and phone number before logging in.',
          nextStep: 'verification',
          user: this.sanitizeUserData(user),
        };
      }

      const tokenPair = await generateTokenPair({
        userId: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
        permissions: this.getUserPermissions(user),
      });

      const sessionInfo = await this.createUserSession(user, deviceInfo);

      await trackLoginAttempt(loginData.email, true, deviceInfo?.ipAddress);

      const updateData: UpdateUserData = {
        lastLoginAt: new Date(),
      };

      await updateUser(user.id, updateData);

      await publishEvent('user.logged_in', {
        userId: user.id,
        userType: user.userType,
        sessionId: sessionInfo.sessionId,
        deviceInfo,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.info('User login successful', {
        ...logContext,
        userId: user.id,
        sessionId: sessionInfo.sessionId,
        duration,
      });

      logger.business('USER_LOGIN', {
        ...logContext,
        userId: user.id,
        userType: user.userType,
      });

      logger.performance('user_login', duration, logContext);

      return {
        success: true,
        message: 'Login successful',
        user: this.sanitizeUserData(user),
        tokens: tokenPair,
        session: sessionInfo,
        permissions: this.getUserPermissions(user),
        profileCompleteness: user.profileCompleteness,
        nextStep: this.getPostLoginStep(user),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User login failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        'Login failed',
        500,
        ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
        ErrorSeverity.HIGH
      );
    }
  }

  public async verifyEmail(verificationData: VerificationRequest): Promise<{
    success: boolean;
    message: string;
    nextStep?: string;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(verificationData.userId)
      .withMetadata({ verificationType: 'email' })
      .build();

    try {
      logger.info('Starting email verification', logContext);

      const success = await verifyUserEmail(verificationData.userId, verificationData.token || '');
      
      if (!success) {
        logger.security('EMAIL_VERIFICATION_FAILED', 'auth_service', 0, {
          ...logContext,
          token: verificationData.token?.slice(0, 8) + '...',
        });

        throw new ApiError(
          'Invalid or expired verification token',
          400,
          ERROR_CODES.BIZ_VERIFICATION_CODE_INVALID,
          ErrorSeverity.LOW
        );
      }

      const user = await getUserById(verificationData.userId);
      if (!user) {
        throw new ApiError(
          'User not found',
          404,
          ERROR_CODES.BIZ_RESOURCE_NOT_FOUND,
          ErrorSeverity.MEDIUM
        );
      }

      await publishEvent('user.email_verified', {
        userId: user.id,
        userType: user.userType,
        email: user.email,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.info('Email verification successful', {
        ...logContext,
        duration,
      });

      logger.business('USER_EMAIL_VERIFIED', logContext);

      return {
        success: true,
        message: 'Email verified successfully',
        nextStep: user.phoneVerified ? this.getPostVerificationStep(user.userType) : 'phone_verification',
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Email verification failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        'Email verification failed',
        500,
        ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
        ErrorSeverity.HIGH
      );
    }
  }

  public async verifyPhone(verificationData: VerificationRequest): Promise<{
    success: boolean;
    message: string;
    nextStep?: string;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(verificationData.userId)
      .withMetadata({ verificationType: 'phone' })
      .build();

    try {
      logger.info('Starting phone verification', logContext);

      const success = await verifyUserPhone(verificationData.userId, verificationData.code || '');
      
      if (!success) {
        logger.security('PHONE_VERIFICATION_FAILED', 'auth_service', 0, {
          ...logContext,
          code: verificationData.code?.slice(0, 2) + '****',
        });

        throw new ApiError(
          'Invalid or expired verification code',
          400,
          ERROR_CODES.BIZ_VERIFICATION_CODE_INVALID,
          ErrorSeverity.LOW
        );
      }

      const user = await getUserById(verificationData.userId);
      if (!user) {
        throw new ApiError(
          'User not found',
          404,
          ERROR_CODES.BIZ_RESOURCE_NOT_FOUND,
          ErrorSeverity.MEDIUM
        );
      }

      await publishEvent('user.phone_verified', {
        userId: user.id,
        userType: user.userType,
        phone: user.phone,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.info('Phone verification successful', {
        ...logContext,
        duration,
      });

      logger.business('USER_PHONE_VERIFIED', logContext);

      return {
        success: true,
        message: 'Phone verified successfully',
        nextStep: user.emailVerified ? this.getPostVerificationStep(user.userType) : 'email_verification',
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Phone verification failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        'Phone verification failed',
        500,
        ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
        ErrorSeverity.HIGH
      );
    }
  }

  public async requestPasswordReset(email: string, deviceInfo?: DeviceInfo): Promise<{
    success: boolean;
    message: string;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({ 
        email, 
        deviceInfo: deviceInfo?.deviceType,
        ipAddress: deviceInfo?.ipAddress 
      })
      .build();

    try {
      logger.info('Password reset requested', logContext);

      const user = await getUserByEmail(email);
      if (!user) {
        logger.security('PASSWORD_RESET_INVALID_EMAIL', 'auth_service', 0, {
          ...logContext,
          email,
        });

        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent.',
        };
      }

      const resetToken = this.generateSecureToken();
      const resetExpires = new Date(Date.now() + this.config.passwordResetExpiry);

      const updateData: UpdateUserData = {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      };

      await updateUser(user.id, updateData);

      await setCache(
        `${CACHE_CONSTANTS.KEYS.PASSWORD_RESET}${resetToken}`,
        { userId: user.id, email: user.email },
        this.config.passwordResetExpiry / 1000
      );

      await this.sendPasswordResetEmail(user, resetToken);

      await publishEvent('user.password_reset_requested', {
        userId: user.id,
        email: user.email,
        resetToken: resetToken.slice(0, 8) + '...',
        deviceInfo,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.info('Password reset request processed', {
        ...logContext,
        userId: user.id,
        duration,
      });

      logger.security('PASSWORD_RESET_REQUESTED', 'auth_service', 0, {
        ...logContext,
        userId: user.id,
      });

      return {
        success: true,
        message: 'Password reset instructions have been sent to your email.',
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Password reset request failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      throw new ApiError(
        'Password reset request failed',
        500,
        ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
        ErrorSeverity.HIGH
      );
    }
  }

  public async validateUserToken(token: string): Promise<{
    isValid: boolean;
    payload?: JWTPayload;
    user?: any;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({ 
        tokenValidation: true,
        tokenPrefix: token.substring(0, 10) + '...'
      })
      .build();

    try {
      logger.debug('Validating user token', logContext);

      const payload = await verifyToken(token);
      const user = await getUserById(payload.userId);

      if (!user) {
        logger.warn('Token valid but user not found', {
          ...logContext,
          userId: payload.userId,
        });

        return {
          isValid: false,
        };
      }

      if (user.status === UserStatus.SUSPENDED) {
        logger.security('TOKEN_VALIDATION_SUSPENDED_USER', 'auth_service', 0, {
          ...logContext,
          userId: user.id,
        });

        return {
          isValid: false,
        };
      }

      const duration = Date.now() - startTime;
      logger.debug('Token validation successful', {
        ...logContext,
        userId: user.id,
        duration,
      });

      return {
        isValid: true,
        payload,
        user: this.sanitizeUserData(user),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.warn('Token validation failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
      };
    }
  }

  public async refreshAccessToken(refreshTokenValue: string, deviceInfo?: DeviceInfo): Promise<{
    tokens: any;
    user: any;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({ 
        deviceInfo: deviceInfo?.deviceType,
        tokenRefresh: true 
      })
      .build();

    try {
      logger.debug('Refreshing access token', logContext);

      const newTokenPair = await refreshAccessToken(refreshTokenValue);

      const payload = await verifyToken(newTokenPair.accessToken);
      const user = await getUserById(payload.userId);

      if (!user) {
        throw new ApiError(
          'User not found',
          404,
          ERROR_CODES.BIZ_RESOURCE_NOT_FOUND,
          ErrorSeverity.MEDIUM
        );
      }

      const duration = Date.now() - startTime;
      logger.debug('Token refreshed successfully', {
        ...logContext,
        userId: user.id,
        duration,
      });

      return {
        tokens: newTokenPair,
        user: this.sanitizeUserData(user),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Token refresh failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
      });

      throw new ApiError(
        'Token refresh failed',
        401,
        ERROR_CODES.AUTH_TOKEN_INVALID,
        ErrorSeverity.MEDIUM
      );
    }
  }

  public async logout(userId: string, sessionId?: string, deviceInfo?: DeviceInfo): Promise<{
    success: boolean;
    message: string;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(userId)
      .withMetadata({ 
        sessionId,
        deviceInfo: deviceInfo?.deviceType 
      })
      .build();

    try {
      logger.info('User logout initiated', logContext);

      if (sessionId) {
        await this.invalidateSession(sessionId);
      }

      await this.invalidateUserSessions(userId);

      await publishEvent('user.logged_out', {
        userId,
        sessionId,
        deviceInfo,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.info('User logout successful', {
        ...logContext,
        duration,
      });

      logger.business('USER_LOGOUT', logContext);

      return {
        success: true,
        message: 'Logged out successfully',
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User logout failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
      });

      throw new ApiError(
        'Logout failed',
        500,
        ERROR_CODES.SYS_INTERNAL_SERVER_ERROR,
        ErrorSeverity.HIGH
      );
    }
  }

  private async createUserSession(user: any, deviceInfo?: DeviceInfo): Promise<SessionInfo> {
    const sessionId = this.generateSessionId();
    const sessionInfo: SessionInfo = {
      sessionId,
      userId: user.id,
      userType: user.userType,
      deviceInfo: deviceInfo || this.getDefaultDeviceInfo(),
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
    };

    await setCache(
      `${CACHE_CONSTANTS.KEYS.USER_SESSION}${sessionId}`,
      sessionInfo,
      SECURITY_CONSTANTS.SESSION.IDLE_TIMEOUT / 1000
    );

    const userSessionsKey = `${CACHE_CONSTANTS.KEYS.USER_SESSIONS}${user.id}`;
    const userSessions = await getCache<string[]>(userSessionsKey) || [];
    
    if (userSessions.length >= this.config.maxSessionsPerUser) {
      const oldestSession = userSessions.shift();
      if (oldestSession) {
        await this.invalidateSession(oldestSession);
      }
    }

    userSessions.push(sessionId);
    await setCache(userSessionsKey, userSessions, 86400);

    return sessionInfo;
  }

  private async invalidateSession(sessionId: string): Promise<void> {
    await deleteCache(`${CACHE_CONSTANTS.KEYS.USER_SESSION}${sessionId}`);
  }

  private async invalidateUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `${CACHE_CONSTANTS.KEYS.USER_SESSIONS}${userId}`;
    const userSessions = await getCache<string[]>(userSessionsKey) || [];

    const invalidationPromises = userSessions.map(sessionId => 
      this.invalidateSession(sessionId)
    );

    await Promise.all(invalidationPromises);
    await deleteCache(userSessionsKey);
  }

  private async validateRegistrationData(data: RegisterRequest): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: ERROR_CODES.VAL_INVALID_EMAIL,
        severity: 'error',
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!data.password || data.password.length < SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH) {
      errors.push({
        field: 'password',
        message: `Password must be at least ${SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH} characters`,
        code: ERROR_CODES.VAL_WEAK_PASSWORD,
        severity: 'error',
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push({
        field: 'firstName',
        message: 'First name must be at least 2 characters',
        code: ERROR_CODES.VAL_REQUIRED_FIELD,
        severity: 'error',
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push({
        field: 'lastName',
        message: 'Last name must be at least 2 characters',
        code: ERROR_CODES.VAL_REQUIRED_FIELD,
        severity: 'error',
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!data.phone || !this.isValidPhone(data.phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format',
        code: ERROR_CODES.VAL_INVALID_PHONE,
        severity: 'error',
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!Object.values(UserType).includes(data.userType)) {
      errors.push({
        field: 'userType',
        message: 'Invalid user type',
        code: ERROR_CODES.VAL_INVALID_USER_TYPE,
        severity: 'error',
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!data.acceptTerms) {
      errors.push({
        field: 'acceptTerms',
        message: 'Terms and conditions must be accepted',
        code: ERROR_CODES.VAL_REQUIRED_FIELD,
        severity: 'error',
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async sendVerificationCommunications(user: any): Promise<void> {
    try {
      await publishEvent('notification.send_email_verification', {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        verificationToken: user.emailVerificationToken,
        userType: user.userType,
      });

      await publishEvent('notification.send_sms_verification', {
        userId: user.id,
        phone: user.phone,
        firstName: user.firstName,
        verificationCode: user.phoneVerificationCode,
        userType: user.userType,
      });

      logger.info('Verification communications sent', 
        createLogContext()
          .withUser(user.id, user.userType)
          .withMetadata({ email: user.email, phone: user.phone })
          .build()
      );

    } catch (error) {
      logger.error('Failed to send verification communications', 
        createLogContext()
          .withUser(user.id, user.userType)
          .withError(ERROR_CODES.SYS_NOTIFICATION_ERROR)
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
    }
  }

  private async sendPasswordResetEmail(user: any, resetToken: string): Promise<void> {
    try {
      await publishEvent('notification.send_password_reset', {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        resetToken,
        userType: user.userType,
      });

      logger.info('Password reset email sent', 
        createLogContext()
          .withUser(user.id, user.userType)
          .withMetadata({ email: user.email })
          .build()
      );

    } catch (error) {
      logger.error('Failed to send password reset email', 
        createLogContext()
          .withUser(user.id, user.userType)
          .withMetadata({ errorCode: ERROR_CODES.SYS_NOTIFICATION_ERROR })
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
    }
  }

  private getUserPermissions(user: any): string[] {
    const basePermissions = ['profile:read', 'profile:update'];
    
    switch (user.userType) {
      case UserType.CLIENT:
        return [
          ...basePermissions,
          'jobs:create',
          'jobs:read',
          'jobs:update',
          'jobs:delete',
          'applications:read',
          'payments:create',
          'reviews:create',
        ];

      case UserType.TRADIE:
        return [
          ...basePermissions,
          'jobs:read',
          'applications:create',
          'applications:read',
          'applications:update',
          'quotes:create',
          'quotes:read',
          'quotes:update',
          'reviews:read',
        ];

      case UserType.ENTERPRISE:
        return [
          ...basePermissions,
          'jobs:create',
          'jobs:read',
          'jobs:update',
          'jobs:delete',
          'team:create',
          'team:read',
          'team:update',
          'team:delete',
          'analytics:read',
          'billing:read',
          'billing:update',
        ];

      default:
        return basePermissions;
    }
  }

  private getNextOnboardingStep(userType: UserType): string {
    switch (userType) {
      case UserType.CLIENT:
        return 'verify_identity_and_setup_company';
      case UserType.TRADIE:
        return 'verify_identity_and_setup_business';
      case UserType.ENTERPRISE:
        return 'verify_identity_and_setup_organization';
      default:
        return 'complete_profile';
    }
  }

  private getPostVerificationStep(userType: UserType): string {
    switch (userType) {
      case UserType.CLIENT:
        return 'upload_company_documents';
      case UserType.TRADIE:
        return 'upload_trade_certifications';
      case UserType.ENTERPRISE:
        return 'setup_team_structure';
      default:
        return 'complete_profile';
    }
  }

  private getPostLoginStep(user: any): string {
    if (user.profileCompleteness < 50) {
      return 'complete_profile';
    }

    if (!user.isVerified) {
      return 'complete_verification';
    }

    return 'dashboard';
  }

  private sanitizeUserData(user: any): any {
    const { passwordHash, emailVerificationToken, phoneVerificationCode, passwordResetToken, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  private generateSecureToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  private generateSessionId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(24).toString('hex');
  }

  private getDefaultDeviceInfo(): DeviceInfo {
    return {
      deviceId: 'unknown',
      deviceType: 'unknown',
      browser: 'unknown',
      os: 'unknown',
      ipAddress: '0.0.0.0',
    };
  }

  public getConfig(): Readonly<AuthServiceConfig> {
    return { ...this.config };
  }
}

export const authService = AuthService.getInstance();

export const registerUser = async (registerData: RegisterRequest, deviceInfo?: DeviceInfo) => {
  return await authService.register(registerData, deviceInfo);
};

export const loginUser = async (loginData: LoginRequest, deviceInfo?: DeviceInfo): Promise<LoginResponse> => {
  return await authService.login(loginData, deviceInfo);
};

export const verifyUserEmailService = async (verificationData: VerificationRequest) => {
  return await authService.verifyEmail(verificationData);
};

export const verifyUserPhoneService = async (verificationData: VerificationRequest) => {
  return await authService.verifyPhone(verificationData);
};

export const requestPasswordReset = async (email: string, deviceInfo?: DeviceInfo) => {
  return await authService.requestPasswordReset(email, deviceInfo);
};

export const refreshUserToken = async (refreshToken: string, deviceInfo?: DeviceInfo) => {
  return await authService.refreshAccessToken(refreshToken, deviceInfo);
};

export const logoutUser = async (userId: string, sessionId?: string, deviceInfo?: DeviceInfo) => {
  return await authService.logout(userId, sessionId, deviceInfo);
};

export const validateUserToken = async (token: string) => {
  return await authService.validateUserToken(token);
};

export { AuthService, AuthServiceConfig, DeviceInfo, SessionInfo, LoginAttempt };
