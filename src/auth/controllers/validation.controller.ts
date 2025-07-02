import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services';
import { sendSuccess, asyncErrorHandler } from '../../shared/utils';
import { validateEmail, validateUsername, validatePassword, validateLoginCredentials, validatePasswordReset, validateChangePassword } from '../utils';
import { ValidationAppError } from '../../shared/utils';

export class ValidationController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  checkEmailAvailability = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { email } = req.body;
    const requestId = res.locals.requestId;

    const emailValidationErrors = validateEmail(email);
    if (emailValidationErrors.length > 0) {
      throw new ValidationAppError('Email validation failed', emailValidationErrors, requestId);
    }

    const isAvailable = await this.userService.isEmailAvailable(email);

    return sendSuccess(res, 'Email availability checked', {
      email,
      available: isAvailable,
      message: isAvailable ? 'Email is available' : 'Email is already registered'
    });
  });

  checkUsernameAvailability = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { username } = req.body;
    const requestId = res.locals.requestId;

    const usernameValidationErrors = validateUsername(username);
    if (usernameValidationErrors.length > 0) {
      throw new ValidationAppError('Username validation failed', usernameValidationErrors, requestId);
    }

    const isAvailable = await this.userService.isUsernameAvailable(username);

    return sendSuccess(res, 'Username availability checked', {
      username,
      available: isAvailable,
      message: isAvailable ? 'Username is available' : 'Username is already taken'
    });
  });

  validatePassword = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { password } = req.body;
    const requestId = res.locals.requestId;

    const passwordValidationErrors = validatePassword(password);
    const isValid = passwordValidationErrors.length === 0;

    if (!isValid) {
      return sendSuccess(res, 'Password validation completed', {
        valid: false,
        errors: passwordValidationErrors,
        requirements: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true
        }
      });
    }

    return sendSuccess(res, 'Password is valid', {
      valid: true,
      strength: 'strong'
    });
  });

  validateLoginCredentials = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { email, password } = req.body;
    const requestId = res.locals.requestId;

    const validationErrors = validateLoginCredentials({ email, password });
    const isValid = validationErrors.length === 0;

    if (!isValid) {
      throw new ValidationAppError('Login credentials validation failed', validationErrors, requestId);
    }

    return sendSuccess(res, 'Login credentials are valid', {
      valid: true,
      email,
      passwordProvided: !!password
    });
  });

  validatePasswordReset = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { token, newPassword, confirmPassword } = req.body;
    const requestId = res.locals.requestId;

    const validationErrors = validatePasswordReset({ token, newPassword, confirmPassword });
    const isValid = validationErrors.length === 0;

    if (!isValid) {
      throw new ValidationAppError('Password reset validation failed', validationErrors, requestId);
    }

    return sendSuccess(res, 'Password reset data is valid', {
      valid: true,
      tokenProvided: !!token,
      passwordsMatch: newPassword === confirmPassword
    });
  });

  validateChangePassword = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const requestId = res.locals.requestId;

    const validationErrors = validateChangePassword({ currentPassword, newPassword, confirmPassword });
    const isValid = validationErrors.length === 0;

    if (!isValid) {
      throw new ValidationAppError('Change password validation failed', validationErrors, requestId);
    }

    return sendSuccess(res, 'Change password data is valid', {
      valid: true,
      currentPasswordProvided: !!currentPassword,
      passwordsMatch: newPassword === confirmPassword,
      passwordsDifferent: currentPassword !== newPassword
    });
  });

  validateRegistrationData = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { email, username, password, role, authProvider } = req.body;
    const requestId = res.locals.requestId;

    const validationErrors = [];

    if (email) {
      const emailErrors = validateEmail(email);
      validationErrors.push(...emailErrors);
    }

    if (username) {
      const usernameErrors = validateUsername(username);
      validationErrors.push(...usernameErrors);
    }

    if (password && authProvider === 'local') {
      const passwordErrors = validatePassword(password);
      validationErrors.push(...passwordErrors);
    }

    if (validationErrors.length > 0) {
      throw new ValidationAppError('Registration data validation failed', validationErrors, requestId);
    }

    const availabilityChecks = await Promise.all([
      email ? this.userService.isEmailAvailable(email) : Promise.resolve(true),
      username ? this.userService.isUsernameAvailable(username) : Promise.resolve(true)
    ]);

    const [emailAvailable, usernameAvailable] = availabilityChecks;

    return sendSuccess(res, 'Registration data validated', {
      valid: emailAvailable && usernameAvailable,
      checks: {
        email: email ? { provided: true, valid: true, available: emailAvailable } : { provided: false },
        username: username ? { provided: true, valid: true, available: usernameAvailable } : { provided: false },
        password: password ? { provided: true, valid: true } : { provided: false }
      },
      issues: [
        ...(!emailAvailable && email ? ['Email is already registered'] : []),
        ...(!usernameAvailable && username ? ['Username is already taken'] : [])
      ]
    });
  });

  generateUsernameFromName = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationAppError('Name validation failed', [{
        field: 'name',
        message: 'Name is required and must be a non-empty string',
        code: 'NAME_REQUIRED'
      }], res.locals.requestId);
    }

    const baseName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueUsername = await this.userService.generateUniqueUsername(baseName);

    return sendSuccess(res, 'Username generated successfully', {
      originalName: name,
      generatedUsername: uniqueUsername,
      available: true
    });
  });

  bulkAvailabilityCheck = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { emails = [], usernames = [] } = req.body;

    if (!Array.isArray(emails) || !Array.isArray(usernames)) {
      throw new ValidationAppError('Invalid input format', [{
        field: 'input',
        message: 'Emails and usernames must be arrays',
        code: 'INVALID_INPUT_FORMAT'
      }], res.locals.requestId);
    }

    const emailChecks = await Promise.all(
      emails.map(async (email: string) => ({
        email,
        available: await this.userService.isEmailAvailable(email)
      }))
    );

    const usernameChecks = await Promise.all(
      usernames.map(async (username: string) => ({
        username,
        available: await this.userService.isUsernameAvailable(username)
      }))
    );

    return sendSuccess(res, 'Bulk availability check completed', {
      emails: emailChecks,
      usernames: usernameChecks,
      summary: {
        totalEmails: emails.length,
        availableEmails: emailChecks.filter(check => check.available).length,
        totalUsernames: usernames.length,
        availableUsernames: usernameChecks.filter(check => check.available).length
      }
    });
  });

  validateEmailFormat = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { email } = req.body;
    const requestId = res.locals.requestId;

    const emailValidationErrors = validateEmail(email);
    const isValid = emailValidationErrors.length === 0;

    return sendSuccess(res, 'Email format validation completed', {
      email,
      valid: isValid,
      errors: emailValidationErrors
    });
  });

  validateUsernameFormat = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { username } = req.body;
    const requestId = res.locals.requestId;

    const usernameValidationErrors = validateUsername(username);
    const isValid = usernameValidationErrors.length === 0;

    return sendSuccess(res, 'Username format validation completed', {
      username,
      valid: isValid,
      errors: usernameValidationErrors
    });
  });

  validateSocialData = asyncErrorHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { socialData, authProvider } = req.body;
    const requestId = res.locals.requestId;

    const validationErrors = [];

    if (!socialData || typeof socialData !== 'object') {
      validationErrors.push({
        field: 'socialData',
        message: 'Social data is required and must be an object',
        code: 'SOCIAL_DATA_REQUIRED'
      });
    } else {
      if (!socialData.email) {
        validationErrors.push({
          field: 'socialData.email',
          message: 'Email is required from social provider',
          code: 'SOCIAL_EMAIL_REQUIRED'
        });
      } else {
        const emailErrors = validateEmail(socialData.email);
        validationErrors.push(...emailErrors.map(error => ({
          ...error,
          field: `socialData.${error.field}`
        })));
      }

      if (!socialData.name) {
        validationErrors.push({
          field: 'socialData.name',
          message: 'Name is required from social provider',
          code: 'SOCIAL_NAME_REQUIRED'
        });
      }

      if (!socialData.id) {
        validationErrors.push({
          field: 'socialData.id',
          message: 'Social ID is required from social provider',
          code: 'SOCIAL_ID_REQUIRED'
        });
      }
    }

    const isValid = validationErrors.length === 0;

    if (!isValid) {
      throw new ValidationAppError('Social data validation failed', validationErrors, requestId);
    }

    return sendSuccess(res, 'Social data is valid', {
      valid: true,
      provider: authProvider,
      socialData: {
        hasEmail: !!socialData?.email,
        hasName: !!socialData?.name,
        hasId: !!socialData?.id,
        hasPicture: !!socialData?.picture
      }
    });
  });
}
