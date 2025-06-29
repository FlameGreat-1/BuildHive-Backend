import { Types } from 'mongoose';
import { IUserRepository, ISessionRepository, IProfileRepository } from '../repositories';
import { buildHiveLogger, AuthErrorFactory, buildHiveResponse } from '../../shared';
import { USER_ROLES, USER_STATUS, VERIFICATION_STATUS, PASSWORD_CONFIG } from '../../config';
import type { 
  RegisterRequest, 
  LoginRequest, 
  RefreshTokenRequest, 
  LogoutRequest,
  EmailVerificationRequest,
  PhoneVerificationRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  ChangePasswordRequest,
  RegisterResponse,
  LoginResponse,
  RefreshTokenResponse,
  LogoutResponse,
  VerificationResponse,
  PasswordResetResponse,
  AuthUser,
  TokenPair,
  SecurityContext,
  AuthValidationResult,
  AuthEvent,
  DeviceInfo,
  LocationInfo
} from '../types';
import { IUserDocument, ISessionDocument, IProfileDocument } from '../models';

export interface IAuthService {
  register(request: RegisterRequest): Promise<RegisterResponse>;
  login(request: LoginRequest): Promise<LoginResponse>;
  refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse>;
  logout(request: LogoutRequest): Promise<LogoutResponse>;
  verifyEmail(request: EmailVerificationRequest): Promise<VerificationResponse>;
  verifyPhone(request: PhoneVerificationRequest): Promise<VerificationResponse>;
  requestPasswordReset(request: PasswordResetRequest): Promise<PasswordResetResponse>;
  resetPassword(request: PasswordResetConfirmRequest): Promise<VerificationResponse>;
  changePassword(userId: string, request: ChangePasswordRequest): Promise<VerificationResponse>;
  validateToken(token: string): Promise<AuthValidationResult>;
  revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number>;
  forgotPassword(request: PasswordResetRequest): Promise<PasswordResetResponse>;
  sendEmailVerification(userId: string, email: string): Promise<VerificationResponse>;
  sendPhoneVerification(userId: string, phone: string): Promise<VerificationResponse>;
  resendVerification(request: ResendVerificationRequest): Promise<VerificationResponse>;
  validateSession(sessionId: string, userId: string): Promise<boolean>;
}

export interface IEventPublisher {
  publish(channel: string, event: AuthEvent): Promise<void>;
}

export interface ITokenService {
  generateTokenPair(user: IUserDocument, sessionId: string, deviceId: string): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<any>;
  verifyRefreshToken(token: string): Promise<any>;
  generateEmailVerificationToken(userId: string, email: string): Promise<string>;
  generatePhoneVerificationCode(userId: string, phone: string): Promise<string>;
  generatePasswordResetToken(userId: string, email: string): Promise<string>;
}

export interface IEmailService {
  sendVerificationEmail(email: string, token: string, username: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string, username: string): Promise<void>;
  sendWelcomeEmail(email: string, username: string, role: string): Promise<void>;
}

export interface ISMSService {
  sendVerificationCode(phone: string, code: string): Promise<void>;
  sendSecurityAlert(phone: string, message: string): Promise<void>;
}

export class AuthService implements IAuthService {
  private readonly userRepository: IUserRepository;
  private readonly sessionRepository: ISessionRepository;
  private readonly profileRepository: IProfileRepository;
  private readonly tokenService: ITokenService;
  private readonly emailService: IEmailService;
  private readonly smsService: ISMSService;
  private readonly eventPublisher: IEventPublisher;
  private readonly logger = buildHiveLogger;

  constructor(
    userRepository: IUserRepository,
    sessionRepository: ISessionRepository,
    profileRepository: IProfileRepository,
    tokenService: ITokenService,
    emailService: IEmailService,
    smsService: ISMSService,
    eventPublisher: IEventPublisher
  ) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.profileRepository = profileRepository;
    this.tokenService = tokenService;
    this.emailService = emailService;
    this.smsService = smsService;
    this.eventPublisher = eventPublisher;

