import { Pool } from 'pg';
import { database } from '../../shared/database/connection';
import { MarketplaceJobDatabaseRecord } from '../../shared/types';
import { 
  MarketplaceJobEntity, 
  MarketplaceJobCreateData, 
  MarketplaceJobUpdateData,
  MarketplaceJobDetails,
  MarketplaceJobSummary,
  MarketplaceJobFilters,
  MarketplaceJobSearchParams,
  MarketplaceJobStats,
  MarketplaceJobExpiry
} from '../types';
import { 
  MARKETPLACE_QUERIES,
  MARKETPLACE_JOB_STATUS,
  MARKETPLACE_CREDIT_COSTS,
  MARKETPLACE_LIMITS
} from '../../config/feeds';

export class MarketplaceJobModel {
  private db: Pool;

  constructor() {
    this.db = database; 
  }

  async create(jobData: MarketplaceJobCreateData, client_id?: number): Promise<MarketplaceJobEntity> {
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + MARKETPLACE_LIMITS.JOB_EXPIRY_DAYS);

    const result = await this.db.query(
      MARKETPLACE_QUERIES.CREATE_MARKETPLACE_JOB,
      [
        client_id || null,
        jobData.title,
        jobData.description,
        jobData.job_type,
        jobData.location,
        jobData.estimated_budget || null,
        jobData.date_required,
        jobData.urgency_level,
        JSON.stringify(jobData.photos || []),
        jobData.client_name,
        jobData.client_email ,
        jobData.client_phone || null,
        jobData.client_company || null,
        expires_at
      ]
    );

