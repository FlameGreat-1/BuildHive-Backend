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
  ValidationError
} from '../../shared/utils';
import { logger } from '../../shared/utils';
import { database } from '../../shared/database';

export class JobService {
  async createJob(tradieId: number, data: CreateJobData): Promise<Job> {
    await this.validateCreateJobData(data);
    
    try {
      const job = await jobRepository.create(tradieId, data);
      
      await this.publishJobEvent({
        type: JobEventType.CREATED,
        jobId: job.id,
        tradieId,
        data: { title: job.title, status: job.status },
        timestamp: new Date()
      });

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

  async getJobsByTradieId(tradieId: number, options?: JobListOptions): Promise<{
    jobs: Job[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const jobs = await jobRepository.findByTradieId(tradieId, options);
    const total = await jobRepository.count(tradieId, options?.filter);
    
    const page = options?.page || JOB_CONSTANTS.PAGINATION.DEFAULT_PAGE;
    const limit = options?.limit || JOB_CONSTANTS.PAGINATION.DEFAULT_LIMIT;
    const totalPages = Math.ceil(total / limit);

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
    
    await this.validateUpdateJobData(data, existingJob);
    
    const updatedJob = await jobRepository.update(jobId, data);
    
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
          toStatus: data.status 
        },
        timestamp: new Date()
      });
    }

    await this.publishJobEvent({
      type: JobEventType.UPDATED,
      jobId,
      tradieId,
      data: { updatedFields: Object.keys(data) },
      timestamp: new Date()
    });

