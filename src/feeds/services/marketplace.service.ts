import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { MarketplaceRepository } from '../repositories';
import { 
  MarketplaceJobEntity,
  MarketplaceJobCreateData,
  MarketplaceJobUpdateData,
  MarketplaceJobSummary,
  MarketplaceJobDetails,
  MarketplaceJobSearchParams,
  MarketplaceJobFilters,
  MarketplaceJobStats,
  MarketplaceCreditCost
} from '../types';
import {
  MARKETPLACE_JOB_STATUS,
  MARKETPLACE_JOB_TYPES,
  URGENCY_LEVEL,
  MARKETPLACE_LIMITS,
  MARKETPLACE_CREDIT_COSTS,
  MARKETPLACE_NOTIFICATIONS
} from '../../config/feeds';
import { 
  validateMarketplaceJobData,
  sanitizeMarketplaceJobData,
  calculateCreditCost,
  isJobExpired,
  canJobBeModified,
  getNextValidStatuses,
  canTransitionToStatus
} from '../utils';
import { logger, createApiResponse } from '../../shared/utils';
import { DatabaseError, ApiResponse } from '../../shared/types';

export class MarketplaceService extends EventEmitter {
  private marketplaceRepository: MarketplaceRepository;
  private redis: Redis;
  private readonly REDIS_CHANNELS = {
    JOB_CREATED: 'marketplace:job:created',
    JOB_UPDATED: 'marketplace:job:updated',
    JOB_STATUS_CHANGED: 'marketplace:job:status_changed',
    JOB_EXPIRED: 'marketplace:job:expired',
    JOB_DELETED: 'marketplace:job:deleted',
    APPLICATION_RECEIVED: 'marketplace:application:received'
  };

