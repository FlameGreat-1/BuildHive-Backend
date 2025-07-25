import { Request, Response } from 'express';
import { MarketplaceService } from '../services';
import { 
  marketplaceMiddleware,
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
import { logger, createApiResponse, validateRequest } from '../../shared/utils';
import { ApiResponse } from '../../shared/types';

export class MarketplaceController {
  private marketplaceService: MarketplaceService;

  constructor() {
    this.marketplaceService = new MarketplaceService();
  }

  createMarketplaceJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const jobData: MarketplaceJobCreateData = req.body;
      const clientId = req.user?.id;

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

  getMarketplaceJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const tradieId = req.user?.id;

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

  searchMarketplaceJobs = async (req: Request, res: Response): Promise<void> => {
    try {
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
        tradieId: req.user?.id,
        searchTerm: req.query.searchTerm as string
      };

      const result = await this.marketplaceService.searchMarketplaceJobs(searchParams);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in searchMarketplaceJobs controller', { error, query: req.query });
      const response = createApiResponse(false, 'Failed to search marketplace jobs', null, [error]);
      res.status(500).json(response);
    }
  };

  updateMarketplaceJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const updateData: MarketplaceJobUpdateData = req.body;
      const clientId = req.user?.id;

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

  updateJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { status, reason } = req.body;
      const clientId = req.user?.id;

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
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

  deleteMarketplaceJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const clientId = req.user?.id;

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

  getClientJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const clientId = req.user?.id;
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

  getMarketplaceStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.marketplaceService.getMarketplaceStats();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in getMarketplaceStats controller', { error });
      const response = createApiResponse(false, 'Failed to retrieve marketplace stats', null, [error]);
      res.status(500).json(response);
    }
  };

  getJobCreditCost = async (req: Request, res: Response): Promise<void> => {
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

  getRecommendedJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const tradieId = req.user?.id;
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

  processExpiredJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.marketplaceService.processExpiredJobs();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in processExpiredJobs controller', { error });
      const response = createApiResponse(false, 'Failed to process expired jobs', null, [error]);
      res.status(500).json(response);
    }
  };

  bulkUpdateJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobIds, status, reason } = req.body;
      const clientId = req.user?.id;

      if (!clientId) {
        const response = createApiResponse(false, 'Authentication required', null);
        res.status(401).json(response);
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

  getJobApplications = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const clientId = req.user?.id;

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        const response = createApiResponse(false, 'Job not found', null);
        res.status(404).json(response);
        return;
      }

      if (clientId && jobResult.data.job.clientId !== clientId) {
        const response = createApiResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      const response = createApiResponse(
        true,
        'Job applications retrieved successfully',
        jobResult.data.applications || []
      );

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getJobApplications controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createApiResponse(false, 'Failed to retrieve job applications', null, [error]);
      res.status(500).json(response);
    }
  };

  getJobAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const clientId = req.user?.id;

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createApiResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        const response = createApiResponse(false, 'Job not found', null);
        res.status(404).json(response);
        return;
      }

      if (clientId && jobResult.data.job.clientId !== clientId) {
        const response = createApiResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      const analytics = {
        jobId: parseInt(jobId),
        totalApplications: jobResult.data.applicationCount || 0,
        viewCount: jobResult.data.job.viewCount || 0,
        averageQuote: jobResult.data.applications?.reduce((sum, app) => sum + (app.customQuote || 0), 0) / (jobResult.data.applications?.length || 1) || 0,
        applicationsByStatus: jobResult.data.applications?.reduce((acc, app) => {
          acc[app.status] = (acc[app.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        createdAt: jobResult.data.job.createdAt,
        lastApplicationAt: jobResult.data.applications?.[0]?.applicationTimestamp
      };

      const response = createApiResponse(true, 'Job analytics retrieved successfully', analytics);
      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getJobAnalytics controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createApiResponse(false, 'Failed to retrieve job analytics', null, [error]);
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
  getJobApplications,
  getJobAnalytics
} = marketplaceController;
