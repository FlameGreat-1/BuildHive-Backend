import { UserService } from './user.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { ProfileService } from './profile.service';
import { 
  RegisterLocalRequest, 
  RegisterSocialRequest, 
  RegisterResponse,
  EmailVerificationRequest,
  EmailVerificationResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  LoginCredentials,
  LoginResult,
  RefreshTokenData,
  RefreshTokenResult,
  PasswordResetData,
  PasswordResetResult,
  PasswordResetConfirmData,
  PasswordResetConfirmResult,
  ChangePasswordData,
  ChangePasswordResult,
  LogoutData,
  LogoutResult
} from '../types';
import { AuthProvider, UserRole } from '../../shared/types';
import { validateRegistrationData, validateLoginCredentials, validatePasswordReset, validateChangePassword, validatePasswordResetRequest } from '../utils';
import { ValidationAppError, AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { logRegistrationAttempt, logRegistrationError } from '../../shared/utils';

export class AuthService {
  private userService: UserService;
  private tokenService: TokenService;
  private emailService: EmailService;
  private profileService: ProfileService;

  constructor() {
    this.userService = new UserService();
    this.tokenService = new TokenService();
    this.emailService = new EmailService();
    this.profileService = new ProfileService();
  }

  async registerLocal(request: RegisterLocalRequest, requestId: string): Promise<RegisterResponse> {
    const validationErrors = validateRegistrationData({
      username: request.username,
      email: request.email,
      password: request.password,
      role: request.role,
      authProvider: AuthProvider.LOCAL
    });

    if (validationErrors.length > 0) {
      throw new ValidationAppError('Registration validation failed', validationErrors, requestId);
    }

    try {
      const user = await this.userService.registerUser({
        username: request.username,
        email: request.email,
        password: request.password,
        role: request.role,
        authProvider: AuthProvider.LOCAL
      });

      const verificationToken = await this.tokenService.generateEmailVerificationToken(
        user.id,
        user.email
      );

      await this.emailService.sendVerificationEmail(user.email, user.username, verificationToken);

      logRegistrationAttempt(user.email, AuthProvider.LOCAL, true, requestId);

      const userData = this.userService.getUserPublicData(user);

      return {
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          ...userData,
          createdAt: userData.createdAt ? userData.createdAt.toISOString() : user.createdAt.toISOString()
        },
        requiresVerification: true,
        verificationSent: true
      };
    } catch (error: any) {
      logRegistrationError(request.email, error.message, requestId);
      throw error;
    }
  }

  async registerSocial(request: RegisterSocialRequest, requestId: string): Promise<RegisterResponse> {
    const validationErrors = validateRegistrationData({
      username: request.socialData.name || `user_${Date.now()}`,
      email: request.socialData.email,
      role: request.role,
      authProvider: request.authProvider
    });

    if (validationErrors.length > 0) {
      throw new ValidationAppError('Social registration validation failed', validationErrors, requestId);
    }

    try {
      const existingUser = await this.userService.getUserBySocialId(
        request.socialId,
        request.authProvider
      );

      if (existingUser) {
        logRegistrationAttempt(request.socialData.email, request.authProvider, true, requestId);
        
        const userData = this.userService.getUserPublicData(existingUser);
        
        return {
          success: true,
          message: 'Social account already registered. Please login.',
          user: {
            ...userData,
            createdAt: userData.createdAt ? userData.createdAt.toISOString() : existingUser.createdAt.toISOString()
          },
          requiresVerification: false,
          verificationSent: false
        };
      }

      const username = await this.userService.generateUniqueUsername(
        request.socialData.name || 'user'
      );

      const user = await this.userService.registerUser({
        username,
        email: request.socialData.email,
        role: request.role,
        authProvider: request.authProvider,
        socialId: request.socialId,
        socialData: request.socialData
      });

      logRegistrationAttempt(user.email, request.authProvider, true, requestId);

      const userData = this.userService.getUserPublicData(user);

      return {
        success: true,
        message: 'Social registration successful.',
        user: {
          ...userData,
          createdAt: userData.createdAt ? userData.createdAt.toISOString() : user.createdAt.toISOString()
        },
        requiresVerification: false,
        verificationSent: false
      };
    } catch (error: any) {
      logRegistrationError(request.socialData.email, error.message, requestId);
      throw error;
    }
  }

  async login(credentials: LoginCredentials, requestId: string): Promise<LoginResult> {
    const validationErrors = validateLoginCredentials({
      email: credentials.email,
      password: credentials.password
    });

    if (validationErrors.length > 0) {
      throw new ValidationAppError('Login validation failed', validationErrors, requestId);
    }

    try {
      const user = await this.userService.authenticateUser(credentials.email, credentials.password);
      
      const tokens = await this.tokenService.generateTokenPair(user.id, user.email, user.role);
      
      const profile = await this.profileService.getProfileByUserId(user.id);
      
      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified
        },
        tokens,
        profile: profile ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatar: profile.avatar
        } : undefined
      };
    } catch (error: any) {
      throw error;
    }
  }

  async refreshToken(data: RefreshTokenData, requestId: string): Promise<RefreshTokenResult> {
    try {
      const tokenData = await this.tokenService.verifyRefreshToken(data.refreshToken);
      
      const user = await this.userService.getUserById(tokenData.userId);
      if (!user) {
        throw new AppError(
          'User not found',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      const newTokens = await this.tokenService.generateTokenPair(user.id, user.email, user.role);
      
      await this.tokenService.revokeToken(data.refreshToken);

      return {
        tokens: newTokens
      };
    } catch (error: any) {
      throw new AppError(
        'Invalid refresh token',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN,
        true,
        requestId
      );
    }
  }

  async logout(data: LogoutData, requestId: string): Promise<LogoutResult> {
    try {
      if (data.refreshToken) {
        const tokenData = await this.tokenService.verifyRefreshToken(data.refreshToken);
        
        if (data.logoutAllDevices) {
          await this.tokenService.revokeAllUserTokens(tokenData.userId);
        } else {
          await this.tokenService.revokeToken(data.refreshToken);
        }
      }

      return {
        success: true,
        message: data.logoutAllDevices ? 'Logged out from all devices successfully' : 'Logged out successfully',
        loggedOut: true
      };
    } catch (error: any) {
      return {
        success: true,
        message: 'Logged out successfully',
        loggedOut: true
      };
    }
  }

  async requestPasswordReset(data: PasswordResetData, requestId: string): Promise<PasswordResetResult> {
    const validationErrors = validatePasswordResetRequest({
      email: data.email
    });

    if (validationErrors.length > 0) {
      throw new ValidationAppError('Password reset validation failed', validationErrors, requestId);
    }

    try {
      const user = await this.userService.initiatePasswordReset(data.email);
      
      const resetToken = await this.tokenService.generatePasswordResetToken(user.id, user.email);
      
      await this.emailService.sendPasswordResetEmail(user.email, user.username, resetToken);

      return {
        success: true,
        message: 'Password reset instructions have been sent to your email',
        resetTokenSent: true
      };
    } catch (error: any) {
      if (error.code === ERROR_CODES.INVALID_CREDENTIALS) {
        return {
          success: true,
          message: 'If an account with that email exists, password reset instructions have been sent',
          resetTokenSent: false
        };
      }
      throw error;
    }
  }

  async confirmPasswordReset(data: PasswordResetConfirmData, requestId: string): Promise<PasswordResetConfirmResult> {
    const validationErrors = validatePasswordReset({
      token: data.token,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword
    });

    if (validationErrors.length > 0) {
      throw new ValidationAppError('Password reset confirmation validation failed', validationErrors, requestId);
    }

    try {
      const tokenData = await this.tokenService.verifyPasswordResetToken(data.token);
      
      await this.userService.resetPassword(data.token, data.newPassword);
      
      await this.tokenService.invalidatePasswordResetToken(tokenData.userId);
      
      await this.tokenService.revokeAllUserTokens(tokenData.userId);

      const user = await this.userService.getUserById(tokenData.userId);
      if (user) {
        await this.emailService.sendPasswordChangedNotification(user.email, user.username);
      }

      return {
        success: true,
        message: 'Password has been reset successfully',
        passwordReset: true
      };
    } catch (error: any) {
      throw new AppError(
        'Password reset failed',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN,
        true,
        requestId
      );
    }
  }

  async changePassword(data: ChangePasswordData, userId: string, requestId: string): Promise<ChangePasswordResult> {
    const validationErrors = validateChangePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword
    });

    if (validationErrors.length > 0) {
      throw new ValidationAppError('Change password validation failed', validationErrors, requestId);
    }

    try {
      await this.userService.changePassword(userId, data.currentPassword, data.newPassword);
      
      await this.tokenService.revokeUserTokensByType(userId, 'refresh');

      const user = await this.userService.getUserById(userId);
      if (user) {
        await this.emailService.sendPasswordChangedNotification(user.email, user.username);
      }

      return {
        success: true,
        message: 'Password changed successfully',
        passwordChanged: true
      };
    } catch (error: any) {
      throw error;
    }
  }

  async verifyEmail(request: EmailVerificationRequest, requestId: string): Promise<EmailVerificationResponse> {
    try {
      const tokenData = await this.tokenService.verifyEmailVerificationToken(request.token);
      
      const user = await this.userService.getUserById(tokenData.userId);
      if (!user) {
        throw new AppError(
          'Invalid verification token',
          HTTP_STATUS_CODES.BAD_REQUEST,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      if (user.email !== request.email) {
        throw new AppError(
          'Email verification token mismatch',
          HTTP_STATUS_CODES.BAD_REQUEST,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      if (user.emailVerified) {
        return {
          success: true,
          message: 'Email is already verified',
          verified: true
        };
      }

      await this.userService.verifyUserEmail(user.id);
      await this.tokenService.invalidateEmailVerificationToken(user.id);
      await this.emailService.sendWelcomeEmail(user.email, user.username, user.role);

      return {
        success: true,
        message: 'Email verified successfully',
        verified: true
      };
    } catch (error: any) {
      throw new AppError(
        'Email verification failed',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN,
        true,
        requestId
      );
    }
  }

  async resendVerificationEmail(request: ResendVerificationRequest, requestId: string): Promise<ResendVerificationResponse> {
    const user = await this.userService.getUserByEmail(request.email);
    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (user.emailVerified) {
      return {
        success: true,
        message: 'Email is already verified',
        sent: false
      };
    }

    try {
      const verificationToken = await this.tokenService.generateEmailVerificationToken(
        user.id,
        user.email
      );

      await this.emailService.sendVerificationEmail(user.email, user.username, verificationToken);

      return {
        success: true,
        message: 'Verification email sent successfully',
        sent: true
      };
    } catch (error: any) {
      throw new AppError(
        'Failed to send verification email',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        true,
        requestId
      );
    }
  }
}
