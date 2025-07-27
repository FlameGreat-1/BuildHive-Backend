import { Request, Response } from 'express';
import { ApplicationService, MarketplaceService } from '../services';
import { 
  JobApplicationCreateData,
  JobApplicationUpdateData,
  JobApplicationSearchParams,
  ApplicationStatusUpdate,
  ApplicationWithdrawal
} from '../types';
import { ApplicationStatus, MarketplaceJobType } from '../../shared/types';
import { logger, createResponse } from '../../shared/utils';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export class ApplicationController {
  private applicationService: ApplicationService;
  private marketplaceService: MarketplaceService;

  constructor() {
    this.applicationService = new ApplicationService();
    this.marketplaceService = new MarketplaceService();
  }

  private convertUserIdToNumber(userId: string | undefined): number | undefined {
    return userId ? parseInt(userId, 10) : undefined;
  }

  createApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const applicationData: JobApplicationCreateData = req.body;
      const tradieId = this.convertUserIdToNumber(req.user?.id);

      const result = await this.applicationService.createApplication(applicationData, tradieId!);

      if (result.success) {
        logger.info('Job application created successfully', {
          applicationId: result.data?.id,
          tradieId,
          marketplaceJobId: applicationData.marketplaceJobId,
          creditsUsed: result.data?.creditsUsed
        });
      }

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      logger.error('Error in createApplication controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to create application', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = this.convertUserIdToNumber(req.user?.id);

      const result = await this.applicationService.getApplication(parseInt(applicationId), userId);

      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      logger.error('Error in getApplication controller', { 
        error, 
        applicationId: req.params.applicationId 
      });
      const response = createResponse(false, 'Failed to retrieve application', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getApplicationsByJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      const result = await this.applicationService.getApplicationsByJob(parseInt(jobId), clientId);

      res.status(result.success ? 200 : 403).json(result);
    } catch (error) {
      logger.error('Error in getApplicationsByJob controller', { 
        error, 
        jobId: req.params.jobId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to retrieve applications', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getTradieApplications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tradieId = this.convertUserIdToNumber(req.user?.id);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as ApplicationStatus | undefined;

      const result = await this.applicationService.getTradieApplications(tradieId!, {
        page,
        limit,
        status
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getTradieApplications controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to retrieve tradie applications', null, [error as any]);
      res.status(500).json(response);
    }
  };

  searchApplications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const searchParams: JobApplicationSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as ApplicationStatus | undefined,
        tradieId: req.query.tradieId ? parseInt(req.query.tradieId as string) : undefined,
        marketplaceJobId: req.query.marketplaceJobId ? parseInt(req.query.marketplaceJobId as string) : undefined,
        jobType: req.query.jobType as MarketplaceJobType | undefined,
        location: req.query.location as string,
        minQuote: req.query.minQuote ? parseFloat(req.query.minQuote as string) : undefined,
        maxQuote: req.query.maxQuote ? parseFloat(req.query.maxQuote as string) : undefined,
        dateRange: req.query.startDate && req.query.endDate ? {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string)
        } : undefined,
        query: req.query.query as string,
        sortBy: req.query.sortBy as 'application_timestamp' | 'custom_quote' | 'tradie_rating' | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await this.applicationService.searchApplications(searchParams);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in searchApplications controller', { error, query: req.query });
      const response = createResponse(false, 'Failed to search applications', null, [error as any]);
      res.status(500).json(response);
    }
  };

  updateApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const updateData: JobApplicationUpdateData = req.body;
      const tradieId = this.convertUserIdToNumber(req.user?.id);

      const result = await this.applicationService.updateApplication(
        parseInt(applicationId),
        updateData,
        tradieId!
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in updateApplication controller', { 
        error, 
        applicationId: req.params.applicationId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to update application', null, [error as any]);
      res.status(500).json(response);
    }
  };

  updateApplicationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const statusUpdate: ApplicationStatusUpdate = req.body;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      const result = await this.applicationService.updateApplicationStatus(
        parseInt(applicationId),
        statusUpdate,
        clientId
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in updateApplicationStatus controller', { 
        error, 
        applicationId: req.params.applicationId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to update application status', null, [error as any]);
      res.status(500).json(response);
    }
  };

  withdrawApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const withdrawalData: ApplicationWithdrawal = req.body;
      const tradieId = this.convertUserIdToNumber(req.user?.id);

      const result = await this.applicationService.withdrawApplication(
        parseInt(applicationId),
        tradieId!,
        withdrawalData
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in withdrawApplication controller', { 
        error, 
        applicationId: req.params.applicationId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to withdraw application', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getTradieApplicationHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tradieId = this.convertUserIdToNumber(req.user?.id);

      const result = await this.applicationService.getTradieApplicationHistory(tradieId!);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getTradieApplicationHistory controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to retrieve application history', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getApplicationAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tradieId = req.query.tradieId ? 
        parseInt(req.query.tradieId as string) : 
        this.convertUserIdToNumber(req.user?.id);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const groupBy = req.query.groupBy as 'day' | 'week' | 'month' | 'status';

      const params = {
        tradieId,
        startDate,
        endDate,
        groupBy
      };

      const result = await this.applicationService.getApplicationAnalytics(params);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getApplicationAnalytics controller', { error, query: req.query });
      const response = createResponse(false, 'Failed to retrieve analytics', null, [error as any]);
      res.status(500).json(response);
    }
  };

  bulkUpdateApplicationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { applicationIds, status, reason, feedback } = req.body;
      const clientId = this.convertUserIdToNumber(req.user?.id);

      const results = [];
      for (const applicationId of applicationIds) {
        try {
          const result = await this.applicationService.updateApplicationStatus(
            parseInt(applicationId),
            { newStatus: status, reason, feedback },
            clientId
          );
          results.push({ 
            applicationId, 
            success: result.success, 
            message: result.message 
          });
        } catch (error) {
          results.push({ 
            applicationId, 
            success: false, 
            message: 'Failed to update application status' 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const response = createResponse(
        true,
        `Updated ${successCount} of ${applicationIds.length} applications`,
        { results, successCount, totalCount: applicationIds.length }
      );

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in bulkUpdateApplicationStatus controller', { error, userId: req.user?.id });
      const response = createResponse(false, 'Failed to bulk update application status', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getApplicationsByStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.params;
      const userId = this.convertUserIdToNumber(req.user?.id);
      const userRole = req.user?.role;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const searchParams: JobApplicationSearchParams = {
        page,
        limit,
        status: status as ApplicationStatus | undefined,
        tradieId: userRole === 'tradie' ? userId : undefined
      };

      const result = await this.applicationService.searchApplications(searchParams);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error in getApplicationsByStatus controller', { 
        error, 
        status: req.params.status,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to retrieve applications by status', null, [error as any]);
      res.status(500).json(response);
    }
  };

  getApplicationMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = this.convertUserIdToNumber(req.user?.id);

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        const response = createResponse(false, 'Application not found', null);
        res.status(404).json(response);
        return;
      }

      const application = applicationResult.data;
      const metrics = {
        applicationId: parseInt(applicationId),
        submissionDate: application.applicationTimestamp,
        status: application.status,
        creditsUsed: application.credits_used,
        customQuote: application.custom_quote,
        proposedTimeline: application.proposed_timeline,
        competitorCount: 0,
        averageQuote: 0,
        rankPosition: 0,
        responseTime: 0
      };

      const jobApplicationsResult = await this.applicationService.getApplicationsByJob(
        application.marketplace_job_id, 
        userId
      );

      if (jobApplicationsResult.success && jobApplicationsResult.data) {
        const allApplications = jobApplicationsResult.data;
        metrics.competitorCount = allApplications.length;

        const quotes = allApplications
          .map(app => app.customQuote || 0)
          .filter(quote => quote > 0);
        
        if (quotes.length > 0) {
          metrics.averageQuote = quotes.reduce((sum, quote) => sum + quote, 0) / quotes.length;
        }
        
        const sortedByQuote = allApplications
          .filter(app => app.customQuote && app.customQuote > 0)
          .sort((a, b) => (a.customQuote || 0) - (b.customQuote || 0));
        
        metrics.rankPosition = sortedByQuote.findIndex(app => app.id === application.id) + 1;
      }

      const response = createResponse(true, 'Application metrics retrieved successfully', metrics);
      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getApplicationMetrics controller', { 
        error, 
        applicationId: req.params.applicationId,
        userId: req.user?.id 
      });
      const response = createResponse(false, 'Failed to retrieve application metrics', null, [error as any]);
      res.status(500).json(response);
    }
  };

  async destroy(): Promise<void> {
    try {
      await this.applicationService.destroy();
      await this.marketplaceService.destroy();
      logger.info('ApplicationController destroyed successfully');
    } catch (error) {
      logger.error('Error destroying ApplicationController', { error });
    }
  }
}

export const applicationController = new ApplicationController();

export const {
  createApplication,
  getApplication,
  getApplicationsByJob,
  getTradieApplications,
  searchApplications,
  updateApplication,
  updateApplicationStatus,
  withdrawApplication,
  getTradieApplicationHistory,
  getApplicationAnalytics,
  bulkUpdateApplicationStatus,
  getApplicationsByStatus,
  getApplicationMetrics
} = applicationController;
