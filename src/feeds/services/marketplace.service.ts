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
import { logger, createResponse } from '../../shared/utils';
import { DatabaseError, ApiResponse } from '../../shared/types';

import { CreditService } from '../../credits/services/credit.service';
import { JobService } from '../../jobs/services/job.service';
import { UserService } from '../../auth/services/user.service';
import { ProfileService } from '../../auth/services/profile.service';
import { PaymentService } from '../../payment/services/payment.service';
import { EmailService } from '../../auth/services/email.service';
import { SmsService } from '../../auth/services/sms.service';

import { job_type, JobStatus, JobPriority, CreateJobData } from '../../jobs/types';
import { CreditUsageType } from '../../credits/types';

export class MarketplaceService extends EventEmitter {

  private marketplaceRepository: MarketplaceRepository;
  private redis: Redis;
  
  private creditService: CreditService;
  private jobService: JobService;
  private userService: UserService;
  private profileService: ProfileService;
  private paymentService: PaymentService;
  private emailService: EmailService;
  private SmsService: SmsService;

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

    this.creditService = new CreditService();
    this.jobService = new JobService();
    this.userService = new UserService();
    this.profileService = new ProfileService();
    this.paymentService = new PaymentService();
    this.emailService = new EmailService();
    this.SmsService = new SmsService();

