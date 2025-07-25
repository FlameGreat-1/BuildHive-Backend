import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { ApplicationRepository, MarketplaceRepository } from '../repositories';
import { 
  JobApplicationEntity,
  JobApplicationCreateData,
  JobApplicationUpdateData,
  JobApplicationSummary,
  JobApplicationDetails,
  JobApplicationSearchParams,
  JobApplicationFilters,
  ApplicationStatusUpdate,
  ApplicationWithdrawal,
  TradieApplicationHistory,
  ApplicationAnalytics
} from '../types';
import {
  APPLICATION_STATUS,
  MARKETPLACE_JOB_STATUS,
  MARKETPLACE_LIMITS,
  MARKETPLACE_CREDIT_COSTS
} from '../../config/feeds';
import { 
  validateApplicationData,
  sanitizeApplicationData,
  canWithdrawApplication,
  canModifyApplication,
  calculateApplicationScore,
  rankApplications,
  validateApplicationStatusTransition
} from '../utils';
import { logger, createApiResponse } from '../../shared/utils';
import { DatabaseError, ApiResponse } from '../../shared/types';

export class ApplicationService extends EventEmitter {
  private applicationRepository: ApplicationRepository;
  private marketplaceRepository: MarketplaceRepository;
  private redis: Redis;
  private readonly REDIS_CHANNELS = {
    APPLICATION_CREATED: 'marketplace:application:created',
    APPLICATION_UPDATED: 'marketplace:application:updated',
    APPLICATION_STATUS_CHANGED: 'marketplace:application:status_changed',
    APPLICATION_WITHDRAWN: 'marketplace:application:withdrawn',
    APPLICATION_SELECTED: 'marketplace:application:selected',
    APPLICATION_REJECTED: 'marketplace:application:rejected'
  };

  constructor() {
    super();
    this.applicationRepository = new ApplicationRepository();
    this.marketplaceRepository = new MarketplaceRepository();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
    this.setupEventListeners();
  }

