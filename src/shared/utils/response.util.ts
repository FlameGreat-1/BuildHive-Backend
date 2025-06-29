import { Response } from 'express';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../config/auth';

// Standard API response interface
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

// Pagination metadata interface
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Paginated response interface
interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// BuildHive Response Utility Class
class BuildHiveResponseUtil {
  private readonly version = 'v1';

  // Generate response metadata
  private generateMeta(requestId?: string) {
    return {
      timestamp: new Date().toISOString(),
      requestId,
      version: this.version,
    };
  }

  // Success responses
  success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = HTTP_STATUS.OK,
    requestId?: string
  ): Response<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta: this.generateMeta(requestId),
    };

    return res.status(statusCode).json(response);
  }

  // Created response (201)
  created<T>(
    res: Response,
    data: T,
    message: string = 'Resource created successfully',
    requestId?: string
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, HTTP_STATUS.CREATED, requestId);
  }

  // No content response (204)
  noContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  // Error responses
  error(
    res: Response,
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    error?: string,
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      ...(error && { error }),
      meta: this.generateMeta(requestId),
    };

    return res.status(statusCode).json(response);
  }

  // Bad request (400)
  badRequest(
    res: Response,
    message: string = 'Bad request',
    error?: string,
    requestId?: string
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, error, requestId);
  }

  // Unauthorized (401)
  unauthorized(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.UNAUTHORIZED,
    requestId?: string
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED, undefined, requestId);
  }

  // Forbidden (403)
  forbidden(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.FORBIDDEN,
    requestId?: string
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN, undefined, requestId);
  }

  // Not found (404)
  notFound(
    res: Response,
    message: string = 'Resource not found',
    requestId?: string
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND, undefined, requestId);
  }

  // Conflict (409)
  conflict(
    res: Response,
    message: string = 'Resource conflict',
    requestId?: string
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.CONFLICT, undefined, requestId);
  }

  // Validation errors (422)
  validationError(
    res: Response,
    errors: Record<string, string[]>,
    message: string = 'Validation failed',
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      errors,
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(response);
  }

  // Rate limit exceeded (429)
  rateLimitExceeded(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.RATE_LIMIT_EXCEEDED,
    requestId?: string
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.TOO_MANY_REQUESTS, undefined, requestId);
  }

  // Internal server error (500)
  internalError(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
    error?: string,
    requestId?: string
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR, error, requestId);
  }

  // Paginated response
  paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta,
    message: string = 'Data retrieved successfully',
    requestId?: string
  ): Response<PaginatedResponse<T>> {
    const response: PaginatedResponse<T> = {
      success: true,
      message,
      data,
      pagination,
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.OK).json(response);
  }

  // Authentication specific responses
  auth = {
    loginSuccess: (res: Response, data: any, requestId?: string) => {
      return this.success(
        res,
        data,
        RESPONSE_MESSAGES.SUCCESS.USER_LOGGED_IN,
        HTTP_STATUS.OK,
        requestId
      );
    },

    registerSuccess: (res: Response, data: any, requestId?: string) => {
      return this.created(
        res,
        data,
        RESPONSE_MESSAGES.SUCCESS.USER_REGISTERED,
        requestId
      );
    },

    logoutSuccess: (res: Response, requestId?: string) => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.USER_LOGGED_OUT,
        HTTP_STATUS.OK,
        requestId
      );
    },

    emailVerified: (res: Response, requestId?: string) => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.EMAIL_VERIFIED,
        HTTP_STATUS.OK,
        requestId
      );
    },

    passwordResetSent: (res: Response, requestId?: string) => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.PASSWORD_RESET_SENT,
        HTTP_STATUS.OK,
        requestId
      );
    },

    passwordResetSuccess: (res: Response, requestId?: string) => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.PASSWORD_RESET_SUCCESS,
        HTTP_STATUS.OK,
        requestId
      );
    },

    invalidCredentials: (res: Response, requestId?: string) => {
      return this.unauthorized(
        res,
        RESPONSE_MESSAGES.ERROR.INVALID_CREDENTIALS,
        requestId
      );
    },

    userNotFound: (res: Response, requestId?: string) => {
      return this.notFound(
        res,
        RESPONSE_MESSAGES.ERROR.USER_NOT_FOUND,
        requestId
      );
    },

    emailExists: (res: Response, requestId?: string) => {
      return this.conflict(
        res,
        RESPONSE_MESSAGES.ERROR.EMAIL_ALREADY_EXISTS,
        requestId
      );
    },

    accountSuspended: (res: Response, requestId?: string) => {
      return this.forbidden(
        res,
        RESPONSE_MESSAGES.ERROR.ACCOUNT_SUSPENDED,
        requestId
      );
    },

    emailNotVerified: (res: Response, requestId?: string) => {
      return this.forbidden(
        res,
        RESPONSE_MESSAGES.ERROR.EMAIL_NOT_VERIFIED,
        requestId
      );
    },
  };

  // Profile specific responses
  profile = {
    updateSuccess: (res: Response, data: any, requestId?: string) => {
      return this.success(
        res,
        data,
        RESPONSE_MESSAGES.SUCCESS.PROFILE_UPDATED,
        HTTP_STATUS.OK,
        requestId
      );
    },
  };
}

// Create and export singleton instance
export const buildHiveResponse = new BuildHiveResponseUtil();

// Export types for use in other modules
export type { ApiResponse, PaginatedResponse, PaginationMeta };

export default buildHiveResponse;
