import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services';
import { 
  RegisterLocalRequest, 
  RegisterSocialRequest, 
  EmailVerificationRequest,
  ResendVerificationRequest 
} from '../types';
import { sendSuccess, sendCreated, asyncErrorHandler } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

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
}
