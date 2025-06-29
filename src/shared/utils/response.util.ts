import { Response } from 'express';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../config/auth';

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

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

class BuildHiveResponseUtil {
  private readonly version = 'v1';

  private generateMeta(requestId?: string) {
    return {
      timestamp: new Date().toISOString(),
      requestId,
      version: this.version,
    };
  }

  success<T>(
    data: T,
    message?: string,
    statusCode?: number,
    requestId?: string
  ): ApiResponse<T>;
  success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode?: number,
    requestId?: string
  ): Response<ApiResponse<T>>;
  success<T>(
    resOrData: Response | T,
    dataOrMessage?: T | string,
    messageOrStatusCode?: string | number,
    statusCodeOrRequestId?: number | string,
    requestId?: string
  ): Response<ApiResponse<T>> | ApiResponse<T> {
    if (resOrData && typeof (resOrData as any).status === 'function') {
      const res = resOrData as Response;
      const data = dataOrMessage as T;
      const message = (messageOrStatusCode as string) || 'Success';
      const statusCode = (statusCodeOrRequestId as number) || HTTP_STATUS.OK;
      
      const response: ApiResponse<T> = {
        success: true,
        message,
        data,
        meta: this.generateMeta(requestId),
      };

      return res.status(statusCode).json(response);
    } else {
      const data = resOrData as T;
      const message = (dataOrMessage as string) || 'Success';
      const statusCode = (messageOrStatusCode as number) || HTTP_STATUS.OK;
      const reqId = statusCodeOrRequestId as string;
      
      return {
        success: true,
        message,
        data,
        meta: this.generateMeta(reqId),
      };
    }
  }

  error(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: any
  ): ApiResponse {
    return {
      success: false,
      message,
      error: code,
      ...(details && { data: details }),
      meta: this.generateMeta(),
    };
  }

  created<T>(
    res: Response,
    data: T,
    message: string = 'Resource created successfully',
    requestId?: string
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, HTTP_STATUS.CREATED, requestId);
  }

  noContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  badRequest(
    res: Response,
    message: string = 'Bad request',
    error?: string,
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      ...(error && { error }),
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.BAD_REQUEST).json(response);
  }

  unauthorized(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.UNAUTHORIZED,
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
  }

  forbidden(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.FORBIDDEN,
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.FORBIDDEN).json(response);
  }

  notFound(
    res: Response,
    message: string = 'Resource not found',
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.NOT_FOUND).json(response);
  }

  conflict(
    res: Response,
    message: string = 'Resource conflict',
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.CONFLICT).json(response);
  }

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

  rateLimitExceeded(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.RATE_LIMIT_EXCEEDED,
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(response);
  }

  internalError(
    res: Response,
    message: string = RESPONSE_MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
    error?: string,
    requestId?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      ...(error && { error }),
      meta: this.generateMeta(requestId),
    };

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }

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

  auth = {
    loginSuccess: (res: Response, data: any, requestId?: string): Response<ApiResponse<any>> => {
      return this.success(
        res,
        data,
        RESPONSE_MESSAGES.SUCCESS.USER_LOGGED_IN,
        HTTP_STATUS.OK,
        requestId
      );
    },

    registerSuccess: (res: Response, data: any, requestId?: string): Response<ApiResponse<any>> => {
      return this.created(
        res,
        data,
        RESPONSE_MESSAGES.SUCCESS.USER_REGISTERED,
        requestId
      );
    },

    logoutSuccess: (res: Response, requestId?: string): Response<ApiResponse<null>> => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.USER_LOGGED_OUT,
        HTTP_STATUS.OK,
        requestId
      );
    },

    emailVerified: (res: Response, requestId?: string): Response<ApiResponse<null>> => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.EMAIL_VERIFIED,
        HTTP_STATUS.OK,
        requestId
      );
    },

    passwordResetSent: (res: Response, requestId?: string): Response<ApiResponse<null>> => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.PASSWORD_RESET_SENT,
        HTTP_STATUS.OK,
        requestId
      );
    },

    passwordResetSuccess: (res: Response, requestId?: string): Response<ApiResponse<null>> => {
      return this.success(
        res,
        null,
        RESPONSE_MESSAGES.SUCCESS.PASSWORD_RESET_SUCCESS,
        HTTP_STATUS.OK,
        requestId
      );
    },

    invalidCredentials: (res: Response, requestId?: string): Response<ApiResponse> => {
      return this.unauthorized(
        res,
        RESPONSE_MESSAGES.ERROR.INVALID_CREDENTIALS,
        requestId
      );
    },

    userNotFound: (res: Response, requestId?: string): Response<ApiResponse> => {
      return this.notFound(
        res,
        RESPONSE_MESSAGES.ERROR.USER_NOT_FOUND,
        requestId
      );
    },

    emailExists: (res: Response, requestId?: string): Response<ApiResponse> => {
      return this.conflict(
        res,
        RESPONSE_MESSAGES.ERROR.EMAIL_ALREADY_EXISTS,
        requestId
      );
    },

    accountSuspended: (res: Response, requestId?: string): Response<ApiResponse> => {
      return this.forbidden(
        res,
        RESPONSE_MESSAGES.ERROR.ACCOUNT_SUSPENDED,
        requestId
      );
    },

    emailNotVerified: (res: Response, requestId?: string): Response<ApiResponse> => {
      return this.forbidden(
        res,
        RESPONSE_MESSAGES.ERROR.EMAIL_NOT_VERIFIED,
        requestId
      );
    },
  };

  profile = {
    updateSuccess: (res: Response, data: any, requestId?: string): Response<ApiResponse<any>> => {
      return this.success(
        res,
        data,
        RESPONSE_MESSAGES.SUCCESS.PROFILE_UPDATED,
        HTTP_STATUS.OK,
        requestId
      );
    },

    createSuccess: (res: Response, data: any, requestId?: string): Response<ApiResponse<any>> => {
      return this.created(
        res,
        data,
        'Profile created successfully',
        requestId
      );
    },

    deleteSuccess: (res: Response, requestId?: string): Response<ApiResponse<null>> => {
      return this.success(
        res,
        null,
        'Profile deleted successfully',
        HTTP_STATUS.OK,
        requestId
      );
    },

    imageUploadSuccess: (res: Response, data: any, requestId?: string): Response<ApiResponse<any>> => {
      return this.success(
        res,
        data,
        'Profile image uploaded successfully',
        HTTP_STATUS.OK,
        requestId
      );
    },
  };

  validation = {
    success: (res: Response, data: any, message: string, requestId?: string): Response<ApiResponse<any>> => {
      return this.success(res, data, message, HTTP_STATUS.OK, requestId);
    },

    failed: (res: Response, message: string, requestId?: string): Response<ApiResponse> => {
      return this.badRequest(res, message, undefined, requestId);
    },
  };
}

export const buildHiveResponse = new BuildHiveResponseUtil();
export type { ApiResponse, PaginatedResponse, PaginationMeta };
export default buildHiveResponse;
