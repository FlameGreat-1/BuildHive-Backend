import { Pool } from 'pg';
import { database } from '../../shared/database/connection';
import { JobApplicationDatabaseRecord } from '../../shared/types';
import { 
  JobApplicationEntity, 
  JobApplicationCreateData, 
  JobApplicationUpdateData,
  JobApplicationDetails,
  JobApplicationSummary,
  JobApplicationFilters,
  JobApplicationSearchParams,
  ApplicationStatusUpdate,
  ApplicationWithdrawal,
  TradieApplicationHistory
} from '../types';
import { 
  MARKETPLACE_QUERIES,
  APPLICATION_STATUS,
  MARKETPLACE_LIMITS
} from '../../config/feeds';

export class ApplicationModel {
  private db: Pool;

  constructor() {
    this.db = database.getPool();
  }

  async create(applicationData: JobApplicationCreateData, tradieId: number): Promise<JobApplicationEntity> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.CREATE_JOB_APPLICATION,
      [
        applicationData.marketplaceJobId,
        tradieId,
        applicationData.customQuote,
        applicationData.proposedTimeline,
        applicationData.approachDescription,
        applicationData.materialsList || null,
        JSON.stringify(applicationData.availabilityDates),
        applicationData.coverMessage || null,
        applicationData.relevantExperience || null,
        JSON.stringify(applicationData.additionalPhotos || []),
        applicationData.questionsForClient || null,
        applicationData.specialOffers || null,
        0
      ]
    );

    return this.transformToEntity(result.rows[0]);
  }

  async findById(id: number): Promise<JobApplicationEntity | null> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.GET_APPLICATION_BY_ID,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.transformToEntity(result.rows[0]);
  }

  async findByJobId(marketplaceJobId: number): Promise<JobApplicationSummary[]> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.GET_APPLICATIONS_BY_JOB,
      [marketplaceJobId]
    );

    return result.rows.map(row => this.transformToSummary(row));
  }

  async findByTradieId(tradieId: number, params: { limit: number; offset: number }): Promise<JobApplicationSummary[]> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.GET_APPLICATIONS_BY_TRADIE,
      [tradieId, params.limit, params.offset]
    );

    return result.rows.map(row => this.transformToSummary(row));
  }

  async checkExistingApplication(marketplaceJobId: number, tradieId: number): Promise<boolean> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.CHECK_EXISTING_APPLICATION,
      [marketplaceJobId, tradieId]
    );

    return result.rows.length > 0;
  }

  async update(id: number, updateData: JobApplicationUpdateData): Promise<JobApplicationEntity | null> {
    const existingApplication = await this.findById(id);
    if (!existingApplication) {
      return null;
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 2;

    if (updateData.customQuote !== undefined) {
      updateFields.push(`custom_quote = $${paramIndex}`);
      updateValues.push(updateData.customQuote);
      paramIndex++;
    }

    if (updateData.proposedTimeline !== undefined) {
      updateFields.push(`proposed_timeline = $${paramIndex}`);
      updateValues.push(updateData.proposedTimeline);
      paramIndex++;
    }

    if (updateData.approachDescription !== undefined) {
      updateFields.push(`approach_description = $${paramIndex}`);
      updateValues.push(updateData.approachDescription);
      paramIndex++;
    }

    if (updateData.materialsList !== undefined) {
      updateFields.push(`materials_list = $${paramIndex}`);
      updateValues.push(updateData.materialsList);
      paramIndex++;
    }

    if (updateData.availabilityDates !== undefined) {
      updateFields.push(`availability_dates = $${paramIndex}`);
      updateValues.push(JSON.stringify(updateData.availabilityDates));
      paramIndex++;
    }

    if (updateData.coverMessage !== undefined) {
      updateFields.push(`cover_message = $${paramIndex}`);
      updateValues.push(updateData.coverMessage);
      paramIndex++;
    }

    if (updateData.relevantExperience !== undefined) {
      updateFields.push(`relevant_experience = $${paramIndex}`);
      updateValues.push(updateData.relevantExperience);
      paramIndex++;
    }

    if (updateData.additionalPhotos !== undefined) {
      updateFields.push(`additional_photos = $${paramIndex}`);
      updateValues.push(JSON.stringify(updateData.additionalPhotos));
      paramIndex++;
    }

    if (updateData.questionsForClient !== undefined) {
      updateFields.push(`questions_for_client = $${paramIndex}`);
      updateValues.push(updateData.questionsForClient);
      paramIndex++;
    }

    if (updateData.specialOffers !== undefined) {
      updateFields.push(`special_offers = $${paramIndex}`);
      updateValues.push(updateData.specialOffers);
      paramIndex++;
    }

    if (updateData.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(updateData.status);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return existingApplication;
    }

    updateFields.push('updated_at = NOW()');

    const query = `
      UPDATE job_applications 
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, ...updateValues]);
    return this.transformToEntity(result.rows[0]);
  }

  async updateStatus(id: number, status: string): Promise<JobApplicationEntity | null> {
    const result = await this.db.query(
      MARKETPLACE_QUERIES.UPDATE_APPLICATION_STATUS,
      [id, status]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.transformToEntity(result.rows[0]);
  }

  async updateCreditsUsed(id: number, creditsUsed: number): Promise<void> {
    await this.db.query(
      'UPDATE job_applications SET credits_used = $2, updated_at = NOW() WHERE id = $1',
      [id, creditsUsed]
    );
  }

  async search(searchParams: JobApplicationSearchParams): Promise<{
    applications: JobApplicationSummary[];
    totalCount: number;
  }> {
    const limit = searchParams.limit || 20;
    const offset = ((searchParams.page || 1) - 1) * limit;
    const sortBy = searchParams.sortBy || 'application_timestamp';
    const sortOrder = searchParams.sortOrder || 'desc';

    let whereConditions: string[] = ['1=1'];
    let queryParams: any[] = [limit, offset];
    let paramIndex = 3;

    if (searchParams.status) {
      whereConditions.push(`ja.status = $${paramIndex}`);
      queryParams.push(searchParams.status);
      paramIndex++;
    }

    if (searchParams.marketplaceJobId) {
      whereConditions.push(`ja.marketplace_job_id = $${paramIndex}`);
      queryParams.push(searchParams.marketplaceJobId);
      paramIndex++;
    }

    if (searchParams.tradieId) {
      whereConditions.push(`ja.tradie_id = $${paramIndex}`);
      queryParams.push(searchParams.tradieId);
      paramIndex++;
    }

    if (searchParams.jobType) {
      whereConditions.push(`mj.job_type = $${paramIndex}`);
      queryParams.push(searchParams.jobType);
      paramIndex++;
    }

    if (searchParams.minQuote) {
      whereConditions.push(`ja.custom_quote >= $${paramIndex}`);
      queryParams.push(searchParams.minQuote);
      paramIndex++;
    }

    if (searchParams.maxQuote) {
      whereConditions.push(`ja.custom_quote <= $${paramIndex}`);
      queryParams.push(searchParams.maxQuote);
      paramIndex++;
    }

    if (searchParams.location) {
      whereConditions.push(`mj.location ILIKE '%' || $${paramIndex} || '%'`);
      queryParams.push(searchParams.location);
      paramIndex++;
    }

    if (searchParams.dateRange) {
      whereConditions.push(`ja.application_timestamp >= $${paramIndex}`);
      queryParams.push(searchParams.dateRange.startDate);
      paramIndex++;
      whereConditions.push(`ja.application_timestamp <= $${paramIndex}`);
      queryParams.push(searchParams.dateRange.endDate);
      paramIndex++;
    }

    const query = `
      SELECT ja.*, mj.title, mj.job_type, mj.location, mj.estimated_budget,
             u.username, p.first_name, p.last_name, p.avatar,
             tms.total_applications, tms.successful_applications, tms.conversion_rate
      FROM job_applications ja
      JOIN marketplace_jobs mj ON ja.marketplace_job_id = mj.id
      JOIN users u ON ja.tradie_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN tradie_marketplace_stats tms ON u.id = tms.tradie_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ja.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM job_applications ja
      JOIN marketplace_jobs mj ON ja.marketplace_job_id = mj.id
      WHERE ${whereConditions.slice(2).join(' AND ')}
    `;

    const [result, countResult] = await Promise.all([
      this.db.query(query, queryParams),
      this.db.query(countQuery, queryParams.slice(2))
    ]);

    return {
      applications: result.rows.map(row => this.transformToSummary(row)),
      totalCount: parseInt(countResult.rows[0].total)
    };
  }

  async getTradieApplicationHistory(tradieId: number): Promise<TradieApplicationHistory> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN status = 'selected' THEN 1 END) as successful_applications,
        COUNT(CASE WHEN status = 'submitted' OR status = 'under_review' THEN 1 END) as pending_applications,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_applications,
        COUNT(CASE WHEN status = 'withdrawn' THEN 1 END) as withdrawn_applications,
        SUM(credits_used) as total_credits_spent,
        AVG(custom_quote) as average_quote
      FROM job_applications
      WHERE tradie_id = $1
    `;

    const recentActivityQuery = `
      SELECT ja.id, mj.title, ja.status, ja.application_timestamp, ja.updated_at
      FROM job_applications ja
      JOIN marketplace_jobs mj ON ja.marketplace_job_id = mj.id
      WHERE ja.tradie_id = $1
      ORDER BY ja.updated_at DESC
      LIMIT 10
    `;

    const [statsResult, activityResult] = await Promise.all([
      this.db.query(statsQuery, [tradieId]),
      this.db.query(recentActivityQuery, [tradieId])
    ]);

    const stats = statsResult.rows[0];
    const totalApplications = parseInt(stats.total_applications) || 0;
    const successfulApplications = parseInt(stats.successful_applications) || 0;

    return {
      totalApplications,
      successfulApplications,
      pendingApplications: parseInt(stats.pending_applications) || 0,
      rejectedApplications: parseInt(stats.rejected_applications) || 0,
      withdrawnApplications: parseInt(stats.withdrawn_applications) || 0,
      conversionRate: totalApplications > 0 ? (successfulApplications / totalApplications) * 100 : 0,
      totalCreditsSpent: parseInt(stats.total_credits_spent) || 0,
      averageQuote: parseFloat(stats.average_quote) || 0,
      applications: [],
      recentActivity: activityResult.rows.map(row => ({
        applicationId: row.id,
        jobTitle: row.title,
        action: this.getActionFromStatus(row.status),
        timestamp: new Date(row.updated_at),
        status: row.status
      }))
    };
  }

  async bulkUpdateStatus(applicationIds: number[], status: string, reason?: string): Promise<number> {
    const query = `
      UPDATE job_applications 
      SET status = $1, updated_at = NOW()
      WHERE id = ANY($2::int[])
    `;

    const result = await this.db.query(query, [status, applicationIds]);
    return result.rowCount || 0;
  }

  async getApplicationsByStatus(status: string, limit: number = 50): Promise<JobApplicationSummary[]> {
    const query = `
      SELECT ja.*, mj.title, mj.job_type, mj.location,
             u.username, p.first_name, p.last_name
      FROM job_applications ja
      JOIN marketplace_jobs mj ON ja.marketplace_job_id = mj.id
      JOIN users u ON ja.tradie_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE ja.status = $1
      ORDER BY ja.application_timestamp DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [status, limit]);
    return result.rows.map(row => this.transformToSummary(row));
  }

  async getApplicationStats(): Promise<{
    totalApplications: number;
    applicationsByStatus: Record<string, number>;
    averageQuote: number;
    totalCreditsSpent: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review,
        COUNT(CASE WHEN status = 'selected' THEN 1 END) as selected,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'withdrawn' THEN 1 END) as withdrawn,
        AVG(custom_quote) as average_quote,
        SUM(credits_used) as total_credits_spent
      FROM job_applications
    `;

    const result = await this.db.query(query);
    const stats = result.rows[0];

    return {
      totalApplications: parseInt(stats.total_applications) || 0,
      applicationsByStatus: {
        submitted: parseInt(stats.submitted) || 0,
        under_review: parseInt(stats.under_review) || 0,
        selected: parseInt(stats.selected) || 0,
        rejected: parseInt(stats.rejected) || 0,
        withdrawn: parseInt(stats.withdrawn) || 0
      },
      averageQuote: parseFloat(stats.average_quote) || 0,
      totalCreditsSpent: parseInt(stats.total_credits_spent) || 0
    };
  }

  private transformToEntity(row: any): JobApplicationEntity {
    const now = new Date();
    const applicationTime = new Date(row.application_timestamp);
    const withdrawalDeadline = new Date(applicationTime.getTime() + (24 * 60 * 60 * 1000));

    return {
      id: row.id,
      marketplaceJobId: row.marketplace_job_id,
      tradieId: row.tradie_id,
      customQuote: parseFloat(row.custom_quote),
      proposedTimeline: row.proposed_timeline,
      approachDescription: row.approach_description,
      materialsList: row.materials_list,
      availabilityDates: row.availability_dates ? JSON.parse(row.availability_dates) : [],
      coverMessage: row.cover_message,
      relevantExperience: row.relevant_experience,
      additionalPhotos: row.additional_photos ? JSON.parse(row.additional_photos) : [],
      questionsForClient: row.questions_for_client,
      specialOffers: row.special_offers,
      creditsUsed: parseInt(row.credits_used) || 0,
      status: row.status,
      applicationTimestamp: applicationTime,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isWithdrawable: row.status === 'submitted' && now < withdrawalDeadline,
      canBeModified: row.status === 'submitted',
      timeUntilWithdrawalDeadline: row.status === 'submitted' ? Math.max(0, withdrawalDeadline.getTime() - now.getTime()) : undefined
    };
  }

  private transformToSummary(row: any): JobApplicationSummary {
    return {
      id: row.id,
      marketplaceJobId: row.marketplace_job_id,
      tradieId: row.tradie_id,
      customQuote: parseFloat(row.custom_quote),
      proposedTimeline: row.proposed_timeline,
      status: row.status,
      applicationTimestamp: new Date(row.application_timestamp),
      creditsUsed: parseInt(row.credits_used) || 0,
      tradieName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : row.username,
      tradieRating: row.rating ? parseFloat(row.rating) : undefined,
      tradieCompletedJobs: parseInt(row.completed_jobs) || 0,
      jobTitle: row.title,
      jobType: row.job_type,
      jobLocation: row.location,
      isSelected: row.status === 'selected',
      canWithdraw: row.status === 'submitted'
    };
  }

  private getActionFromStatus(status: string): string {
    const actionMap: Record<string, string> = {
      'submitted': 'Applied',
      'under_review': 'Under Review',
      'selected': 'Selected',
      'rejected': 'Rejected',
      'withdrawn': 'Withdrawn'
    };
    return actionMap[status] || 'Updated';
  }
}
