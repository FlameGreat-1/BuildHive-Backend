import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services';
import { sendSuccess, asyncErrorHandler } from '../../shared/utils';
import { validateEmail, validateUsername } from '../utils';
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
//       const { validatePasswordStrength } = require('../utils');
//       const passwordErrors = validatePasswordStrength(password);
//       validationErrors.push(...passwordErrors);
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
}
