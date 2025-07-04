import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { JOB_CONSTANTS } from '../../config/jobs';
import { sendValidationError, ValidationError, logger } from '../../shared/utils';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors: ValidationError[] = errors.array().map(error => ({
      field: error.param || error.type || 'unknown',
      message: error.msg,
      code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
    }));

    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: validationErrors,
      tradieId: (req as any).user?.id,
      body: req.body
    });

    sendValidationError(res, 'Validation failed', validationErrors);
    return;
  }

  next();
};

export const validateJobId = (req: Request, res: Response, next: NextFunction): void => {
  const jobId = parseInt(req.params.id || req.params.jobId);

  if (isNaN(jobId) || jobId <= 0) {
    sendValidationError(res, 'Invalid job ID', [{
      field: 'id',
      message: 'Job ID must be a valid positive number',
      code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
    }]);
    return;
  }

  next();
};

export const validateClientId = (req: Request, res: Response, next: NextFunction): void => {
  const clientId = parseInt(req.params.id || req.params.clientId);

  if (isNaN(clientId) || clientId <= 0) {
    sendValidationError(res, 'Invalid client ID', [{
      field: 'id',
      message: 'Client ID must be a valid positive number',
      code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
    }]);
    return;
  }

  next();
};

export const validateMaterialId = (req: Request, res: Response, next: NextFunction): void => {
  const materialId = parseInt(req.params.materialId || req.params.id);

  if (isNaN(materialId) || materialId <= 0) {
    sendValidationError(res, 'Invalid material ID', [{
      field: 'materialId',
      message: 'Material ID must be a valid positive number',
      code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
    }]);
    return;
  }

  next();
};

export const validateAttachmentId = (req: Request, res: Response, next: NextFunction): void => {
  const attachmentId = parseInt(req.params.attachmentId || req.params.id);

  if (isNaN(attachmentId) || attachmentId <= 0) {
    sendValidationError(res, 'Invalid attachment ID', [{
      field: 'attachmentId',
      message: 'Attachment ID must be a valid positive number',
      code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
    }]);
    return;
  }

  next();
};

export const validatePaginationParams = (req: Request, res: Response, next: NextFunction): void => {
  const errors: ValidationError[] = [];

  if (req.query.page) {
    const page = parseInt(req.query.page as string);
    if (isNaN(page) || page < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be a positive number',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }
  }

  if (req.query.limit) {
    const limit = parseInt(req.query.limit as string);
    if (isNaN(limit) || limit < 1 || limit > JOB_CONSTANTS.PAGINATION.MAX_LIMIT) {
      errors.push({
        field: 'limit',
        message: `Limit must be between 1 and ${JOB_CONSTANTS.PAGINATION.MAX_LIMIT}`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }
  }

  if (errors.length > 0) {
    sendValidationError(res, 'Invalid pagination parameters', errors);
    return;
  }

  next();
};
