import { database } from '../../shared/database';
import { 
  Job, 
  CreateJobData, 
  UpdateJobData, 
  JobFilter, 
  JobListOptions, 
  JobSummary, 
  JobStatistics,
  Material,
  JobAttachment,
  Client,
  CreateClientData,
  UpdateClientData,
  ClientFilter,
  ClientListOptions,
  CreateMaterialData,
  UpdateMaterialData,
  CreateAttachmentData,
  JobStatus,
  JobType,
  JobPriority,
  JobTag,
  ClientTag,
  MaterialUnit,
  JobSortField,
  ClientSortField,
  SortOrder
} from '../types';
import { JOB_CONSTANTS } from '../../config/jobs';

export class JobModel {
  async create(tradieId: number, data: CreateJobData): Promise<Job> {
    const transaction = await database.transaction();
    
    try {
      let clientId: number;
      
      const existingClient = await this.findClientByEmail(tradieId, data.clientEmail, transaction);
      
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const clientData: CreateClientData = {
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone,
          company: data.clientCompany
        };
        const newClient = await this.createClient(tradieId, clientData, transaction);
        clientId = newClient.id;
      }

      const jobQuery = `
        INSERT INTO jobs (
          tradie_id, client_id, title, description, job_type, priority,
          client_name, client_email, client_phone, client_company,
          site_address, site_city, site_state, site_postcode, site_access_instructions,
          start_date, due_date, estimated_duration, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `;

      const jobResult = await transaction.query(jobQuery, [
        tradieId,
        clientId,
        data.title,
        data.description,
        data.jobType,
        data.priority,
        data.clientName,
        data.clientEmail,
        data.clientPhone,
        data.clientCompany || null,
        data.siteAddress,
        data.siteCity,
        data.siteState,
        data.sitePostcode,
        data.siteAccessInstructions || null,
        data.startDate,
        data.dueDate,
        data.estimatedDuration,
        data.notes || [],
        'pending'
      ]);

      const jobId = jobResult.rows[0].id;

      if (data.materials && data.materials.length > 0) {
        for (const material of data.materials) {
          await this.createMaterial(jobId, material, transaction);
        }
      }

      await this.updateClientStats(clientId, transaction);
      await transaction.commit();

      return await this.findById(jobId) as Job;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findById(id: number): Promise<Job | null> {
    const query = `
      SELECT j.*, 
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', m.id,
                 'jobId', m.job_id,
                 'name', m.name,
                 'quantity', m.quantity,
                 'unit', m.unit,
                 'unitCost', m.unit_cost,
                 'totalCost', m.total_cost,
                 'supplier', m.supplier,
                 'createdAt', m.created_at,
                 'updatedAt', m.updated_at
               )
             ) FILTER (WHERE m.id IS NOT NULL), '[]') as materials,
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', a.id,
                 'jobId', a.job_id,
                 'filename', a.filename,
                 'originalName', a.original_name,
                 'filePath', a.file_path,
                 'fileSize', a.file_size,
                 'mimeType', a.mime_type,
                 'uploadedAt', a.uploaded_at,
                 'createdAt', a.uploaded_at,
                 'updatedAt', a.updated_at
               )
             ) FILTER (WHERE a.id IS NOT NULL), '[]') as attachments
      FROM jobs j
      LEFT JOIN materials m ON j.id = m.job_id
      LEFT JOIN job_attachments a ON j.id = a.job_id
      WHERE j.id = $1
      GROUP BY j.id
    `;

    const result = await database.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToJob(result.rows[0]);
  }

  async findAllByTradieId(tradieId: number): Promise<Job[]> {
    const query = `
      SELECT j.*, 
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', m.id,
                 'jobId', m.job_id,
                 'name', m.name,
                 'quantity', m.quantity,
                 'unit', m.unit,
                 'unitCost', m.unit_cost,
                 'totalCost', m.total_cost,
                 'supplier', m.supplier,
                 'createdAt', m.created_at,
                 'updatedAt', m.updated_at
               )
             ) FILTER (WHERE m.id IS NOT NULL), '[]') as materials,
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', a.id,
                 'jobId', a.job_id,
                 'filename', a.filename,
                 'originalName', a.original_name,
                 'filePath', a.file_path,
                 'fileSize', a.file_size,
                 'mimeType', a.mime_type,
                 'uploadedAt', a.uploaded_at,
                 'createdAt', a.uploaded_at,
                 'updatedAt', a.updated_at
               )
             ) FILTER (WHERE a.id IS NOT NULL), '[]') as attachments
      FROM jobs j
      LEFT JOIN materials m ON j.id = m.job_id
      LEFT JOIN job_attachments a ON j.id = a.job_id
      WHERE j.tradie_id = $1
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `;

    const result = await database.query(query, [tradieId]);
    return result.rows.map(row => this.mapRowToJob(row));
  }

  async findByClientId(clientId: number, tradieId: number): Promise<Job[]> {
    const query = `
      SELECT j.*, 
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', m.id,
                 'jobId', m.job_id,
                 'name', m.name,
                 'quantity', m.quantity,
                 'unit', m.unit,
                 'unitCost', m.unit_cost,
                 'totalCost', m.total_cost,
                 'supplier', m.supplier,
                 'createdAt', m.created_at,
                 'updatedAt', m.updated_at
               )
             ) FILTER (WHERE m.id IS NOT NULL), '[]') as materials,
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', a.id,
                 'jobId', a.job_id,
                 'filename', a.filename,
                 'originalName', a.original_name,
                 'filePath', a.file_path,
                 'fileSize', a.file_size,
                 'mimeType', a.mime_type,
                 'uploadedAt', a.uploaded_at,
                 'createdAt', a.uploaded_at,
                 'updatedAt', a.updated_at
               )
             ) FILTER (WHERE a.id IS NOT NULL), '[]') as attachments
      FROM jobs j
      LEFT JOIN materials m ON j.id = m.job_id
      LEFT JOIN job_attachments a ON j.id = a.job_id
      WHERE j.client_id = $1 AND j.tradie_id = $2
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `;

    const result = await database.query(query, [clientId, tradieId]);
    return result.rows.map(row => this.mapRowToJob(row));
  }

  async hasActiveJobsForClient(clientId: number): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE client_id = $1 AND status IN ('pending', 'active', 'on_hold')
    `;

    const result = await database.query(query, [clientId]);
    return parseInt(result.rows[0].count) > 0;
  }

  async findByTradieId(tradieId: number, options?: JobListOptions): Promise<Job[]> {
    const { page = 1, limit = 20, filter, sort } = options || {};
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE j.tradie_id = $1';
    const params: any[] = [tradieId];
    let paramIndex = 2;

    if (filter) {
      if (filter.status) {
        whereClause += ` AND j.status = $${paramIndex}`;
        params.push(filter.status);
        paramIndex++;
      }
      
      if (filter.jobType) {
        whereClause += ` AND j.job_type = $${paramIndex}`;
        params.push(filter.jobType);
        paramIndex++;
      }
      
      if (filter.priority) {
        whereClause += ` AND j.priority = $${paramIndex}`;
        params.push(filter.priority);
        paramIndex++;
      }
      
      if (filter.clientId) {
        whereClause += ` AND j.client_id = $${paramIndex}`;
        params.push(filter.clientId);
        paramIndex++;
      }
      
      if (filter.startDate) {
        whereClause += ` AND j.start_date >= $${paramIndex}`;
        params.push(filter.startDate);
        paramIndex++;
      }
      
      if (filter.endDate) {
        whereClause += ` AND j.due_date <= $${paramIndex}`;
        params.push(filter.endDate);
        paramIndex++;
      }
      
      if (filter.tags && filter.tags.length > 0) {
        whereClause += ` AND j.tags && $${paramIndex}`;
        params.push(filter.tags);
        paramIndex++;
      }
      
      if (filter.search) {
        whereClause += ` AND (j.title ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex} OR j.client_name ILIKE $${paramIndex})`;
        params.push(`%${filter.search}%`);
        paramIndex++;
      }
    }

    let orderClause = 'ORDER BY j.created_at DESC';
    if (sort) {
      const sortField = sort.field === JobSortField.CLIENT_NAME ? 'j.client_name' : `j.${sort.field}`;
      orderClause = `ORDER BY ${sortField} ${sort.order.toUpperCase()}`;
    }

    const query = `
      SELECT j.*, 
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', m.id,
                 'jobId', m.job_id,
                 'name', m.name,
                 'quantity', m.quantity,
                 'unit', m.unit,
                 'unitCost', m.unit_cost,
                 'totalCost', m.total_cost,
                 'supplier', m.supplier,
                 'createdAt', m.created_at,
                 'updatedAt', m.updated_at
               )
             ) FILTER (WHERE m.id IS NOT NULL), '[]') as materials,
             COALESCE(json_agg(
               DISTINCT jsonb_build_object(
                 'id', a.id,
                 'jobId', a.job_id,
                 'filename', a.filename,
                 'originalName', a.original_name,
                 'filePath', a.file_path,
                 'fileSize', a.file_size,
                 'mimeType', a.mime_type,
                 'uploadedAt', a.uploaded_at,
                 'createdAt', a.uploaded_at,
                 'updatedAt', a.updated_at
               )
             ) FILTER (WHERE a.id IS NOT NULL), '[]') as attachments
      FROM jobs j
      LEFT JOIN materials m ON j.id = m.job_id
      LEFT JOIN job_attachments a ON j.id = a.job_id
      ${whereClause}
      GROUP BY j.id
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await database.query(query, params);
    
    return result.rows.map(row => this.mapRowToJob(row));
  }

  async update(id: number, data: UpdateJobData): Promise<Job | null> {
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
      UPDATE jobs
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await database.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    return await this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const transaction = await database.transaction();
    
    try {
      await transaction.query(`DELETE FROM job_attachments WHERE job_id = $1`, [id]);
      await transaction.query(`DELETE FROM materials WHERE job_id = $1`, [id]);
      
      const result = await transaction.query(`DELETE FROM jobs WHERE id = $1`, [id]);
      
      await transaction.commit();
      return result.rowCount > 0;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async count(tradieId: number, filter?: JobFilter): Promise<number> {
    let whereClause = 'WHERE tradie_id = $1';
    const params: any[] = [tradieId];
    let paramIndex = 2;

    if (filter) {
      if (filter.status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(filter.status);
        paramIndex++;
      }
      
      if (filter.jobType) {
        whereClause += ` AND job_type = $${paramIndex}`;
        params.push(filter.jobType);
        paramIndex++;
      }
      
      if (filter.search) {
        whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR client_name ILIKE $${paramIndex})`;
        params.push(`%${filter.search}%`);
        paramIndex++;
      }
    }

    const query = `SELECT COUNT(*) as count FROM jobs ${whereClause}`;
    const result = await database.query(query, params);
    
    return parseInt(result.rows[0].count);
  }

  async getSummary(tradieId: number): Promise<JobSummary> {
    const query = `
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
        COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_jobs,
        COALESCE(SUM(
          CASE WHEN status = 'completed' THEN 
            (SELECT COALESCE(SUM(total_cost), 0) FROM materials WHERE job_id = j.id)
          ELSE 0 END
        ), 0) as total_revenue,
        COALESCE(AVG(hours_worked) FILTER (WHERE hours_worked > 0), 0) as average_hours,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled')) as overdue_count,
        COUNT(*) FILTER (WHERE start_date <= NOW() + INTERVAL '7 days' AND status = 'pending') as upcoming_count
      FROM jobs j
      WHERE tradie_id = $1
    `;

    const result = await database.query(query, [tradieId]);
    const row = result.rows[0];

    return {
      totalJobs: parseInt(row.total_jobs),
      pendingJobs: parseInt(row.pending_jobs),
      activeJobs: parseInt(row.active_jobs),
      completedJobs: parseInt(row.completed_jobs),
      cancelled: parseInt(row.cancelled_jobs),
      cancelledJobs: parseInt(row.cancelled_jobs),
      onHoldJobs: parseInt(row.on_hold_jobs),
      totalRevenue: parseFloat(row.total_revenue),
      averageHours: parseFloat(row.average_hours),
      overdueCount: parseInt(row.overdue_count),
      upcomingCount: parseInt(row.upcoming_count)
    };
  }

  async getStatistics(tradieId: number): Promise<JobStatistics> {
    const query = `
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_jobs,
        COALESCE(SUM(hours_worked), 0) as total_hours,
        COALESCE(AVG(estimated_duration), 0) as average_job_duration,
        COUNT(DISTINCT client_id) as client_count,
        COALESCE((
          SELECT SUM(total_cost) 
          FROM materials m 
          JOIN jobs j2 ON m.job_id = j2.id 
          WHERE j2.tradie_id = $1
        ), 0) as material_costs,
        COALESCE((
          SELECT SUM(total_cost) 
          FROM materials m 
          JOIN jobs j2 ON m.job_id = j2.id 
          WHERE j2.tradie_id = $1 AND j2.status = 'completed'
        ), 0) as total_revenue
      FROM jobs j
      WHERE tradie_id = $1
    `;

    const result = await database.query(query, [tradieId]);
    const row = result.rows[0];

    const totalJobs = parseInt(row.total_jobs);
    const completedJobs = parseInt(row.completed_jobs);

    return {
      totalJobs,
      completedJobs,
      activeJobs: parseInt(row.active_jobs),
      pendingJobs: parseInt(row.pending_jobs),
      cancelledJobs: parseInt(row.cancelled_jobs),
      onHoldJobs: parseInt(row.on_hold_jobs),
      totalRevenue: parseFloat(row.total_revenue),
      totalHours: parseFloat(row.total_hours),
      averageJobDuration: parseFloat(row.average_job_duration),
      completionRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
      clientCount: parseInt(row.client_count),
      materialCosts: parseFloat(row.material_costs),
      jobsByStatus: {},
      jobsByType: {},
      jobsByPriority: {},
      monthlyStats: [],
      averageEfficiency: 0,
      healthScoreAverage: 0
    };
  }

  async createClient(tradieId: number, data: CreateClientData, transaction?: any): Promise<Client> {
    const dbConnection = transaction || database;
    
    const query = `
      INSERT INTO clients (
        tradie_id, name, email, phone, company, address, city, state, postcode, notes, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await dbConnection.query(query, [
      tradieId,
      data.name,
      data.email,
      data.phone,
      data.company || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.postcode || null,
      data.notes || null,
      data.tags || []
    ]);

    return this.mapRowToClient(result.rows[0]);
  }

  async findClientByEmail(tradieId: number, email: string, transaction?: any): Promise<Client | null> {
    const dbConnection = transaction || database;
    
    const query = `
      SELECT * FROM clients
      WHERE tradie_id = $1 AND email = $2
    `;

    const result = await dbConnection.query(query, [tradieId, email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToClient(result.rows[0]);
  }

  async createMaterial(jobId: number, data: CreateMaterialData, transaction?: any): Promise<Material> {
    const dbConnection = transaction || database;
    const totalCost = data.quantity * data.unitCost;
    
    const query = `
      INSERT INTO materials (
        job_id, name, quantity, unit, unit_cost, total_cost, supplier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await dbConnection.query(query, [
      jobId,
      data.name,
      data.quantity,
      data.unit,
      data.unitCost,
      totalCost,
      data.supplier || null
    ]);

    return this.mapRowToMaterial(result.rows[0]);
  }

  async updateClientStats(clientId: number, transaction?: any): Promise<void> {
    const dbConnection = transaction || database;
    
    const query = `
      UPDATE clients
      SET 
        total_jobs = (
          SELECT COUNT(*) FROM jobs 
          WHERE client_id = $1
        ),
        total_revenue = (
          SELECT COALESCE(SUM(m.total_cost), 0)
          FROM jobs j
          LEFT JOIN materials m ON j.id = m.job_id
          WHERE j.client_id = $1 AND j.status = 'completed'
        ),
        last_job_date = (
          SELECT MAX(created_at) FROM jobs
          WHERE client_id = $1
        ),
        updated_at = NOW()
      WHERE id = $1
    `;

    await dbConnection.query(query, [clientId]);
  }

  private mapRowToJob(row: any): Job {
    return {
      id: row.id,
      tradieId: row.tradie_id,
      clientId: row.client_id,
      title: row.title,
      description: row.description,
      jobType: row.job_type as JobType,
      status: row.status as JobStatus,
      priority: row.priority as JobPriority,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      clientCompany: row.client_company,
      siteAddress: row.site_address,
      siteCity: row.site_city,
      siteState: row.site_state,
      sitePostcode: row.site_postcode,
      siteAccessInstructions: row.site_access_instructions,
      startDate: new Date(row.start_date),
      dueDate: new Date(row.due_date),
      estimatedDuration: row.estimated_duration,
      hoursWorked: parseFloat(row.hours_worked || 0),
      totalCost: parseFloat(row.total_cost || 0),
      notes: row.notes || [],
      tags: row.tags || [],
      materials: row.materials || [],
      attachments: row.attachments || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToClient(row: any): Client {
    return {
      id: row.id,
      tradieId: row.tradie_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      address: row.address,
      city: row.city,
      state: row.state,
      postcode: row.postcode,
      notes: row.notes,
      tags: row.tags || [],
      totalJobs: row.total_jobs || 0,
      totalRevenue: parseFloat(row.total_revenue || 0),
      lastJobDate: row.last_job_date ? new Date(row.last_job_date) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToMaterial(row: any): Material {
    return {
      id: row.id,
      jobId: row.job_id,
      name: row.name,
      quantity: parseFloat(row.quantity),
      unit: row.unit as MaterialUnit,
      unitCost: parseFloat(row.unit_cost),
      totalCost: parseFloat(row.total_cost),
      supplier: row.supplier,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