  constructor() {
    super();
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

  async createMarketplaceJob(
    jobData: MarketplaceJobCreateData, 
    clientId?: number
  ): Promise<ApiResponse<MarketplaceJobEntity>> {
    try {
      const validationResult = validateMarketplaceJobData(jobData);
      if (!validationResult.isValid) {
        return createApiResponse(false, 'Validation failed', null, validationResult.errors);
      }

      const sanitizedData = sanitizeMarketplaceJobData(jobData);
      
      if (clientId) {
        await this.marketplaceRepository.validateClientProfile(clientId);
      } else {
        clientId = await this.marketplaceRepository.createOrUpdateClientProfile(sanitizedData);
      }

      const job = await this.marketplaceRepository.createJob(sanitizedData, clientId);

      await this.publishJobCreatedEvent(job);
      await this.notifyRelevantTradies(job);
      await this.updateClientCRM(clientId, job);

      logger.info('Marketplace job created successfully', {
        jobId: job.id,
        clientId,
        jobType: job.jobType,
        location: job.location
      });

      return createApiResponse(true, 'Job created successfully', job);
    } catch (error) {
      logger.error('Error creating marketplace job', { error, jobData });
      return createApiResponse(false, 'Failed to create job', null, [error]);
    }
  }

  async getMarketplaceJob(id: number, tradieId?: number): Promise<ApiResponse<MarketplaceJobDetails>> {
    try {
      const jobDetails = await this.marketplaceRepository.findJobDetails(id, tradieId);
      
      if (!jobDetails) {
        return createApiResponse(false, 'Job not found', null);
      }

      if (isJobExpired(jobDetails as MarketplaceJobEntity)) {
        await this.handleJobExpiry(id);
        return createApiResponse(false, 'Job has expired', null);
      }

      logger.debug('Marketplace job retrieved', { jobId: id, tradieId });

      return createApiResponse(true, 'Job retrieved successfully', jobDetails);
    } catch (error) {
      logger.error('Error getting marketplace job', { error, jobId: id });
      return createApiResponse(false, 'Failed to retrieve job', null, [error]);
    }
  }

  async searchMarketplaceJobs(
    searchParams: MarketplaceJobSearchParams
  ): Promise<ApiResponse<{
    jobs: MarketplaceJobSummary[];
    totalCount: number;
    hasMore: boolean;
    filters: MarketplaceJobFilters;
  }>> {
    try {
      const result = await this.marketplaceRepository.searchJobs(searchParams);

      const response = {
        jobs: result.jobs,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        filters: this.extractFiltersFromSearch(searchParams)
      };

      logger.debug('Marketplace jobs search completed', {
        totalCount: result.totalCount,
        returnedCount: result.jobs.length,
        searchParams
      });

      return createApiResponse(true, 'Jobs retrieved successfully', response);
    } catch (error) {
      logger.error('Error searching marketplace jobs', { error, searchParams });
      return createApiResponse(false, 'Failed to search jobs', null, [error]);
    }
  }

  async updateMarketplaceJob(
    id: number, 
    updateData: MarketplaceJobUpdateData, 
    clientId: number
  ): Promise<ApiResponse<MarketplaceJobEntity>> {
    try {
      const existingJob = await this.marketplaceRepository.findJobById(id);
      if (!existingJob) {
        return createApiResponse(false, 'Job not found', null);
      }

      if (!canJobBeModified(existingJob)) {
        return createApiResponse(false, 'Job cannot be modified in current status', null);
      }

      const updatedJob = await this.marketplaceRepository.updateJob(id, updateData, clientId);
      if (!updatedJob) {
        return createApiResponse(false, 'Failed to update job', null);
      }

      await this.publishJobUpdatedEvent(existingJob, updatedJob);
      await this.notifyApplicationsOfJobUpdate(id, updateData);

      logger.info('Marketplace job updated successfully', {
        jobId: id,
        clientId,
        changes: Object.keys(updateData)
      });

      return createApiResponse(true, 'Job updated successfully', updatedJob);
    } catch (error) {
      logger.error('Error updating marketplace job', { error, jobId: id, updateData });
      return createApiResponse(false, 'Failed to update job', null, [error]);
    }
  }

  async updateJobStatus(
    id: number, 
    status: string, 
    reason?: string,
    clientId?: number
  ): Promise<ApiResponse<MarketplaceJobEntity>> {
    try {
      const existingJob = await this.marketplaceRepository.findJobById(id);
      if (!existingJob) {
        return createApiResponse(false, 'Job not found', null);
      }

      if (clientId && existingJob.clientId !== clientId) {
        return createApiResponse(false, 'Unauthorized access', null);
      }

      if (!canTransitionToStatus(existingJob.status, status)) {
        return createApiResponse(false, `Cannot transition from ${existingJob.status} to ${status}`, null);
      }

      const updatedJob = await this.marketplaceRepository.updateJobStatus(id, status, reason);
      if (!updatedJob) {
        return createApiResponse(false, 'Failed to update job status', null);
      }

      await this.publishJobStatusChangedEvent(existingJob, updatedJob, reason);
      await this.handleStatusChangeWorkflow(existingJob, updatedJob);

      logger.info('Job status updated successfully', {
        jobId: id,
        previousStatus: existingJob.status,
        newStatus: status,
        reason
      });

      return createApiResponse(true, 'Job status updated successfully', updatedJob);
    } catch (error) {
      logger.error('Error updating job status', { error, jobId: id, status });
      return createApiResponse(false, 'Failed to update job status', null, [error]);
    }
  }

  async deleteMarketplaceJob(id: number, clientId: number): Promise<ApiResponse<boolean>> {
    try {
      const existingJob = await this.marketplaceRepository.findJobById(id);
      if (!existingJob) {
        return createApiResponse(false, 'Job not found', null);
      }

      if (existingJob.applicationCount > 0) {
        return createApiResponse(false, 'Cannot delete job with existing applications', null);
      }

      const deletedJob = await this.marketplaceRepository.deleteJob(id, clientId);
      if (!deletedJob) {
        return createApiResponse(false, 'Failed to delete job', null);
      }

      await this.publishJobDeletedEvent(deletedJob);
      await this.cleanupJobRelatedData(id);

      logger.info('Marketplace job deleted successfully', { jobId: id, clientId });

      return createApiResponse(true, 'Job deleted successfully', true);
    } catch (error) {
      logger.error('Error deleting marketplace job', { error, jobId: id, clientId });
      return createApiResponse(false, 'Failed to delete job', null, [error]);
    }
  }

  async getClientJobs(
    clientId: number, 
    params: { page: number; limit: number; status?: string }
  ): Promise<ApiResponse<{
    jobs: MarketplaceJobSummary[];
    totalCount: number;
    hasMore: boolean;
  }>> {
    try {
      const result = await this.marketplaceRepository.findJobsByClient(clientId, params);

      logger.debug('Client jobs retrieved', {
        clientId,
        totalCount: result.totalCount,
        returnedCount: result.jobs.length
      });

      return createApiResponse(true, 'Client jobs retrieved successfully', result);
    } catch (error) {
      logger.error('Error getting client jobs', { error, clientId, params });
      return createApiResponse(false, 'Failed to retrieve client jobs', null, [error]);
    }
  }

  async getMarketplaceStats(): Promise<ApiResponse<MarketplaceJobStats>> {
    try {
      const stats = await this.marketplaceRepository.getMarketplaceStats();

      logger.debug('Marketplace stats retrieved', {
        totalJobs: stats.totalJobs,
        activeJobs: stats.activeJobs
      });

      return createApiResponse(true, 'Marketplace stats retrieved successfully', stats);
    } catch (error) {
      logger.error('Error getting marketplace stats', { error });
      return createApiResponse(false, 'Failed to retrieve marketplace stats', null, [error]);
    }
  }

  async getJobCreditCost(jobId: number): Promise<ApiResponse<MarketplaceCreditCost>> {
    try {
      const creditCost = await this.marketplaceRepository.getJobCreditCost(jobId);
      
      if (!creditCost) {
        return createApiResponse(false, 'Job not found', null);
      }

      return createApiResponse(true, 'Credit cost calculated successfully', creditCost);
    } catch (error) {
      logger.error('Error getting job credit cost', { error, jobId });
      return createApiResponse(false, 'Failed to calculate credit cost', null, [error]);
    }
  }

  async getRecommendedJobs(tradieId: number, limit: number = 10): Promise<ApiResponse<MarketplaceJobSummary[]>> {
    try {
      const recommendedJobs = await this.marketplaceRepository.getRecommendedJobs(tradieId, limit);

      logger.debug('Recommended jobs retrieved', {
        tradieId,
        count: recommendedJobs.length
      });

      return createApiResponse(true, 'Recommended jobs retrieved successfully', recommendedJobs);
    } catch (error) {
      logger.error('Error getting recommended jobs', { error, tradieId });
      return createApiResponse(false, 'Failed to retrieve recommended jobs', null, [error]);
    }
  }

  async processExpiredJobs(): Promise<ApiResponse<{ processed: number; failed: number }>> {
    try {
      const expiredJobs = await this.marketplaceRepository.findExpiredJobs();
      let processed = 0;
      let failed = 0;

      for (const expiredJob of expiredJobs) {
        try {
          await this.handleJobExpiry(expiredJob.id);
          processed++;
        } catch (error) {
          logger.error('Error processing expired job', { error, jobId: expiredJob.id });
          failed++;
        }
      }

      logger.info('Expired jobs processing completed', { processed, failed });

      return createApiResponse(true, 'Expired jobs processed successfully', { processed, failed });
    } catch (error) {
      logger.error('Error processing expired jobs', { error });
      return createApiResponse(false, 'Failed to process expired jobs', null, [error]);
    }
  }

  private async publishJobCreatedEvent(job: MarketplaceJobEntity): Promise<void> {
    try {
      const eventData = {
        jobId: job.id,
        clientId: job.clientId,
        jobType: job.jobType,
        location: job.location,
        urgencyLevel: job.urgencyLevel,
        estimatedBudget: job.estimatedBudget,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.JOB_CREATED, JSON.stringify(eventData));
      this.emit('job:created', eventData);

      logger.debug('Job created event published', { jobId: job.id });
    } catch (error) {
      logger.error('Error publishing job created event', { error, jobId: job.id });
    }
  }

  private async publishJobUpdatedEvent(
    previousJob: MarketplaceJobEntity, 
    updatedJob: MarketplaceJobEntity
  ): Promise<void> {
    try {
      const eventData = {
        jobId: updatedJob.id,
        clientId: updatedJob.clientId,
        previousData: {
          title: previousJob.title,
          description: previousJob.description,
          estimatedBudget: previousJob.estimatedBudget
        },
        updatedData: {
          title: updatedJob.title,
          description: updatedJob.description,
          estimatedBudget: updatedJob.estimatedBudget
        },
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.JOB_UPDATED, JSON.stringify(eventData));
      this.emit('job:updated', eventData);

      logger.debug('Job updated event published', { jobId: updatedJob.id });
    } catch (error) {
      logger.error('Error publishing job updated event', { error, jobId: updatedJob.id });
    }
  }

  private async publishJobStatusChangedEvent(
    previousJob: MarketplaceJobEntity, 
    updatedJob: MarketplaceJobEntity, 
    reason?: string
  ): Promise<void> {
    try {
      const eventData = {
        jobId: updatedJob.id,
        clientId: updatedJob.clientId,
        previousStatus: previousJob.status,
        newStatus: updatedJob.status,
        reason,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.JOB_STATUS_CHANGED, JSON.stringify(eventData));
      this.emit('job:status_changed', eventData);

      logger.debug('Job status changed event published', { 
        jobId: updatedJob.id, 
        previousStatus: previousJob.status, 
        newStatus: updatedJob.status 
      });
    } catch (error) {
      logger.error('Error publishing job status changed event', { error, jobId: updatedJob.id });
    }
  }

  private async publishJobDeletedEvent(job: MarketplaceJobEntity): Promise<void> {
    try {
      const eventData = {
        jobId: job.id,
        clientId: job.clientId,
        jobType: job.jobType,
        applicationCount: job.applicationCount,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.JOB_DELETED, JSON.stringify(eventData));
      this.emit('job:deleted', eventData);

      logger.debug('Job deleted event published', { jobId: job.id });
    } catch (error) {
      logger.error('Error publishing job deleted event', { error, jobId: job.id });
    }
  }

    private async notifyRelevantTradies(job: MarketplaceJobEntity): Promise<void> {
      try {
        const notificationData = {
          jobId: job.id,
          title: job.title,
          jobType: job.jobType,
          location: job.location,
          urgencyLevel: job.urgencyLevel,
          estimatedBudget: job.estimatedBudget,
          creditCost: calculateCreditCost(job.jobType, job.urgencyLevel).finalCost
        };
  
        await this.redis.publish('notifications:new_job', JSON.stringify(notificationData));
  
        logger.debug('Relevant tradies notified of new job', { jobId: job.id });
      } catch (error) {
        logger.error('Error notifying relevant tradies', { error, jobId: job.id });
      }
    }
  
    private async notifyApplicationsOfJobUpdate(jobId: number, updateData: MarketplaceJobUpdateData): Promise<void> {
      try {
        const notificationData = {
          jobId,
          updateType: 'job_updated',
          changes: Object.keys(updateData),
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('notifications:job_updated', JSON.stringify(notificationData));
  
        logger.debug('Applications notified of job update', { jobId });
      } catch (error) {
        logger.error('Error notifying applications of job update', { error, jobId });
      }
    }
  
    private async handleJobExpiry(jobId: number): Promise<void> {
      try {
        await this.marketplaceRepository.updateJobStatus(jobId, MARKETPLACE_JOB_STATUS.EXPIRED, 'Job expired automatically');
  
        const eventData = {
          jobId,
          status: MARKETPLACE_JOB_STATUS.EXPIRED,
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish(this.REDIS_CHANNELS.JOB_EXPIRED, JSON.stringify(eventData));
        this.emit('job:expired', eventData);
  
        logger.info('Job expired and status updated', { jobId });
      } catch (error) {
        logger.error('Error handling job expiry', { error, jobId });
      }
    }
  
    private async handleStatusChangeWorkflow(
      previousJob: MarketplaceJobEntity, 
      updatedJob: MarketplaceJobEntity
    ): Promise<void> {
      try {
        switch (updatedJob.status) {
          case MARKETPLACE_JOB_STATUS.ASSIGNED:
            await this.handleJobAssignment(updatedJob);
            break;
          case MARKETPLACE_JOB_STATUS.COMPLETED:
            await this.handleJobCompletion(updatedJob);
            break;
          case MARKETPLACE_JOB_STATUS.CANCELLED:
            await this.handleJobCancellation(updatedJob);
            break;
        }
      } catch (error) {
        logger.error('Error in status change workflow', { error, jobId: updatedJob.id });
      }
    }
  
    private async handleJobAssignment(job: MarketplaceJobEntity): Promise<void> {
      try {
        await this.createJobInJobManagementSystem(job);
        await this.notifySelectedTradie(job);
        await this.notifyRejectedApplicants(job);
  
        logger.info('Job assignment workflow completed', { jobId: job.id });
      } catch (error) {
        logger.error('Error in job assignment workflow', { error, jobId: job.id });
      }
    }
  
    private async handleJobCompletion(job: MarketplaceJobEntity): Promise<void> {
      try {
        await this.updateTradieStats(job);
        await this.updateClientCRMCompletion(job);
        await this.processJobCompletionRewards(job);
  
        logger.info('Job completion workflow completed', { jobId: job.id });
      } catch (error) {
        logger.error('Error in job completion workflow', { error, jobId: job.id });
      }
    }
  
    private async handleJobCancellation(job: MarketplaceJobEntity): Promise<void> {
      try {
        await this.processApplicationRefunds(job.id);
        await this.notifyAffectedParties(job);
  
        logger.info('Job cancellation workflow completed', { jobId: job.id });
      } catch (error) {
        logger.error('Error in job cancellation workflow', { error, jobId: job.id });
      }
    }
  
    private async createJobInJobManagementSystem(marketplaceJob: MarketplaceJobEntity): Promise<void> {
      try {
        const jobManagementData = {
          title: marketplaceJob.title,
          description: marketplaceJob.description,
          jobType: marketplaceJob.jobType,
          location: marketplaceJob.location,
          clientId: marketplaceJob.clientId,
          estimatedBudget: marketplaceJob.estimatedBudget,
          dateRequired: marketplaceJob.dateRequired,
          status: 'assigned',
          source: 'marketplace',
          marketplaceJobId: marketplaceJob.id
        };
  
        const jobCreationEvent = {
          type: 'create_job_from_marketplace',
          data: jobManagementData,
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('job_management:create_job', JSON.stringify(jobCreationEvent));
  
        logger.debug('Job creation request sent to job management system', { 
          marketplaceJobId: marketplaceJob.id 
        });
      } catch (error) {
        logger.error('Error creating job in job management system', { 
          error, 
          marketplaceJobId: marketplaceJob.id 
        });
      }
    }
  
    private async updateClientCRM(clientId: number, job: MarketplaceJobEntity): Promise<void> {
      try {
        const crmData = {
          clientId,
          jobId: job.id,
          jobType: job.jobType,
          estimatedValue: job.estimatedBudget,
          location: job.location,
          source: 'marketplace',
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('crm:client_activity', JSON.stringify(crmData));
  
        logger.debug('Client CRM updated', { clientId, jobId: job.id });
      } catch (error) {
        logger.error('Error updating client CRM', { error, clientId, jobId: job.id });
      }
    }
  
    private async updateClientCRMCompletion(job: MarketplaceJobEntity): Promise<void> {
      try {
        const crmData = {
          clientId: job.clientId,
          jobId: job.id,
          status: 'completed',
          completionDate: new Date().toISOString()
        };
  
        await this.redis.publish('crm:job_completed', JSON.stringify(crmData));
  
        logger.debug('Client CRM completion updated', { clientId: job.clientId, jobId: job.id });
      } catch (error) {
        logger.error('Error updating client CRM completion', { error, jobId: job.id });
      }
    }
  
    private async notifySelectedTradie(job: MarketplaceJobEntity): Promise<void> {
      try {
        const notificationData = {
          type: 'application_selected',
          jobId: job.id,
          jobTitle: job.title,
          clientName: job.clientName,
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('notifications:application_selected', JSON.stringify(notificationData));
  
        logger.debug('Selected tradie notified', { jobId: job.id });
      } catch (error) {
        logger.error('Error notifying selected tradie', { error, jobId: job.id });
      }
    }
  
    private async notifyRejectedApplicants(job: MarketplaceJobEntity): Promise<void> {
      try {
        const notificationData = {
          type: 'application_rejected',
          jobId: job.id,
          jobTitle: job.title,
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('notifications:application_rejected', JSON.stringify(notificationData));
  
        logger.debug('Rejected applicants notified', { jobId: job.id });
      } catch (error) {
        logger.error('Error notifying rejected applicants', { error, jobId: job.id });
      }
    }
  
    private async updateTradieStats(job: MarketplaceJobEntity): Promise<void> {
      try {
        const statsData = {
          jobId: job.id,
          jobType: job.jobType,
          completionDate: new Date().toISOString()
        };
  
        await this.redis.publish('tradie_stats:job_completed', JSON.stringify(statsData));
  
        logger.debug('Tradie stats updated', { jobId: job.id });
      } catch (error) {
        logger.error('Error updating tradie stats', { error, jobId: job.id });
      }
    }
  
    private async processJobCompletionRewards(job: MarketplaceJobEntity): Promise<void> {
      try {
        const rewardData = {
          jobId: job.id,
          clientId: job.clientId,
          jobValue: job.estimatedBudget,
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('rewards:job_completed', JSON.stringify(rewardData));
  
        logger.debug('Job completion rewards processed', { jobId: job.id });
      } catch (error) {
        logger.error('Error processing job completion rewards', { error, jobId: job.id });
      }
    }
  
    private async processApplicationRefunds(jobId: number): Promise<void> {
      try {
        const refundData = {
          jobId,
          reason: 'job_cancelled',
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('credits:process_refunds', JSON.stringify(refundData));
  
        logger.debug('Application refunds processed', { jobId });
      } catch (error) {
        logger.error('Error processing application refunds', { error, jobId });
      }
    }
  
    private async notifyAffectedParties(job: MarketplaceJobEntity): Promise<void> {
      try {
        const notificationData = {
          type: 'job_cancelled',
          jobId: job.id,
          jobTitle: job.title,
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('notifications:job_cancelled', JSON.stringify(notificationData));
  
        logger.debug('Affected parties notified of job cancellation', { jobId: job.id });
      } catch (error) {
        logger.error('Error notifying affected parties', { error, jobId: job.id });
      }
    }
  
    private async cleanupJobRelatedData(jobId: number): Promise<void> {
      try {
        const cleanupData = {
          jobId,
          timestamp: new Date().toISOString()
        };
  
        await this.redis.publish('cleanup:job_deleted', JSON.stringify(cleanupData));
  
        logger.debug('Job cleanup initiated', { jobId });
      } catch (error) {
        logger.error('Error initiating job cleanup', { error, jobId });
      }
    }
  
    private extractFiltersFromSearch(searchParams: MarketplaceJobSearchParams): MarketplaceJobFilters {
      return {
        jobType: searchParams.jobType,
        location: searchParams.location,
        urgencyLevel: searchParams.urgencyLevel,
        minBudget: searchParams.minBudget,
        maxBudget: searchParams.maxBudget,
        dateRange: searchParams.dateRange,
        excludeApplied: searchParams.excludeApplied,
        tradieId: searchParams.tradieId
      };
    }
  
    private setupEventListeners(): void {
      this.on('job:created', (data) => {
        logger.debug('Job created event received', data);
      });
  
      this.on('job:updated', (data) => {
        logger.debug('Job updated event received', data);
      });
  
      this.on('job:status_changed', (data) => {
        logger.debug('Job status changed event received', data);
      });
  
      this.on('job:expired', (data) => {
        logger.debug('Job expired event received', data);
      });
  
      this.on('job:deleted', (data) => {
        logger.debug('Job deleted event received', data);
      });
    }
  
    async destroy(): Promise<void> {
      try {
        await this.redis.quit();
        this.removeAllListeners();
        logger.info('MarketplaceService destroyed successfully');
      } catch (error) {
        logger.error('Error destroying MarketplaceService', { error });
      }
    }
  }
  