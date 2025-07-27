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
import { logger, createResponse } from '../../shared/utils';
import { DatabaseError, ApiResponse } from '../../shared/types';

import { UserService } from '../../auth/services/user.service';
import { ProfileService } from '../../auth/services/profile.service';
import { EmailService } from '../../auth/services/email.service';
import { SMSService } from '../../auth/services/sms.service';

export class ApplicationService extends EventEmitter {
  private applicationRepository: ApplicationRepository;
  private marketplaceRepository: MarketplaceRepository;
  private redis: Redis;
  
  private userService: UserService;
  private profileService: ProfileService;
  private emailService: EmailService;
  private smsService: SMSService;

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

    this.userService = new UserService();
    this.profileService = new ProfileService();
    this.emailService = new EmailService();
    this.smsService = new SMSService();

    this.setupEventListeners();
  }

  private convertUserIdToString(userId: number): string {
    return userId.toString();
  }

  private convertUserIdToNumber(userId: string): number {
    return parseInt(userId, 10);
  }

  async createApplication(
    applicationData: JobApplicationCreateData, 
    tradie_id: number
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const validationResult = validateApplicationData(applicationData);
      if (!validationResult.isValid) {
        return createResponse(false, 'Validation failed', null, validationResult.errors);
      }

      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      if (!tradieUser) {
        return createResponse(false, 'Tradie not found', null);
      }

      const tradieProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(tradie_id));
      if (!tradieProfile) {
        return createResponse(false, 'Tradie profile not found', null);
      }

      const sanitizedData = sanitizeApplicationData(applicationData);

      const marketplaceJob = await this.marketplaceRepository.findJobById(sanitizedData.marketplace_job_id );
      if (!marketplaceJob) {
        return createResponse(false, 'Job not found', null);
      }

      if (marketplaceJob.status !== MARKETPLACE_JOB_STATUS.AVAILABLE) {
        return createResponse(false, 'Job is no longer available for applications', null);
      }

      if (marketplaceJob.isExpired) {
        return createResponse(false, 'Job has expired', null);
      }

      const application = await this.applicationRepository.createApplication(sanitizedData, tradie_id);

      await this.publishApplicationCreatedEvent(application, marketplaceJob);
      await this.notifyClientOfNewApplicationDirectly(application, marketplaceJob);
      await this.updateTradieApplicationStatsDirectly(tradie_id);

      logger.info('Job application created successfully', {
        applicationId: application.id,
        tradie_id,
        marketplace_job_id : sanitizedData.marketplace_job_id ,
        credits_used: application.credits_used
      });

      return createResponse(true, 'Application submitted successfully', application);
    } catch (error) {
      logger.error('Error creating job application', { error, applicationData, tradie_id });
      return createResponse(false, 'Failed to submit application', null, [error]);
    }
  }

  async getApplication(id: number, userId?: number): Promise<ApiResponse<JobApplicationDetails>> {
    try {
      const applicationDetails = await this.applicationRepository.findApplicationDetails(id);
      
      if (!applicationDetails) {
        return createResponse(false, 'Application not found', null);
      }

      if (userId) {
        const user = await this.userService.getUserById(this.convertUserIdToString(userId));
        if (!user) {
          return createResponse(false, 'User not found', null);
        }

        if (!this.canUserAccessApplication(applicationDetails, userId)) {
          return createResponse(false, 'Unauthorized access', null);
        }
      }

      logger.debug('Application retrieved', { applicationId: id, userId });

      return createResponse(true, 'Application retrieved successfully', applicationDetails);
    } catch (error) {
      logger.error('Error getting application', { error, applicationId: id });
      return createResponse(false, 'Failed to retrieve application', null, [error]);
    }
  }

  async getApplicationsByJob(
    marketplace_job_id : number, 
    client_id?: number
  ): Promise<ApiResponse<JobApplicationSummary[]>> {
    try {
      if (client_id) {
        const clientUser = await this.userService.getUserById(this.convertUserIdToString(client_id));
        if (!clientUser) {
          return createResponse(false, 'Client not found', null);
        }

        const jobOwnership = await this.marketplaceRepository.validateJobOwnership(marketplace_job_id , client_id);
        if (!jobOwnership) {
          return createResponse(false, 'Unauthorized access', null);
        }
      }

      const applications = await this.applicationRepository.findApplicationsByJob(marketplace_job_id );
      const rankedApplications = rankApplications(applications);

      logger.debug('Applications by job retrieved', {
        marketplace_job_id ,
        count: rankedApplications.length
      });

      return createResponse(true, 'Applications retrieved successfully', rankedApplications);
    } catch (error) {
      logger.error('Error getting applications by job', { error, marketplace_job_id  });
      return createResponse(false, 'Failed to retrieve applications', null, [error]);
    }
  }

  async getTradieApplications(
    tradie_id: number, 
    params: { page: number; limit: number; status?: string }
  ): Promise<ApiResponse<{
    applications: JobApplicationSummary[];
    totalCount: number;
    hasMore: boolean;
  }>> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      if (!tradieUser) {
        return createResponse(false, 'Tradie not found', null);
      }

      const result = await this.applicationRepository.findApplicationsByTradie(tradie_id, params);

      logger.debug('Tradie applications retrieved', {
        tradie_id,
        totalCount: result.totalCount,
        returnedCount: result.applications.length
      });

      return createResponse(true, 'Applications retrieved successfully', result);
    } catch (error) {
      logger.error('Error getting tradie applications', { error, tradie_id, params });
      return createResponse(false, 'Failed to retrieve applications', null, [error]);
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
      if (searchParams.tradie_id) {
        const tradieUser = await this.userService.getUserById(this.convertUserIdToString(searchParams.tradie_id));
        if (!tradieUser) {
          return createResponse(false, 'Tradie not found', null);
        }
      }

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

      return createResponse(true, 'Applications retrieved successfully', response);
    } catch (error) {
      logger.error('Error searching applications', { error, searchParams });
      return createResponse(false, 'Failed to search applications', null, [error]);
    }
  }

  async updateApplication(
    id: number, 
    updateData: JobApplicationUpdateData, 
    tradie_id: number
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      if (!tradieUser) {
        return createResponse(false, 'Tradie not found', null);
      }

      const existingApplication = await this.applicationRepository.findApplicationById(id);
      if (!existingApplication) {
        return createResponse(false, 'Application not found', null);
      }

      if (existingApplication.tradie_id !== tradie_id) {
        return createResponse(false, 'Unauthorized access', null);
      }

      if (!canModifyApplication(existingApplication)) {
        return createResponse(false, 'Application cannot be modified in current status', null);
      }

      const updatedApplication = await this.applicationRepository.updateApplication(id, updateData, tradie_id);
      if (!updatedApplication) {
        return createResponse(false, 'Failed to update application', null);
      }

      await this.publishApplicationUpdatedEvent(existingApplication, updatedApplication);
      await this.notifyClientOfApplicationUpdateDirectly(updatedApplication);

      logger.info('Application updated successfully', {
        applicationId: id,
        tradie_id,
        changes: Object.keys(updateData)
      });

      return createResponse(true, 'Application updated successfully', updatedApplication);
    } catch (error) {
      logger.error('Error updating application', { error, applicationId: id, updateData });
      return createResponse(false, 'Failed to update application', null, [error]);
    }
  }

  async updateApplicationStatus(
    id: number, 
    statusUpdate: ApplicationStatusUpdate,
    client_id?: number
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const existingApplication = await this.applicationRepository.findApplicationById(id);
      if (!existingApplication) {
        return createResponse(false, 'Application not found', null);
      }

      if (client_id) {
        const clientUser = await this.userService.getUserById(this.convertUserIdToString(client_id));
        if (!clientUser) {
          return createResponse(false, 'Client not found', null);
        }

        const jobOwnership = await this.marketplaceRepository.validateJobOwnership(
          existingApplication.marketplace_job_id , 
          client_id
        );
        if (!jobOwnership) {
          return createResponse(false, 'Unauthorized access', null);
        }
      }

      const transitionValidation = validateApplicationStatusTransition(
        existingApplication.status, 
        statusUpdate.status
      );
      if (!transitionValidation.isValid) {
        return createResponse(false, transitionValidation.error || 'Invalid status transition', null);
      }

      const updatedApplication = await this.applicationRepository.updateApplicationStatus(
        id, 
        statusUpdate.status, 
        statusUpdate.reason,
        statusUpdate.feedback
      );

      if (!updatedApplication) {
        return createResponse(false, 'Failed to update application status', null);
      }

      await this.publishApplicationStatusChangedEvent(existingApplication, updatedApplication, statusUpdate);
      await this.handleStatusChangeWorkflowDirectly(existingApplication, updatedApplication);

      logger.info('Application status updated successfully', {
        applicationId: id,
        previousStatus: existingApplication.status,
        newStatus: statusUpdate.status,
        reason: statusUpdate.reason
      });

      return createResponse(true, 'Application status updated successfully', updatedApplication);
    } catch (error) {
      logger.error('Error updating application status', { error, applicationId: id, statusUpdate });
      return createResponse(false, 'Failed to update application status', null, [error]);
    }
  }

  async withdrawApplication(
    id: number, 
    tradie_id: number, 
    withdrawalData: ApplicationWithdrawal
  ): Promise<ApiResponse<JobApplicationEntity>> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      if (!tradieUser) {
        return createResponse(false, 'Tradie not found', null);
      }

      const existingApplication = await this.applicationRepository.findApplicationById(id);
      if (!existingApplication) {
        return createResponse(false, 'Application not found', null);
      }

      if (existingApplication.tradie_id !== tradie_id) {
        return createResponse(false, 'Unauthorized access', null);
      }

      if (!canWithdrawApplication(existingApplication)) {
        return createResponse(false, 'Application cannot be withdrawn at this time', null);
      }

      const withdrawnApplication = await this.applicationRepository.withdrawApplication(
        id, 
        tradie_id, 
        withdrawalData
      );

      if (!withdrawnApplication) {
        return createResponse(false, 'Failed to withdraw application', null);
      }

      await this.publishApplicationWithdrawnEvent(withdrawnApplication, withdrawalData);
      await this.notifyClientOfApplicationWithdrawalDirectly(withdrawnApplication);

      if (withdrawalData.refundCredits) {
        await this.emailService.sendCreditRefundNotification(
          tradieUser.email,
          tradieUser.username,
          existingApplication.credits_used,
          'Application withdrawal'
        );
      }

      logger.info('Application withdrawn successfully', {
        applicationId: id,
        tradie_id,
        reason: withdrawalData.reason,
        refundCredits: withdrawalData.refundCredits
      });

      return createResponse(true, 'Application withdrawn successfully', withdrawnApplication);
    } catch (error) {
      logger.error('Error withdrawing application', { error, applicationId: id, tradie_id });
      return createResponse(false, 'Failed to withdraw application', null, [error]);
    }
  }

  async getTradieApplicationHistory(tradie_id: number): Promise<ApiResponse<TradieApplicationHistory>> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      if (!tradieUser) {
        return createResponse(false, 'Tradie not found', null);
      }

      const history = await this.applicationRepository.getTradieApplicationHistory(tradie_id);

      logger.debug('Tradie application history retrieved', {
        tradie_id,
        totalApplications: history.totalApplications,
        conversionRate: history.conversionRate
      });

      return createResponse(true, 'Application history retrieved successfully', history);
    } catch (error) {
      logger.error('Error getting tradie application history', { error, tradie_id });
      return createResponse(false, 'Failed to retrieve application history', null, [error]);
    }
  }

  async getApplicationAnalytics(params: {
    tradie_id?: number;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month' | 'status';
  }): Promise<ApiResponse<ApplicationAnalytics>> {
    try {
      if (params.tradie_id) {
        const tradieUser = await this.userService.getUserById(this.convertUserIdToString(params.tradie_id));
        if (!tradieUser) {
          return createResponse(false, 'Tradie not found', null);
        }
      }

      const analytics = await this.applicationRepository.getApplicationAnalytics(params);

      logger.debug('Application analytics retrieved', {
        totalApplications: analytics.totalApplications,
        conversionRate: analytics.conversionRate,
        params
      });

      return createResponse(true, 'Analytics retrieved successfully', analytics);
    } catch (error) {
      logger.error('Error getting application analytics', { error, params });
      return createResponse(false, 'Failed to retrieve analytics', null, [error]);
    }
  }

  private async handleStatusChangeWorkflowDirectly(
    previousApplication: JobApplicationEntity, 
    updatedApplication: JobApplicationEntity
  ): Promise<void> {
    try {
      switch (updatedApplication.status) {
        case APPLICATION_STATUS.SELECTED:
          await this.handleApplicationSelectionDirectly(updatedApplication);
          break;
        case APPLICATION_STATUS.REJECTED:
          await this.handleApplicationRejectionDirectly(updatedApplication);
          break;
        case APPLICATION_STATUS.UNDER_REVIEW:
          await this.handleApplicationUnderReviewDirectly(updatedApplication);
          break;
      }
    } catch (error) {
      logger.error('Error in application status change workflow', { 
        error, 
        applicationId: updatedApplication.id 
      });
    }
  }

  private async handleApplicationSelectionDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      await this.notifyTradieOfSelectionDirectly(application);
      await this.updateMarketplaceJobStatus(application.marketplace_job_id , MARKETPLACE_JOB_STATUS.ASSIGNED);
      await this.rejectOtherApplicationsDirectly(application.marketplace_job_id , application.id);
      await this.updateTradieSuccessStatsDirectly(application.tradie_id);

      const eventData = {
        applicationId: application.id,
        tradie_id: application.tradie_id,
        marketplace_job_id : application.marketplace_job_id ,
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

  private async handleApplicationRejectionDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      await this.notifyTradieOfRejectionDirectly(application);
      await this.updateTradieRejectionStatsDirectly(application.tradie_id);

      const eventData = {
        applicationId: application.id,
        tradie_id: application.tradie_id,
        marketplace_job_id : application.marketplace_job_id ,
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

  private async handleApplicationUnderReviewDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      await this.notifyTradieOfReviewDirectly(application);

      logger.info('Application under review workflow completed', { applicationId: application.id });
    } catch (error) {
      logger.error('Error in application under review workflow', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyClientOfNewApplicationDirectly(
    application: JobApplicationEntity, 
    marketplaceJob: any
  ): Promise<void> {
    try {
      const clientUser = await this.userService.getUserById(this.convertUserIdToString(marketplaceJob.client_id));
      
      if (clientUser) {
        await this.emailService.sendWelcomeEmail(
          clientUser.email,
          `New Application for "${marketplaceJob.title}"`,
          'client'
        );

        const tradieUser = await this.userService.getUserById(this.convertUserIdToString(application.tradie_id));
        if (tradieUser) {
          const message = `New application received for "${marketplaceJob.title}" from ${tradieUser.username}. Quote: $${application.custom_quote}`;
          await this.smsService.sendSMS(marketplaceJob.client_phone || clientUser.username, message);
        }
      }

      const notificationData = {
        type: 'new_application',
        applicationId: application.id,
        jobId: marketplaceJob.id,
        jobTitle: marketplaceJob.title,
        tradie_id: application.tradie_id,
        custom_quote: application.custom_quote,
        proposed_timeline: application.proposed_timeline,
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

  private async notifyClientOfApplicationUpdateDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      const marketplaceJob = await this.marketplaceRepository.findJobById(application.marketplace_job_id );
      if (marketplaceJob) {
        const clientUser = await this.userService.getUserById(this.convertUserIdToString(marketplaceJob.client_id));
        
        if (clientUser) {
          await this.emailService.sendWelcomeEmail(
            clientUser.email,
            `Application Updated for "${marketplaceJob.title}"`,
            'client'
          );

          const message = `Application for "${marketplaceJob.title}" has been updated. New quote: $${application.custom_quote}`;
          await this.smsService.sendSMS(marketplaceJob.client_phone || clientUser.username, message);
        }
      }

      const notificationData = {
        type: 'application_updated',
        applicationId: application.id,
        marketplace_job_id : application.marketplace_job_id ,
        tradie_id: application.tradie_id,
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

  private async notifyClientOfApplicationWithdrawalDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      const marketplaceJob = await this.marketplaceRepository.findJobById(application.marketplace_job_id );
      if (marketplaceJob) {
        const clientUser = await this.userService.getUserById(this.convertUserIdToString(marketplaceJob.client_id));
        
        if (clientUser) {
          await this.emailService.sendWelcomeEmail(
            clientUser.email,
            `Application Withdrawn for "${marketplaceJob.title}"`,
            'client'
          );

          const message = `An application for "${marketplaceJob.title}" has been withdrawn.`;
          await this.smsService.sendSMS(marketplaceJob.client_phone || clientUser.username, message);
        }
      }

      const notificationData = {
        type: 'application_withdrawn',
        applicationId: application.id,
        marketplace_job_id : application.marketplace_job_id ,
        tradie_id: application.tradie_id,
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

  private async updateTradieApplicationStatsDirectly(tradie_id: number): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      
      if (tradieUser) {
        const tradieProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(tradie_id));
        
        if (tradieProfile) {
          await this.profileService.updateProfile(this.convertUserIdToString(tradie_id), {
            bio: tradieProfile.bio ? `${tradieProfile.bio} | Recent application submitted` : 'Recent application submitted'
          });
        }
      }

      const statsData = {
        tradie_id,
        action: 'application_submitted',
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('tradie_stats:application_submitted', JSON.stringify(statsData));

      logger.debug('Tradie application stats updated', { tradie_id });
    } catch (error) {
      logger.error('Error updating tradie application stats', { error, tradie_id });
    }
  }

  private async notifyTradieOfSelectionDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(application.tradie_id));
      const marketplaceJob = await this.marketplaceRepository.findJobById(application.marketplace_job_id );
      
      if (tradieUser && marketplaceJob) {
        await this.emailService.sendWelcomeEmail(
          tradieUser.email,
          `Congratulations! Application Selected for "${marketplaceJob.title}"`,
          'tradie'
        );

        const message = `Congratulations! Your application for "${marketplaceJob.title}" has been selected. Check your email for details.`;
        await this.smsService.sendSMS(tradieUser.username, message);
      }

      const notificationData = {
        type: 'application_selected',
        applicationId: application.id,
        tradie_id: application.tradie_id,
        marketplace_job_id : application.marketplace_job_id ,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:tradie_application_selected', JSON.stringify(notificationData));

      logger.debug('Tradie notified of application selection', { 
        applicationId: application.id, 
        tradie_id: application.tradie_id 
      });
    } catch (error) {
      logger.error('Error notifying tradie of selection', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyTradieOfRejectionDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(application.tradie_id));
      const marketplaceJob = await this.marketplaceRepository.findJobById(application.marketplace_job_id );
      
      if (tradieUser && marketplaceJob) {
        await this.emailService.sendWelcomeEmail(
          tradieUser.email,
          `Application Update for "${marketplaceJob.title}"`,
          'tradie'
        );

        const message = `Your application for "${marketplaceJob.title}" was not selected this time. Keep applying for more opportunities!`;
        await this.smsService.sendSMS(tradieUser.username, message);
      }

      const notificationData = {
        type: 'application_rejected',
        applicationId: application.id,
        tradie_id: application.tradie_id,
        marketplace_job_id : application.marketplace_job_id ,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:tradie_application_rejected', JSON.stringify(notificationData));

      logger.debug('Tradie notified of application rejection', { 
        applicationId: application.id, 
        tradie_id: application.tradie_id 
      });
    } catch (error) {
      logger.error('Error notifying tradie of rejection', { 
        error, 
        applicationId: application.id 
      });
    }
  }

  private async notifyTradieOfReviewDirectly(application: JobApplicationEntity): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(application.tradie_id));
      const marketplaceJob = await this.marketplaceRepository.findJobById(application.marketplace_job_id );
      
      if (tradieUser && marketplaceJob) {
        await this.emailService.sendWelcomeEmail(
          tradieUser.email,
          `Application Under Review for "${marketplaceJob.title}"`,
          'tradie'
        );

        const message = `Your application for "${marketplaceJob.title}" is now under review. We'll notify you of any updates.`;
        await this.smsService.sendSMS(tradieUser.username, message);
      }

      const notificationData = {
        type: 'application_under_review',
        applicationId: application.id,
        tradie_id: application.tradie_id,
        marketplace_job_id : application.marketplace_job_id ,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('notifications:tradie_application_review', JSON.stringify(notificationData));

      logger.debug('Tradie notified of application review', { 
        applicationId: application.id, 
        tradie_id: application.tradie_id 
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

  private async rejectOtherApplicationsDirectly(marketplace_job_id : number, selectedApplicationId: number): Promise<void> {
    try {
      const applications = await this.applicationRepository.findApplicationsByJob(marketplace_job_id );
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

        for (const applicationId of otherApplicationIds) {
          const rejectedApp = await this.applicationRepository.findApplicationById(applicationId);
          if (rejectedApp) {
            await this.notifyTradieOfRejectionDirectly(rejectedApp);
          }
        }
      }

      logger.debug('Other applications rejected', { 
        marketplace_job_id , 
        rejectedCount: otherApplicationIds.length 
      });
    } catch (error) {
      logger.error('Error rejecting other applications', { error, marketplace_job_id  });
    }
  }

  private async updateTradieSuccessStatsDirectly(tradie_id: number): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      
      if (tradieUser) {
        const tradieProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(tradie_id));
        
        if (tradieProfile) {
          await this.profileService.updateProfile(this.convertUserIdToString(tradie_id), {
            bio: tradieProfile.bio ? `${tradieProfile.bio} | Successful application` : 'Successful application'
          });
        }
      }

      const statsData = {
        tradie_id,
        action: 'application_successful',
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('tradie_stats:application_successful', JSON.stringify(statsData));

      logger.debug('Tradie success stats updated', { tradie_id });
    } catch (error) {
      logger.error('Error updating tradie success stats', { error, tradie_id });
    }
  }

  private async updateTradieRejectionStatsDirectly(tradie_id: number): Promise<void> {
    try {
      const tradieUser = await this.userService.getUserById(this.convertUserIdToString(tradie_id));
      
      if (tradieUser) {
        const tradieProfile = await this.profileService.getProfileByUserId(this.convertUserIdToString(tradie_id));
        
        if (tradieProfile) {
          await this.profileService.updateProfile(this.convertUserIdToString(tradie_id), {
            bio: tradieProfile.bio ? `${tradieProfile.bio} | Application experience` : 'Application experience'
          });
        }
      }

      const statsData = {
        tradie_id,
        action: 'application_rejected',
        timestamp: new Date().toISOString()
      };

      await this.redis.publish('tradie_stats:application_rejected', JSON.stringify(statsData));

      logger.debug('Tradie rejection stats updated', { tradie_id });
    } catch (error) {
      logger.error('Error updating tradie rejection stats', { error, tradie_id });
    }
  }

  private async publishApplicationCreatedEvent(
    application: JobApplicationEntity, 
    marketplaceJob: any
  ): Promise<void> {
    try {
      const eventData = {
        applicationId: application.id,
        tradie_id: application.tradie_id,
        marketplace_job_id : application.marketplace_job_id ,
        jobTitle: marketplaceJob.title,
        custom_quote: application.custom_quote,
        credits_used: application.credits_used,
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
        tradie_id: updatedApplication.tradie_id,
        marketplace_job_id : updatedApplication.marketplace_job_id ,
        previousData: {
          custom_quote: previousApplication.custom_quote,
          proposed_timeline: previousApplication.proposed_timeline
        },
        updatedData: {
          custom_quote: updatedApplication.custom_quote,
          proposed_timeline: updatedApplication.proposed_timeline
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
        tradie_id: updatedApplication.tradie_id,
        marketplace_job_id : updatedApplication.marketplace_job_id ,
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
        tradie_id: application.tradie_id,
        marketplace_job_id : application.marketplace_job_id ,
        reason: withdrawalData.reason,
        refundCredits: withdrawalData.refundCredits,
        creditsRefunded: withdrawalData.refundCredits ? application.credits_used : 0,
        timestamp: new Date().toISOString()
      };

      await this.redis.publish(this.REDIS_CHANNELS.APPLICATION_WITHDRAWN, JSON.stringify(eventData));
      this.emit('application:withdrawn', eventData);

      logger.debug('Application withdrawn event published', { applicationId: application.id });
    } catch (error) {
      logger.error('Error publishing application withdrawn event', { error, applicationId: application.id });
    }
  }

  private canUserAccessApplication(application: JobApplicationDetails, userId: number): boolean {
    return application.tradie_id === userId || application.job.id === userId;
  }

  private extractFiltersFromSearch(searchParams: JobApplicationSearchParams): JobApplicationFilters {
    return {
      status: searchParams.status,
      tradie_id: searchParams.tradie_id,
      marketplace_job_id : searchParams.marketplace_job_id ,
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



