import { Request, Response } from 'express';
import { MarketplaceService } from '../services';
import { 
  MarketplaceJobCreateData,
  MarketplaceJobUpdateData,
  MarketplaceJobSearchParams
} from '../types';
import { Marketplacejob_type, urgency_level } from '../../shared/types';
import { MarketplaceSortOption } from '../../config/feeds/constants';
import { logger, createResponse } from '../../shared/utils';

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
      const client_id = this.convertUserIdToNumber(req.user?.id);

      const result = await this.marketplaceService.createMarketplaceJob(jobData, client_id!);

      if (result.success) {
        logger.info('Marketplace job created successfully', {
          jobId: result.data?.id,
          client_id,
          job_type: result.data?.job_type,
          location: result.data?.location
        });
      }

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      logger.error('Error in createMarketplaceJob controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to create marketplace job', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getMarketplaceJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const tradie_id = this.convertUserIdToNumber(req.user?.id);

      const result = await this.marketplaceService.getMarketplaceJob(parseInt(jobId), tradie_id);

      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      logger.error('Error in getMarketplaceJob controller', { error, jobId: req.params.jobId });
      const response = createResponse(false, 'Failed to retrieve marketplace job', null, [error as any]);
      res.status(500).json(response);
    }
  };

  searchMarketplaceJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tradie_id = this.convertUserIdToNumber(req.user?.id);
      
      const searchParams: MarketplaceJobSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        job_type: req.query.job_type as Marketplacejob_type | undefined,
        location: req.query.location as string,
        urgency_level: req.query.urgency_level as urgency_level | undefined,
        minBudget: req.query.minBudget ? parseFloat(req.query.minBudget as string) : undefined,
        maxBudget: req.query.maxBudget ? parseFloat(req.query.maxBudget as string) : undefined,
        dateRange: req.query.startDate && req.query.endDate ? {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string)
        } : undefined,
        excludeApplied: req.query.excludeApplied === 'true',
        tradie_id: tradie_id,
        searchTerm: req.query.searchTerm as string,
        sortBy: req.query.sortBy as MarketplaceSortOption | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await this.marketplaceService.searchMarketplaceJobs(searchParams);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in searchMarketplaceJobs controller', { error, query: req.query });
      const response = createResponse(false, 'Failed to search marketplace jobs', null, [error as any]);
      res.status(500).json(response);
    }
  };

  updateMarketplaceJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const updateData: MarketplaceJobUpdateData = req.body;
      const client_id = this.convertUserIdToNumber(req.user?.id);

      const result = await this.marketplaceService.updateMarketplaceJob(
        parseInt(jobId),
        updateData,
        client_id!
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in updateMarketplaceJob controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to update marketplace job', null, [error as any]);
      res.status(500).json(response);
    }
  };

  updateJobStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { status, reason } = req.body;
      const client_id = this.convertUserIdToNumber(req.user?.id);

      const result = await this.marketplaceService.updateJobStatus(
        parseInt(jobId),
        status,
        reason,
        client_id!
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in updateJobStatus controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to update job status', null, [error as any]);
      res.status(500).json(response);
    }
  };

  deleteMarketplaceJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const client_id = this.convertUserIdToNumber(req.user?.id);

      const result = await this.marketplaceService.deleteMarketplaceJob(parseInt(jobId), client_id!);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in deleteMarketplaceJob controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to delete marketplace job', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getClientJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const client_id = this.convertUserIdToNumber(req.user?.id);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const result = await this.marketplaceService.getClientJobs(client_id!, {
        page,
        limit,
        status
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getClientJobs controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to retrieve client jobs', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getMarketplaceStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.marketplaceService.getMarketplaceStats();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in getMarketplaceStats controller', { error });
      const response = createResponse(false, 'Failed to retrieve marketplace stats', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getJobCreditCost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      const result = await this.marketplaceService.getJobCreditCost(parseInt(jobId));

      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      logger.error('Error in getJobCreditCost controller', { error, jobId: req.params.jobId });
      const response = createResponse(false, 'Failed to calculate credit cost', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getRecommendedJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tradie_id = this.convertUserIdToNumber(req.user?.id);
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.marketplaceService.getRecommendedJobs(tradie_id!, limit);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getRecommendedJobs controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to retrieve recommended jobs', null, [error as any]);
      res.status(500).json(response);
    }
  };

  processExpiredJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.marketplaceService.processExpiredJobs();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in processExpiredJobs controller', { error });
      const response = createResponse(false, 'Failed to process expired jobs', null, [error as any]);
      res.status(500).json(response);
    }
  };

  bulkUpdateJobStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobIds, status, reason } = req.body;
      const client_id = this.convertUserIdToNumber(req.user?.id);

      const results = [];
      for (const jobId of jobIds) {
        try {
          const result = await this.marketplaceService.updateJobStatus(
            parseInt(jobId),
            status,
            reason,
            client_id!
          );
          results.push({ jobId, success: result.success, message: result.message });
        } catch (error) {
          results.push({ jobId, success: false, message: 'Failed to update job status' });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const response = createResponse(
        true,
        `Updated ${successCount} of ${jobIds.length} jobs`,
        { results, successCount, totalCount: jobIds.length }
      );

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in bulkUpdateJobStatus controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to bulk update job status', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getMarketplaceAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const params = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        groupBy: req.query.groupBy as 'day' | 'week' | 'month' | 'job_type' | 'location' | undefined
      };

      const result = await this.marketplaceService.getMarketplaceStats();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in getMarketplaceAnalytics controller', { error });
      const response = createResponse(false, 'Failed to retrieve marketplace analytics', null, [error as any]);
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
