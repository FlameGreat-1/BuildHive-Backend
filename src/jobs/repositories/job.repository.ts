import { 
  Job, 
  CreateJobData, 
  UpdateJobData, 
  JobFilter, 
  JobListOptions, 
  JobSummary, 
  JobStatistics,
  Client,
  CreateClientData,
  UpdateClientData,
  ClientFilter,
  ClientListOptions,
  Material,
  CreateMaterialData,
  UpdateMaterialData,
  JobAttachment,
  CreateAttachmentData,
  JobRepository,
  ClientRepository,
  MaterialRepository,
  AttachmentRepository
} from '../types';
import { JobModel } from '../models';
import { logger } from '../../shared/utils';

export class JobRepositoryImpl implements JobRepository {
  private jobModel: JobModel;

  constructor() {
    this.jobModel = new JobModel();
  }

  async create(tradieId: number, data: CreateJobData): Promise<Job> {
    try {
      const job = await this.jobModel.create(tradieId, data);
      
      logger.info('Job created successfully', {
        jobId: job.id,
        tradieId,
        title: job.title,
        clientEmail: job.clientEmail
      });

      return job;
    } catch (error: any) {
      logger.error('Failed to create job', {
        tradieId,
        title: data.title,
        error: error.message
      });
      throw error;
    }
  }

  async findById(id: number): Promise<Job | null> {
    try {
      const job = await this.jobModel.findById(id);
      
      if (!job) {
        logger.warn('Job not found', { jobId: id });
        return null;
      }

      return job;
    } catch (error: any) {
      logger.error('Failed to find job by ID', {
        jobId: id,
        error: error.message
      });
      throw error;
    }
  }

  async findByTradieId(tradieId: number, options?: JobListOptions): Promise<Job[]> {
    try {
      const jobs = await this.jobModel.findByTradieId(tradieId, options);
      
      logger.info('Jobs retrieved for tradie', {
        tradieId,
        count: jobs.length,
        page: options?.page || 1,
        limit: options?.limit || 20
      });

      return jobs;
    } catch (error: any) {
      logger.error('Failed to find jobs by tradie ID', {
        tradieId,
        error: error.message
      });
      throw error;
    }
  }

  async update(id: number, data: UpdateJobData): Promise<Job | null> {
    try {
      const job = await this.jobModel.update(id, data);
      
      if (!job) {
        logger.warn('Job not found for update', { jobId: id });
        return null;
      }

      logger.info('Job updated successfully', {
        jobId: id,
        updatedFields: Object.keys(data)
      });

      return job;
    } catch (error: any) {
      logger.error('Failed to update job', {
        jobId: id,
        error: error.message
      });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const deleted = await this.jobModel.delete(id);
      
      if (deleted) {
        logger.info('Job deleted successfully', { jobId: id });
      } else {
        logger.warn('Job not found for deletion', { jobId: id });
      }

      return deleted;
    } catch (error: any) {
      logger.error('Failed to delete job', {
        jobId: id,
        error: error.message
      });
      throw error;
    }
  }

  async count(tradieId: number, filter?: JobFilter): Promise<number> {
    try {
      const count = await this.jobModel.count(tradieId, filter);
      
      logger.info('Job count retrieved', {
        tradieId,
        count,
        hasFilter: !!filter
      });

      return count;
    } catch (error: any) {
      logger.error('Failed to count jobs', {
        tradieId,
        error: error.message
      });
      throw error;
    }
  }

  async getSummary(tradieId: number): Promise<JobSummary> {
    try {
      const summary = await this.jobModel.getSummary(tradieId);
      
      logger.info('Job summary retrieved', {
        tradieId,
        totalJobs: summary.total,
        completedJobs: summary.completed
      });

      return summary;
    } catch (error: any) {
      logger.error('Failed to get job summary', {
        tradieId,
        error: error.message
      });
      throw error;
    }
  }

  async getStatistics(tradieId: number): Promise<JobStatistics> {
    try {
      const statistics = await this.jobModel.getStatistics(tradieId);
      
      logger.info('Job statistics retrieved', {
        tradieId,
        totalJobs: statistics.totalJobs,
        completionRate: statistics.completionRate
      });

      return statistics;
    } catch (error: any) {
      logger.error('Failed to get job statistics', {
        tradieId,
        error: error.message
      });
      throw error;
    }
  }
}