    this.setupEventListeners();
  }

  private convertUserIdToString(userId: number): string {
    return userId.toString();
  }

  private convertUserIdToNumber(userId: string): number {
    return parseInt(userId, 10);
  }

  async createMarketplaceJob(
    jobData: MarketplaceJobCreateData, 
    client_id?: number
  ): Promise<ApiResponse<MarketplaceJobEntity>> {
    try {
      const validationResult = validateMarketplaceJobData(jobData);
      if (!validationResult.isValid) {
        return createResponse(false, 'Validation failed', null, validationResult.errors);
      }

      const sanitizedData = sanitizeMarketplaceJobData(jobData);
      
      if (client_id) {
        const clientUser = await this.userService.getUserById(this.convertUserIdToString(client_id));
        if (!clientUser) {
          return createResponse(false, 'Client not found', null);
        }
        
        const clientProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(client_id));
        if (!clientProfile) {
          return createResponse(false, 'Client profile not found', null);
        }
      } else {

        client_id = await this.marketplaceRepository.createOrUpdateClientProfile(sanitizedData);
      }

      const job = await this.marketplaceRepository.createJob(sanitizedData, client_id);

      await this.publishJobCreatedEvent(job);
      await this.notifyRelevantTradiesDirectly(job); 
      await this.updateClientCRMDirectly(client_id, job);

      logger.info('Marketplace job created successfully', {
        jobId: job.id,
        client_id,
        job_type: job.job_type,
        location: job.location
      });

      return createResponse(true, 'Job created successfully', job);
    } catch (error) {
      logger.error('Error creating marketplace job', { error, jobData });
      return createResponse(false, 'Failed to create job', null, [error]);
    }
  }

  async getMarketplaceJob(id: number, tradie_id?: number): Promise<ApiResponse<MarketplaceJobDetails>> {
    try {
      const jobDetails = await this.marketplaceRepository.findJobDetails(id, tradie_id);
      
      if (!jobDetails) {
        return createResponse(false, 'Job not found', null);
      }

      if (isJobExpired(jobDetails as MarketplaceJobEntity)) {
        await this.handleJobExpiry(id);
        return createResponse(false, 'Job has expired', null);
      }

      if (tradie_id) {
        const creditCost = calculateCreditCost(jobDetails.job_type, jobDetails.urgency_level).finalCost;
        const creditCheck = await this.creditService.checkCreditSufficiency(tradie_id, creditCost);
        
        (jobDetails as any).creditSufficient = creditCheck.sufficient;
        (jobDetails as any).creditShortfall = creditCheck.shortfall;
      }

      logger.debug('Marketplace job retrieved', { jobId: id, tradie_id });

      return createResponse(true, 'Job retrieved successfully', jobDetails);
    } catch (error) {
      logger.error('Error getting marketplace job', { error, jobId: id });
      return createResponse(false, 'Failed to retrieve job', null, [error]);
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

      if (searchParams.tradie_id) {
        const tradieProfile = await this.profileService.getProfileByUserId(
          this.convertUserIdToString(searchParams.tradie_id)
        );
        
        if (tradieProfile && tradieProfile.location && !searchParams.location) {
          searchParams.location = tradieProfile.location;
        }
      }

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

      return createResponse(true, 'Jobs retrieved successfully', response);
    } catch (error) {
      logger.error('Error searching marketplace jobs', { error, searchParams });
      return createResponse(false, 'Failed to search jobs', null, [error]);
    }
  }

  async updateMarketplaceJob(
    id: number, 
    updateData: MarketplaceJobUpdateData, 
    client_id: number
  ): Promise<ApiResponse<MarketplaceJobEntity>> {
    try {
      const existingJob = await this.marketplaceRepository.findJobById(id);
      if (!existingJob) {
        return createResponse(false, 'Job not found', null);
      }

      const clientUser = await this.userService.getUserById(this.convertUserIdToString(client_id));
      if (!clientUser) {
        return createResponse(false, 'Client not found', null);
      }

      if (!canJobBeModified(existingJob)) {
        return createResponse(false, 'Job cannot be modified in current status', null);
      }

      const updatedJob = await this.marketplaceRepository.updateJob(id, updateData, client_id);
      if (!updatedJob) {
        return createResponse(false, 'Failed to update job', null);
      }

      await this.publishJobUpdatedEvent(existingJob, updatedJob);
      await this.notifyApplicationsOfJobUpdateDirectly(id, updateData);

      logger.info('Marketplace job updated successfully', {
        jobId: id,
        client_id,
        changes: Object.keys(updateData)
      });

      return createResponse(true, 'Job updated successfully', updatedJob);
    } catch (error) {
      logger.error('Error updating marketplace job', { error, jobId: id, updateData });
      return createResponse(false, 'Failed to update job', null, [error]);
    }
  }

  async updateJobStatus(
    id: number, 
    status: string, 
    reason?: string,
    client_id?: number
  ): Promise<ApiResponse<MarketplaceJobEntity>> {
    try {
      const existingJob = await this.marketplaceRepository.findJobById(id);
      if (!existingJob) {
        return createResponse(false, 'Job not found', null);
      }

      if (client_id && existingJob.client_id !== client_id) {
        return createResponse(false, 'Unauthorized access', null);
      }

      if (!canTransitionToStatus(existingJob.status, status)) {
        return createResponse(false, `Cannot transition from ${existingJob.status} to ${status}`, null);
      }

      const updatedJob = await this.marketplaceRepository.updateJobStatus(id, status, reason);
      if (!updatedJob) {
        return createResponse(false, 'Failed to update job status', null);
      }

      await this.publishJobStatusChangedEvent(existingJob, updatedJob, reason);
      await this.handleStatusChangeWorkflowDirectly(existingJob, updatedJob);

      logger.info('Job status updated successfully', {
        jobId: id,
        previousStatus: existingJob.status,
        newStatus: status,
        reason
      });

      return createResponse(true, 'Job status updated successfully', updatedJob);
    } catch (error) {
      logger.error('Error updating job status', { error, jobId: id, status });
      return createResponse(false, 'Failed to update job status', null, [error]);
    }
  }

  async deleteMarketplaceJob(id: number, client_id: number): Promise<ApiResponse<boolean>> {
    try {
      const existingJob = await this.marketplaceRepository.findJobById(id);
      if (!existingJob) {
        return createResponse(false, 'Job not found', null);
      }

      const clientUser = await this.userService.getUserById(this.convertUserIdToString(client_id));
      if (!clientUser) {
        return createResponse(false, 'Client not found', null);
      }

      if (existingJob.applicationCount > 0) {
        await this.processApplicationRefundsDirectly(id);
      }

      const deletedJob = await this.marketplaceRepository.deleteJob(id, client_id);
      if (!deletedJob) {
        return createResponse(false, 'Failed to delete job', null);
      }

      await this.publishJobDeletedEvent(deletedJob);
      await this.cleanupJobRelatedData(id);

      logger.info('Marketplace job deleted successfully', { jobId: id, client_id });

      return createResponse(true, 'Job deleted successfully', true);
    } catch (error) {
      logger.error('Error deleting marketplace job', { error, jobId: id, client_id });
      return createResponse(false, 'Failed to delete job', null, [error]);
    }
  }

  async getClientJobs(
    client_id: number, 
    params: { page: number; limit: number; status?: string }
  ): Promise<ApiResponse<{
    jobs: MarketplaceJobSummary[];
    totalCount: number;
    hasMore: boolean;
  }>> {
    try {
      const clientUser = await this.userService.getUserById(this.convertUserIdToString(client_id));
      if (!clientUser) {
        return createResponse(false, 'Client not found', null);
      }

      const result = await this.marketplaceRepository.findJobsByClient(client_id, params);

      logger.debug('Client jobs retrieved', {
        client_id,
        totalCount: result.totalCount,
        returnedCount: result.jobs.length
      });

      return createResponse(true, 'Client jobs retrieved successfully', result);
    } catch (error) {
      logger.error('Error getting client jobs', { error, client_id, params });
      return createResponse(false, 'Failed to retrieve client jobs', null, [error]);
    }
  }

  async getMarketplaceStats(): Promise<ApiResponse<MarketplaceJobStats>> {
    try {
      const stats = await this.marketplaceRepository.getMarketplaceStats();

      logger.debug('Marketplace stats retrieved', {
        totalJobs: stats.totalJobs,
        activeJobs: stats.activeJobs
      });

      return createResponse(true, 'Marketplace stats retrieved successfully', stats);
    } catch (error) {
      logger.error('Error getting marketplace stats', { error });
      return createResponse(false, 'Failed to retrieve marketplace stats', null, [error]);
    }
  }

  async getJobCreditCost(jobId: number): Promise<ApiResponse<MarketplaceCreditCost>> {
    try {
      const creditCost = await this.marketplaceRepository.getJobCreditCost(jobId);
      
      if (!creditCost) {
        return createResponse(false, 'Job not found', null);
      }

      return createResponse(true, 'Credit cost calculated successfully', creditCost);
    } catch (error) {
      logger.error('Error getting job credit cost', { error, jobId });
      return createResponse(false, 'Failed to calculate credit cost', null, [error]);
    }
  }

  async getRecommendedJobs(tradie_id: number, limit: number = 10): Promise<ApiResponse<MarketplaceJobSummary[]>> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      if (!tradieUser) {
        return createResponse(false, 'Tradie not found', null);
      }

      const tradieProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(tradie_id));
      
      const recommendedJobs = await this.marketplaceRepository.getRecommendedJobs(tradie_id, limit);

      for (const job of recommendedJobs) {
        const creditCost = calculateCreditCost(job.job_type, job.urgency_level).finalCost;
        const creditCheck = await this.creditService.checkCreditSufficiency(tradie_id, creditCost);
        (job as any).canAfford = creditCheck.sufficient;
      }

      logger.debug('Recommended jobs retrieved', {
        tradie_id,
        count: recommendedJobs.length
      });

      return createResponse(true, 'Recommended jobs retrieved successfully', recommendedJobs);
    } catch (error) {
      logger.error('Error getting recommended jobs', { error, tradie_id });
      return createResponse(false, 'Failed to retrieve recommended jobs', null, [error]);
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
          await this.processApplicationRefundsDirectly(expiredJob.id);
          processed++;
        } catch (error) {
          logger.error('Error processing expired job', { error, jobId: expiredJob.id });
          failed++;
        }
      }

      logger.info('Expired jobs processing completed', { processed, failed });

      return createResponse(true, 'Expired jobs processed successfully', { processed, failed });
    } catch (error) {
      logger.error('Error processing expired jobs', { error });
      return createResponse(false, 'Failed to process expired jobs', null, [error]);
    }
  }

  private async handleStatusChangeWorkflowDirectly(
    previousJob: MarketplaceJobEntity, 
    updatedJob: MarketplaceJobEntity
  ): Promise<void> {
    try {
      switch (updatedJob.status) {
        case MARKETPLACE_JOB_STATUS.ASSIGNED:
          await this.handleJobAssignmentDirectly(updatedJob);
          break;
        case MARKETPLACE_JOB_STATUS.COMPLETED:
          await this.handleJobCompletionDirectly(updatedJob);
          break;
        case MARKETPLACE_JOB_STATUS.CANCELLED:
          await this.handleJobCancellationDirectly(updatedJob);
          break;
      }
    } catch (error) {
      logger.error('Error in status change workflow', { error, jobId: updatedJob.id });
    }
  }

  private async handleJobAssignmentDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      await this.createJobInJobManagementSystemDirectly(job);
      await this.notifySelectedTradieDirectly(job);
      await this.notifyRejectedApplicantsDirectly(job);

      logger.info('Job assignment workflow completed', { jobId: job.id });
    } catch (error) {
      logger.error('Error in job assignment workflow', { error, jobId: job.id });
    }
  }

  private async handleJobCompletionDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      await this.updateTradieStatsDirectly(job);
      await this.updateClientCRMCompletionDirectly(job);
      await this.processJobCompletionRewardsDirectly(job);

      logger.info('Job completion workflow completed', { jobId: job.id });
    } catch (error) {
      logger.error('Error in job completion workflow', { error, jobId: job.id });
    }
  }

  private async handleJobCancellationDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      await this.processApplicationRefundsDirectly(job.id);
      await this.notifyAffectedPartiesDirectly(job);

      logger.info('Job cancellation workflow completed', { jobId: job.id });
    } catch (error) {
      logger.error('Error in job cancellation workflow', { error, jobId: job.id });
    }
  }

  private async createJobInJobManagementSystemDirectly(marketplaceJob: MarketplaceJobEntity): Promise<void> {
    try {
      const jobManagementData: CreateJobData = {
        title: marketplaceJob.title,
        description: marketplaceJob.description,
        job_type: marketplaceJob.job_type as job_type,
        priority: JobPriority.MEDIUM,
        client_name: marketplaceJob.client_name,
        client_email : marketplaceJob.client_email ,
        client_phone: marketplaceJob.client_phone,
        client_company: marketplaceJob.client_company,
        siteAddress: marketplaceJob.location,
        siteCity: marketplaceJob.location,
        siteState: '',
        sitePostcode: '',
        startDate: new Date(),
        dueDate: marketplaceJob.date_required,
        estimatedDuration: 8,
        notes: [`Created from marketplace job #${marketplaceJob.id}`]
      };

      const createdJob = await this.jobService.createJob(marketplaceJob.selectedtradie_id, jobManagementData);

      await this.redis.publish('job_management:job_created_from_marketplace', JSON.stringify({
        marketplace_job_id : marketplaceJob.id,
        newJobId: createdJob.id,
        timestamp: new Date().toISOString()
      }));

      logger.debug('Job created in job management system', { 
        marketplace_job_id : marketplaceJob.id,
        newJobId: createdJob.id
      });
    } catch (error) {
      logger.error('Error creating job in job management system', { 
        error, 
        marketplace_job_id : marketplaceJob.id 
      });
    }
  }

  private async notifyRelevantTradiesDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      const notificationData = {
        jobId: job.id,
        title: job.title,
        job_type: job.job_type,
        location: job.location,
        urgency_level: job.urgency_level,
        estimated_budget: job.estimated_budget,
        creditCost: calculateCreditCost(job.job_type, job.urgency_level).finalCost
      };

      await this.emailService.sendJobNotificationEmail(
        job.client_email ,
        'New Job Posted',
        `Your job "${job.title}" has been posted to the marketplace.`
      );

      await this.redis.publish('notifications:new_job', JSON.stringify(notificationData));

      logger.debug('Relevant tradies notified of new job', { jobId: job.id });
    } catch (error) {
      logger.error('Error notifying relevant tradies', { error, jobId: job.id });
    }
  }

  private async notifyApplicationsOfJobUpdateDirectly(jobId: number, updateData: MarketplaceJobUpdateData): Promise<void> {
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

  private async updateClientCRMDirectly(client_id: number, job: MarketplaceJobEntity): Promise<void> {
    try {
      const clientUser = await this.userService.getUserById(this.convertUserIdToString(client_id));
      const clientProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(client_id));

      const crmData = {
        client_id,
        jobId: job.id,
        job_type: job.job_type,
        estimatedValue: job.estimated_budget,
        location: job.location,
        source: 'marketplace',
        client_name: clientUser?.username || job.client_name,
        client_email : clientUser?.email || job.client_email ,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('crm:client_activity', JSON.stringify(crmData));

      logger.debug('Client CRM updated', { client_id, jobId: job.id });
    } catch (error) {
      logger.error('Error updating client CRM', { error, client_id, jobId: job.id });
    }
  }

  private async updateClientCRMCompletionDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      const clientUser = await this.userService.getUserById(this.convertUserIdToString(job.client_id));

      const crmData = {
        client_id: job.client_id,
        jobId: job.id,
        status: 'completed',
        completionDate: new Date().toISOString(),
        client_email : clientUser?.email || job.client_email 
      };

      await this.redis.publish('crm:job_completed', JSON.stringify(crmData));

      logger.debug('Client CRM completion updated', { client_id: job.client_id, jobId: job.id });
    } catch (error) {
      logger.error('Error updating client CRM completion', { error, jobId: job.id });
    }
  }

  private async notifySelectedTradieDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(job.selectedtradie_id));
      
      if (tradieUser) {
        await this.emailService.sendJobNotificationEmail(
          tradieUser.email,
          'Application Selected',
          `Congratulations! Your application for "${job.title}" has been selected.`
        );

        if (tradieUser.username) {
          await this.SmsService.sendSMS(
            tradieUser.username,
            `Your application for "${job.title}" has been selected. Check your email for details.`
          );
        }
      }

      const notificationData = {
        type: 'application_selected',
        jobId: job.id,
        jobTitle: job.title,
        client_name: job.client_name,
        tradie_id: job.selectedtradie_id,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:application_selected', JSON.stringify(notificationData));

      logger.debug('Selected tradie notified', { jobId: job.id, tradie_id: job.selectedtradie_id });
    } catch (error) {
      logger.error('Error notifying selected tradie', { error, jobId: job.id });
    }
  }

  private async notifyRejectedApplicantsDirectly(job: MarketplaceJobEntity): Promise<void> {
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

  private async updateTradieStatsDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(job.selectedtradie_id));
      
      if (tradieUser) {
        const tradieProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(job.selectedtradie_id));
        
        if (tradieProfile) {
          await this.profileService.updateProfile(this.convertUserIdToString(job.selectedtradie_id), {
            bio: tradieProfile.bio ? `${tradieProfile.bio} | Completed marketplace job: ${job.title}` : `Completed marketplace job: ${job.title}`
          });
        }
      }

      const statsData = {
        tradie_id: job.selectedtradie_id,
        jobId: job.id,
        job_type: job.job_type,
        completionDate: new Date().toISOString()
      };

      await this.redis.publish('tradie_stats:job_completed', JSON.stringify(statsData));

      logger.debug('Tradie stats updated', { jobId: job.id, tradie_id: job.selectedtradie_id });
    } catch (error) {
      logger.error('Error updating tradie stats', { error, jobId: job.id });
    }
  }

  private async processJobCompletionRewardsDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      const bonusCredits = Math.floor(job.estimated_budget / 100);
      
      if (bonusCredits > 0) {
        await this.creditService.addCredits(
          job.selectedtradie_id,
          bonusCredits,
          'job_completion_bonus'
        );
      }

      const rewardData = {
        jobId: job.id,
        client_id: job.client_id,
        tradie_id: job.selectedtradie_id,
        jobValue: job.estimated_budget,
        bonusCredits,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('rewards:job_completed', JSON.stringify(rewardData));

      logger.debug('Job completion rewards processed', { jobId: job.id, bonusCredits });
    } catch (error) {
      logger.error('Error processing job completion rewards', { error, jobId: job.id });
    }
  }

  private async processApplicationRefundsDirectly(jobId: number): Promise<void> {
    try {
      const applications = await this.marketplaceRepository.getJobApplications(jobId);
      
      for (const application of applications) {
        if (application.status !== 'selected') {
          const refundAmount = application.credits_used;
          
          await this.creditService.refundCredits(
            application.tradie_id,
            refundAmount,
            `Job cancelled - refund for application to job #${jobId}`
          );

          logger.debug('Credits refunded for application', {
            jobId,
            tradie_id: application.tradie_id,
            refundAmount
          });
        }
      }

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

  private async notifyAffectedPartiesDirectly(job: MarketplaceJobEntity): Promise<void> {
    try {
      const clientUser = await this.userService.getUserById(this.convertUserIdToString(job.client_id));
      
      if (clientUser) {
        await this.emailService.sendJobNotificationEmail(
          clientUser.email,
          'Job Cancelled',
          `Your job "${job.title}" has been cancelled. All application fees have been refunded.`
        );
      }

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

  private async publishJobCreatedEvent(job: MarketplaceJobEntity): Promise<void> {
    try {
      const eventData = {
        jobId: job.id,
        client_id: job.client_id,
        job_type: job.job_type,
        location: job.location,
        urgency_level: job.urgency_level,
        estimated_budget: job.estimated_budget,
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
        client_id: updatedJob.client_id,
        previousData: {
          title: previousJob.title,
          description: previousJob.description,
          estimated_budget: previousJob.estimated_budget
        },
        updatedData: {
          title: updatedJob.title,
          description: updatedJob.description,
          estimated_budget: updatedJob.estimated_budget
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
        client_id: updatedJob.client_id,
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
        client_id: job.client_id,
        job_type: job.job_type,
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
      job_type: searchParams.job_type,
      location: searchParams.location,
      urgency_level: searchParams.urgency_level,
      minBudget: searchParams.minBudget,
      maxBudget: searchParams.maxBudget,
      dateRange: searchParams.dateRange,
      excludeApplied: searchParams.excludeApplied,
      tradie_id: searchParams.tradie_id
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


