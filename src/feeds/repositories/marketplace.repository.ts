import { Pool, PoolClient } from 'pg';
import { database } from '../../shared/database/connection';
import { logger } from '../../shared/utils';
import { DatabaseError } from '../../shared/types';
import { MarketplaceJobModel } from '../models';
import { 
  MarketplaceJobEntity,
  MarketplaceJobCreateData,
  MarketplaceJobUpdateData,
  MarketplaceJobSummary,
  MarketplaceJobDetails,
  MarketplaceJobFilters,
  MarketplaceJobSearchParams,
  MarketplaceJobStats,
  MarketplaceJobExpiry,
  MarketplaceCreditCost
} from '../types';
import {
  MARKETPLACE_QUERIES,
  MARKETPLACE_JOB_STATUS,
  MARKETPLACE_LIMITS,
  MARKETPLACE_CREDIT_COSTS
} from '../../config/feeds';
import { 
  buildSearchQuery,
  calculateCreditCost,
  formatJobSummary,
  formatJobDetails,
  isJobExpired
} from '../utils';

export class MarketplaceRepository {
  private db: Pool;
  private marketplaceJobModel: MarketplaceJobModel;

  constructor() {
    this.db = database.getPool();
    this.marketplaceJobModel = new MarketplaceJobModel();
  }

  async createJob(jobData: MarketplaceJobCreateData, client_id: number): Promise<MarketplaceJobEntity> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const job = await this.marketplaceJobModel.create(jobData, client_id);
      
      await this.logJobActivity(client, job.id, 'JOB_CREATED', {
        client_id: job.client_id,
        job_type: job.job_type,
        location: job.location,
        estimatedBudget: job.estimatedBudget
      });

      await client.query('COMMIT');
      
      logger.info('Marketplace job created successfully', {
        jobId: job.id,
        client_id: job.client_id,
        job_type: job.job_type
      });

