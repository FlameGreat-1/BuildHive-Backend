import { UserService } from './user.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { 
  RegisterLocalRequest, 
  RegisterSocialRequest, 
  RegisterResponse,
  EmailVerificationRequest,
  EmailVerificationResponse,
  ResendVerificationRequest,
  ResendVerificationResponse
} from '../types';
import { AuthProvider, UserRole } from '../../shared/types';
import { validateRegistrationData } from '../utils';
import { ValidationAppError, AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { logRegistrationAttempt, logRegistrationError } from '../../shared/utils';

export class AuthService {
  private userService: UserService;
  private tokenService: TokenService;
  private emailService: EmailService;

  constructor() {
    this.userService = new UserService();
    this.tokenService = new TokenService();
    this.emailService = new EmailService();
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
