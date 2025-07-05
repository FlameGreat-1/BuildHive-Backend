import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { JOB_CONSTANTS } from '../../config/jobs';
import { sendErrorResponse, logger } from '../../shared/utils';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), JOB_CONSTANTS.FILE_UPLOAD.UPLOAD_PATH);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `job-${req.params.id || 'attachment'}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = JOB_CONSTANTS.FILE_TYPES.ALLOWED_MIME_TYPES as readonly string[];
  
  if (allowedTypes.includes(file.mimetype as any)) {
    cb(null, true);
  } else {
    logger.warn('File upload rejected - invalid type', {
      filename: file.originalname,
      mimetype: file.mimetype,
      allowedTypes: allowedTypes,
      tradieId: (req as any).user?.id
    });

    cb(new Error(`Invalid file type. Allowed types: ${JOB_CONSTANTS.FILE_TYPES.ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

export const uploadJobAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: JOB_CONSTANTS.VALIDATION.MAX_FILE_SIZE,
    files: JOB_CONSTANTS.VALIDATION.MAX_FILES_PER_JOB
  }
}).single('attachment');

export const uploadMultipleJobAttachments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: JOB_CONSTANTS.VALIDATION.MAX_FILE_SIZE,
    files: JOB_CONSTANTS.VALIDATION.MAX_FILES_PER_JOB
  }
}).array('attachments', JOB_CONSTANTS.VALIDATION.MAX_FILES_PER_JOB);

export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    logger.error('File upload error', {
      error: error.message,
      code: error.code,
      field: error.field,
      tradieId: (req as any).user?.id,
      filename: req.file?.originalname
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        sendErrorResponse(res, `File too large. Maximum size: ${JOB_CONSTANTS.VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`, 400);
        break;
      case 'LIMIT_FILE_COUNT':
        sendErrorResponse(res, `Too many files. Maximum: ${JOB_CONSTANTS.VALIDATION.MAX_FILES_PER_JOB}`, 400);
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        sendErrorResponse(res, 'Unexpected file field', 400);
        break;
      default:
        sendErrorResponse(res, 'File upload failed', 400);
    }
    return;
  }

  if (error.message.includes('Invalid file type')) {
    sendErrorResponse(res, error.message, 400);
    return;
  }

  next(error);
};
