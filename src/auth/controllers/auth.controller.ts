import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services';
import { 
  RegisterLocalRequest, 
  RegisterSocialRequest, 
  EmailVerificationRequest,
  ResendVerificationRequest,
  LoginCredentials,
  RefreshTokenData,
  PasswordResetData,
  PasswordResetConfirmData,
  ChangePasswordData,
  LogoutData
} from '../types';
import { sendSuccess, sendCreated, asyncErrorHandler } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  registerLocal = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const registrationData: RegisterLocalRequest = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role
    };

    const result = await this.authService.registerLocal(registrationData, requestId);

    return sendCreated(res, result.message, {
      user: result.user,
      requiresVerification: result.requiresVerification,
      verificationSent: result.verificationSent
    });
  });

  registerSocial = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const registrationData: RegisterSocialRequest = {
      authProvider: req.body.authProvider,
      socialId: req.body.socialId,
      socialData: req.body.socialData,
      role: req.body.role
    };

    const result = await this.authService.registerSocial(registrationData, requestId);

    return sendCreated(res, result.message, {
      user: result.user,
      requiresVerification: result.requiresVerification,
      verificationSent: result.verificationSent
    });
  });

  login = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const credentials: LoginCredentials = {
      email: req.body.email,
      password: req.body.password,
      rememberMe: req.body.rememberMe || false
    };

    const result = await this.authService.login(credentials, requestId);

    return sendSuccess(res, 'Login successful', {
      user: result.user,
      tokens: result.tokens,
      profile: result.profile
    });
  });

  refreshToken = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const refreshData: RefreshTokenData = {
      refreshToken: req.body.refreshToken
    };

    const result = await this.authService.refreshToken(refreshData, requestId);

    return sendSuccess(res, 'Token refreshed successfully', {
      tokens: result.tokens
    });
  });

  logout = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const logoutData: LogoutData = {
      refreshToken: req.body.refreshToken,
      logoutAllDevices: req.body.logoutAllDevices || false
    };

    const result = await this.authService.logout(logoutData, requestId);

    return sendSuccess(res, result.message, {
      loggedOut: result.loggedOut
    });
  });

  requestPasswordReset = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const resetData: PasswordResetData = {
      email: req.body.email
    };

    const result = await this.authService.requestPasswordReset(resetData, requestId);

    return sendSuccess(res, result.message, {
      resetTokenSent: result.resetTokenSent
    });
  });

  confirmPasswordReset = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const confirmData: PasswordResetConfirmData = {
      token: req.body.token,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword
    };

    const result = await this.authService.confirmPasswordReset(confirmData, requestId);

    return sendSuccess(res, result.message, {
      passwordReset: result.passwordReset
    });
  });

  changePassword = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const changeData: ChangePasswordData = {
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword
    };

    const result = await this.authService.changePassword(changeData, userId, requestId);

    return sendSuccess(res, result.message, {
      passwordChanged: result.passwordChanged
    });
  });

  verifyEmail = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const verificationData: EmailVerificationRequest = {
      token: req.body.token,
      email: req.body.email
    };

    const result = await this.authService.verifyEmail(verificationData, requestId);

    return sendSuccess(res, result.message, {
      verified: result.verified
    });
  });

  resendVerificationEmail = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const requestId = res.locals.requestId;
    const resendData: ResendVerificationRequest = {
      email: req.body.email
    };

    const result = await this.authService.resendVerificationEmail(resendData, requestId);

    return sendSuccess(res, result.message, {
      sent: result.sent
    });
  });

  getCurrentUser = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const user = req.user;
    
    if (!user) {
      throw new Error('User not found in request');
    }

    return sendSuccess(res, 'Current user retrieved successfully', {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  });

  validateSession = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const user = req.user;
    
    if (!user) {
      throw new Error('User not found in request');
    }

    return sendSuccess(res, 'Session is valid', {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  });
}
