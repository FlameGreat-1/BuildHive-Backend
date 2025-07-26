import { Request, Response } from 'express';
import { MarketplaceService } from '../services';
import { 
  validateJobCreation,
  validateJobUpdate,
  validateJobSearch,
  validateJobStatusUpdate,
  checkJobOwnership,
  checkJobAvailability,
  rateLimitJobCreation,
  rateLimitJobSearch,
  logJobActivity,
  validateClientRole,
  validateTradieRole,
  sanitizeJobData,
  validatePagination,
  checkJobDeletion,
  validateJobFilters,
  cacheJobData,
  trackJobViews,
  validateJobExpiry,
  requireJobAccess,
  validateBulkOperations
} from '../middleware';
import { 
  MarketplaceJobCreateData,
  MarketplaceJobUpdateData,
  MarketplaceJobSearchParams
} from '../types';
import { authenticate, authorize } from '../../shared/middleware';
import { logger, createApiResponse } from '../../shared/utils';
import { ApiResponse } from '../../shared/types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export class MarketplaceController {
  private marketplaceService: MarketplaceService;

  constructor() {
    this.marketplaceService = new MarketplaceService();
  }

  private convertUserIdToNumber(userId: string | undefined): number | undefined {
    return userId ? parseInt(userId, 10) : undefined;
  }

  createMarketplaceJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const jobData: MarketplaceJobCreateData = req.body;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      if (!clientId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      const result = await this.marketplaceService.createMarketplaceJob(jobData, clientId);

      if (result.success) {
        logger.info('Marketplace job created successfully', {
          jobId: result.data?.id,
          clientId,
          jobType: result.data?.jobType,
          location: result.data?.location
        });
      }

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      logger.error('Error in createMarketplaceJob controller', { error, userId: req.user?.id });
      const response = createApiResponse(false, 'Failed to create marketplace job', null, [error]);
      res.status(500).json(response);
    }
  };

  getMarketplaceJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const tradieId = this.convertUserIdToNumber(req.user?.id);

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      const result = await this.marketplaceService.getMarketplaceJob(parseInt(jobId), tradieId);

      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      logger.error('Error in getMarketplaceJob controller', { error, jobId: req.params.jobId });
      const response = createApiResponse(false, 'Failed to retrieve marketplace job', null, [error]);
      res.status(500).json(response);
    }
  };

  searchMarketplaceJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tradieId = this.convertUserIdToNumber(req.user?.id);
      
      const searchParams: MarketplaceJobSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        jobType: req.query.jobType as string,
        location: req.query.location as string,
        urgencyLevel: req.query.urgencyLevel as string,
        minBudget: req.query.minBudget ? parseFloat(req.query.minBudget as string) : undefined,
        maxBudget: req.query.maxBudget ? parseFloat(req.query.maxBudget as string) : undefined,
        dateRange: req.query.dateRange as string,
        excludeApplied: req.query.excludeApplied === 'true',
        tradieId: tradieId,
        searchTerm: req.query.searchTerm as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await this.marketplaceService.searchMarketplaceJobs(searchParams);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in searchMarketplaceJobs controller', { error, query: req.query });
      const response = createApiResponse(false, 'Failed to search marketplace jobs', null, [error]);
      res.status(500).json(response);
    }
  };

  updateMarketplaceJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const updateData: MarketplaceJobUpdateData = req.body;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      if (!clientId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      const result = await this.marketplaceService.updateMarketplaceJob(
        parseInt(jobId),
        updateData,
        clientId
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in updateMarketplaceJob controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createApiResponse(false, 'Failed to update marketplace job', null, [error]);
      res.status(500).json(response);
    }
  };

  updateJobStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { status, reason } = req.body;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      if (!clientId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      const result = await this.marketplaceService.updateJobStatus(
        parseInt(jobId),
        status,
        reason,
        clientId
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in updateJobStatus controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createApiResponse(false, 'Failed to update job status', null, [error]);
      res.status(500).json(response);
    }
  };

  deleteMarketplaceJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      if (!clientId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      const result = await this.marketplaceService.deleteMarketplaceJob(parseInt(jobId), clientId);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in deleteMarketplaceJob controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createApiResponse(false, 'Failed to delete marketplace job', null, [error]);
      res.status(500).json(response);
    }
  };

  getClientJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const clientId = this.convertUserIdToNumber(req.user?.id);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      if (!clientId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      const result = await this.marketplaceService.getClientJobs(clientId, {
        page,
        limit,
        status
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getClientJobs controller', { error, userId: req.user?.id });
      const response = createApiResponse(false, 'Failed to retrieve client jobs', null, [error]);
      res.status(500).json(response);
    }
  };

  getMarketplaceStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.marketplaceService.getMarketplaceStats();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in getMarketplaceStats controller', { error });
      const response = createApiResponse(false, 'Failed to retrieve marketplace stats', null, [error]);
      res.status(500).json(response);
    }
  };

  getJobCreditCost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      const result = await this.marketplaceService.getJobCreditCost(parseInt(jobId));

      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      logger.error('Error in getJobCreditCost controller', { error, jobId: req.params.jobId });
      const response = createApiResponse(false, 'Failed to calculate credit cost', null, [error]);
      res.status(500).json(response);
    }
  };

  getRecommendedJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tradieId = this.convertUserIdToNumber(req.user?.id);
      const limit = parseInt(req.query.limit as string) || 10;

      if (!tradieId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      const result = await this.marketplaceService.getRecommendedJobs(tradieId, limit);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getRecommendedJobs controller', { error, userId: req.user?.id });
      const response = createApiResponse(false, 'Failed to retrieve recommended jobs', null, [error]);
      res.status(500).json(response);
    }
  };

  processExpiredJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.marketplaceService.processExpiredJobs();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in processExpiredJobs controller', { error });
      const response = createApiResponse(false, 'Failed to process expired jobs', null, [error]);
      res.status(500).json(response);
    }
  };

  bulkUpdateJobStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobIds, status, reason } = req.body;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      if (!clientId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        const response = createApiResponse(false, 'Job IDs array is required', null);
        res.status(400).json(response);
        return;
      }

      const results = [];
      for (const jobId of jobIds) {
        try {
          const result = await this.marketplaceService.updateJobStatus(
            parseInt(jobId),
            status,
            reason,
            clientId
          );
          results.push({ jobId, success: result.success, message: result.message });
        } catch (error) {
          results.push({ jobId, success: false, message: 'Failed to update job status' });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const response = createApiResponse(
        true,
        `Updated ${successCount} of ${jobIds.length} jobs`,
        { results, successCount, totalCount: jobIds.length }
      );

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in bulkUpdateJobStatus controller', { error, userId: req.user?.id });
      const response = createApiResponse(false, 'Failed to bulk update job status', null, [error]);
      res.status(500).json(response);
    }
  };

  getMarketplaceAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const params = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        groupBy: req.query.groupBy as 'day' | 'week' | 'month' | 'jobType' | 'location' | undefined
      };

      const result = await this.marketplaceService.getMarketplaceAnalytics(params);

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in getMarketplaceAnalytics controller', { error });
      const response = createApiResponse(false, 'Failed to retrieve marketplace analytics', null, [error]);
      res.status(500).json(response);
    }
  };

  async destroy(): Promise<void> {
    try {
      await this.marketplaceService.destroy();
      logger.info('MarketplaceController destroyed successfully');
    } catch (error) {
      logger.error('Error destroying MarketplaceController', { error });
    }
  }
}

export const marketplaceController = new MarketplaceController();

export const {
  createMarketplaceJob,
  getMarketplaceJob,
  searchMarketplaceJobs,
  updateMarketplaceJob,
  updateJobStatus,
  deleteMarketplaceJob,
  getClientJobs,
  getMarketplaceStats,
  getJobCreditCost,
  getRecommendedJobs,
  processExpiredJobs,
  bulkUpdateJobStatus,
  getMarketplaceAnalytics
} = marketplaceController;