    logger.info('Job updated successfully', {
      jobId,
      tradieId,
      updatedFields: Object.keys(data)
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
    return await jobRepository.getSummary(tradieId);
  }

  async getJobStatistics(tradieId: number): Promise<JobStatistics> {
    return await jobRepository.getStatistics(tradieId);
  }

  async updateJobStatus(jobId: number, tradieId: number, status: JobStatus): Promise<Job> {
    const existingJob = await this.getJobById(jobId, tradieId);
    
    this.validateStatusTransition(existingJob.status, status);
    
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

    const validationErrors: ValidationError[] = [];
    
    materials.forEach((material, index) => {
      const materialErrors = this.validateMaterialData(material, `materials[${index}]`);
      validationErrors.push(...materialErrors);
    });

    if (validationErrors.length > 0) {
      throw new MaterialValidationError('Material validation failed', validationErrors);
    }

    const createdMaterials: Material[] = [];
    
    for (const materialData of materials) {
      const material = await materialRepository.create(jobId, materialData);
      createdMaterials.push(material);
    }

    await this.publishJobEvent({
      type: JobEventType.MATERIAL_ADDED,
      jobId,
      tradieId,
      data: { materialCount: materials.length },
      timestamp: new Date()
    });

    logger.info('Materials added to job', {
      jobId,
      tradieId,
      materialCount: materials.length
    });

    return createdMaterials;
  }

  async updateJobMaterial(materialId: number, jobId: number, tradieId: number, data: UpdateMaterialData): Promise<Material> {
    await this.getJobById(jobId, tradieId);
    
    const validationErrors = this.validateMaterialData(data, 'material');
    
    if (validationErrors.length > 0) {
      throw new MaterialValidationError('Material validation failed', validationErrors);
    }

    const updatedMaterial = await materialRepository.update(materialId, data);
    
    if (!updatedMaterial) {
      throw new JobNotFoundError(`Material with ID ${materialId} not found`);
    }

    await this.publishJobEvent({
      type: JobEventType.MATERIAL_UPDATED,
      jobId,
      tradieId,
      data: { materialId, updatedFields: Object.keys(data) },
      timestamp: new Date()
    });

    return updatedMaterial;
  }

  async removeJobMaterial(materialId: number, jobId: number, tradieId: number): Promise<boolean> {
    await this.getJobById(jobId, tradieId);
    
    const deleted = await materialRepository.delete(materialId);
    
    if (deleted) {
      await this.publishJobEvent({
        type: JobEventType.MATERIAL_REMOVED,
        jobId,
        tradieId,
        data: { materialId },
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
        fileSize: attachment.fileSize
      },
      timestamp: new Date()
    });

    logger.info('Attachment added to job', {
      jobId,
      tradieId,
      attachmentId: attachment.id,
      filename: attachment.filename
    });

    return attachment;
  }

  async removeJobAttachment(attachmentId: number, jobId: number, tradieId: number): Promise<boolean> {
    await this.getJobById(jobId, tradieId);
    
    const attachment = await attachmentRepository.findById(attachmentId);
    
    if (!attachment) {
      throw new JobNotFoundError(`Attachment with ID ${attachmentId} not found`);
    }

    const deleted = await attachmentRepository.delete(attachmentId);
    
    if (deleted) {
      await this.publishJobEvent({
        type: JobEventType.ATTACHMENT_REMOVED,
        jobId,
        tradieId,
        data: { attachmentId },
        timestamp: new Date()
      });
    }

    return deleted;
  }

  async getJobAttachments(jobId: number, tradieId: number): Promise<JobAttachment[]> {
    await this.getJobById(jobId, tradieId);
    
    return await attachmentRepository.findByJobId(jobId);
  }
  
    private async validateCreateJobData(data: CreateJobData): Promise<void> {
    const errors: ValidationError[] = [];

    if (!data.title || data.title.trim().length < JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH) {
      errors.push({
        field: 'title',
        message: `Title must be at least ${JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH} characters long`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (data.title && data.title.length > JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH) {
      errors.push({
        field: 'title',
        message: `Title cannot exceed ${JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push({
        field: 'description',
        message: 'Description is required',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (data.description && data.description.length > JOB_CONSTANTS.VALIDATION.DESCRIPTION_MAX_LENGTH) {
      errors.push({
        field: 'description',
        message: `Description cannot exceed ${JOB_CONSTANTS.VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (!Object.values(JOB_CONSTANTS.TYPES).includes(data.jobType)) {
      errors.push({
        field: 'jobType',
        message: 'Invalid job type',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_TYPE
      });
    }

    if (!Object.values(JOB_CONSTANTS.PRIORITY).includes(data.priority)) {
      errors.push({
        field: 'priority',
        message: 'Invalid priority level',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_PRIORITY
      });
    }

    if (!data.clientName || data.clientName.trim().length === 0) {
      errors.push({
        field: 'clientName',
        message: 'Client name is required',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (!data.clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail)) {
      errors.push({
        field: 'clientEmail',
        message: 'Valid client email is required',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (!data.clientPhone || data.clientPhone.trim().length === 0) {
      errors.push({
        field: 'clientPhone',
        message: 'Client phone is required',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (!data.siteAddress || data.siteAddress.trim().length === 0) {
      errors.push({
        field: 'siteAddress',
        message: 'Site address is required',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (data.startDate >= data.dueDate) {
      errors.push({
        field: 'dueDate',
        message: 'Due date must be after start date',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_DATE_RANGE
      });
    }

    if (data.estimatedDuration < JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION || 
        data.estimatedDuration > JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION) {
      errors.push({
        field: 'estimatedDuration',
        message: `Estimated duration must be between ${JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION} and ${JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION} hours`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (errors.length > 0) {
      throw new JobValidationError('Job validation failed', errors);
    }
  }

  private async validateUpdateJobData(data: UpdateJobData, existingJob: Job): Promise<void> {
    const errors: ValidationError[] = [];

    if (data.title !== undefined) {
      if (data.title.trim().length < JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH) {
        errors.push({
          field: 'title',
          message: `Title must be at least ${JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH} characters long`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        });
      }

      if (data.title.length > JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH) {
        errors.push({
          field: 'title',
          message: `Title cannot exceed ${JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH} characters`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        });
      }
    }

    if (data.status !== undefined && !Object.values(JOB_CONSTANTS.STATUS).includes(data.status)) {
      errors.push({
        field: 'status',
        message: 'Invalid job status',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      });
    }

    if (data.priority !== undefined && !Object.values(JOB_CONSTANTS.PRIORITY).includes(data.priority)) {
      errors.push({
        field: 'priority',
        message: 'Invalid priority level',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_PRIORITY
      });
    }

    if (data.hoursWorked !== undefined) {
      if (data.hoursWorked < JOB_CONSTANTS.VALIDATION.MIN_HOURS_WORKED || 
          data.hoursWorked > JOB_CONSTANTS.VALIDATION.MAX_HOURS_WORKED) {
        errors.push({
          field: 'hoursWorked',
          message: `Hours worked must be between ${JOB_CONSTANTS.VALIDATION.MIN_HOURS_WORKED} and ${JOB_CONSTANTS.VALIDATION.MAX_HOURS_WORKED}`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        });
      }
    }

    if (data.startDate && data.dueDate && data.startDate >= data.dueDate) {
      errors.push({
        field: 'dueDate',
        message: 'Due date must be after start date',
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_DATE_RANGE
      });
    }

    if (errors.length > 0) {
      throw new JobValidationError('Job validation failed', errors);
    }
  }

  private validateMaterialData(data: CreateMaterialData | UpdateMaterialData, fieldPrefix: string = ''): ValidationError[] {
    const errors: ValidationError[] = [];
    const prefix = fieldPrefix ? `${fieldPrefix}.` : '';

    if ('name' in data && data.name !== undefined) {
      if (!data.name || data.name.trim().length < MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH) {
        errors.push({
          field: `${prefix}name`,
          message: `Material name must be at least ${MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters long`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        });
      }

      if (data.name.length > MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH) {
        errors.push({
          field: `${prefix}name`,
          message: `Material name cannot exceed ${MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        });
      }
    }

    if ('quantity' in data && data.quantity !== undefined) {
      if (data.quantity < MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY || 
          data.quantity > MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY) {
        errors.push({
          field: `${prefix}quantity`,
          message: `Quantity must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY}`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        });
      }
    }

    if ('unitCost' in data && data.unitCost !== undefined) {
      if (data.unitCost < MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST || 
          data.unitCost > MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST) {
        errors.push({
          field: `${prefix}unitCost`,
          message: `Unit cost must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST}`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        });
      }
    }

    if ('unit' in data && data.unit !== undefined) {
      if (!Object.values(JOB_CONSTANTS.MATERIAL_UNITS).includes(data.unit)) {
        errors.push({
          field: `${prefix}unit`,
          message: 'Invalid material unit',
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_MATERIAL_UNIT
        });
      }
    }

    return errors;
  }

  private validateAttachmentData(data: CreateAttachmentData): void {
    const errors: ValidationError[] = [];

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

    if (!data.mimeType || !JOB_CONSTANTS.FILE_TYPES.ALLOWED_MIME_TYPES.includes(data.mimeType)) {
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

  private validateStatusTransition(currentStatus: JobStatus, newStatus: JobStatus): void {
    const validTransitions: Record<JobStatus, JobStatus[]> = {
      [JobStatus.PENDING]: [JobStatus.ACTIVE, JobStatus.CANCELLED],
      [JobStatus.ACTIVE]: [JobStatus.COMPLETED, JobStatus.ON_HOLD, JobStatus.CANCELLED],
      [JobStatus.ON_HOLD]: [JobStatus.ACTIVE, JobStatus.CANCELLED],
      [JobStatus.COMPLETED]: [],
      [JobStatus.CANCELLED]: []
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new JobValidationError('Invalid status transition', [{
        field: 'status',
        message: `Cannot change status from ${currentStatus} to ${newStatus}`,
        code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
      }]);
    }
  }

  private async publishJobEvent(event: JobEvent): Promise<void> {
    try {
      const redisClient = database.getRedisClient();
      await redisClient.publish(JOB_CONSTANTS.EVENTS.JOB_CREATED, JSON.stringify(event));
    } catch (error: any) {
      logger.error('Failed to publish job event', {
        eventType: event.type,
        jobId: event.jobId,
        error: error.message
      });
    }
  }
}

  export class ClientService {
  async createClient(tradieId: number, data: CreateClientData): Promise<Client> {
    await this.validateCreateClientData(data);
    
    const existingClient = await clientRepository.findByEmail(tradieId, data.email);
    
    if (existingClient) {
      throw new JobValidationError('Client already exists', [{
        field: 'email',
        message: 'A client with this email already exists',
        code: JOB_CONSTANTS.ERROR_CODES.DUPLICATE_CLIENT_EMAIL
      }]);
    }

    const client = await clientRepository.create(tradieId, data);
    
    logger.info('Client created successfully', {
      clientId: client.id,
      tradieId,
      name: client.name,
      email: client.email
    });

    return client;
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

  async getClientsByTradieId(tradieId: number, options?: ClientListOptions): Promise<{
    clients: Client[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const clients = await clientRepository.findByTradieId(tradieId, options);
    const total = await clientRepository.count(tradieId, options?.filter);
    
    const page = options?.page || JOB_CONSTANTS.PAGINATION.DEFAULT_PAGE;
    const limit = options?.limit || JOB_CONSTANTS.PAGINATION.DEFAULT_LIMIT;
    const totalPages = Math.ceil(total / limit);

    return {
      clients,
      total,
      page,
      limit,
      totalPages
    };
  }

  async updateClient(clientId: number, tradieId: number, data: UpdateClientData): Promise<Client> {
    await this.getClientById(clientId, tradieId);
    
    await this.validateUpdateClientData(data);
    
    const updatedClient = await clientRepository.update(clientId, data);
    
    if (!updatedClient) {
      throw new ClientNotFoundError(`Client with ID ${clientId} not found`);
    }

    logger.info('Client updated successfully', {
      clientId,
      tradieId,
      updatedFields: Object.keys(data)
    });

    return updatedClient;
  }

  async deleteClient(clientId: number, tradieId: number): Promise<boolean> {
    await this.getClientById(clientId, tradieId);
    
    const deleted = await clientRepository.delete(clientId);
    
    if (deleted) {
      logger.info('Client deleted successfully', {
        clientId,
        tradieId
      });
    }

    return deleted;
  }

  private async validateCreateClientData(data: CreateClientData): Promise<void> {
    const errors: ValidationError[] = [];

    if (!data.name || data.name.trim().length < CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH) {
      errors.push({
        field: 'name',
        message: `Name must be at least ${CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters long`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (data.name && data.name.length > CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH) {
      errors.push({
        field: 'name',
        message: `Name cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push({
        field: 'email',
        message: 'Valid email is required',
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (data.email && data.email.length > CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH) {
      errors.push({
        field: 'email',
        message: `Email cannot exceed ${CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (!data.phone || data.phone.trim().length < CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH) {
      errors.push({
        field: 'phone',
        message: `Phone must be at least ${CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH} characters long`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (data.phone && data.phone.length > CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH) {
      errors.push({
        field: 'phone',
        message: `Phone cannot exceed ${CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (data.company && data.company.length > CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH) {
      errors.push({
        field: 'company',
        message: `Company name cannot exceed ${CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (data.address && data.address.length > CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH) {
      errors.push({
        field: 'address',
        message: `Address cannot exceed ${CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (data.notes && data.notes.length > CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH) {
      errors.push({
        field: 'notes',
        message: `Notes cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH} characters`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (data.tags && data.tags.length > CLIENT_CONSTANTS.VALIDATION.MAX_TAGS) {
      errors.push({
        field: 'tags',
        message: `Maximum ${CLIENT_CONSTANTS.VALIDATION.MAX_TAGS} tags allowed`,
        code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
      });
    }

    if (errors.length > 0) {
      throw new JobValidationError('Client validation failed', errors);
    }
  }

  private async validateUpdateClientData(data: UpdateClientData): Promise<void> {
    const errors: ValidationError[] = [];

    if (data.name !== undefined) {
      if (data.name.trim().length < CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH) {
        errors.push({
          field: 'name',
          message: `Name must be at least ${CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters long`,
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        });
      }

      if (data.name.length > CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH) {
        errors.push({
          field: 'name',
          message: `Name cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`,
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        });
      }
    }

    if (data.email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push({
          field: 'email',
          message: 'Valid email is required',
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        });
      }

      if (data.email.length > CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH) {
        errors.push({
          field: 'email',
          message: `Email cannot exceed ${CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH} characters`,
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        });
      }
    }

    if (data.phone !== undefined) {
      if (data.phone.trim().length < CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH) {
        errors.push({
          field: 'phone',
          message: `Phone must be at least ${CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH} characters long`,
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        });
      }

      if (data.phone.length > CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH) {
        errors.push({
          field: 'phone',
          message: `Phone cannot exceed ${CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH} characters`,
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        });
      }
    }

    if (errors.length > 0) {
      throw new JobValidationError('Client validation failed', errors);
    }
  }
}

export class MaterialService {
  async getMaterialsByJobId(jobId: number, tradieId: number): Promise<Material[]> {
    const jobService = new JobService();
    await jobService.getJobById(jobId, tradieId);
    
    return await materialRepository.findByJobId(jobId);
  }

  async updateMaterial(materialId: number, jobId: number, tradieId: number, data: UpdateMaterialData): Promise<Material> {
    const jobService = new JobService();
    await jobService.getJobById(jobId, tradieId);
    
    const updatedMaterial = await materialRepository.update(materialId, data);
    
    if (!updatedMaterial) {
      throw new JobNotFoundError(`Material with ID ${materialId} not found`);
    }

    logger.info('Material updated successfully', {
      materialId,
      jobId,
      tradieId,
      updatedFields: Object.keys(data)
    });

    return updatedMaterial;
  }

  async deleteMaterial(materialId: number, jobId: number, tradieId: number): Promise<boolean> {
    const jobService = new JobService();
    await jobService.getJobById(jobId, tradieId);
    
    const deleted = await materialRepository.delete(materialId);
    
    if (deleted) {
      logger.info('Material deleted successfully', {
        materialId,
        jobId,
        tradieId
      });
    }

    return deleted;
  }
}

export class AttachmentService {
  async getAttachmentsByJobId(jobId: number, tradieId: number): Promise<JobAttachment[]> {
    const jobService = new JobService();
    await jobService.getJobById(jobId, tradieId);
    
    return await attachmentRepository.findByJobId(jobId);
  }

  async getAttachmentById(attachmentId: number, jobId: number, tradieId: number): Promise<JobAttachment> {
    const jobService = new JobService();
    await jobService.getJobById(jobId, tradieId);
    
    const attachment = await attachmentRepository.findById(attachmentId);
    
    if (!attachment) {
      throw new JobNotFoundError(`Attachment with ID ${attachmentId} not found`);
    }

    return attachment;
  }

  async deleteAttachment(attachmentId: number, jobId: number, tradieId: number): Promise<boolean> {
    const jobService = new JobService();
    await jobService.getJobById(jobId, tradieId);
    
    const deleted = await attachmentRepository.delete(attachmentId);
    
    if (deleted) {
      logger.info('Attachment deleted successfully', {
        attachmentId,
        jobId,
        tradieId
      });
    }

    return deleted;
  }
}

export const jobService = new JobService();
export const clientService = new ClientService();
export const materialService = new MaterialService();
export const attachmentService = new AttachmentService();