  async createApplication(
    applicationData: JobApplicationCreateData, 
    tradieId: number
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const validationResult = validateApplicationData(applicationData);
      if (!validationResult.isValid) {
        return createApiResponse(false, 'Validation failed', null, validationResult.errors);
      }

      const sanitizedData = sanitizeApplicationData(applicationData);

      const marketplaceJob = await this.marketplaceRepository.findJobById(sanitizedData.marketplaceJobId);
      if (!marketplaceJob) {
        return createApiResponse(false, 'Job not found', null);
      }

      if (marketplaceJob.status !== MARKETPLACE_JOB_STATUS.AVAILABLE) {
        return createApiResponse(false, 'Job is no longer available for applications', null);
      }

      if (marketplaceJob.isExpired) {
        return createApiResponse(false, 'Job has expired', null);
      }

      const application = await this.applicationRepository.createApplication(sanitizedData, tradieId);

      await this.publishApplicationCreatedEvent(application, marketplaceJob);
      await this.notifyClientOfNewApplication(application, marketplaceJob);
      await this.updateTradieApplicationStats(tradieId);

      logger.info('Job application created successfully', {
        applicationId: application.id,
        tradieId,
        marketplaceJobId: sanitizedData.marketplaceJobId,
        creditsUsed: application.creditsUsed
      });

      return createApiResponse(true, 'Application submitted successfully', application);
    } catch (error) {
      logger.error('Error creating job application', { error, applicationData, tradieId });
      return createApiResponse(false, 'Failed to submit application', null, [error]);
    }
  }

  async getApplication(id: number, userId?: number): Promise<ApiResponse<JobApplicationDetails>> {
    try {
      const applicationDetails = await this.applicationRepository.findApplicationDetails(id);
      
      if (!applicationDetails) {
        return createApiResponse(false, 'Application not found', null);
      }

      if (userId && !this.canUserAccessApplication(applicationDetails, userId)) {
        return createApiResponse(false, 'Unauthorized access', null);
      }

      logger.debug('Application retrieved', { applicationId: id, userId });

      return createApiResponse(true, 'Application retrieved successfully', applicationDetails);
    } catch (error) {
      logger.error('Error getting application', { error, applicationId: id });
      return createApiResponse(false, 'Failed to retrieve application', null, [error]);
    }
  }

  async getApplicationsByJob(
    marketplaceJobId: number, 
    clientId?: number
  ): Promise<ApiResponse<JobApplicationSummary[]>> {
    try {
      if (clientId) {
        const jobOwnership = await this.marketplaceRepository.validateJobOwnership(marketplaceJobId, clientId);
        if (!jobOwnership) {
          return createApiResponse(false, 'Unauthorized access', null);
        }
      }

      const applications = await this.applicationRepository.findApplicationsByJob(marketplaceJobId);
      const rankedApplications = rankApplications(applications);

      logger.debug('Applications by job retrieved', {
        marketplaceJobId,
        count: rankedApplications.length
      });

      return createApiResponse(true, 'Applications retrieved successfully', rankedApplications);
    } catch (error) {
      logger.error('Error getting applications by job', { error, marketplaceJobId });
      return createApiResponse(false, 'Failed to retrieve applications', null, [error]);
    }
  }

  async getTradieApplications(
    tradieId: number, 
    params: { page: number; limit: number; status?: string }
  ): Promise<ApiResponse<{
    applications: JobApplicationSummary[];
    totalCount: number;
    hasMore: boolean;
  }>> {
    try {
      const result = await this.applicationRepository.findApplicationsByTradie(tradieId, params);

      logger.debug('Tradie applications retrieved', {
        tradieId,
        totalCount: result.totalCount,
        returnedCount: result.applications.length
      });

      return createApiResponse(true, 'Applications retrieved successfully', result);
    } catch (error) {
      logger.error('Error getting tradie applications', { error, tradieId, params });
      return createApiResponse(false, 'Failed to retrieve applications', null, [error]);
    }
  }

  async searchApplications(
    searchParams: JobApplicationSearchParams
  ): Promise<ApiResponse<{
    applications: JobApplicationSummary[];
    totalCount: number;
    hasMore: boolean;
    filters: JobApplicationFilters;
  }>> {
    try {
      const result = await this.applicationRepository.searchApplications(searchParams);

      const response = {
        applications: result.applications,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        filters: this.extractFiltersFromSearch(searchParams)
      };

      logger.debug('Application search completed', {
        totalCount: result.totalCount,
        returnedCount: result.applications.length,
        searchParams
      });

      return createApiResponse(true, 'Applications retrieved successfully', response);
    } catch (error) {
      logger.error('Error searching applications', { error, searchParams });
      return createApiResponse(false, 'Failed to search applications', null, [error]);
    }
  }

  async updateApplication(
    id: number, 
    updateData: JobApplicationUpdateData, 
    tradieId: number
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const existingApplication = await this.applicationRepository.findApplicationById(id);
      if (!existingApplication) {
        return createApiResponse(false, 'Application not found', null);
      }

      if (!canModifyApplication(existingApplication)) {
        return createApiResponse(false, 'Application cannot be modified in current status', null);
      }

      const updatedApplication = await this.applicationRepository.updateApplication(id, updateData, tradieId);
      if (!updatedApplication) {
        return createApiResponse(false, 'Failed to update application', null);
      }

      await this.publishApplicationUpdatedEvent(existingApplication, updatedApplication);
      await this.notifyClientOfApplicationUpdate(updatedApplication);

      logger.info('Application updated successfully', {
        applicationId: id,
        tradieId,
        changes: Object.keys(updateData)
      });

      return createApiResponse(true, 'Application updated successfully', updatedApplication);
    } catch (error) {
      logger.error('Error updating application', { error, applicationId: id, updateData });
      return createApiResponse(false, 'Failed to update application', null, [error]);
    }
  }

  async updateApplicationStatus(
    id: number, 
    statusUpdate: ApplicationStatusUpdate,
    clientId?: number
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const existingApplication = await this.applicationRepository.findApplicationById(id);
      if (!existingApplication) {
        return createApiResponse(false, 'Application not found', null);
      }

      if (clientId) {
        const jobOwnership = await this.marketplaceRepository.validateJobOwnership(
          existingApplication.marketplaceJobId, 
          clientId
        );
        if (!jobOwnership) {
          return createApiResponse(false, 'Unauthorized access', null);
        }
      }

      const transitionValidation = validateApplicationStatusTransition(
        existingApplication.status, 
        statusUpdate.status
      );
      if (!transitionValidation.isValid) {
        return createApiResponse(false, transitionValidation.error || 'Invalid status transition', null);
      }

      const updatedApplication = await this.applicationRepository.updateApplicationStatus(
        id, 
        statusUpdate.status, 
        statusUpdate.reason,
        statusUpdate.feedback
      );

      if (!updatedApplication) {
        return createApiResponse(false, 'Failed to update application status', null);
      }

      await this.publishApplicationStatusChangedEvent(existingApplication, updatedApplication, statusUpdate);
      await this.handleStatusChangeWorkflow(existingApplication, updatedApplication);

      logger.info('Application status updated successfully', {
        applicationId: id,
        previousStatus: existingApplication.status,
        newStatus: statusUpdate.status,
        reason: statusUpdate.reason
      });

      return createApiResponse(true, 'Application status updated successfully', updatedApplication);
    } catch (error) {
      logger.error('Error updating application status', { error, applicationId: id, statusUpdate });
      return createApiResponse(false, 'Failed to update application status', null, [error]);
    }
  }

  async withdrawApplication(
    id: number, 
    tradieId: number, 
    withdrawalData: ApplicationWithdrawal
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const existingApplication = await this.applicationRepository.findApplicationById(id);
      if (!existingApplication) {
        return createApiResponse(false, 'Application not found', null);
      }

      if (!canWithdrawApplication(existingApplication)) {
        return createApiResponse(false, 'Application cannot be withdrawn at this time', null);
      }

      const withdrawnApplication = await this.applicationRepository.withdrawApplication(
        id, 
        tradieId, 
        withdrawalData
      );

      if (!withdrawnApplication) {
        return createApiResponse(false, 'Failed to withdraw application', null);
      }

      await this.publishApplicationWithdrawnEvent(withdrawnApplication, withdrawalData);
      await this.notifyClientOfApplicationWithdrawal(withdrawnApplication);

      logger.info('Application withdrawn successfully', {
        applicationId: id,
        tradieId,
        reason: withdrawalData.reason,
        refundCredits: withdrawalData.refundCredits
      });

      return createApiResponse(true, 'Application withdrawn successfully', withdrawnApplication);
    } catch (error) {
      logger.error('Error withdrawing application', { error, applicationId: id, tradieId });
      return createApiResponse(false, 'Failed to withdraw application', null, [error]);
    }
  }

  async getTradieApplicationHistory(tradieId: number): Promise<ApiResponse<TradieApplicationHistory>> {
    try {
      const history = await this.applicationRepository.getTradieApplicationHistory(tradieId);

      logger.debug('Tradie application history retrieved', {
        tradieId,
        totalApplications: history.totalApplications,
        conversionRate: history.conversionRate
      });

      return createApiResponse(true, 'Application history retrieved successfully', history);
    } catch (error) {
      logger.error('Error getting tradie application history', { error, tradieId });
      return createApiResponse(false, 'Failed to retrieve application history', null, [error]);
    }
  }

  async getApplicationAnalytics(params: {
    tradieId?: number;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month' | 'status';
  }): Promise<ApiResponse<ApplicationAnalytics>> {
    try {
      const analytics = await this.applicationRepository.getApplicationAnalytics(params);

      logger.debug('Application analytics retrieved', {
        totalApplications: analytics.totalApplications,
        conversionRate: analytics.conversionRate,
        params
      });

      return createApiResponse(true, 'Analytics retrieved successfully', analytics);
    } catch (error) {
      logger.error('Error getting application analytics', { error, params });
      return createApiResponse(false, 'Failed to retrieve analytics', null, [error]);
    }
  }

  private async publishApplicationCreatedEvent(
    application: JobApplicationEntity, 
    marketplaceJob: any
  ): Promise<void> {
    try {
      const eventData = {
        applicationId: application.id,
        tradieId: application.tradieId,
        marketplaceJobId: application.marketplaceJobId,
        jobTitle: marketplaceJob.title,
        customQuote: application.customQuote,
        creditsUsed: application.creditsUsed,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.APPLICATION_CREATED, JSON.stringify(eventData));
      this.emit('application:created', eventData);

      logger.debug('Application created event published', { applicationId: application.id });
    } catch (error) {
      logger.error('Error publishing application created event', { error, applicationId: application.id });
    }
  }

  private async publishApplicationUpdatedEvent(
    previousApplication: JobApplicationEntity, 
    updatedApplication: JobApplicationEntity
  ): Promise<void> {
    try {
      const eventData = {
        applicationId: updatedApplication.id,
        tradieId: updatedApplication.tradieId,
        marketplaceJobId: updatedApplication.marketplaceJobId,
        previousData: {
          customQuote: previousApplication.customQuote,
          proposedTimeline: previousApplication.proposedTimeline
        },
        updatedData: {
          customQuote: updatedApplication.customQuote,
          proposedTimeline: updatedApplication.proposedTimeline
        },
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.APPLICATION_UPDATED, JSON.stringify(eventData));
      this.emit('application:updated', eventData);

      logger.debug('Application updated event published', { applicationId: updatedApplication.id });
    } catch (error) {
      logger.error('Error publishing application updated event', { error, applicationId: updatedApplication.id });
    }
  }

  private async publishApplicationStatusChangedEvent(
    previousApplication: JobApplicationEntity, 
    updatedApplication: JobApplicationEntity, 
    statusUpdate: ApplicationStatusUpdate
  ): Promise<void> {
    try {
      const eventData = {
        applicationId: updatedApplication.id,
        tradieId: updatedApplication.tradieId,
        marketplaceJobId: updatedApplication.marketplaceJobId,
        previousStatus: previousApplication.status,
        newStatus: updatedApplication.status,
        reason: statusUpdate.reason,
        feedback: statusUpdate.feedback,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.APPLICATION_STATUS_CHANGED, JSON.stringify(eventData));
      this.emit('application:status_changed', eventData);

      logger.debug('Application status changed event published', { 
        applicationId: updatedApplication.id, 
        previousStatus: previousApplication.status, 
        newStatus: updatedApplication.status 
      });
    } catch (error) {
      logger.error('Error publishing application status changed event', { error, applicationId: updatedApplication.id });
    }
  }

  private async publishApplicationWithdrawnEvent(
    application: JobApplicationEntity, 
    withdrawalData: ApplicationWithdrawal
  ): Promise<void> {
    try {
      const eventData = {
        applicationId: application.id,
        tradieId: application.tradieId,
        marketplaceJobId: application.marketplaceJobId,
        reason: withdrawalData.reason,
        refundCredits: withdrawalData.refundCredits,
        creditsRefunded: withdrawalData.refundCredits ? application.creditsUsed : 0,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.APPLICATION_WITHDRAWN, JSON.stringify(eventData));
      this.emit('application:withdrawn', eventData);

      logger.debug('Application withdrawn event published', { applicationId: application.id });
    } catch (error) {
      logger.error('Error publishing application withdrawn event', { error, applicationId: application.id });
    }
  }

  private async notifyClientOfNewApplication(
    application: JobApplicationEntity, 
    marketplaceJob: any
  ): Promise<void> {
    try {
      const notificationData = {
        type: 'new_application',
        applicationId: application.id,
        jobId: marketplaceJob.id,
        jobTitle: marketplaceJob.title,
        tradieId: application.tradieId,
        customQuote: application.customQuote,
        proposedTimeline: application.proposedTimeline,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:new_application', JSON.stringify(notificationData));

      logger.debug('Client notified of new application', { 
        applicationId: application.id, 
        jobId: marketplaceJob.id 
      });
    } catch (error) {
      logger.error('Error notifying client of new application', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyClientOfApplicationUpdate(application: JobApplicationEntity): Promise<void> {
    try {
      const notificationData = {
        type: 'application_updated',
        applicationId: application.id,
        marketplaceJobId: application.marketplaceJobId,
        tradieId: application.tradieId,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:application_updated', JSON.stringify(notificationData));

      logger.debug('Client notified of application update', { applicationId: application.id });
    } catch (error) {
      logger.error('Error notifying client of application update', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyClientOfApplicationWithdrawal(application: JobApplicationEntity): Promise<void> {
    try {
      const notificationData = {
        type: 'application_withdrawn',
        applicationId: application.id,
        marketplaceJobId: application.marketplaceJobId,
        tradieId: application.tradieId,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:application_withdrawn', JSON.stringify(notificationData));

      logger.debug('Client notified of application withdrawal', { applicationId: application.id });
    } catch (error) {
      logger.error('Error notifying client of application withdrawal', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async updateTradieApplicationStats(tradieId: number): Promise<void> {
    try {
      const statsData = {
        tradieId,
        action: 'application_submitted',
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('tradie_stats:application_submitted', JSON.stringify(statsData));

      logger.debug('Tradie application stats updated', { tradieId });
    } catch (error) {
      logger.error('Error updating tradie application stats', { error, tradieId });
    }
  }

  private async handleStatusChangeWorkflow(
    previousApplication: JobApplicationEntity, 
    updatedApplication: JobApplicationEntity
  ): Promise<void> {
    try {
      switch (updatedApplication.status) {
        case APPLICATION_STATUS.SELECTED:
          await this.handleApplicationSelection(updatedApplication);
          break;
        case APPLICATION_STATUS.REJECTED:
          await this.handleApplicationRejection(updatedApplication);
          break;
        case APPLICATION_STATUS.UNDER_REVIEW:
          await this.handleApplicationUnderReview(updatedApplication);
          break;
      }
    } catch (error) {
      logger.error('Error in application status change workflow', { 
        error, 
        applicationId: updatedApplication.id 
      });
    }
  }

  private async handleApplicationSelection(application: JobApplicationEntity): Promise<void> {
    try {
      await this.notifyTradieOfSelection(application);
      await this.updateMarketplaceJobStatus(application.marketplaceJobId, MARKETPLACE_JOB_STATUS.ASSIGNED);
      await this.rejectOtherApplications(application.marketplaceJobId, application.id);
      await this.updateTradieSuccessStats(application.tradieId);

      const eventData = {
        applicationId: application.id,
        tradieId: application.tradieId,
        marketplaceJobId: application.marketplaceJobId,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.APPLICATION_SELECTED, JSON.stringify(eventData));
      this.emit('application:selected', eventData);

      logger.info('Application selection workflow completed', { applicationId: application.id });
    } catch (error) {
      logger.error('Error in application selection workflow', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async handleApplicationRejection(application: JobApplicationEntity): Promise<void> {
    try {
      await this.notifyTradieOfRejection(application);
      await this.updateTradieRejectionStats(application.tradieId);

      const eventData = {
        applicationId: application.id,
        tradieId: application.tradieId,
        marketplaceJobId: application.marketplaceJobId,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.APPLICATION_REJECTED, JSON.stringify(eventData));
      this.emit('application:rejected', eventData);

      logger.info('Application rejection workflow completed', { applicationId: application.id });
    } catch (error) {
      logger.error('Error in application rejection workflow', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async handleApplicationUnderReview(application: JobApplicationEntity): Promise<void> {
    try {
      await this.notifyTradieOfReview(application);

      logger.info('Application under review workflow completed', { applicationId: application.id });
    } catch (error) {
      logger.error('Error in application under review workflow', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyTradieOfSelection(application: JobApplicationEntity): Promise<void> {
    try {
      const notificationData = {
        type: 'application_selected',
        applicationId: application.id,
        tradieId: application.tradieId,
        marketplaceJobId: application.marketplaceJobId,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:tradie_application_selected', JSON.stringify(notificationData));

      logger.debug('Tradie notified of application selection', { 
        applicationId: application.id, 
        tradieId: application.tradieId 
      });
    } catch (error) {
      logger.error('Error notifying tradie of selection', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyTradieOfRejection(application: JobApplicationEntity): Promise<void> {
    try {
      const notificationData = {
        type: 'application_rejected',
        applicationId: application.id,
        tradieId: application.tradieId,
        marketplaceJobId: application.marketplaceJobId,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:tradie_application_rejected', JSON.stringify(notificationData));

      logger.debug('Tradie notified of application rejection', { 
        applicationId: application.id, 
        tradieId: application.tradieId 
      });
    } catch (error) {
      logger.error('Error notifying tradie of rejection', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyTradieOfReview(application: JobApplicationEntity): Promise<void> {
    try {
      const notificationData = {
        type: 'application_under_review',
        applicationId: application.id,
        tradieId: application.tradieId,
        marketplaceJobId: application.marketplaceJobId,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:tradie_application_review', JSON.stringify(notificationData));

      logger.debug('Tradie notified of application review', { 
        applicationId: application.id, 
        tradieId: application.tradieId 
      });
    } catch (error) {
      logger.error('Error notifying tradie of review', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async updateMarketplaceJobStatus(jobId: number, status: string): Promise<void> {
    try {
      await this.marketplaceRepository.updateJobStatus(jobId, status, 'Application selected');

      logger.debug('Marketplace job status updated', { jobId, status });
    } catch (error) {
      logger.error('Error updating marketplace job status', { error, jobId, status });
    }
  }

  private async rejectOtherApplications(marketplaceJobId: number, selectedApplicationId: number): Promise<void> {
    try {
      const applications = await this.applicationRepository.findApplicationsByJob(marketplaceJobId);
      const otherApplicationIds = applications
        .filter(app => app.id !== selectedApplicationId && 
                      (app.status === APPLICATION_STATUS.SUBMITTED || 
                       app.status === APPLICATION_STATUS.UNDER_REVIEW))
        .map(app => app.id);

      if (otherApplicationIds.length > 0) {
        await this.applicationRepository.bulkUpdateApplicationStatus(
          otherApplicationIds, 
          APPLICATION_STATUS.REJECTED, 
          'Another application was selected'
        );
      }

      logger.debug('Other applications rejected', { 
        marketplaceJobId, 
        rejectedCount: otherApplicationIds.length 
      });
    } catch (error) {
      logger.error('Error rejecting other applications', { error, marketplaceJobId });
    }
  }

  private async updateTradieSuccessStats(tradieId: number): Promise<void> {
    try {
      const statsData = {
        tradieId,
        action: 'application_successful',
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('tradie_stats:application_successful', JSON.stringify(statsData));

      logger.debug('Tradie success stats updated', { tradieId });
    } catch (error) {
      logger.error('Error updating tradie success stats', { error, tradieId });
    }
  }

  private async updateTradieRejectionStats(tradieId: number): Promise<void> {
    try {
      const statsData = {
        tradieId,
        action: 'application_rejected',
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('tradie_stats:application_rejected', JSON.stringify(statsData));

      logger.debug('Tradie rejection stats updated', { tradieId });
    } catch (error) {
      logger.error('Error updating tradie rejection stats', { error, tradieId });
    }
  }

  private canUserAccessApplication(application: JobApplicationDetails, userId: number): boolean {
    return application.tradieId === userId || application.job.id === userId;
  }

  private extractFiltersFromSearch(searchParams: JobApplicationSearchParams): JobApplicationFilters {
    return {
      status: searchParams.status,
      tradieId: searchParams.tradieId,
      marketplaceJobId: searchParams.marketplaceJobId,
      dateRange: searchParams.dateRange,
      minQuote: searchParams.minQuote,
      maxQuote: searchParams.maxQuote
    };
  }

  private setupEventListeners(): void {
    this.on('application:created', (data) => {
      logger.debug('Application created event received', data);
    });

    this.on('application:updated', (data) => {
      logger.debug('Application updated event received', data);
    });

    this.on('application:status_changed', (data) => {
      logger.debug('Application status changed event received', data);
    });

    this.on('application:withdrawn', (data) => {
      logger.debug('Application withdrawn event received', data);
    });

    this.on('application:selected', (data) => {
      logger.debug('Application selected event received', data);
    });

    this.on('application:rejected', (data) => {
      logger.debug('Application rejected event received', data);
    });
  }

  async destroy(): Promise<void> {
    try {
      await this.redis.quit();
      this.removeAllListeners();
      logger.info('ApplicationService destroyed successfully');
    } catch (error) {
      logger.error('Error destroying ApplicationService', { error });
    }
  }
}



    