// @ts-nocheck
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
  JobStatus,
  JobType,
  JobPriority,
  JobTag,
  ClientTag,
  JobEvent,
  JobEventType
} from '../types';
import { 
  jobRepository, 
  clientRepository, 
  materialRepository, 
  attachmentRepository 
} from '../repositories';
import { JOB_CONSTANTS, CLIENT_CONSTANTS, MATERIAL_CONSTANTS } from '../../config/jobs';
import { 
  JobNotFoundError, 
  UnauthorizedJobAccessError, 
  ClientNotFoundError,
  JobValidationError,
  MaterialValidationError,
  FileUploadError,
  ValidationAppError,
  logger
} from '../../shared/utils';
import { JobUtils, ClientUtils, MaterialUtils, DateUtils } from '../utils';

export class JobService {
  async createJob(tradieId: number, data: CreateJobData): Promise<Job> {
    const validationErrors = JobUtils.validateJobData(data);
    if (validationErrors.length > 0) {
      throw new JobValidationError('Job validation failed', validationErrors.map(error => ({
        field: 'general',
        message: error,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      })));
    }
    
    try {
      const { materials, ...jobDataWithoutMaterials } = data;
      
      const formattedData = {
        ...jobDataWithoutMaterials,
        title: JobUtils.formatJobTitle(data.title),
        clientName: ClientUtils.formatClientName(data.clientName),
        clientPhone: ClientUtils.formatPhoneNumber(data.clientPhone)
      };

      const job = await jobRepository.create(tradieId, formattedData as any);
      
      if (materials && materials.length > 0) {
        await this.addJobMaterials(job.id, tradieId, materials);
      }
      
      await this.publishJobEvent({
        type: JobEventType.CREATED,
        jobId: job.id,
        tradieId,
        data: { 
          title: job.title, 
          status: job.status,
          reference: JobUtils.generateJobReference(job.id, job.jobType)
        },
        timestamp: new Date()
      });

      logger.info('Job created successfully', {
        jobId: job.id,
        tradieId,
        title: job.title,
        clientEmail: job.clientEmail,
        reference: JobUtils.generateJobReference(job.id, job.jobType),
        estimatedValue: JobUtils.calculateEstimatedJobValue(job)
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

  async getJobById(jobId: number, tradieId: number): Promise<Job> {
    const job = await jobRepository.findById(jobId);
    
    if (!job) {
      throw new JobNotFoundError(`Job with ID ${jobId} not found`);
    }

    if (job.tradieId !== tradieId) {
      throw new UnauthorizedJobAccessError('You do not have permission to access this job');
    }

    return job;
  }

  async getAllJobsByTradieId(tradieId: number): Promise<Job[]> {
    return await jobRepository.findAllByTradieId(tradieId);
  }

  async getJobsByClientId(clientId: number, tradieId: number): Promise<Job[]> {
    return await jobRepository.findByClientId(clientId, tradieId);
  }

  async getJobsByTradieId(tradieId: number, options?: JobListOptions): Promise<{
    jobs: Job[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let jobs = await jobRepository.findByTradieId(tradieId, options);
    const total = await jobRepository.count(tradieId, options?.filter);
    
    const page = options?.page || JOB_CONSTANTS.PAGINATION.DEFAULT_PAGE;
    const limit = options?.limit || JOB_CONSTANTS.PAGINATION.DEFAULT_LIMIT;
    const totalPages = Math.ceil(total / limit);

    if (options?.filter?.isOverdue) {
      jobs = JobUtils.getOverdueJobs(jobs);
    }

    if (options?.filter?.startDate && options?.filter?.endDate) {
      jobs = JobUtils.filterJobsByDateRange(jobs, options.filter.startDate, options.filter.endDate);
    }

    if (options?.filter?.status) {
      jobs = JobUtils.getJobsByStatus(jobs, options.filter.status);
    }

    return {
      jobs,
      total,
      page,
      limit,
      totalPages
    };
  }

  async updateJob(jobId: number, tradieId: number, data: UpdateJobData): Promise<Job> {
    const existingJob = await this.getJobById(jobId, tradieId);
    
    const validationErrors = JobUtils.validateJobData(data);
    if (validationErrors.length > 0) {
      throw new JobValidationError('Job validation failed', validationErrors.map(error => ({
        field: 'general',
        message: error,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      })));
    }

    if (data.status && !JobUtils.canTransitionStatus(existingJob.status, data.status)) {
      throw new JobValidationError('Invalid status transition', [{
        field: 'status',
        message: `Cannot transition from ${existingJob.status} to ${data.status}`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      }]);
    }
    
    const formattedData = { ...data };
    if (data.title) formattedData.title = JobUtils.formatJobTitle(data.title);
    if (data.clientName) formattedData.clientName = ClientUtils.formatClientName(data.clientName);
    if (data.clientPhone) formattedData.clientPhone = ClientUtils.formatPhoneNumber(data.clientPhone);

    const updatedJob = await jobRepository.update(jobId, formattedData);
    
    if (!updatedJob) {
      throw new JobNotFoundError(`Job with ID ${jobId} not found`);
    }

    if (data.status && data.status !== existingJob.status) {
      await this.publishJobEvent({
        type: JobEventType.STATUS_CHANGED,
        jobId,
        tradieId,
        data: { 
          fromStatus: existingJob.status, 
          toStatus: data.status,
          progress: JobUtils.calculateJobProgress(updatedJob)
        },
        timestamp: new Date()
      });
    }

    await this.publishJobEvent({
      type: JobEventType.UPDATED,
      jobId,
      tradieId,
      data: { 
        updatedFields: Object.keys(data),
        healthScore: JobUtils.getJobHealthScore(updatedJob)
      },
      timestamp: new Date()
    });

    logger.info('Job updated successfully', {
      jobId,
      tradieId,
      updatedFields: Object.keys(data),
      newStatus: data.status,
      progress: JobUtils.calculateJobProgress(updatedJob)
    });

    return updatedJob;
  }

  async deleteJob(jobId: number, tradieId: number): Promise<boolean> {
    await this.getJobById(jobId, tradieId);
    
    const deleted = await jobRepository.delete(jobId);
    
    if (deleted) {
      await this.publishJobEvent({
        type: JobEventType.DELETED,
        jobId,
        tradieId,
        data: {},
        timestamp: new Date()
      });

      logger.info('Job deleted successfully', {
        jobId,
        tradieId
      });
    }

    return deleted;
  }

  async getJobSummary(tradieId: number): Promise<JobSummary> {
    const summary = await jobRepository.getSummary(tradieId);
    const allJobs = await this.getAllJobsByTradieId(tradieId);
    
    const overdueJobs = JobUtils.getOverdueJobs(allJobs);
    const upcomingJobs = JobUtils.getUpcomingJobs(allJobs, 7);
    
    return {
      ...summary,
      cancelled: summary.cancelled || 0,
    };
  }

  async getJobStatistics(tradieId: number): Promise<JobStatistics> {
    const statistics = await jobRepository.getStatistics(tradieId);
    const allJobs = await this.getAllJobsByTradieId(tradieId);
    
    const jobsByStatus = {
      [JobStatus.PENDING]: JobUtils.getJobsByStatus(allJobs, JobStatus.PENDING).length,
      [JobStatus.ACTIVE]: JobUtils.getJobsByStatus(allJobs, JobStatus.ACTIVE).length,
      [JobStatus.COMPLETED]: JobUtils.getJobsByStatus(allJobs, JobStatus.COMPLETED).length,
      [JobStatus.CANCELLED]: JobUtils.getJobsByStatus(allJobs, JobStatus.CANCELLED).length,
      [JobStatus.ON_HOLD]: JobUtils.getJobsByStatus(allJobs, JobStatus.ON_HOLD).length
    };

    const jobsByType = allJobs.reduce((acc, job) => {
      acc[job.jobType] = (acc[job.jobType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const jobsByPriority = allJobs.reduce((acc, job) => {
      acc[job.priority] = (acc[job.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const monthlyStats = this.calculateMonthlyStats(allJobs);

    return {
      ...statistics,
      jobsByStatus,
      jobsByType,
      jobsByPriority,
      monthlyStats
    };
  }
  
  async updateJobStatus(jobId: number, tradieId: number, status: JobStatus): Promise<Job> {
    const existingJob = await this.getJobById(jobId, tradieId);
    
    if (!JobUtils.canTransitionStatus(existingJob.status, status)) {
      throw new JobValidationError('Invalid status transition', [{
        field: 'status',
        message: `Cannot transition from ${existingJob.status} to ${status}`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      }]);
    }
    
    return await this.updateJob(jobId, tradieId, { status });
  }

  async addJobMaterials(jobId: number, tradieId: number, materials: CreateMaterialData[]): Promise<Material[]> {
    await this.getJobById(jobId, tradieId);
    
    if (materials.length > JOB_CONSTANTS.VALIDATION.MAX_MATERIALS_PER_JOB) {
      throw new MaterialValidationError('Too many materials', [{
        field: 'materials',
        message: `Maximum ${JOB_CONSTANTS.VALIDATION.MAX_MATERIALS_PER_JOB} materials allowed per job`,
        code: JOB_CONSTANTS.ERROR_CODES.MATERIALS_LIMIT_EXCEEDED
      }]);
    }

    const validationErrors: any[] = [];
    
    materials.forEach((material, index) => {
      const materialErrors = MaterialUtils.validateMaterialData(material);
      if (materialErrors.length > 0) {
        materialErrors.forEach(error => {
          validationErrors.push({
            field: `materials[${index}]`,
            message: error,
            code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
          });
        });
      }
    });

    if (validationErrors.length > 0) {
      throw new MaterialValidationError('Material validation failed', validationErrors);
    }

    const createdMaterials: Material[] = [];
    
    for (const materialData of materials) {
      const formattedMaterial = {
        ...materialData,
        name: MaterialUtils.formatMaterialName(materialData.name),
        totalCost: MaterialUtils.calculateTotalCost(materialData.quantity, materialData.unitCost)
      };

      const material = await materialRepository.create(jobId, formattedMaterial);
      createdMaterials.push(material);
    }

    const totalCost = MaterialUtils.calculateMaterialsTotal(createdMaterials);

    await this.publishJobEvent({
      type: JobEventType.MATERIAL_ADDED,
      jobId,
      tradieId,
      data: { 
        materialCount: materials.length,
        totalCost,
        formattedTotalCost: MaterialUtils.formatCurrency(totalCost)
      },
      timestamp: new Date()
    });

    logger.info('Materials added to job', {
      jobId,
      tradieId,
      materialCount: materials.length,
      totalCost
    });

    return createdMaterials;
  }
  
  async updateJobMaterial(materialId: number, jobId: number, tradieId: number, data: UpdateMaterialData): Promise<Material> {
    await this.getJobById(jobId, tradieId);
    
    const validationErrors = MaterialUtils.validateMaterialData(data);
    if (validationErrors.length > 0) {
      throw new MaterialValidationError('Material validation failed', validationErrors.map(error => ({
        field: 'material',
        message: error,
        code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
      })));
    }

    const formattedData = { ...data };
    if (data.name) formattedData.name = MaterialUtils.formatMaterialName(data.name);

    const updatedMaterial = await materialRepository.update(materialId, formattedData);
    
    if (!updatedMaterial) {
      throw new JobNotFoundError(`Material with ID ${materialId} not found`);
    }

    await this.publishJobEvent({
      type: JobEventType.MATERIAL_UPDATED,
      jobId,
      tradieId,
      data: { 
        materialId, 
        updatedFields: Object.keys(data),
        newTotalCost: updatedMaterial.totalCost,
        formattedCost: MaterialUtils.formatCurrency(updatedMaterial.totalCost)
      },
      timestamp: new Date()
    });

    return updatedMaterial;
  }

    async removeJobMaterial(materialId: number, jobId: number, tradieId: number): Promise<boolean> {
    await this.getJobById(jobId, tradieId);
    
    const material = await materialRepository.findById(materialId);
    if (!material) {
      return false;
    }

    const deleted = await materialRepository.delete(materialId);
    
    if (deleted) {
      await this.publishJobEvent({
        type: JobEventType.MATERIAL_REMOVED,
        jobId,
        tradieId,
        data: { 
          materialId,
          materialName: material.name,
          costRemoved: material.totalCost
        },
        timestamp: new Date()
      });
    }

    return deleted;
  }

  async getJobMaterials(jobId: number, tradieId: number): Promise<Material[]> {
    await this.getJobById(jobId, tradieId);
    
    return await materialRepository.findByJobId(jobId);
  }

  async addJobAttachment(jobId: number, tradieId: number, attachmentData: CreateAttachmentData): Promise<JobAttachment> {
    await this.getJobById(jobId, tradieId);
    
    this.validateAttachmentData(attachmentData);
    
    const attachment = await attachmentRepository.create(jobId, attachmentData);
    
    await this.publishJobEvent({
      type: JobEventType.ATTACHMENT_ADDED,
      jobId,
      tradieId,
      data: { 
        attachmentId: attachment.id,
        filename: attachment.filename,
        fileSize: attachment.fileSize,
        formattedSize: `${Math.round(attachment.fileSize / 1024)} KB`,
        mimeType: attachment.mimeType
      },
      timestamp: new Date()
    });

    logger.info('Attachment added to job', {
      jobId,
      tradieId,
      attachmentId: attachment.id,
      filename: attachment.filename,
      fileSize: attachment.fileSize
    });

    return attachment;
  }

  async removeJobAttachment(attachmentId: number, jobId: number, tradieId: number): Promise<boolean> {
    await this.getJobById(jobId, tradieId);
    
    const attachment = await attachmentRepository.findById(attachmentId);
    
    if (!attachment) {
      return false;
    }

    const deleted = await attachmentRepository.delete(attachmentId);
    
    if (deleted) {
      await this.publishJobEvent({
        type: JobEventType.ATTACHMENT_REMOVED,
        jobId,
        tradieId,
        data: { 
          attachmentId,
          filename: attachment.filename,
          fileSize: attachment.fileSize
        },
        timestamp: new Date()
      });
    }

    return deleted;
  }

  async getJobAttachments(jobId: number, tradieId: number): Promise<JobAttachment[]> {
    await this.getJobById(jobId, tradieId);
    
    return await attachmentRepository.findByJobId(jobId);
  }

  private calculateMonthlyStats(jobs: Job[]): { month: string; jobsCompleted: number; revenue: number; }[] {
    const monthlyData: Record<string, { count: number; revenue: number; completed: number }> = {};
    
    jobs.forEach(job => {
      const monthKey = `${job.createdAt.getFullYear()}-${String(job.createdAt.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, revenue: 0, completed: 0 };
      }
      
      monthlyData[monthKey].count++;
      monthlyData[monthKey].revenue += job.totalCost || 0;
      
      if (job.status === JobStatus.COMPLETED) {
        monthlyData[monthKey].completed++;
      }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      jobsCompleted: data.completed,
      revenue: data.revenue
    }));
  }

  private validateAttachmentData(data: CreateAttachmentData): void {
    const errors: any[] = [];

    if (!data.filename || data.filename.trim().length === 0) {
      errors.push({
        field: 'filename',
        message: 'Filename is required',
        code: JOB_CONSTANTS.ERROR_CODES.FILE_UPLOAD_ERROR
      });
    }

    if (!data.originalName || data.originalName.trim().length === 0) {
      errors.push({
        field: 'originalName',
        message: 'Original filename is required',
        code: JOB_CONSTANTS.ERROR_CODES.FILE_UPLOAD_ERROR
      });
    }

    if (!data.mimeType || !JOB_CONSTANTS.FILE_TYPES.ALLOWED_MIME_TYPES.includes(data.mimeType as any)) {
      errors.push({
        field: 'mimeType',
        message: 'Invalid file type',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_FILE_TYPE
      });
    }

    if (data.fileSize > JOB_CONSTANTS.VALIDATION.MAX_FILE_SIZE) {
      errors.push({
        field: 'fileSize',
        message: `File size cannot exceed ${JOB_CONSTANTS.VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`,
        code: JOB_CONSTANTS.ERROR_CODES.FILE_TOO_LARGE
      });
    }

    if (errors.length > 0) {
      throw new FileUploadError('File validation failed');
    }
  }

  private async publishJobEvent(event: JobEvent): Promise<void> {
    try {
      logger.info('Job event published', {
        type: event.type,
        jobId: event.jobId,
        tradieId: event.tradieId,
        timestamp: event.timestamp
      });
    } catch (error: any) {
      logger.error('Failed to publish job event', {
        event: event.type,
        jobId: event.jobId,
        error: error.message
      });
    }
  }
}

export class ClientService {
  async createClient(tradieId: number, data: CreateClientData): Promise<Client> {
    const validationErrors = ClientUtils.validateClientData(data);
    if (validationErrors.length > 0) {
      throw new ClientNotFoundError('Client validation failed');
    }

    try {
      const formattedData = {
        ...data,
        name: ClientUtils.formatClientName(data.name),
        phone: ClientUtils.formatPhoneNumber(data.phone),
        email: data.email.toLowerCase().trim()
      };

      if (!ClientUtils.validateEmail(formattedData.email)) {
        throw new ClientNotFoundError('Invalid email format');
      }

      const client = await clientRepository.create(tradieId, formattedData);

      logger.info('Client created successfully', {
        clientId: client.id,
        tradieId,
        name: client.name,
        email: client.email,
        reference: ClientUtils.generateClientReference(client.id)
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

  async getClientById(clientId: number, tradieId: number): Promise<Client> {
    const client = await clientRepository.findById(clientId);
    
    if (!client) {
      throw new ClientNotFoundError(`Client with ID ${clientId} not found`);
    }

    if (client.tradieId !== tradieId) {
      throw new UnauthorizedJobAccessError('You do not have permission to access this client');
    }

    return client;
  }

  async getAllClientsByTradieId(tradieId: number): Promise<Client[]> {
    return await clientRepository.findAllByTradieId(tradieId);
  }

  async getClientsByTradieId(tradieId: number, options?: ClientListOptions): Promise<{
    clients: Client[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let clients = await clientRepository.findByTradieId(tradieId, options);
    const total = await clientRepository.count(tradieId, options?.filter);
    
    const page = options?.page || JOB_CONSTANTS.PAGINATION.DEFAULT_PAGE;
    const limit = options?.limit || JOB_CONSTANTS.PAGINATION.DEFAULT_LIMIT;
    const totalPages = Math.ceil(total / limit);

    if (options?.filter) {
      if (options.filter.search) {
        clients = ClientUtils.searchClients(clients, options.filter.search);
      }

      if (options.filter.tags && options.filter.tags.length > 0) {
        clients = clients.filter(client => 
          options.filter!.tags!.some(tag => client.tags?.includes(tag as ClientTag))
        );
      }
    }

    return {
      clients,
      total,
      page,
      limit,
      totalPages
    };
  }

  async updateClient(clientId: number, tradieId: number, data: UpdateClientData): Promise<Client> {
    const existingClient = await this.getClientById(clientId, tradieId);
    
    const validationErrors = ClientUtils.validateClientData(data);
    if (validationErrors.length > 0) {
      throw new ClientNotFoundError('Client validation failed');
    }

    const formattedData = { ...data };
    if (data.name) formattedData.name = ClientUtils.formatClientName(data.name);
    if (data.phone) formattedData.phone = ClientUtils.formatPhoneNumber(data.phone);
    if (data.email) {
      formattedData.email = data.email.toLowerCase().trim();
      if (!ClientUtils.validateEmail(formattedData.email)) {
        throw new ClientNotFoundError('Invalid email format');
      }
    }

    const updatedClient = await clientRepository.update(clientId, formattedData);
    
    if (!updatedClient) {
      throw new ClientNotFoundError(`Client with ID ${clientId} not found`);
    }

    logger.info('Client updated successfully', {
      clientId,
      tradieId,
      updatedFields: Object.keys(data),
      name: updatedClient.name
    });

    return updatedClient;
  }

  async deleteClient(clientId: number, tradieId: number): Promise<boolean> {
    await this.getClientById(clientId, tradieId);
    
    const hasActiveJobs = await jobRepository.hasActiveJobsForClient(clientId);
    if (hasActiveJobs) {
      throw new ClientNotFoundError('Cannot delete client with active jobs');
    }

    const deleted = await clientRepository.delete(clientId);
    
    if (deleted) {
      logger.info('Client deleted successfully', {
        clientId,
        tradieId
      });
    }

    return deleted;
  }
}

export class MaterialService {
  async getMaterialById(materialId: number): Promise<Material> {
    const material = await materialRepository.findById(materialId);
    
    if (!material) {
      throw new JobNotFoundError(`Material with ID ${materialId} not found`);
    }

    return material;
  }

  async updateMaterial(materialId: number, data: UpdateMaterialData): Promise<Material> {
    const validationErrors = MaterialUtils.validateMaterialData(data);
    if (validationErrors.length > 0) {
      throw new MaterialValidationError('Material validation failed', validationErrors.map(error => ({
        field: 'material',
        message: error,
        code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
      })));
    }

    const formattedData = { ...data };
    if (data.name) formattedData.name = MaterialUtils.formatMaterialName(data.name);

    const updatedMaterial = await materialRepository.update(materialId, formattedData);
    
    if (!updatedMaterial) {
      throw new JobNotFoundError(`Material with ID ${materialId} not found`);
    }

    return updatedMaterial;
  }

  async deleteMaterial(materialId: number): Promise<boolean> {
    return await materialRepository.delete(materialId);
  }
}

export class AttachmentService {
  async getAttachmentById(attachmentId: number): Promise<JobAttachment> {
    const attachment = await attachmentRepository.findById(attachmentId);
    
    if (!attachment) {
      throw new JobNotFoundError(`Attachment with ID ${attachmentId} not found`);
    }

    return attachment;
  }

  async deleteAttachment(attachmentId: number): Promise<boolean> {
    return await attachmentRepository.delete(attachmentId);
  }
}

export const jobService = new JobService();
export const clientService = new ClientService();
export const materialService = new MaterialService();
export const attachmentService = new AttachmentService();