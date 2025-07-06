import { Request, Response, NextFunction } from 'express';
import { JOB_CONSTANTS } from '../../config/jobs';
import { 
  sendErrorResponse, 
  sendNotFoundResponse,
  UnauthorizedJobAccessError,
  JobNotFoundError,
  logger 
} from '../../shared/utils';
import { jobRepository, clientRepository } from '../repositories';
import { Job, Client } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
  job?: Job;
  client?: Client;
}

export const requireJobOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      sendErrorResponse(res, 'Authentication required', 401);
      return;
    }

    const tradieId = parseInt(req.user.id);
    const jobId = parseInt(req.params.id || req.params.jobId);

    if (isNaN(jobId)) {
      sendErrorResponse(res, 'Invalid job ID', 400);
      return;
    }

    const job = await jobRepository.findById(jobId);

    if (!job) {
      sendNotFoundResponse(res, 'Job not found');
      return;
    }

    if (job.tradieId !== tradieId) {
      logger.warn('Unauthorized job access attempt', {
        tradieId,
        jobId,
        actualOwnerId: job.tradieId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      sendErrorResponse(res, 'You do not have permission to access this job', 403);
      return;
    }

    req.job = job;
    next();
  } catch (error: any) {
    logger.error('Job ownership verification failed', {
      tradieId: req.user?.id,
      jobId: req.params.id || req.params.jobId,
      error: error.message
    });

    sendErrorResponse(res, 'Failed to verify job ownership', 500);
  }
};

export const requireClientOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      sendErrorResponse(res, 'Authentication required', 401);
      return;
    }

    const tradieId = parseInt(req.user.id);
    const clientId = parseInt(req.params.id || req.params.clientId);

    if (isNaN(clientId)) {
      sendErrorResponse(res, 'Invalid client ID', 400);
      return;
    }

    const client = await clientRepository.findById(clientId);

    if (!client) {
      sendNotFoundResponse(res, 'Client not found');
      return;
    }

    if (client.tradieId !== tradieId) {
      logger.warn('Unauthorized client access attempt', {
        tradieId,
        clientId,
        actualOwnerId: client.tradieId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      sendErrorResponse(res, 'You do not have permission to access this client', 403);
      return;
    }

    req.client = client;
    next();
  } catch (error: any) {
    logger.error('Client ownership verification failed', {
      tradieId: req.user?.id,
      clientId: req.params.id || req.params.clientId,
      error: error.message
    });

    sendErrorResponse(res, 'Failed to verify client ownership', 500);
  }
};

export const requireTradieRole = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendErrorResponse(res, 'Authentication required', 401);
    return;
  }

  if (req.user.role !== 'tradie' && req.user.role !== 'enterprise') {
    logger.warn('Insufficient role for job access', {
      userId: req.user.id,
      userRole: req.user.role,
      requiredRole: 'tradie',
      ip: req.ip
    });

    sendErrorResponse(res, 'Insufficient permissions', 403);
    return;
  }

  next();
};

export const requireEnterpriseRole = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendErrorResponse(res, 'Authentication required', 401);
    return;
  }

  if (req.user.role !== 'enterprise') {
    logger.warn('Enterprise role required', {
      userId: req.user.id,
      userRole: req.user.role,
      requiredRole: 'enterprise',
      ip: req.ip
    });

    sendErrorResponse(res, 'Enterprise account required', 403);
    return;
  }

  next();
};
