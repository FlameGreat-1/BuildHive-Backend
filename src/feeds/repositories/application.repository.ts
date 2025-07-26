import { Pool, PoolClient } from 'pg';
import { database } from '../../shared/database/connection';
import { logger } from '../../shared/utils';
import { DatabaseError } from '../../shared/types';
import { ApplicationModel } from '../models';
import { 
  JobApplicationEntity,
  JobApplicationCreateData,
  JobApplicationUpdateData,
  JobApplicationSummary,
  JobApplicationDetails,
  JobApplicationFilters,
  JobApplicationSearchParams,
  ApplicationStatusUpdate,
  ApplicationWithdrawal,
  TradieApplicationHistory,
  ApplicationAnalytics
} from '../types';
import {
  APPLICATION_STATUS,
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
  buildApplicationSearchQuery
} from '../utils';

export class ApplicationRepository {
  private db: Pool;
  private applicationModel: ApplicationModel;

  constructor() {
    this.db = database.getPool();
    this.applicationModel = new ApplicationModel();
  }

  async createApplication(
    applicationData: JobApplicationCreateData, 
    tradieId: number
  ): Promise<JobApplicationEntity> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const existingApplication = await this.applicationModel.checkExistingApplication(
        applicationData.marketplaceJobId, 
        tradieId
      );
      
