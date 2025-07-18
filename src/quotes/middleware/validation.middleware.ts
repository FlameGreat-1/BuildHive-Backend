import { Request, Response, NextFunction } from 'express';
import { 
  QuoteCreateData, 
  QuoteUpdateData, 
  QuoteStatusUpdateData, 
  QuoteDeliveryData,
  AIPricingRequest 
} from '../types';
import { validateQuoteItems, sanitizeQuoteInput, validateQuoteStatusTransition } from '../utils';
import { QUOTE_CONSTANTS } from '../../config/quotes';
import { ValidationError } from '../../shared/types';
import { createErrorResponse, logger, AppError } from '../../shared/utils';  
import { HTTP_STATUS_CODES } from '../../config/auth/constants';
import { QuoteStatus, DeliveryMethod, QuoteItemType, MaterialUnit } from '../../shared/types/database.types';

const sendValidationError = (res: Response, message: string, errors: ValidationError[]): void => {
  const error = new AppError(message, HTTP_STATUS_CODES.BAD_REQUEST, 'VALIDATION_ERROR');
  res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(
    createErrorResponse(error, res.locals.requestId || 'unknown')
  );
};

export const validateCreateQuote = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const errors: ValidationError[] = [];
  const data: QuoteCreateData = req.body;

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push({
      field: 'title',
      message: 'Quote title is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (data.title && data.title.length > QUOTE_CONSTANTS.MAX_TITLE_LENGTH) {
    errors.push({
      field: 'title',
      message: `Quote title cannot exceed ${QUOTE_CONSTANTS.MAX_TITLE_LENGTH} characters`,
      code: 'FIELD_TOO_LONG'
    });
  }

  if (data.description && data.description.length > QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH) {
    errors.push({
      field: 'description',
      message: `Quote description cannot exceed ${QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters`,
      code: 'FIELD_TOO_LONG'
    });
  }

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.push({
      field: 'items',
      message: 'At least one quote item is required',
      code: 'REQUIRED_FIELD'
    });
  } else {
    try {
      const itemErrors = validateQuoteItems(data.items);
      itemErrors.forEach(error => {
        errors.push({
          field: 'items',
          message: error,
          code: 'VALIDATION_ERROR'
        });
      });
    } catch (error) {
      errors.push({
        field: 'items',
        message: 'Invalid quote items format',
        code: 'VALIDATION_ERROR'
      });
    }
  }

  if (!data.validUntil) {
    errors.push({
      field: 'validUntil',
      message: 'Quote valid until date is required',
      code: 'REQUIRED_FIELD'
    });
  } else {
    const validUntilDate = new Date(data.validUntil);
    const now = new Date();
    
    if (isNaN(validUntilDate.getTime())) {
      errors.push({
        field: 'validUntil',
        message: 'Invalid valid until date format',
        code: 'INVALID_FORMAT'
      });
    } else if (validUntilDate <= now) {
      errors.push({
        field: 'validUntil',
        message: 'Quote valid until date must be in the future',
        code: 'INVALID_VALUE'
      });
    }
  }

  if (data.clientId && (typeof data.clientId !== 'number' || data.clientId <= 0)) {
    errors.push({
      field: 'clientId',
      message: 'Valid client ID is required',
      code: 'INVALID_VALUE'
    });
  }

  if (data.jobId && (typeof data.jobId !== 'number' || data.jobId <= 0)) {
    errors.push({
      field: 'jobId',
      message: 'Valid job ID is required',
      code: 'INVALID_VALUE'
    });
  }

  if (data.gstEnabled !== undefined && typeof data.gstEnabled !== 'boolean') {
    errors.push({
      field: 'gstEnabled',
      message: 'GST enabled must be a boolean value',
      code: 'INVALID_TYPE'
    });
  }

  if (data.termsConditions && data.termsConditions.length > QUOTE_CONSTANTS.MAX_TERMS_CONDITIONS_LENGTH) {
    errors.push({
      field: 'termsConditions',
      message: `Terms and conditions cannot exceed ${QUOTE_CONSTANTS.MAX_TERMS_CONDITIONS_LENGTH} characters`,
      code: 'FIELD_TOO_LONG'
    });
  }

  if (data.notes && data.notes.length > QUOTE_CONSTANTS.MAX_NOTES_LENGTH) {
    errors.push({
      field: 'notes',
      message: `Notes cannot exceed ${QUOTE_CONSTANTS.MAX_NOTES_LENGTH} characters`,
      code: 'FIELD_TOO_LONG'
    });
  }

  if (errors.length > 0) {
    logger.warn('Quote creation validation failed', {
      requestId,
      userId: (req as any).user?.id,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Quote validation failed', errors);
  }

  try {
    if (data.title) {
      req.body.title = sanitizeQuoteInput(data.title);
    }

    if (data.description) {
      req.body.description = sanitizeQuoteInput(data.description);
    }

    if (data.termsConditions) {
      req.body.termsConditions = sanitizeQuoteInput(data.termsConditions);
    }

    if (data.notes) {
      req.body.notes = sanitizeQuoteInput(data.notes);
    }
  } catch (error) {
    logger.error('Error sanitizing quote input', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  next();
};

export const validateUpdateQuote = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const errors: ValidationError[] = [];
  const data: QuoteUpdateData = req.body;

  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push({
        field: 'title',
        message: 'Quote title must be a non-empty string',
        code: 'INVALID_TYPE'
      });
    } else if (data.title.length > QUOTE_CONSTANTS.MAX_TITLE_LENGTH) {
      errors.push({
        field: 'title',
        message: `Quote title cannot exceed ${QUOTE_CONSTANTS.MAX_TITLE_LENGTH} characters`,
        code: 'FIELD_TOO_LONG'
      });
    }
  }

  if (data.description !== undefined && data.description.length > QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH) {
    errors.push({
      field: 'description',
      message: `Quote description cannot exceed ${QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters`,
      code: 'FIELD_TOO_LONG'
    });
  }

  if (data.items !== undefined) {
    if (!Array.isArray(data.items)) {
      errors.push({
        field: 'items',
        message: 'Quote items must be an array',
        code: 'INVALID_TYPE'
      });
    } else if (data.items.length === 0) {
      errors.push({
        field: 'items',
        message: 'At least one quote item is required',
        code: 'REQUIRED_FIELD'
      });
    } else {
      try {
        const createItems = data.items.map(item => ({
          itemType: item.itemType || QuoteItemType.LABOUR,
          description: item.description || '',
          quantity: item.quantity || 0,
          unit: item.unit || MaterialUnit.PIECE,
          unitPrice: item.unitPrice || 0
        }));
        const itemErrors = validateQuoteItems(createItems);
        itemErrors.forEach(error => {
          errors.push({
            field: 'items',
            message: error,
            code: 'VALIDATION_ERROR'
          });
        });
      } catch (error) {
        errors.push({
          field: 'items',
          message: 'Invalid quote items format',
          code: 'VALIDATION_ERROR'
        });
      }
    }
  }

  if (data.validUntil !== undefined) {
    const validUntilDate = new Date(data.validUntil);
    const now = new Date();
    
    if (isNaN(validUntilDate.getTime())) {
      errors.push({
        field: 'validUntil',
        message: 'Invalid valid until date format',
        code: 'INVALID_FORMAT'
      });
    } else if (validUntilDate <= now) {
      errors.push({
        field: 'validUntil',
        message: 'Quote valid until date must be in the future',
        code: 'INVALID_VALUE'
      });
    }
  }

  if (data.gstEnabled !== undefined && typeof data.gstEnabled !== 'boolean') {
    errors.push({
      field: 'gstEnabled',
      message: 'GST enabled must be a boolean value',
      code: 'INVALID_TYPE'
    });
  }

  if (errors.length > 0) {
    logger.warn('Quote update validation failed', {
      requestId,
      userId: (req as any).user?.id,
      quoteId: req.params.quoteId,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Quote update validation failed', errors);
  }

  try {
    if (data.title) {
      req.body.title = sanitizeQuoteInput(data.title);
    }

    if (data.description) {
      req.body.description = sanitizeQuoteInput(data.description);
    }

    if (data.termsConditions) {
      req.body.termsConditions = sanitizeQuoteInput(data.termsConditions);
    }

    if (data.notes) {
      req.body.notes = sanitizeQuoteInput(data.notes);
    }
  } catch (error) {
    logger.error('Error sanitizing quote input', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  next();
};

export const validateQuoteStatusUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const errors: ValidationError[] = [];
  const data: QuoteStatusUpdateData = req.body;

  const validStatuses: QuoteStatus[] = [
    QuoteStatus.DRAFT,
    QuoteStatus.SENT,
    QuoteStatus.VIEWED,
    QuoteStatus.ACCEPTED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
    QuoteStatus.CANCELLED
  ];

  if (!data.status) {
    errors.push({
      field: 'status',
      message: 'Quote status is required',
      code: 'REQUIRED_FIELD'
    });
  } else if (!validStatuses.includes(data.status)) {
    errors.push({
      field: 'status',
      message: 'Invalid quote status',
      code: 'INVALID_VALUE'
    });
  }

  if (data.reason && typeof data.reason !== 'string') {
    errors.push({
      field: 'reason',
      message: 'Reason must be a string',
      code: 'INVALID_TYPE'
    });
  }

  if (errors.length > 0) {
    logger.warn('Quote status update validation failed', {
      requestId,
      userId: (req as any).user?.id,
      quoteId: req.params.quoteId,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Quote status update validation failed', errors);
  }

  next();
};

export const validateQuoteDelivery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const errors: ValidationError[] = [];
  const data: QuoteDeliveryData = req.body;

  if (!data.deliveryMethods || !Array.isArray(data.deliveryMethods) || data.deliveryMethods.length === 0) {
    errors.push({
      field: 'deliveryMethods',
      message: 'At least one delivery method is required',
      code: 'REQUIRED_FIELD'
    });
  } else {
    const validMethods: DeliveryMethod[] = [
      DeliveryMethod.EMAIL,
      DeliveryMethod.SMS,
      DeliveryMethod.PDF,
      DeliveryMethod.PORTAL
    ];
    const invalidMethods = data.deliveryMethods.filter(method => !validMethods.includes(method));
    
    if (invalidMethods.length > 0) {
      errors.push({
        field: 'deliveryMethods',
        message: `Invalid delivery methods: ${invalidMethods.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }

    if (data.deliveryMethods.includes(DeliveryMethod.EMAIL) && !data.recipientEmail) {
      errors.push({
        field: 'recipientEmail',
        message: 'Recipient email is required for email delivery',
        code: 'REQUIRED_FIELD'
      });
    }

    if (data.deliveryMethods.includes(DeliveryMethod.SMS) && !data.recipientPhone) {
      errors.push({
        field: 'recipientPhone',
        message: 'Recipient phone is required for SMS delivery',
        code: 'REQUIRED_FIELD'
      });
    }
  }

  if (data.recipientEmail && typeof data.recipientEmail === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.recipientEmail)) {
      errors.push({
        field: 'recipientEmail',
        message: 'Invalid email format',
        code: 'INVALID_FORMAT'
      });
    }
  }

  if (data.recipientPhone && typeof data.recipientPhone === 'string') {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(data.recipientPhone)) {
      errors.push({
        field: 'recipientPhone',
        message: 'Invalid phone number format',
        code: 'INVALID_FORMAT'
      });
    }
  }

  if (errors.length > 0) {
    logger.warn('Quote delivery validation failed', {
      requestId,
      userId: (req as any).user?.id,
      quoteId: req.params.quoteId,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Quote delivery validation failed', errors);
  }

  next();
};

export const validateAIPricingRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const errors: ValidationError[] = [];
  const data: AIPricingRequest = req.body;

  if (!data.jobDescription || typeof data.jobDescription !== 'string' || data.jobDescription.trim().length < 10) {
    errors.push({
      field: 'jobDescription',
      message: 'Job description must be at least 10 characters long',
      code: 'FIELD_TOO_SHORT'
    });
  }

  if (!data.jobType || typeof data.jobType !== 'string' || data.jobType.trim().length === 0) {
    errors.push({
      field: 'jobType',
      message: 'Job type is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (!data.tradieHourlyRate || typeof data.tradieHourlyRate !== 'number' || data.tradieHourlyRate <= 0) {
    errors.push({
      field: 'tradieHourlyRate',
      message: 'Valid tradie hourly rate is required',
      code: 'INVALID_VALUE'
    });
  }

  if (data.estimatedDuration !== undefined && (typeof data.estimatedDuration !== 'number' || data.estimatedDuration <= 0)) {
    errors.push({
      field: 'estimatedDuration',
      message: 'Estimated duration must be a positive number',
      code: 'INVALID_VALUE'
    });
  }

  if (errors.length > 0) {
    logger.warn('AI pricing request validation failed', {
      requestId,
      userId: (req as any).user?.id,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'AI pricing request validation failed', errors);
  }

  try {
    if (data.jobDescription) {
      req.body.jobDescription = sanitizeQuoteInput(data.jobDescription);
    }

    if (data.jobType) {
      req.body.jobType = sanitizeQuoteInput(data.jobType);
    }
  } catch (error) {
    logger.error('Error sanitizing AI pricing input', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  next();
};

export const validateQuoteId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const quoteId = parseInt(req.params.quoteId);
  
  if (isNaN(quoteId) || quoteId <= 0) {
    const requestId = res.locals.requestId || 'unknown';
    
    logger.warn('Invalid quote ID provided', {
      requestId,
      userId: (req as any).user?.id,
      providedId: req.params.quoteId,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Invalid quote ID', [{
      field: 'quoteId',
      message: 'Quote ID must be a positive number',
      code: 'INVALID_VALUE'
    }]);
  }

  req.params.quoteId = quoteId.toString();
  next();
};

export const validatePaymentMethodId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const errors: ValidationError[] = [];
  const { paymentMethodId } = req.body;

  if (!paymentMethodId || typeof paymentMethodId !== 'string' || paymentMethodId.trim().length === 0) {
    errors.push({
      field: 'paymentMethodId',
      message: 'Payment method ID is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (errors.length > 0) {
    logger.warn('Payment method validation failed', {
      requestId,
      userId: (req as any).user?.id,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Payment method validation failed', errors);
  }

  next();
};

export const validateRefundRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const errors: ValidationError[] = [];
  const { amount, reason } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    errors.push({
      field: 'amount',
      message: 'Valid refund amount is required',
      code: 'INVALID_VALUE'
    });
  }

  if (amount && amount > 999999.99) {
    errors.push({
      field: 'amount',
      message: 'Refund amount cannot exceed $999,999.99',
      code: 'FIELD_TOO_LARGE'
    });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    errors.push({
      field: 'reason',
      message: 'Refund reason is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (reason && reason.length > 500) {
    errors.push({
      field: 'reason',
      message: 'Refund reason cannot exceed 500 characters',
      code: 'FIELD_TOO_LONG'
    });
  }

  if (errors.length > 0) {
    logger.warn('Refund request validation failed', {
      requestId,
      userId: (req as any).user?.id,
      quoteId: req.params.quoteId,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Refund request validation failed', errors);
  }

  try {
    if (reason) {
      req.body.reason = sanitizeQuoteInput(reason);
    }
  } catch (error) {
    logger.error('Error sanitizing refund reason', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  next();
};

export const validateQuoteNumber = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const quoteNumber = req.params.quoteNumber;
  
  if (!quoteNumber || typeof quoteNumber !== 'string' || quoteNumber.trim().length === 0) {
    const requestId = res.locals.requestId || 'unknown';
    
    logger.warn('Invalid quote number provided', {
      requestId,
      userId: (req as any).user?.id,
      providedNumber: quoteNumber,
      timestamp: new Date().toISOString()
    });

    return sendValidationError(res, 'Invalid quote number', [{
      field: 'quoteNumber',
      message: 'Quote number is required',
      code: 'REQUIRED_FIELD'
    }]);
  }

  next();
};