    this.logger.info('AuthService initialized', {
      service: 'AuthService',
      dependencies: ['UserRepository', 'SessionRepository', 'ProfileRepository', 'TokenService', 'EmailService', 'SMSService', 'EventPublisher']
    });
  }

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      this.logger.info('User registration started', {
        role: request.role,
        platform: request.platform,
        authProvider: request.authProvider,
        hasEmail: !!request.email,
        hasPhone: !!request.phone
      });

      await this.validateRegistrationRequest(request);
      await this.checkUserExists(request);

      const userData = await this.buildUserData(request);
      const user = await this.userRepository.create(userData);

      const profileData = await this.buildProfileData(user, request);
      const profile = await this.profileRepository.create(profileData);

      user.profileId = new Types.ObjectId(profile.id);
      await user.save();

      const sessionData = await this.createUserSession(user, request.deviceInfo, request.locationInfo);
      const tokens = await this.tokenService.generateTokenPair(user, sessionData.id, request.deviceInfo.deviceId);

      const authUser = this.mapToAuthUser(user, profile);
      const requiresVerification = this.determineVerificationRequirements(user);

      if (requiresVerification.email && user.email) {
        const verificationToken = await this.tokenService.generateEmailVerificationToken(user.id, user.email);
        await this.emailService.sendVerificationEmail(user.email, verificationToken, user.username);
      }

      if (requiresVerification.phone && user.phone) {
        const verificationCode = await this.tokenService.generatePhoneVerificationCode(user.id, user.phone);
        await this.smsService.sendVerificationCode(user.phone, verificationCode);
      }

      await this.publishAuthEvent('user.registered', user, sessionData, request);

      this.logger.info('User registration completed', {
        userId: user.id,
        username: user.username,
        role: user.role,
        platform: user.platform,
        requiresEmailVerification: requiresVerification.email,
        requiresPhoneVerification: requiresVerification.phone
      });

      return buildHiveResponse.success({
        user: authUser,
        tokens,
        requiresVerification,
        nextSteps: this.generateNextSteps(user, requiresVerification)
      }, 'User registered successfully');

    } catch (error) {
      this.logger.error('User registration failed', error, {
        role: request.role,
        platform: request.platform,
        authProvider: request.authProvider
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.registrationFailed('Registration failed due to internal error', error);
    }
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      this.logger.info('User login started', {
        identifier: this.maskIdentifier(request.identifier),
        platform: request.platform,
        authProvider: request.authProvider
      });

      await this.validateLoginRequest(request);

      let user: IUserDocument | null;

      if (request.authProvider === 'google') {
        user = await this.handleGoogleLogin(request);
      } else {
        user = await this.handleLocalLogin(request);
      }

      if (!user) {
        throw AuthErrorFactory.invalidCredentials();
      }

      await this.validateUserStatus(user);
      
      const profile = await this.profileRepository.findByUserId(user.id);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      const isNewDevice = await this.checkNewDevice(user.id, request.deviceInfo.deviceId);
      const sessionData = await this.createUserSession(user, request.deviceInfo, request.locationInfo);
      
      if (request.rememberMe) {
        sessionData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await sessionData.save();
      }

      const tokens = await this.tokenService.generateTokenPair(user, sessionData.id, request.deviceInfo.deviceId);

      user.lastLogin = new Date();
      user.lastLoginIP = request.locationInfo.ip;
      user.lastLoginPlatform = request.platform;
      await user.save();

      const authUser = this.mapToAuthUser(user, profile);
      const requiresVerification = this.determineVerificationRequirements(user);

      await this.publishAuthEvent('user.login', user, sessionData, request);

      if (isNewDevice && user.phone) {
        await this.smsService.sendSecurityAlert(
          user.phone, 
          `New device login detected for your BuildHive account from ${request.deviceInfo.platform}`
        );
      }

      this.logger.info('User login completed', {
        userId: user.id,
        username: user.username,
        platform: request.platform,
        isNewDevice,
        sessionId: sessionData.id
      });

      return buildHiveResponse.success({
        user: authUser,
        tokens,
        session: {
          id: sessionData.id,
          expiresAt: sessionData.expiresAt,
          isNewDevice
        },
        requiresVerification: Object.values(requiresVerification).some(Boolean) ? requiresVerification : undefined
      }, 'Login successful');

    } catch (error) {
      this.logger.error('User login failed', error, {
        identifier: this.maskIdentifier(request.identifier),
        platform: request.platform
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.loginFailed('Login failed due to internal error', error);
    }
  }

  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      this.logger.debug('Token refresh started', {
        deviceId: request.deviceInfo.deviceId,
        platform: request.deviceInfo.platform
      });

      const tokenPayload = await this.tokenService.verifyRefreshToken(request.refreshToken);
      const session = await this.sessionRepository.validateSession(tokenPayload.sessionId, request.refreshToken);

      if (!session) {
        throw AuthErrorFactory.invalidToken('Invalid refresh token');
      }

      const user = await this.userRepository.findById(session.userId.toString());
      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      await this.validateUserStatus(user);

      if (!session.validateDevice(request.deviceInfo)) {
        await session.addSuspiciousActivity('Device information mismatch during token refresh');
        throw AuthErrorFactory.suspiciousActivity('Device validation failed');
      }

      await session.updateLocation(request.locationInfo);
      const newTokens = await this.tokenService.generateTokenPair(user, session.id, request.deviceInfo.deviceId);

      await this.sessionRepository.refreshSession(session.id, newTokens.refreshToken);

      this.logger.debug('Token refresh completed', {
        userId: user.id,
        sessionId: session.id,
        platform: request.deviceInfo.platform
      });

      return buildHiveResponse.success({
        tokens: newTokens,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          verificationStatus: user.verificationStatus
        }
      }, 'Token refreshed successfully');

    } catch (error) {
      this.logger.error('Token refresh failed', error, {
        deviceId: request.deviceInfo.deviceId
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.tokenRefreshFailed('Token refresh failed', error);
    }
  }

  async logout(request: LogoutRequest): Promise<LogoutResponse> {
    try {
      this.logger.info('User logout started', {
        logoutAll: request.logoutAll,
        hasRefreshToken: !!request.refreshToken,
        deviceId: request.deviceId
      });

      let sessionsTerminated = 0;

      if (request.refreshToken) {
        const tokenPayload = await this.tokenService.verifyRefreshToken(request.refreshToken);
        const session = await this.sessionRepository.findById(tokenPayload.sessionId);

        if (session) {
          if (request.logoutAll) {
            sessionsTerminated = await this.sessionRepository.revokeAllUserSessions(
              session.userId.toString(),
              session.id
            );
            await this.sessionRepository.revokeSession(session.id);
            sessionsTerminated += 1;
          } else {
            await this.sessionRepository.revokeSession(session.id);
            sessionsTerminated = 1;
          }

          await this.publishAuthEvent('user.logout', null, session, request);
        }
      }

      this.logger.info('User logout completed', {
        sessionsTerminated,
        logoutAll: request.logoutAll
      });

      return buildHiveResponse.success({
        message: 'Logout successful',
        sessionsTerminated
      }, 'Logged out successfully');

    } catch (error) {
      this.logger.error('User logout failed', error, {
        logoutAll: request.logoutAll
      });

      throw AuthErrorFactory.logoutFailed('Logout failed', error);
    }
  }

  async verifyEmail(request: EmailVerificationRequest): Promise<VerificationResponse> {
    try {
      this.logger.info('Email verification started', {
        email: this.maskEmail(request.email)
      });

      const tokenPayload = await this.tokenService.verifyAccessToken(request.token);
      const user = await this.userRepository.findById(tokenPayload.userId);

      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      if (user.email !== request.email) {
        throw AuthErrorFactory.invalidToken('Email mismatch');
      }

      if (user.isEmailVerified) {
        throw AuthErrorFactory.alreadyVerified('Email already verified');
      }

      await this.userRepository.verifyEmail(user.id);
      const updatedUser = await this.userRepository.findById(user.id);

      if (updatedUser?.isFullyVerified()) {
        await this.emailService.sendWelcomeEmail(
          updatedUser.email!,
          updatedUser.username,
          updatedUser.role
        );
      }

      await this.publishAuthEvent('user.verified', updatedUser!, null, { type: 'email' });

      this.logger.info('Email verification completed', {
        userId: user.id,
        email: this.maskEmail(request.email),
        isFullyVerified: updatedUser?.isFullyVerified()
      });

      return buildHiveResponse.success({
        verified: true,
        type: 'email' as const,
        user: {
          id: user.id,
          verificationStatus: updatedUser!.verificationStatus,
          isEmailVerified: true,
          isPhoneVerified: updatedUser!.isPhoneVerified
        },
        isFullyVerified: updatedUser!.isFullyVerified()
      }, 'Email verified successfully');

    } catch (error) {
      this.logger.error('Email verification failed', error, {
        email: this.maskEmail(request.email)
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.verificationFailed('Email verification failed', error);
    }
  }

  async verifyPhone(request: PhoneVerificationRequest): Promise<VerificationResponse> {
    try {
      this.logger.info('Phone verification started', {
        phone: this.maskPhone(request.phone),
        userId: request.userId
      });

      const user = await this.userRepository.findById(request.userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      if (user.phone !== request.phone) {
        throw AuthErrorFactory.invalidInput('Phone number mismatch');
      }

      if (user.isPhoneVerified) {
        throw AuthErrorFactory.alreadyVerified('Phone already verified');
      }

      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256').update(request.code).digest('hex');

      if (user.phoneVerificationCode !== hashedCode) {
        user.phoneVerificationAttempts = (user.phoneVerificationAttempts || 0) + 1;
        await user.save();

        if (user.phoneVerificationAttempts >= 3) {
          throw AuthErrorFactory.tooManyAttempts('Too many verification attempts');
        }

        throw AuthErrorFactory.invalidVerificationCode();
      }

      if (user.phoneVerificationExpires && user.phoneVerificationExpires < new Date()) {
        throw AuthErrorFactory.verificationExpired();
      }

      await this.userRepository.verifyPhone(user.id);
      const updatedUser = await this.userRepository.findById(user.id);

      if (updatedUser?.isFullyVerified() && updatedUser.email) {
        await this.emailService.sendWelcomeEmail(
          updatedUser.email,
          updatedUser.username,
          updatedUser.role
        );
      }

      await this.publishAuthEvent('user.verified', updatedUser!, null, { type: 'phone' });

      this.logger.info('Phone verification completed', {
        userId: user.id,
        phone: this.maskPhone(request.phone),
        isFullyVerified: updatedUser?.isFullyVerified()
      });

      return buildHiveResponse.success({
        verified: true,
        type: 'phone' as const,
        user: {
          id: user.id,
          verificationStatus: updatedUser!.verificationStatus,
          isEmailVerified: updatedUser!.isEmailVerified,
          isPhoneVerified: true
        },
        isFullyVerified: updatedUser!.isFullyVerified()
      }, 'Phone verified successfully');

    } catch (error) {
      this.logger.error('Phone verification failed', error, {
        phone: this.maskPhone(request.phone),
        userId: request.userId
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.verificationFailed('Phone verification failed', error);
    }
  }

  async requestPasswordReset(request: PasswordResetRequest): Promise<PasswordResetResponse> {
    try {
      this.logger.info('Password reset requested', {
        email: this.maskEmail(request.email),
        platform: request.platform
      });

      const user = await this.userRepository.findByEmail(request.email);
      if (!user) {
        return buildHiveResponse.success({
          message: 'If an account exists, a reset link has been sent',
          resetTokenSent: false,
          expiresIn: 0
        }, 'Password reset request processed');
      }

      const resetToken = await this.tokenService.generatePasswordResetToken(user.id, user.email!);
      await this.emailService.sendPasswordResetEmail(user.email!, resetToken, user.username);

      this.logger.info('Password reset email sent', {
        userId: user.id,
        email: this.maskEmail(request.email)
      });

      return buildHiveResponse.success({
        message: 'Password reset link sent to your email',
        resetTokenSent: true,
        expiresIn: 10 * 60
      }, 'Password reset link sent');

    } catch (error) {
      this.logger.error('Password reset request failed', error, {
        email: this.maskEmail(request.email)
      });

      throw AuthErrorFactory.passwordResetFailed('Password reset request failed', error);
    }
  }

  async resetPassword(request: PasswordResetConfirmRequest): Promise<VerificationResponse> {
    try {
      this.logger.info('Password reset confirmation started');

      if (request.newPassword !== request.confirmPassword) {
        throw AuthErrorFactory.passwordMismatch();
      }

      const tokenPayload = await this.tokenService.verifyAccessToken(request.token);
      const user = await this.userRepository.findById(tokenPayload.userId);

      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      await this.validatePasswordStrength(request.newPassword);
      await this.userRepository.updatePassword(user.id, request.newPassword);

      await this.sessionRepository.revokeAllUserSessions(user.id);

      if (user.phone) {
        await this.smsService.sendSecurityAlert(
          user.phone,
          'Your BuildHive password has been successfully reset. All sessions have been logged out.'
        );
      }

      this.logger.info('Password reset completed', {
        userId: user.id,
        username: user.username
      });

      return buildHiveResponse.success({
        verified: true,
        type: 'password_reset' as any,
        user: {
          id: user.id,
          verificationStatus: user.verificationStatus,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified
        },
        isFullyVerified: user.isFullyVerified()
      }, 'Password reset successfully');

    } catch (error) {
      this.logger.error('Password reset failed', error);

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.passwordResetFailed('Password reset failed', error);
    }
  }

  async changePassword(userId: string, request: ChangePasswordRequest): Promise<VerificationResponse> {
    try {
      this.logger.info('Password change started', { userId });

      if (request.newPassword !== request.confirmPassword) {
        throw AuthErrorFactory.passwordMismatch();
      }

      const user = await this.userRepository.findByCredentials(userId, request.currentPassword);
      if (!user) {
        throw AuthErrorFactory.invalidCredentials();
      }

      await this.validatePasswordStrength(request.newPassword);
      await this.userRepository.updatePassword(userId, request.newPassword);

      this.logger.info('Password changed successfully', { userId });

      return buildHiveResponse.success({
        verified: true,
        type: 'password_change' as any,
        user: {
          id: user.id,
          verificationStatus: user.verificationStatus,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified
        },
        isFullyVerified: user.isFullyVerified()
      }, 'Password changed successfully');

    } catch (error) {
      this.logger.error('Password change failed', error, { userId });
      throw AuthErrorFactory.passwordChangeFailed('Password change failed', error);
    }
  }

  async validateToken(token: string): Promise<AuthValidationResult> {
    try {
      const tokenPayload = await this.tokenService.verifyAccessToken(token);
      const user = await this.userRepository.findById(tokenPayload.userId);

      if (!user) {
        return { isValid: false, errors: [{ field: 'token', message: 'User not found' }] };
      }

      const session = await this.sessionRepository.findById(tokenPayload.sessionId);
      if (!session || !session.isValid()) {
        return { isValid: false, errors: [{ field: 'session', message: 'Invalid session' }] };
      }

      const profile = await this.profileRepository.findByUserId(user.id);
      const authUser = this.mapToAuthUser(user, profile);

      return {
        isValid: true,
        user: authUser,
        session: this.mapToSessionData(session),
        securityContext: this.buildSecurityContext(user, session)
      };

    } catch (error) {
      this.logger.error('Token validation failed', error);
      return { isValid: false, errors: [{ field: 'token', message: 'Invalid token' }] };
    }
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      const count = await this.sessionRepository.revokeAllUserSessions(userId, exceptSessionId);
      this.logger.info('All user sessions revoked', { userId, exceptSessionId, count });
      return count;
    } catch (error) {
      this.logger.error('Failed to revoke all sessions', error, { userId });
      throw AuthErrorFactory.sessionRevocationFailed('Failed to revoke sessions', error);
    }
  }

  private async validateRegistrationRequest(request: RegisterRequest): Promise<void> {
    if (!request.email && !request.phone) {
      throw AuthErrorFactory.invalidInput('Either email or phone is required');
    }

    if (request.authProvider === 'local' && !request.password) {
      throw AuthErrorFactory.invalidInput('Password is required for local registration');
    }

    if (request.authProvider === 'google' && !request.googleId) {
      throw AuthErrorFactory.invalidInput('Google ID is required for Google registration');
    }

    if (request.password) {
      await this.validatePasswordStrength(request.password);
    }

    if (!request.acceptTerms) {
      throw AuthErrorFactory.invalidInput('Terms and conditions must be accepted');
    }
  }

  private async validatePasswordStrength(password: string): Promise<void> {
    if (password.length < PASSWORD_CONFIG.MIN_LENGTH) {
      throw AuthErrorFactory.weakPassword(`Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters`);
    }

    if (password.length > PASSWORD_CONFIG.MAX_LENGTH) {
      throw AuthErrorFactory.weakPassword(`Password must not exceed ${PASSWORD_CONFIG.MAX_LENGTH} characters`);
    }

    if (PASSWORD_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      throw AuthErrorFactory.weakPassword('Password must contain at least one uppercase letter');
    }

    if (PASSWORD_CONFIG.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      throw AuthErrorFactory.weakPassword('Password must contain at least one lowercase letter');
    }

    if (PASSWORD_CONFIG.REQUIRE_NUMBERS && !/\d/.test(password)) {
      throw AuthErrorFactory.weakPassword('Password must contain at least one number');
    }

    if (PASSWORD_CONFIG.REQUIRE_SPECIAL_CHARS && !new RegExp(`[${PASSWORD_CONFIG.SPECIAL_CHARS}]`).test(password)) {
      throw AuthErrorFactory.weakPassword('Password must contain at least one special character');
    }
  }

  private mapToAuthUser(user: IUserDocument, profile?: IProfileDocument | null): AuthUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      platform: user.platform,
      authProvider: user.authProvider,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      verificationStatus: user.verificationStatus,
      lastLogin: user.lastLogin,
      profileId: profile?.id,
      subscription: user.subscription,
      credits: user.credits,
      canApplyToJobs: user.canApplyToJobs(),
      canPostJobs: user.canPostJobs(),
      canManageTeam: user.canManageTeam(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private maskIdentifier(identifier: string): string {
    if (identifier.includes('@')) {
      return this.maskEmail(identifier);
    }
    if (identifier.startsWith('+') || /^\d+$/.test(identifier)) {
      return this.maskPhone(identifier);
    }
    return identifier.substring(0, 3) + '***';
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }

  private maskPhone(phone: string): string {
    return phone.substring(0, 4) + '***' + phone.substring(phone.length - 2);
  }
}

async forgotPassword(request: PasswordResetRequest): Promise<PasswordResetResponse> {
  return this.requestPasswordReset(request);
}

async sendEmailVerification(userId: string, email: string): Promise<VerificationResponse> {
  try {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw AuthErrorFactory.userNotFound();
    }

    const verificationToken = await this.tokenService.generateEmailVerificationToken(userId, email);
    await this.emailService.sendVerificationEmail(email, verificationToken, user.username);

    return buildHiveResponse.success({
      verified: false,
      type: 'email' as const,
      user: {
        id: userId,
        verificationStatus: user.verificationStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified
      },
      isFullyVerified: false
    }, 'Verification email sent');
  } catch (error) {
    throw AuthErrorFactory.verificationFailed('Failed to send email verification', error);
  }
}

async sendPhoneVerification(userId: string, phone: string): Promise<VerificationResponse> {
  try {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw AuthErrorFactory.userNotFound();
    }

    const verificationCode = await this.tokenService.generatePhoneVerificationCode(userId, phone);
    await this.smsService.sendVerificationCode(phone, verificationCode);

    return buildHiveResponse.success({
      verified: false,
      type: 'phone' as const,
      user: {
        id: userId,
        verificationStatus: user.verificationStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified
      },
      isFullyVerified: false
    }, 'Verification code sent');
  } catch (error) {
    throw AuthErrorFactory.verificationFailed('Failed to send phone verification', error);
  }
}

async resendVerification(request: ResendVerificationRequest): Promise<VerificationResponse> {
  if (request.type === 'email') {
    return this.sendEmailVerification(request.userId!, request.identifier);
  } else {
    return this.sendPhoneVerification(request.userId!, request.identifier);
  }
}

async validateSession(sessionId: string, userId: string): Promise<boolean> {
  try {
    const session = await this.sessionRepository.findById(sessionId);
    return session ? session.userId.toString() === userId && session.isValid() : false;
  } catch (error) {
    return false;
  }
}