      if (existingApplication) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Application already exists for this job');
      }

      const marketplaceJobQuery = `
        SELECT id, status, job_type, urgency_level 
        FROM marketplace_jobs 
        WHERE id = $1
      `;
      const jobResult = await client.query(marketplaceJobQuery, [applicationData.marketplaceJobId]);
      
      if (jobResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Marketplace job not found');
      }

      const marketplaceJob = jobResult.rows[0];
      if (marketplaceJob.status !== 'available') {
        await client.query('ROLLBACK');
        throw new DatabaseError('Job is no longer available for applications');
      }

      const creditCost = await this.calculateApplicationCreditCost(
        marketplaceJob.job_type, 
        marketplaceJob.urgency_level
      );

      await this.validateTradieCredits(client, tradieId, creditCost);

      const application = await this.applicationModel.create(applicationData, tradieId);

      await this.deductApplicationCredits(client, tradieId, application.id, creditCost);
      
      await client.query(
        'UPDATE marketplace_jobs SET application_count = application_count + 1 WHERE id = $1',
        [applicationData.marketplaceJobId]
      );

      await this.logApplicationActivity(client, application.id, 'APPLICATION_CREATED', {
        tradieId,
        marketplaceJobId: applicationData.marketplaceJobId,
        customQuote: applicationData.customQuote,
        creditsUsed: creditCost
      });

      await client.query('COMMIT');
      
      logger.info('Job application created successfully', {
        applicationId: application.id,
        tradieId,
        marketplaceJobId: applicationData.marketplaceJobId,
        creditsUsed: creditCost
      });

      return application;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating job application', { error, applicationData, tradieId });
      throw new DatabaseError('Failed to create job application', error);
    } finally {
      client.release();
    }
  }

  async findApplicationById(id: number): Promise<JobApplicationEntity | null> {
    try {
      const application = await this.applicationModel.findById(id);
      
      if (application) {
        logger.debug('Job application retrieved', { applicationId: id });
      }
      
      return application;
    } catch (error) {
      logger.error('Error finding job application by ID', { error, applicationId: id });
      throw new DatabaseError('Failed to find job application', error);
    }
  }

  async findApplicationDetails(id: number): Promise<JobApplicationDetails | null> {
    try {
      const application = await this.findApplicationById(id);
      if (!application) return null;

      const jobQuery = `
        SELECT id, title, job_type, location, estimated_budget, urgency_level, date_required
        FROM marketplace_jobs 
        WHERE id = $1
      `;
      const jobResult = await this.db.query(jobQuery, [application.marketplaceJobId]);
      
      if (jobResult.rows.length === 0) return null;

      const marketplaceJob = jobResult.rows[0];

      const tradieProfileQuery = `
        SELECT u.username, p.first_name, p.last_name, p.avatar, p.rating,
               tp.service_types, tp.hourly_rate, tp.completed_jobs, tp.years_experience,
               tms.total_applications, tms.successful_applications, tms.conversion_rate
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        LEFT JOIN tradie_profiles tp ON u.id = tp.user_id
        LEFT JOIN tradie_marketplace_stats tms ON u.id = tms.tradie_id
        WHERE u.id = $1
      `;

      const tradieResult = await this.db.query(tradieProfileQuery, [application.tradieId]);
      
      if (tradieResult.rows.length === 0) {
        throw new DatabaseError('Tradie profile not found');
      }

      const tradieProfile = tradieResult.rows[0];

      const applicationDetails: JobApplicationDetails = {
        ...application,
        job: {
          id: parseInt(marketplaceJob.id),
          title: marketplaceJob.title,
          jobType: marketplaceJob.job_type,
          location: marketplaceJob.location,
          estimatedBudget: parseFloat(marketplaceJob.estimated_budget) || 0,
          urgencyLevel: marketplaceJob.urgency_level,
          dateRequired: new Date(marketplaceJob.date_required)
        },
        tradie: {
          id: application.tradieId,
          username: tradieProfile.username,
          profile: {
            firstName: tradieProfile.first_name,
            lastName: tradieProfile.last_name,
            avatar: tradieProfile.avatar,
            rating: parseFloat(tradieProfile.rating) || 0,
            serviceTypes: tradieProfile.service_types || [],
            hourlyRate: parseFloat(tradieProfile.hourly_rate) || 0,
            completedJobs: parseInt(tradieProfile.completed_jobs) || 0,
            yearsExperience: parseInt(tradieProfile.years_experience) || 0,
            location: marketplaceJob.location
          },
          marketplaceStats: {
            totalApplications: parseInt(tradieProfile.total_applications) || 0,
            successfulApplications: parseInt(tradieProfile.successful_applications) || 0,
            conversionRate: parseFloat(tradieProfile.conversion_rate) || 0
          }
        },
        timeline: await this.getApplicationTimeline(id),
        canWithdraw: canWithdrawApplication(application),
        canModify: canModifyApplication(application)
      };

      return applicationDetails;
    } catch (error) {
      logger.error('Error finding job application details', { error, applicationId: id });
      throw new DatabaseError('Failed to find job application details', error);
    }
  }

  async findApplicationsByJob(marketplaceJobId: number): Promise<JobApplicationSummary[]> {
    try {
      const applications = await this.applicationModel.findByJobId(marketplaceJobId);
      
      logger.debug('Applications by job retrieved', {
        marketplaceJobId,
        count: applications.length
      });

      return applications;
    } catch (error) {
      logger.error('Error finding applications by job', { error, marketplaceJobId });
      throw new DatabaseError('Failed to find applications by job', error);
    }
  }

  async findApplicationsByTradie(
    tradieId: number, 
    params: { page: number; limit: number; status?: string }
  ): Promise<{
    applications: JobApplicationSummary[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const offset = (params.page - 1) * params.limit;
      const applications = await this.applicationModel.findByTradieId(tradieId, {
        limit: params.limit,
        offset
      });

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM job_applications 
        WHERE tradie_id = $1 
        ${params.status ? 'AND status = $2' : ''}
      `;
      
      const countParams = params.status ? [tradieId, params.status] : [tradieId];
      const countResult = await this.db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);

      const hasMore = totalCount > (params.page * params.limit);

      logger.debug('Tradie applications retrieved', {
        tradieId,
        totalCount,
        returnedCount: applications.length
      });

      return {
        applications,
        totalCount,
        hasMore
      };
    } catch (error) {
      logger.error('Error finding applications by tradie', { error, tradieId, params });
      throw new DatabaseError('Failed to find applications by tradie', error);
    }
  }

  async searchApplications(searchParams: JobApplicationSearchParams): Promise<{
    applications: JobApplicationSummary[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const result = await this.applicationModel.search(searchParams);
      
      const limit = searchParams.limit || 20;
      const hasMore = result.totalCount > ((searchParams.page || 1) * limit);

      logger.debug('Application search completed', {
        totalCount: result.totalCount,
        returnedCount: result.applications.length,
        searchParams
      });

      return {
        applications: result.applications,
        totalCount: result.totalCount,
        hasMore
      };
    } catch (error) {
      logger.error('Error searching applications', { error, searchParams });
      throw new DatabaseError('Failed to search applications', error);
    }
  }

  async updateApplication(
    id: number, 
    updateData: JobApplicationUpdateData, 
    tradieId: number
  ): Promise<JobApplicationEntity | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const existingApplication = await this.findApplicationById(id);
      if (!existingApplication) {
        await client.query('ROLLBACK');
        return null;
      }

      if (existingApplication.tradieId !== tradieId) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Unauthorized application update attempt');
      }

      if (!canModifyApplication(existingApplication)) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Application cannot be modified in current status');
      }

      const updatedApplication = await this.applicationModel.update(id, updateData);
      
      if (updatedApplication) {
        await this.logApplicationActivity(client, id, 'APPLICATION_UPDATED', {
          tradieId,
          changes: updateData,
          previousStatus: existingApplication.status
        });
      }

      await client.query('COMMIT');
      
      logger.info('Job application updated successfully', {
        applicationId: id,
        tradieId,
        changes: Object.keys(updateData)
      });

      return updatedApplication;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating job application', { error, applicationId: id, updateData });
      throw new DatabaseError('Failed to update job application', error);
    } finally {
      client.release();
    }
  }

  async updateApplicationStatus(
    id: number, 
    status: string, 
    reason?: string,
    feedback?: string
  ): Promise<JobApplicationEntity | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const existingApplication = await this.findApplicationById(id);
      if (!existingApplication) {
        await client.query('ROLLBACK');
        return null;
      }

      const updatedApplication = await this.applicationModel.updateStatus(id, status);
      
      if (updatedApplication) {
        await this.logApplicationActivity(client, id, 'STATUS_CHANGED', {
          previousStatus: existingApplication.status,
          newStatus: status,
          reason,
          feedback
        });

        if (status === APPLICATION_STATUS.SELECTED) {
          await this.handleApplicationSelection(client, updatedApplication);
        }
      }

      await client.query('COMMIT');
      
      logger.info('Application status updated', {
        applicationId: id,
        previousStatus: existingApplication.status,
        newStatus: status,
        reason
      });

      return updatedApplication;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating application status', { error, applicationId: id, status });
      throw new DatabaseError('Failed to update application status', error);
    } finally {
      client.release();
    }
  }

  async withdrawApplication(
    id: number, 
    tradieId: number, 
    withdrawalData: ApplicationWithdrawal
  ): Promise<JobApplicationEntity | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const existingApplication = await this.findApplicationById(id);
      if (!existingApplication) {
        await client.query('ROLLBACK');
        return null;
      }

      if (existingApplication.tradieId !== tradieId) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Unauthorized withdrawal attempt');
      }

      if (!canWithdrawApplication(existingApplication)) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Application cannot be withdrawn at this time');
      }

      const withdrawnApplication = await this.applicationModel.updateStatus(id, APPLICATION_STATUS.WITHDRAWN);
      
      if (withdrawnApplication && withdrawalData.refundCredits) {
        await this.refundApplicationCredits(client, tradieId, id, existingApplication.creditsUsed);
      }

      if (withdrawnApplication) {
        await this.logApplicationActivity(client, id, 'APPLICATION_WITHDRAWN', {
          tradieId,
          reason: withdrawalData.reason,
          refundCredits: withdrawalData.refundCredits,
          creditsRefunded: withdrawalData.refundCredits ? existingApplication.creditsUsed : 0
        });
      }

      await client.query('COMMIT');
      
      logger.info('Application withdrawn successfully', {
        applicationId: id,
        tradieId,
        reason: withdrawalData.reason,
        refundCredits: withdrawalData.refundCredits
      });

      return withdrawnApplication;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error withdrawing application', { error, applicationId: id, tradieId });
      throw new DatabaseError('Failed to withdraw application', error);
    } finally {
      client.release();
    }
  }

  async getTradieApplicationHistory(tradieId: number): Promise<TradieApplicationHistory> {
    try {
      const history = await this.applicationModel.getTradieApplicationHistory(tradieId);
      
      logger.debug('Tradie application history retrieved', {
        tradieId,
        totalApplications: history.totalApplications,
        conversionRate: history.conversionRate
      });

      return history;
    } catch (error) {
      logger.error('Error getting tradie application history', { error, tradieId });
      throw new DatabaseError('Failed to get tradie application history', error);
    }
  }

  async bulkUpdateApplicationStatus(
    applicationIds: number[], 
    status: string, 
    reason?: string,
    feedback?: string
  ): Promise<{ updated: number; failed: number[] }> {
    const client = await this.db.connect();
    const failedIds: number[] = [];
    let updatedCount = 0;
    
    try {
      await client.query('BEGIN');
      
      for (const applicationId of applicationIds) {
        try {
          const existingApplication = await this.findApplicationById(applicationId);
          if (!existingApplication) {
            failedIds.push(applicationId);
            continue;
          }

          await this.applicationModel.updateStatus(applicationId, status);
          
          await this.logApplicationActivity(client, applicationId, 'BULK_STATUS_UPDATE', {
            previousStatus: existingApplication.status,
            newStatus: status,
            reason,
            feedback,
            batchOperation: true
          });
          
          updatedCount++;
        } catch (error) {
          logger.warn('Failed to update application in bulk operation', { applicationId, error });
          failedIds.push(applicationId);
        }
      }

      await client.query('COMMIT');
      
      logger.info('Bulk application status update completed', {
        totalApplications: applicationIds.length,
        updated: updatedCount,
        failed: failedIds.length,
        newStatus: status
      });

      return { updated: updatedCount, failed: failedIds };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in bulk application status update', { error, applicationIds, status });
      throw new DatabaseError('Failed to bulk update application status', error);
    } finally {
      client.release();
    }
  }

  async getApplicationAnalytics(params: {
    tradieId?: number;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month' | 'status';
  }): Promise<ApplicationAnalytics> {
    try {
      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (params.tradieId) {
        whereClause += ` AND tradie_id = $${paramIndex}`;
        queryParams.push(params.tradieId);
        paramIndex++;
      }

      if (params.startDate) {
        whereClause += ` AND application_timestamp >= $${paramIndex}`;
        queryParams.push(params.startDate);
        paramIndex++;
      }

      if (params.endDate) {
        whereClause += ` AND application_timestamp <= $${paramIndex}`;
        queryParams.push(params.endDate);
        paramIndex++;
      }

      const analyticsQuery = `
        SELECT 
          COUNT(*) as total_applications,
          COUNT(CASE WHEN status = 'selected' THEN 1 END) as successful_applications,
          COUNT(CASE WHEN status = 'submitted' OR status = 'under_review' THEN 1 END) as pending_applications,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_applications,
          COUNT(CASE WHEN status = 'withdrawn' THEN 1 END) as withdrawn_applications,
          AVG(custom_quote) as average_quote,
          SUM(credits_used) as total_credits_spent
        FROM job_applications
        WHERE ${whereClause}
      `;

      const result = await this.db.query(analyticsQuery, queryParams);
      const stats = result.rows[0];

      const totalApplications = parseInt(stats.total_applications) || 0;
      const successfulApplications = parseInt(stats.successful_applications) || 0;

      const trendQuery = this.buildApplicationTrendQuery(params.groupBy || 'day', whereClause);
      const trendResult = await this.db.query(trendQuery, queryParams);

      const analytics: ApplicationAnalytics = {
        totalApplications,
        successfulApplications,
        pendingApplications: parseInt(stats.pending_applications) || 0,
        rejectedApplications: parseInt(stats.rejected_applications) || 0,
        withdrawnApplications: parseInt(stats.withdrawn_applications) || 0,
        conversionRate: totalApplications > 0 ? (successfulApplications / totalApplications) * 100 : 0,
        averageQuote: parseFloat(stats.average_quote) || 0,
        totalCreditsSpent: parseInt(stats.total_credits_spent) || 0,
        trendData: trendResult.rows.map(row => ({
          period: row.period,
          applications: parseInt(row.application_count),
          successful: parseInt(row.successful_count),
          conversionRate: parseInt(row.application_count) > 0 ? 
            (parseInt(row.successful_count) / parseInt(row.application_count)) * 100 : 0
        }))
      };

      logger.debug('Application analytics retrieved', {
        totalApplications: analytics.totalApplications,
        conversionRate: analytics.conversionRate,
        params
      });

      return analytics;
    } catch (error) {
      logger.error('Error getting application analytics', { error, params });
      throw new DatabaseError('Failed to get application analytics', error);
    }
  }

  async getApplicationsByStatus(status: string, limit: number = 50): Promise<JobApplicationSummary[]> {
    try {
      const applications = await this.applicationModel.getApplicationsByStatus(status, limit);
      
      logger.debug('Applications by status retrieved', {
        status,
        count: applications.length
      });

      return applications;
    } catch (error) {
      logger.error('Error getting applications by status', { error, status });
      throw new DatabaseError('Failed to get applications by status', error);
    }
  }

  async getApplicationStats(): Promise<{
    totalApplications: number;
    applicationsByStatus: Record<string, number>;
    averageQuote: number;
    totalCreditsSpent: number;
  }> {
    try {
      const stats = await this.applicationModel.getApplicationStats();
      
      logger.debug('Application stats retrieved', {
        totalApplications: stats.totalApplications,
        averageQuote: stats.averageQuote
      });

      return stats;
    } catch (error) {
      logger.error('Error getting application stats', { error });
      throw new DatabaseError('Failed to get application stats', error);
    }
  }

  async validateApplicationOwnership(applicationId: number, tradieId: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT 1 FROM job_applications WHERE id = $1 AND tradie_id = $2',
        [applicationId, tradieId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error validating application ownership', { error, applicationId, tradieId });
      return false;
    }
  }

  async getApplicationTimeline(applicationId: number): Promise<Array<{
    status: string;
    timestamp: Date;
    description: string;
    metadata?: Record<string, any>;
  }>> {
    try {
      const result = await this.db.query(
        `SELECT activity_type, metadata, created_at 
         FROM application_activity_log 
         WHERE application_id = $1 
         ORDER BY created_at ASC`,
        [applicationId]
      );

      const timeline = result.rows.map(row => ({
        status: row.activity_type,
        timestamp: new Date(row.created_at),
        description: this.getActivityDescription(row.activity_type),
        metadata: JSON.parse(row.metadata || '{}')
      }));

      return timeline;
    } catch (error) {
      logger.error('Error getting application timeline', { error, applicationId });
      throw new DatabaseError('Failed to get application timeline', error);
    }
  }

  private async calculateApplicationCreditCost(jobType: string, urgencyLevel: string): Promise<number> {
    const baseCost = MARKETPLACE_CREDIT_COSTS.BASE_APPLICATION_COST;
    const urgencyMultiplier = MARKETPLACE_CREDIT_COSTS.URGENCY_MULTIPLIERS[urgencyLevel as keyof typeof MARKETPLACE_CREDIT_COSTS.URGENCY_MULTIPLIERS] || 1.0;
    const jobTypeMultiplier = MARKETPLACE_CREDIT_COSTS.JOB_TYPE_MULTIPLIERS[jobType as keyof typeof MARKETPLACE_CREDIT_COSTS.JOB_TYPE_MULTIPLIERS] || 1.0;
    
    return Math.ceil(baseCost * urgencyMultiplier * jobTypeMultiplier);
  }

  private async validateTradieCredits(client: PoolClient, tradieId: number, requiredCredits: number): Promise<void> {
    const creditResult = await client.query(
      'SELECT balance FROM credits WHERE user_id = $1',
      [tradieId]
    );

    if (creditResult.rows.length === 0 || parseInt(creditResult.rows[0].balance) < requiredCredits) {
      throw new DatabaseError('Insufficient credits for application');
    }
  }

  private async deductApplicationCredits(
    client: PoolClient, 
    tradieId: number, 
    applicationId: number, 
    creditAmount: number
  ): Promise<void> {
    await client.query(
      'UPDATE credits SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
      [creditAmount, tradieId]
    );

    await client.query(
      `INSERT INTO credit_transactions 
       (user_id, transaction_type, amount, description, reference_id, created_at) 
       VALUES ($1, 'job_application', $2, 'Job application fee', $3, NOW())`,
      [tradieId, -creditAmount, applicationId]
    );

    await this.applicationModel.updateCreditsUsed(applicationId, creditAmount);
  }

  private async refundApplicationCredits(
    client: PoolClient, 
    tradieId: number, 
    applicationId: number, 
    creditAmount: number
  ): Promise<void> {
    await client.query(
      'UPDATE credits SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
      [creditAmount, tradieId]
    );

    await client.query(
      `INSERT INTO credit_transactions 
       (user_id, transaction_type, amount, description, reference_id, created_at) 
       VALUES ($1, 'application_refund', $2, 'Application withdrawal refund', $3, NOW())`,
      [tradieId, creditAmount, applicationId]
    );
  }

  private async handleApplicationSelection(client: PoolClient, application: JobApplicationEntity): Promise<void> {
    await client.query(
      `UPDATE job_applications 
       SET status = 'rejected' 
       WHERE marketplace_job_id = $1 AND id != $2 AND status IN ('submitted', 'under_review')`,
      [application.marketplaceJobId, application.id]
    );

    await client.query(
      `UPDATE marketplace_jobs 
       SET status = 'assigned' 
       WHERE id = $1`,
      [application.marketplaceJobId]
    );
  }

  private async logApplicationActivity(
    client: PoolClient, 
    applicationId: number, 
    activity: string, 
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await client.query(
        `INSERT INTO application_activity_log 
         (application_id, activity_type, metadata, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [applicationId, activity, JSON.stringify(metadata)]
      );
    } catch (error) {
      logger.warn('Failed to log application activity', { error, applicationId, activity });
    }
  }

  private buildApplicationTrendQuery(groupBy: string, whereClause: string): string {
    const groupByClause = {
      day: "DATE_TRUNC('day', application_timestamp)",
      week: "DATE_TRUNC('week', application_timestamp)",
      month: "DATE_TRUNC('month', application_timestamp)",
      status: 'status'
    }[groupBy] || "DATE_TRUNC('day', application_timestamp)";

    return `
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as application_count,
        COUNT(CASE WHEN status = 'selected' THEN 1 END) as successful_count
      FROM job_applications 
      WHERE ${whereClause}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
      LIMIT 30
    `;
  }

  private getActivityDescription(activityType: string): string {
    const descriptions: Record<string, string> = {
      'APPLICATION_CREATED': 'Application submitted',
      'APPLICATION_UPDATED': 'Application updated',
      'STATUS_CHANGED': 'Status changed',
      'APPLICATION_WITHDRAWN': 'Application withdrawn',
      'BULK_STATUS_UPDATE': 'Status updated in bulk operation'
    };
    return descriptions[activityType] || 'Activity recorded';
  }
}