    return this.transformToEntity(result.rows[0]);
  }

  async findById(id: number): Promise<MarketplaceJobEntity | null> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.GET_MARKETPLACE_JOB_BY_ID,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.transformToEntity(result.rows[0]);
  }

  async findAll(params: { limit: number; offset: number }): Promise<MarketplaceJobSummary[]> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.GET_MARKETPLACE_JOBS_LIST,
      [params.limit, params.offset]
    );

    return result.rows.map(row => this.transformToSummary(row));
  }

  async search(searchParams: MarketplaceJobSearchParams): Promise<{
    jobs: MarketplaceJobSummary[];
    totalCount: number;
  }> {
    const limit = searchParams.limit || 20;
    const offset = ((searchParams.page || 1) - 1) * limit;
    const sortBy = searchParams.sortBy || 'date_posted';

    const result = await this.db.query(
      MARKETPLACE_QUERIES.SEARCH_MARKETPLACE_JOBS,
      [
        limit,
        offset,
        searchParams.query || null,
        searchParams.job_type || null,
        searchParams.location || null,
        searchParams.urgency_level || null,
        searchParams.minBudget || null,
        searchParams.maxBudget || null,
        sortBy
      ]
    );

    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM marketplace_jobs mj 
       WHERE mj.status = 'available' 
         AND mj.expires_at > NOW()
         AND ($3::text IS NULL OR mj.title ILIKE '%' || $3 || '%' OR mj.description ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR mj.job_type = $4)
         AND ($5::text IS NULL OR mj.location ILIKE '%' || $5 || '%')
         AND ($6::text IS NULL OR mj.urgency_level = $6)
         AND ($7::numeric IS NULL OR mj.estimated_budget >= $7)
         AND ($8::numeric IS NULL OR mj.estimated_budget <= $8)`,
      [
        null, null,
        searchParams.query || null,
        searchParams.job_type || null,
        searchParams.location || null,
        searchParams.urgency_level || null,
        searchParams.minBudget || null,
        searchParams.maxBudget || null
      ]
    );

    return {
      jobs: result.rows.map(row => this.transformToSummary(row)),
      totalCount: parseInt(countResult.rows[0].total)
    };
  }

  async update(id: number, updateData: MarketplaceJobUpdateData): Promise<MarketplaceJobEntity | null> {
    const existingJob = await this.findById(id);
    if (!existingJob) {
      return null;
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 2;

    if (updateData.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      updateValues.push(updateData.title);
      paramIndex++;
    }

    if (updateData.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(updateData.description);
      paramIndex++;
    }

    if (updateData.estimated_budget !== undefined) {
      updateFields.push(`estimated_budget = $${paramIndex}`);
      updateValues.push(updateData.estimated_budget);
      paramIndex++;
    }

    if (updateData.date_required !== undefined) {
      updateFields.push(`date_required = $${paramIndex}`);
      updateValues.push(updateData.date_required);
      paramIndex++;
    }

    if (updateData.urgency_level !== undefined) {
      updateFields.push(`urgency_level = $${paramIndex}`);
      updateValues.push(updateData.urgency_level);
      paramIndex++;
    }

    if (updateData.photos !== undefined) {
      updateFields.push(`photos = $${paramIndex}`);
      updateValues.push(JSON.stringify(updateData.photos));
      paramIndex++;
    }

    if (updateData.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(updateData.status);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return existingJob;
    }

    updateFields.push('updated_at = NOW()');

    const query = `
      UPDATE marketplace_jobs 
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, ...updateValues]);
    return this.transformToEntity(result.rows[0]);
  }

  async updateStatus(id: number, status: string): Promise<MarketplaceJobEntity | null> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.UPDATE_MARKETPLACE_JOB_STATUS,
      [id, status]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.transformToEntity(result.rows[0]);
  }

  async incrementApplicationCount(id: number): Promise<void> {
    await this.db.query(
      MARKETPLACE_QUERIES.UPDATE_MARKETPLACE_JOB_APPLICATION_COUNT,
      [id]
    );
  }

  async findByClient(client_id: number, params: { limit: number; offset: number }): Promise<MarketplaceJobSummary[]> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.GET_JOBS_BY_CLIENT,
      [client_id, params.limit, params.offset]
    );

    return result.rows.map(row => this.transformToSummary(row));
  }

  async delete(id: number, client_id: number): Promise<MarketplaceJobEntity | null> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.DELETE_MARKETPLACE_JOB,
      [id, client_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.transformToEntity(result.rows[0]);
  }

  async findExpiredJobs(): Promise<MarketplaceJobExpiry[]> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.EXPIRE_OLD_JOBS,
      []
    );

    return result.rows.map(row => ({
      jobId: row.id,
      title: row.title,
      expires_at: new Date(row.expires_at),
      applicationCount: row.application_count || 0,
      notificationSent: false
    }));
  }

  async getStats(): Promise<MarketplaceJobStats> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'available' AND expires_at > NOW() THEN 1 END) as active_jobs,
        COUNT(CASE WHEN status = 'expired' OR expires_at <= NOW() THEN 1 END) as expired_jobs,
        COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_jobs,
        AVG(application_count) as avg_applications_per_job,
        SUM(application_count) as total_applications
      FROM marketplace_jobs
    `;

    const job_typesQuery = `
      SELECT 
        job_type,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM marketplace_jobs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY job_type
      ORDER BY count DESC
      LIMIT 5
    `;

    const locationsQuery = `
      SELECT 
        location,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM marketplace_jobs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY location
      ORDER BY count DESC
      LIMIT 5
    `;

    const [statsResult, job_typesResult, locationsResult] = await Promise.all([
      this.db.query(statsQuery),
      this.db.query(job_typesQuery),
      this.db.query(locationsQuery)
    ]);

    const stats = statsResult.rows[0];
    const totalApplications = parseInt(stats.total_applications) || 0;
    const assignedJobs = parseInt(stats.assigned_jobs) || 0;

    return {
      totalJobs: parseInt(stats.total_jobs) || 0,
      activeJobs: parseInt(stats.active_jobs) || 0,
      expiredJobs: parseInt(stats.expired_jobs) || 0,
      assignedJobs: assignedJobs,
      averageApplicationsPerJob: parseFloat(stats.avg_applications_per_job) || 0,
      totalApplications: totalApplications,
      conversionRate: totalApplications > 0 ? (assignedJobs / totalApplications) * 100 : 0,
      topjob_types: job_typesResult.rows.map(row => ({
        job_type: row.job_type,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage)
      })),
      topLocations: locationsResult.rows.map(row => ({
        location: row.location,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage)
      }))
    };
  }

  async calculateCreditCost(job_type: string, urgency_level: string): Promise<number> {
    const baseCost = MARKETPLACE_CREDIT_COSTS.BASE_APPLICATION_COST;
    const urgencyMultiplier = MARKETPLACE_CREDIT_COSTS.URGENCY_MULTIPLIERS[urgency_level as keyof typeof MARKETPLACE_CREDIT_COSTS.URGENCY_MULTIPLIERS] || 1.0;
    const job_typeMultiplier = MARKETPLACE_CREDIT_COSTS.JOB_TYPE_MULTIPLIERS[job_type as keyof typeof MARKETPLACE_CREDIT_COSTS.JOB_TYPE_MULTIPLIERS] || 1.0;

    return Math.ceil(baseCost * urgencyMultiplier * job_typeMultiplier);
  }

  private transformToEntity(row: any): MarketplaceJobEntity {
    return {
      id: row.id,
      client_id: row.client_id,
      title: row.title,
      description: row.description,
      job_type: row.job_type,
      location: row.location,
      estimated_budget: row.estimated_budget,
      date_required: new Date(row.date_required),
      urgency_level: row.urgency_level,
      photos: row.photos ? JSON.parse(row.photos) : [],
      status: row.current_status || row.status,
      view_count: row.view_count || 0,
      client_name: row.client_name,
      client_email: row.client_email,
      client_phone: row.client_phone,
      client_company: row.client_company,
      expires_at: row.expires_at ? new Date(row.expires_at) : null,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      applicationCount: parseInt(row.application_count) || 0,
      isExpired: row.expires_at ? new Date(row.expires_at) <= new Date() : false,
      daysUntilExpiry: row.expires_at ? Math.ceil((new Date(row.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0,
      creditCostForApplication: 0
    };
  }
  
  private transformToSummary(row: any): MarketplaceJobSummary {
    const entity = this.transformToEntity(row);
    return {
      id: entity.id,
      title: entity.title,
      job_type: entity.job_type,
      location: entity.location,
      estimated_budget: entity.estimated_budget,
      urgency_level: entity.urgency_level,
      applicationCount: entity.application_count,
      status: entity.status,
      createdAt: entity.createdAt,
      daysUntilExpiry: entity.daysUntilExpiry,
      creditCost: 0,
      hasApplied: false
    };
  }
}