export class ClientRepositoryImpl implements ClientRepository {
  private jobModel: JobModel;

  constructor() {
    this.jobModel = new JobModel();
  }

  async create(tradieId: number, data: CreateClientData): Promise<Client> {
    try {
      const client = await this.jobModel.createClient(tradieId, data);
      
      logger.info('Client created successfully', {
        clientId: client.id,
        tradieId,
        name: client.name,
        email: client.email
      });

      return client;
    } catch (error: any) {
      logger.error('Failed to create client', {
        tradieId,
        name: data.name,
        email: data.email,
        error: error.message
      });
      throw error;
    }
  }

  async findById(id: number): Promise<Client | null> {
    try {
      const query = `
        SELECT * FROM clients WHERE id = $1
      `;
      
      const result = await this.jobModel['database'].query(query, [id]);
      
      if (result.rows.length === 0) {
        logger.warn('Client not found', { clientId: id });
        return null;
      }

      return this.jobModel['mapRowToClient'](result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to find client by ID', {
        clientId: id,
        error: error.message
      });
      throw error;
    }
  }

  async findByTradieId(tradieId: number, options?: ClientListOptions): Promise<Client[]> {
    try {
      const { page = 1, limit = 20, filter, sort } = options || {};
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE tradie_id = $1';
      const params: any[] = [tradieId];
      let paramIndex = 2;

      if (filter) {
        if (filter.search) {
          whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`;
          params.push(`%${filter.search}%`);
          paramIndex++;
        }
        
        if (filter.tags && filter.tags.length > 0) {
          whereClause += ` AND tags && $${paramIndex}`;
          params.push(filter.tags);
          paramIndex++;
        }
        
        if (filter.hasJobs !== undefined) {
          whereClause += ` AND total_jobs ${filter.hasJobs ? '>' : '='} 0`;
        }
        
        if (filter.minRevenue !== undefined) {
          whereClause += ` AND total_revenue >= $${paramIndex}`;
          params.push(filter.minRevenue);
          paramIndex++;
        }
        
        if (filter.maxRevenue !== undefined) {
          whereClause += ` AND total_revenue <= $${paramIndex}`;
          params.push(filter.maxRevenue);
          paramIndex++;
        }
        
        if (filter.lastJobAfter) {
          whereClause += ` AND last_job_date >= $${paramIndex}`;
          params.push(filter.lastJobAfter);
          paramIndex++;
        }
        
        if (filter.lastJobBefore) {
          whereClause += ` AND last_job_date <= $${paramIndex}`;
          params.push(filter.lastJobBefore);
          paramIndex++;
        }
      }

      let orderClause = 'ORDER BY created_at DESC';
      if (sort) {
        orderClause = `ORDER BY ${sort.field} ${sort.order.toUpperCase()}`;
      }

      const query = `
        SELECT * FROM clients
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);
      const result = await this.jobModel['database'].query(query, params);
      
      const clients = result.rows.map(row => this.jobModel['mapRowToClient'](row));
      
      logger.info('Clients retrieved for tradie', {
        tradieId,
        count: clients.length,
        page,
        limit
      });

      return clients;
    } catch (error: any) {
      logger.error('Failed to find clients by tradie ID', {
        tradieId,
        error: error.message
      });
      throw error;
    }
  }
  
    async findByEmail(tradieId: number, email: string): Promise<Client | null> {
    try {
      const client = await this.jobModel.findClientByEmail(tradieId, email);
      
      if (!client) {
        logger.warn('Client not found by email', { tradieId, email });
        return null;
      }

      return client;
    } catch (error: any) {
      logger.error('Failed to find client by email', {
        tradieId,
        email,
        error: error.message
      });
      throw error;
    }
  }

  async update(id: number, data: UpdateClientData): Promise<Client | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbField = this.camelToSnake(key);
          fields.push(`${dbField} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        return await this.findById(id);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE clients
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.jobModel['database'].query(query, values);
      
      if (result.rows.length === 0) {
        logger.warn('Client not found for update', { clientId: id });
        return null;
      }

      const client = this.jobModel['mapRowToClient'](result.rows[0]);
      
      logger.info('Client updated successfully', {
        clientId: id,
        updatedFields: Object.keys(data)
      });

      return client;
    } catch (error: any) {
      logger.error('Failed to update client', {
        clientId: id,
        error: error.message
      });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM clients WHERE id = $1`;
      const result = await this.jobModel['database'].query(query, [id]);
      
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        logger.info('Client deleted successfully', { clientId: id });
      } else {
        logger.warn('Client not found for deletion', { clientId: id });
      }

      return deleted;
    } catch (error: any) {
      logger.error('Failed to delete client', {
        clientId: id,
        error: error.message
      });
      throw error;
    }
  }

  async count(tradieId: number, filter?: ClientFilter): Promise<number> {
    try {
      let whereClause = 'WHERE tradie_id = $1';
      const params: any[] = [tradieId];
      let paramIndex = 2;

      if (filter) {
        if (filter.search) {
          whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`;
          params.push(`%${filter.search}%`);
          paramIndex++;
        }
        
        if (filter.tags && filter.tags.length > 0) {
          whereClause += ` AND tags && $${paramIndex}`;
          params.push(filter.tags);
          paramIndex++;
        }
      }

      const query = `SELECT COUNT(*) as count FROM clients ${whereClause}`;
      const result = await this.jobModel['database'].query(query, params);
      
      const count = parseInt(result.rows[0].count);
      
      logger.info('Client count retrieved', {
        tradieId,
        count,
        hasFilter: !!filter
      });

      return count;
    } catch (error: any) {
      logger.error('Failed to count clients', {
        tradieId,
        error: error.message
      });
      throw error;
    }
  }

  async updateStats(clientId: number): Promise<void> {
    try {
      await this.jobModel.updateClientStats(clientId);
      
      logger.info('Client stats updated successfully', { clientId });
    } catch (error: any) {
      logger.error('Failed to update client stats', {
        clientId,
        error: error.message
      });
      throw error;
    }
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export class MaterialRepositoryImpl implements MaterialRepository {
  private jobModel: JobModel;

  constructor() {
    this.jobModel = new JobModel();
  }

  async create(jobId: number, data: CreateMaterialData): Promise<Material> {
    try {
      const material = await this.jobModel.createMaterial(jobId, data);
      
      logger.info('Material created successfully', {
        materialId: material.id,
        jobId,
        name: material.name,
        totalCost: material.totalCost
      });

      return material;
    } catch (error: any) {
      logger.error('Failed to create material', {
        jobId,
        name: data.name,
        error: error.message
      });
      throw error;
    }
  }

  async findByJobId(jobId: number): Promise<Material[]> {
    try {
      const query = `
        SELECT * FROM materials 
        WHERE job_id = $1 
        ORDER BY created_at ASC
      `;
      
      const result = await this.jobModel['database'].query(query, [jobId]);
      
      const materials = result.rows.map(row => this.jobModel['mapRowToMaterial'](row));
      
      logger.info('Materials retrieved for job', {
        jobId,
        count: materials.length
      });

      return materials;
    } catch (error: any) {
      logger.error('Failed to find materials by job ID', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  async update(id: number, data: UpdateMaterialData): Promise<Material | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbField = this.camelToSnake(key);
          fields.push(`${dbField} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        const query = `SELECT * FROM materials WHERE id = $1`;
        const result = await this.jobModel['database'].query(query, [id]);
        return result.rows.length > 0 ? this.jobModel['mapRowToMaterial'](result.rows[0]) : null;
      }

      if (data.quantity !== undefined || data.unitCost !== undefined) {
        const currentQuery = `SELECT * FROM materials WHERE id = $${paramIndex}`;
        values.push(id);
        const currentResult = await this.jobModel['database'].query(currentQuery, [id]);
        
        if (currentResult.rows.length === 0) {
          return null;
        }

        const current = currentResult.rows[0];
        const quantity = data.quantity !== undefined ? data.quantity : current.quantity;
        const unitCost = data.unitCost !== undefined ? data.unitCost : current.unit_cost;
        const totalCost = quantity * unitCost;

        fields.push(`total_cost = $${paramIndex + 1}`);
        values.push(totalCost);
        paramIndex++;
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE materials
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.jobModel['database'].query(query, values);
      
      if (result.rows.length === 0) {
        logger.warn('Material not found for update', { materialId: id });
        return null;
      }

      const material = this.jobModel['mapRowToMaterial'](result.rows[0]);
      
      logger.info('Material updated successfully', {
        materialId: id,
        updatedFields: Object.keys(data)
      });

      return material;
    } catch (error: any) {
      logger.error('Failed to update material', {
        materialId: id,
        error: error.message
      });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM materials WHERE id = $1`;
      const result = await this.jobModel['database'].query(query, [id]);
      
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        logger.info('Material deleted successfully', { materialId: id });
      } else {
        logger.warn('Material not found for deletion', { materialId: id });
      }

      return deleted;
    } catch (error: any) {
      logger.error('Failed to delete material', {
        materialId: id,
        error: error.message
      });
      throw error;
    }
  }

  async deleteByJobId(jobId: number): Promise<boolean> {
    try {
      const query = `DELETE FROM materials WHERE job_id = $1`;
      const result = await this.jobModel['database'].query(query, [jobId]);
      
      logger.info('Materials deleted for job', {
        jobId,
        deletedCount: result.rowCount
      });

      return result.rowCount > 0;
    } catch (error: any) {
      logger.error('Failed to delete materials by job ID', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export class AttachmentRepositoryImpl implements AttachmentRepository {
  private jobModel: JobModel;

  constructor() {
    this.jobModel = new JobModel();
  }

  async create(jobId: number, data: CreateAttachmentData): Promise<JobAttachment> {
    try {
      const query = `
        INSERT INTO job_attachments (
          job_id, filename, original_name, file_path, file_size, mime_type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await this.jobModel['database'].query(query, [
        jobId,
        data.filename,
        data.originalName,
        data.filePath,
        data.fileSize,
        data.mimeType
      ]);

      const attachment = this.mapRowToAttachment(result.rows[0]);
      
      logger.info('Attachment created successfully', {
        attachmentId: attachment.id,
        jobId,
        filename: attachment.filename,
        fileSize: attachment.fileSize
      });

      return attachment;
    } catch (error: any) {
      logger.error('Failed to create attachment', {
        jobId,
        filename: data.filename,
        error: error.message
      });
      throw error;
    }
  }

  async findByJobId(jobId: number): Promise<JobAttachment[]> {
    try {
      const query = `
        SELECT * FROM job_attachments 
        WHERE job_id = $1 
        ORDER BY uploaded_at DESC
      `;
      
      const result = await this.jobModel['database'].query(query, [jobId]);
      
      const attachments = result.rows.map(row => this.mapRowToAttachment(row));
      
      logger.info('Attachments retrieved for job', {
        jobId,
        count: attachments.length
      });

      return attachments;
    } catch (error: any) {
      logger.error('Failed to find attachments by job ID', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  async findById(id: number): Promise<JobAttachment | null> {
    try {
      const query = `SELECT * FROM job_attachments WHERE id = $1`;
      const result = await this.jobModel['database'].query(query, [id]);
      
      if (result.rows.length === 0) {
        logger.warn('Attachment not found', { attachmentId: id });
        return null;
      }

      return this.mapRowToAttachment(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to find attachment by ID', {
        attachmentId: id,
        error: error.message
      });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM job_attachments WHERE id = $1`;
      const result = await this.jobModel['database'].query(query, [id]);
      
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        logger.info('Attachment deleted successfully', { attachmentId: id });
      } else {
        logger.warn('Attachment not found for deletion', { attachmentId: id });
      }

      return deleted;
    } catch (error: any) {
      logger.error('Failed to delete attachment', {
        attachmentId: id,
        error: error.message
      });
      throw error;
    }
  }

  async deleteByJobId(jobId: number): Promise<boolean> {
    try {
      const query = `DELETE FROM job_attachments WHERE job_id = $1`;
      const result = await this.jobModel['database'].query(query, [jobId]);
      
      logger.info('Attachments deleted for job', {
        jobId,
        deletedCount: result.rowCount
      });

      return result.rowCount > 0;
    } catch (error: any) {
      logger.error('Failed to delete attachments by job ID', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  private mapRowToAttachment(row: any): JobAttachment {
    return {
      id: row.id,
      jobId: row.job_id,
      filename: row.filename,
      originalName: row.original_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadedAt: new Date(row.uploaded_at)
    };
  }
}

export const jobRepository = new JobRepositoryImpl();
export const clientRepository = new ClientRepositoryImpl();
export const materialRepository = new MaterialRepositoryImpl();
export const attachmentRepository = new AttachmentRepositoryImpl();