      return job;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating marketplace job', { error, jobData });
      throw new DatabaseError('Failed to create marketplace job', error);
    } finally {
      client.release();
    }
  }

  async findJobById(id: number): Promise<MarketplaceJobEntity | null> {
    try {
      const job = await this.marketplaceJobModel.findById(id);
      
      if (job) {
        logger.debug('Marketplace job retrieved', { jobId: id });
      }
      
      return job;
    } catch (error) {
      logger.error('Error finding marketplace job by ID', { error, jobId: id });
      throw new DatabaseError('Failed to find marketplace job', error);
    }
  }

  async findJobDetails(id: number, tradie_id?: number): Promise<MarketplaceJobDetails | null> {
    try {
      const job = await this.findJobById(id);
      if (!job) return null;

      const creditCost = calculateCreditCost(job.job_type, job.urgencyLevel);
      const hasApplied = tradie_id ? await this.checkTradieApplication(id, tradie_id) : false;
      
      const jobDetails = formatJobDetails(job, creditCost);
      jobDetails.applications.hasUserApplied = hasApplied;
      
      if (hasApplied && tradie_id) {
        const applicationId = await this.getTradieApplicationId(id, tradie_id);
        jobDetails.applications.userApplicationId = applicationId;
      }

      return jobDetails;
    } catch (error) {
      logger.error('Error finding marketplace job details', { error, jobId: id });
      throw new DatabaseError('Failed to find marketplace job details', error);
    }
  }

  async searchJobs(searchParams: MarketplaceJobSearchParams): Promise<{
    jobs: MarketplaceJobSummary[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const result = await this.marketplaceJobModel.search(searchParams);
      
      const jobsWithCreditCost = await Promise.all(
        result.jobs.map(async (job) => {
          const creditCost = calculateCreditCost(job.job_type, job.urgencyLevel);
          const hasApplied = searchParams.tradie_id ? 
            await this.checkTradieApplication(job.id, searchParams.tradie_id) : false;
          
          return formatJobSummary({
            ...job,
            creditCostForApplication: creditCost.finalCost
          } as MarketplaceJobEntity, creditCost.finalCost, hasApplied);
        })
      );

      const limit = searchParams.limit || 20;
      const hasMore = result.totalCount > ((searchParams.page || 1) * limit);

      logger.debug('Marketplace jobs search completed', {
        totalCount: result.totalCount,
        returnedCount: jobsWithCreditCost.length,
        searchParams
      });

      return {
        jobs: jobsWithCreditCost,
        totalCount: result.totalCount,
        hasMore
      };
    } catch (error) {
      logger.error('Error searching marketplace jobs', { error, searchParams });
      throw new DatabaseError('Failed to search marketplace jobs', error);
    }
  }

  async updateJob(id: number, updateData: MarketplaceJobUpdateData, client_id: number): Promise<MarketplaceJobEntity | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const existingJob = await this.findJobById(id);
      if (!existingJob) {
        await client.query('ROLLBACK');
        return null;
      }

      if (existingJob.client_id !== client_id) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Unauthorized job update attempt');
      }

      const updatedJob = await this.marketplaceJobModel.update(id, updateData);
      
      if (updatedJob) {
        await this.logJobActivity(client, id, 'JOB_UPDATED', {
          changes: updateData,
          previousStatus: existingJob.status,
          newStatus: updatedJob.status
        });
      }

      await client.query('COMMIT');
      
      logger.info('Marketplace job updated successfully', {
        jobId: id,
        client_id,
        changes: Object.keys(updateData)
      });

      return updatedJob;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating marketplace job', { error, jobId: id, updateData });
      throw new DatabaseError('Failed to update marketplace job', error);
    } finally {
      client.release();
    }
  }

  async updateJobStatus(id: number, status: string, reason?: string): Promise<MarketplaceJobEntity | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const existingJob = await this.findJobById(id);
      if (!existingJob) {
        await client.query('ROLLBACK');
        return null;
      }

      const updatedJob = await this.marketplaceJobModel.updateStatus(id, status);
      
      if (updatedJob) {
        await this.logJobActivity(client, id, 'STATUS_CHANGED', {
          previousStatus: existingJob.status,
          newStatus: status,
          reason
        });
      }

      await client.query('COMMIT');
      
      logger.info('Marketplace job status updated', {
        jobId: id,
        previousStatus: existingJob.status,
        newStatus: status,
        reason
      });

      return updatedJob;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating marketplace job status', { error, jobId: id, status });
      throw new DatabaseError('Failed to update marketplace job status', error);
    } finally {
      client.release();
    }
  }

  async incrementApplicationCount(jobId: number): Promise<void> {
    try {
      await this.marketplaceJobModel.incrementApplicationCount(jobId);
      
      logger.debug('Application count incremented', { jobId });
    } catch (error) {
      logger.error('Error incrementing application count', { error, jobId });
      throw new DatabaseError('Failed to increment application count', error);
    }
  }

  async findJobsByClient(client_id: number, params: { 
    page: number; 
    limit: number; 
    status?: string;
  }): Promise<{
    jobs: MarketplaceJobSummary[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const offset = (params.page - 1) * params.limit;
      const jobs = await this.marketplaceJobModel.findByClient(client_id, {
        limit: params.limit,
        offset
      });

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM marketplace_jobs 
        WHERE client_id = $1 
        ${params.status ? 'AND status = $2' : ''}
      `;
      
      const countParams = params.status ? [client_id, params.status] : [client_id];
      const countResult = await this.db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);

      const jobSummaries = jobs.map(job => formatJobSummary(job as MarketplaceJobEntity));
      const hasMore = totalCount > (params.page * params.limit);

      logger.debug('Client jobs retrieved', {
        client_id,
        totalCount,
        returnedCount: jobSummaries.length
      });

      return {
        jobs: jobSummaries,
        totalCount,
        hasMore
      };
    } catch (error) {
      logger.error('Error finding jobs by client', { error, client_id, params });
      throw new DatabaseError('Failed to find jobs by client', error);
    }
  }

  async deleteJob(id: number, client_id: number): Promise<MarketplaceJobEntity | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const existingJob = await this.findJobById(id);
      if (!existingJob) {
        await client.query('ROLLBACK');
        return null;
      }

      if (existingJob.applicationCount > 0) {
        await client.query('ROLLBACK');
        throw new DatabaseError('Cannot delete job with existing applications');
      }

      const deletedJob = await this.marketplaceJobModel.delete(id, client_id);
      
      if (deletedJob) {
        await this.logJobActivity(client, id, 'JOB_DELETED', {
          client_id,
          job_type: deletedJob.job_type,
          applicationCount: deletedJob.applicationCount
        });
      }

      await client.query('COMMIT');
      
      logger.info('Marketplace job deleted successfully', {
        jobId: id,
        client_id
      });

      return deletedJob;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting marketplace job', { error, jobId: id, client_id });
      throw new DatabaseError('Failed to delete marketplace job', error);
    } finally {
      client.release();
    }
  }

  async getMarketplaceStats(): Promise<MarketplaceJobStats> {
    try {
      const stats = await this.marketplaceJobModel.getStats();
      
      logger.debug('Marketplace stats retrieved', {
        totalJobs: stats.totalJobs,
        activeJobs: stats.activeJobs
      });

      return stats;
    } catch (error) {
      logger.error('Error getting marketplace stats', { error });
      throw new DatabaseError('Failed to get marketplace stats', error);
    }
  }

  async findExpiredJobs(): Promise<MarketplaceJobExpiry[]> {
    try {
      const expiredJobs = await this.marketplaceJobModel.findExpiredJobs();
      
      logger.info('Expired jobs found', { count: expiredJobs.length });

      return expiredJobs;
    } catch (error) {
      logger.error('Error finding expired jobs', { error });
      throw new DatabaseError('Failed to find expired jobs', error);
    }
  }

  async bulkUpdateJobStatus(
    jobIds: number[], 
    status: string, 
    reason?: string
  ): Promise<{ updated: number; failed: number[] }> {
    const client = await this.db.connect();
    const failedIds: number[] = [];
    let updatedCount = 0;
    
    try {
      await client.query('BEGIN');
      
      for (const jobId of jobIds) {
        try {
          const existingJob = await this.findJobById(jobId);
          if (!existingJob) {
            failedIds.push(jobId);
            continue;
          }

          await this.marketplaceJobModel.updateStatus(jobId, status);
          
          await this.logJobActivity(client, jobId, 'BULK_STATUS_UPDATE', {
            previousStatus: existingJob.status,
            newStatus: status,
            reason,
            batchOperation: true
          });
          
          updatedCount++;
        } catch (error) {
          logger.warn('Failed to update job in bulk operation', { jobId, error });
          failedIds.push(jobId);
        }
      }

      await client.query('COMMIT');
      
      logger.info('Bulk job status update completed', {
        totalJobs: jobIds.length,
        updated: updatedCount,
        failed: failedIds.length,
        newStatus: status
      });

      return { updated: updatedCount, failed: failedIds };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in bulk job status update', { error, jobIds, status });
      throw new DatabaseError('Failed to bulk update job status', error);
    } finally {
      client.release();
    }
  }

  async getJobAnalytics(params: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month' | 'job_type' | 'location';
  }): Promise<{
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    averageApplicationsPerJob: number;
    topjob_types: Array<{ job_type: string; count: number; percentage: number }>;
    topLocations: Array<{ location: string; count: number; percentage: number }>;
    trendData: Array<{ period: string; count: number; applications: number }>;
  }> {
    try {
      const baseStats = await this.getMarketplaceStats();
      
      let dateFilter = '';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (params.startDate) {
        dateFilter += ` AND created_at >= $${paramIndex}`;
        queryParams.push(params.startDate);
        paramIndex++;
      }

      if (params.endDate) {
        dateFilter += ` AND created_at <= $${paramIndex}`;
        queryParams.push(params.endDate);
        paramIndex++;
      }

      const trendQuery = this.buildTrendQuery(params.groupBy || 'day', dateFilter);
      const trendResult = await this.db.query(trendQuery, queryParams);

      logger.debug('Job analytics retrieved', {
        totalJobs: baseStats.totalJobs,
        dateRange: { start: params.startDate, end: params.endDate },
        groupBy: params.groupBy
      });

      return {
        totalJobs: baseStats.totalJobs,
        activeJobs: baseStats.activeJobs,
        completedJobs: baseStats.assignedJobs,
        averageApplicationsPerJob: baseStats.averageApplicationsPerJob,
        topjob_types: baseStats.topjob_types,
        topLocations: baseStats.topLocations,
        trendData: trendResult.rows.map(row => ({
          period: row.period,
          count: parseInt(row.job_count),
          applications: parseInt(row.application_count)
        }))
      };
    } catch (error) {
      logger.error('Error getting job analytics', { error, params });
      throw new DatabaseError('Failed to get job analytics', error);
    }
  }

  async getJobsByLocation(location: string, radius?: number): Promise<MarketplaceJobSummary[]> {
    try {
      const searchParams: MarketplaceJobSearchParams = {
        location,
        page: 1,
        limit: 50,
        sortBy: 'date_posted',
        sortOrder: 'desc'
      };

      const result = await this.searchJobs(searchParams);
      
      logger.debug('Jobs by location retrieved', {
        location,
        radius,
        count: result.jobs.length
      });

      return result.jobs;
    } catch (error) {
      logger.error('Error getting jobs by location', { error, location, radius });
      throw new DatabaseError('Failed to get jobs by location', error);
    }
  }

  async getJobsByjob_type(job_type: string, limit: number = 20): Promise<MarketplaceJobSummary[]> {
    try {
      const searchParams: MarketplaceJobSearchParams = {
        job_type,
        page: 1,
        limit,
        sortBy: 'date_posted',
        sortOrder: 'desc'
      };

      const result = await this.searchJobs(searchParams);
      
      logger.debug('Jobs by job type retrieved', {
        job_type,
        count: result.jobs.length
      });

      return result.jobs;
    } catch (error) {
      logger.error('Error getting jobs by job type', { error, job_type });
      throw new DatabaseError('Failed to get jobs by job type', error);
    }
  }

  async getRecommendedJobs(tradie_id: number, limit: number = 10): Promise<MarketplaceJobSummary[]> {
    try {
      const tradieProfileQuery = `
        SELECT service_types, location, hourly_rate, completed_jobs, rating
        FROM tradie_profiles tp
        JOIN profiles p ON tp.user_id = p.user_id
        WHERE tp.user_id = $1
      `;
      
      const profileResult = await this.db.query(tradieProfileQuery, [tradie_id]);
      
      if (profileResult.rows.length === 0) {
        return [];
      }

      const profile = profileResult.rows[0];
      const serviceTypes = profile.service_types || [];
      
      const recommendationQuery = `
        SELECT mj.*, 
               CASE 
                 WHEN mj.job_type = ANY($2::text[]) THEN 10
                 ELSE 0
               END +
               CASE 
                 WHEN mj.location ILIKE '%' || $3 || '%' THEN 5
                 ELSE 0
               END +
               CASE 
                 WHEN mj.urgency_level = 'urgent' THEN 4
                 WHEN mj.urgency_level = 'high' THEN 3
                 WHEN mj.urgency_level = 'medium' THEN 2
                 ELSE 1
               END as relevance_score
        FROM marketplace_jobs mj
        WHERE mj.status = 'available' 
          AND mj.expires_at > NOW()
          AND NOT EXISTS (
            SELECT 1 FROM job_applications ja 
            WHERE ja.marketplace_job_id = mj.id 
            AND ja.tradie_id = $1
          )
        ORDER BY relevance_score DESC, mj.created_at DESC
        LIMIT $4
      `;

      const result = await this.db.query(recommendationQuery, [
        tradie_id,
        serviceTypes,
        profile.location || '',
        limit
      ]);

      const recommendedJobs = await Promise.all(
        result.rows.map(async (row) => {
          const job = this.transformRowToEntity(row);
          const creditCost = calculateCreditCost(job.job_type, job.urgencyLevel);
          return formatJobSummary(job, creditCost.finalCost, false);
        })
      );

      logger.debug('Recommended jobs retrieved', {
        tradie_id,
        count: recommendedJobs.length,
        serviceTypes
      });

      return recommendedJobs;
    } catch (error) {
      logger.error('Error getting recommended jobs', { error, tradie_id });
      throw new DatabaseError('Failed to get recommended jobs', error);
    }
  }

  async getJobActivityLog(jobId: number): Promise<Array<{
    id: number;
    activityType: string;
    metadata: Record<string, any>;
    createdAt: Date;
  }>> {
    try {
      const result = await this.db.query(
        `SELECT id, activity_type, metadata, created_at 
         FROM marketplace_job_activity_log 
         WHERE job_id = $1 
         ORDER BY created_at DESC`,
        [jobId]
      );

      const activities = result.rows.map(row => ({
        id: parseInt(row.id),
        activityType: row.activity_type,
        metadata: JSON.parse(row.metadata || '{}'),
        createdAt: new Date(row.created_at)
      }));

      logger.debug('Job activity log retrieved', {
        jobId,
        activityCount: activities.length
      });

      return activities;
    } catch (error) {
      logger.error('Error getting job activity log', { error, jobId });
      throw new DatabaseError('Failed to get job activity log', error);
    }
  }

  async validateJobOwnership(jobId: number, client_id: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT 1 FROM marketplace_jobs WHERE id = $1 AND client_id = $2',
        [jobId, client_id]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error validating job ownership', { error, jobId, client_id });
      return false;
    }
  }

  async getJobCreditCost(jobId: number): Promise<MarketplaceCreditCost | null> {
    try {
      const job = await this.findJobById(jobId);
      if (!job) return null;

      return calculateCreditCost(job.job_type, job.urgencyLevel);
    } catch (error) {
      logger.error('Error getting job credit cost', { error, jobId });
      throw new DatabaseError('Failed to get job credit cost', error);
    }
  }

  async getJobApplications(jobId: number): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT ja.*, p.first_name, p.last_name, p.phone, p.email
         FROM job_applications ja
         JOIN profiles p ON ja.tradie_id = p.user_id
         WHERE ja.marketplace_job_id = $1
         ORDER BY ja.created_at DESC`,
        [jobId]
      );

      logger.debug('Job applications retrieved', {
        jobId,
        applicationCount: result.rows.length
      });

      return result.rows.map(row => ({
        id: parseInt(row.id),
        tradie_id: parseInt(row.tradie_id),
        marketplace_job_id : parseInt(row.marketplace_job_id),
        custom_quote: parseFloat(row.custom_quote) || 0,
        proposedTimeline: row.proposed_timeline,
        coverLetter: row.cover_letter,
        status: row.status,
        credits_used: parseInt(row.credits_used) || 0,
        applicationTimestamp: new Date(row.application_timestamp),
        tradie: {
          firstName: row.first_name,
          lastName: row.last_name,
          phone: row.phone,
          email: row.email
        }
      }));
    } catch (error) {
      logger.error('Error getting job applications', { error, jobId });
      throw new DatabaseError('Failed to get job applications', error);
    }
  }

  async createOrUpdateClientProfile(jobData: MarketplaceJobCreateData): Promise<number> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      let userId: number;
      const userResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [jobData.clientEmail]
      );

      if (userResult.rows.length > 0) {
        userId = parseInt(userResult.rows[0].id);
      } else {
        const newUserResult = await client.query(
          `INSERT INTO users (email, username, role, created_at) 
           VALUES ($1, $2, 'client', NOW()) RETURNING id`,
          [jobData.clientEmail, jobData.clientEmail.split('@')[0]]
        );
        userId = parseInt(newUserResult.rows[0].id);
      }

      await client.query(
        `INSERT INTO profiles (user_id, first_name, phone, company, created_at) 
         VALUES ($1, $2, $3, $4, NOW()) 
         ON CONFLICT (user_id) DO UPDATE SET 
         phone = EXCLUDED.phone, 
         company = EXCLUDED.company, 
         updated_at = NOW()`,
        [userId, jobData.clientName, jobData.clientPhone, jobData.clientCompany]
      );

      await client.query('COMMIT');

      logger.debug('Client profile created/updated', { userId, email: jobData.clientEmail });

      return userId;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating/updating client profile', { error, jobData });
      throw new DatabaseError('Failed to create/update client profile');
    } finally {
      client.release();
    }
  }

  private async checkTradieApplication(jobId: number, tradie_id: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT 1 FROM job_applications WHERE marketplace_job_id = $1 AND tradie_id = $2 LIMIT 1',
        [jobId, tradie_id]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking tradie application', { error, jobId, tradie_id });
      return false;
    }
  }

  private async getTradieApplicationId(jobId: number, tradie_id: number): Promise<number | undefined> {
    try {
      const result = await this.db.query(
        'SELECT id FROM job_applications WHERE marketplace_job_id = $1 AND tradie_id = $2 LIMIT 1',
        [jobId, tradie_id]
      );
      
      return result.rows.length > 0 ? parseInt(result.rows[0].id) : undefined;
    } catch (error) {
      logger.error('Error getting tradie application ID', { error, jobId, tradie_id });
      return undefined;
    }
  }

  private async logJobActivity(
    client: PoolClient, 
    jobId: number, 
    activity: string, 
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await client.query(
        `INSERT INTO marketplace_job_activity_log 
         (job_id, activity_type, metadata, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [jobId, activity, JSON.stringify(metadata)]
      );
    } catch (error) {
      logger.warn('Failed to log job activity', { error, jobId, activity });
    }
  }

  private buildTrendQuery(groupBy: string, dateFilter: string): string {
    const groupByClause = {
      day: "DATE_TRUNC('day', created_at)",
      week: "DATE_TRUNC('week', created_at)",
      month: "DATE_TRUNC('month', created_at)",
      job_type: 'job_type',
      location: 'location'
    }[groupBy] || "DATE_TRUNC('day', created_at)";

    return `
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as job_count,
        COALESCE(SUM(application_count), 0) as application_count
      FROM marketplace_jobs 
      WHERE 1=1 ${dateFilter}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
      LIMIT 30
    `;
  }

  private transformRowToEntity(row: any): MarketplaceJobEntity {
    return {
      id: parseInt(row.id),
      client_id: parseInt(row.client_id),
      title: row.title,
      description: row.description,
      job_type: row.job_type,
      location: row.location,
      estimatedBudget: parseFloat(row.estimated_budget) || 0,
      dateRequired: new Date(row.date_required),
      urgencyLevel: row.urgency_level,
      photos: row.photos ? JSON.parse(row.photos) : [],
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      clientCompany: row.client_company,
      status: row.status,
      applicationCount: parseInt(row.application_count) || 0,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isExpired: new Date(row.expires_at) <= new Date(),
      daysUntilExpiry: Math.ceil((new Date(row.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      creditCostForApplication: 0
    };
  }
}

