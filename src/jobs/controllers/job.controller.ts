import { Response, NextFunction } from 'express';
import { 
  jobService, 
  clientService, 
  materialService, 
  attachmentService 
} from '../services';
import { 
  CreateJobData, 
  UpdateJobData, 
  JobListOptions, 
  JobFilter,
  JobSortOptions,
  JobSortField,
  SortOrder,
  CreateClientData,
  UpdateClientData,
  ClientListOptions,
  ClientFilter,
  ClientSortOptions,
  ClientSortField,
  CreateMaterialData,
  UpdateMaterialData,
  CreateAttachmentData,
  JobStatus,
  Job,
  Material,
  Client,
  EnrichedClient
} from '../types';
import { JOB_CONSTANTS } from '../../config/jobs';
import { 
  sendSuccessResponse, 
  sendErrorResponse, 
  sendNotFoundResponse,
  sendValidationError,
  JobNotFoundError,
  UnauthorizedJobAccessError,
  ClientNotFoundError,
  JobValidationError,
  MaterialValidationError,
  FileUploadError,
  logger
} from '../../shared/utils';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { JobUtils, ClientUtils, MaterialUtils } from '../utils';

export class JobController {
  async createJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobData: CreateJobData = {
        title: JobUtils.formatJobTitle(req.body.title),
        description: req.body.description,
        jobType: req.body.jobType,
        priority: req.body.priority,
        clientName: ClientUtils.formatClientName(req.body.clientName),
        clientEmail: req.body.clientEmail,
        clientPhone: ClientUtils.formatPhoneNumber(req.body.clientPhone),
        clientCompany: req.body.clientCompany,
        siteAddress: req.body.siteAddress,
        siteCity: req.body.siteCity,
        siteState: req.body.siteState,
        sitePostcode: req.body.sitePostcode,
        siteAccessInstructions: req.body.siteAccessInstructions,
        startDate: new Date(req.body.startDate),
        dueDate: new Date(req.body.dueDate),
        estimatedDuration: req.body.estimatedDuration,
        materials: req.body.materials,
        notes: req.body.notes
      };

      const job = await jobService.createJob(tradieId, jobData);

      logger.info('Job created successfully via API', {
        jobId: job.id,
        tradieId,
        title: job.title,
        clientEmail: job.clientEmail,
        reference: JobUtils.generateJobReference(job.id, job.jobType)
      });

      sendSuccessResponse(res, 'Job created successfully', {
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        estimatedValue: JobUtils.calculateEstimatedJobValue(job),
        reference: JobUtils.generateJobReference(job.id, job.jobType)
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  async getJobById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);

      const job = await jobService.getJobById(jobId, tradieId);

      const enrichedJob = {
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        estimatedValue: JobUtils.calculateEstimatedJobValue(job),
        reference: JobUtils.generateJobReference(job.id, job.jobType),
        isOverdue: JobUtils.isJobOverdue(job),
        daysUntilDue: JobUtils.getDaysUntilDue(job),
        healthScore: JobUtils.getJobHealthScore(job),
        efficiency: JobUtils.calculateJobEfficiency(job),
        nextValidStatuses: JobUtils.getNextValidStatuses(job.status)
      };

      sendSuccessResponse(res, 'Job retrieved successfully', enrichedJob);
    } catch (error) {
      next(error);
    }
  }

  async getJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      
      const page = parseInt(req.query.page as string) || JOB_CONSTANTS.PAGINATION.DEFAULT_PAGE;
      const limit = Math.min(
        parseInt(req.query.limit as string) || JOB_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
        JOB_CONSTANTS.PAGINATION.MAX_LIMIT
      );

      const filter: JobFilter = {};
      
      if (req.query.status) {
        filter.status = req.query.status as JobStatus;
      }
      
      if (req.query.jobType) {
        filter.jobType = req.query.jobType as any;
      }
      
      if (req.query.priority) {
        filter.priority = req.query.priority as any;
      }
      
      if (req.query.clientId) {
        filter.clientId = parseInt(req.query.clientId as string);
      }
      
      if (req.query.startDate) {
        filter.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filter.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.search) {
        filter.search = req.query.search as string;
      }
      
      if (req.query.tags) {
        const tags = Array.isArray(req.query.tags) 
          ? req.query.tags as string[]
          : [req.query.tags as string];
        filter.tags = tags as any[];
      }

      if (req.query.overdue === 'true') {
        filter.isOverdue = true;
      }

      const sort: JobSortOptions = {
        field: (req.query.sortField as JobSortField) || JobSortField.CREATED_AT,
        order: (req.query.sortOrder as SortOrder) || SortOrder.DESC
      };

      const options: JobListOptions = {
        page,
        limit,
        filter,
        sort
      };

      const result = await jobService.getJobsByTradieId(tradieId, options);

      const enrichedJobs = result.jobs.map(job => ({
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        reference: JobUtils.generateJobReference(job.id, job.jobType),
        isOverdue: JobUtils.isJobOverdue(job),
        daysUntilDue: JobUtils.getDaysUntilDue(job),
        healthScore: JobUtils.getJobHealthScore(job)
      }));

      const sortedJobs = req.query.sortByPriority === 'true' 
        ? JobUtils.sortJobsByPriority(enrichedJobs)
        : enrichedJobs;

      sendSuccessResponse(res, 'Jobs retrieved successfully', {
        ...result,
        jobs: sortedJobs
      });
    } catch (error) {
      next(error);
    }
  }

  async updateJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);

      const updateData: UpdateJobData = {};
      
      if (req.body.title !== undefined) updateData.title = JobUtils.formatJobTitle(req.body.title);
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.status !== undefined) {
        const currentJob = await jobService.getJobById(jobId, tradieId);
        if (!JobUtils.canTransitionStatus(currentJob.status, req.body.status)) {
          sendValidationError(res, 'Invalid status transition', [{
            field: 'status',
            message: `Cannot transition from ${currentJob.status} to ${req.body.status}`,
            code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
          }]);
          return;
        }
        updateData.status = req.body.status;
      }
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.clientName !== undefined) updateData.clientName = ClientUtils.formatClientName(req.body.clientName);
      if (req.body.clientEmail !== undefined) updateData.clientEmail = req.body.clientEmail;
      if (req.body.clientPhone !== undefined) updateData.clientPhone = ClientUtils.formatPhoneNumber(req.body.clientPhone);
      if (req.body.clientCompany !== undefined) updateData.clientCompany = req.body.clientCompany;
      if (req.body.siteAddress !== undefined) updateData.siteAddress = req.body.siteAddress;
      if (req.body.siteCity !== undefined) updateData.siteCity = req.body.siteCity;
      if (req.body.siteState !== undefined) updateData.siteState = req.body.siteState;
      if (req.body.sitePostcode !== undefined) updateData.sitePostcode = req.body.sitePostcode;
      if (req.body.siteAccessInstructions !== undefined) updateData.siteAccessInstructions = req.body.siteAccessInstructions;
      if (req.body.startDate !== undefined) updateData.startDate = new Date(req.body.startDate);
      if (req.body.dueDate !== undefined) updateData.dueDate = new Date(req.body.dueDate);
      if (req.body.estimatedDuration !== undefined) updateData.estimatedDuration = req.body.estimatedDuration;
      if (req.body.hoursWorked !== undefined) updateData.hoursWorked = req.body.hoursWorked;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.tags !== undefined) updateData.tags = req.body.tags;

      const validationErrors = JobUtils.validateJobData(updateData);
      if (validationErrors.length > 0) {
        sendValidationError(res, 'Job validation failed', validationErrors.map(error => ({
          field: 'general',
          message: error,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        })));
        return;
      }

      const job = await jobService.updateJob(jobId, tradieId, updateData);

      logger.info('Job updated successfully via API', {
        jobId,
        tradieId,
        updatedFields: Object.keys(updateData),
        newStatus: updateData.status
      });

      sendSuccessResponse(res, 'Job updated successfully', {
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        estimatedValue: JobUtils.calculateEstimatedJobValue(job),
        reference: JobUtils.generateJobReference(job.id, job.jobType),
        healthScore: JobUtils.getJobHealthScore(job)
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);

      const deleted = await jobService.deleteJob(jobId, tradieId);

      if (!deleted) {
        sendNotFoundResponse(res, 'Job not found');
        return;
      }

      logger.info('Job deleted successfully via API', {
        jobId,
        tradieId
      });

      sendSuccessResponse(res, 'Job deleted successfully', { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async updateJobStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);
      const { status } = req.body;

      const currentJob = await jobService.getJobById(jobId, tradieId);
      
      if (!JobUtils.canTransitionStatus(currentJob.status, status)) {
        sendValidationError(res, 'Invalid status transition', [{
          field: 'status',
          message: `Cannot transition from ${currentJob.status} to ${status}`,
          code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
        }]);
        return;
      }

      const job = await jobService.updateJobStatus(jobId, tradieId, status);

      logger.info('Job status updated successfully via API', {
        jobId,
        tradieId,
        oldStatus: currentJob.status,
        newStatus: status
      });

      sendSuccessResponse(res, 'Job status updated successfully', {
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        nextValidStatuses: JobUtils.getNextValidStatuses(job.status)
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getJobSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      
      const summary = await jobService.getJobSummary(tradieId);

      sendSuccessResponse(res, 'Job summary retrieved successfully', summary);
    } catch (error) {
      next(error);
    }
  }

  async getJobStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      
      const statistics = await jobService.getJobStatistics(tradieId);

      sendSuccessResponse(res, 'Job statistics retrieved successfully', statistics);
    } catch (error) {
      next(error);
    }
  }

  async addJobMaterials(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);
      const { materials } = req.body;

      const materialData: CreateMaterialData[] = materials.map((material: any) => {
        const validationErrors = MaterialUtils.validateMaterialData(material);
        if (validationErrors.length > 0) {
          throw new MaterialValidationError('Material validation failed', validationErrors.map(error => ({
            field: 'material',
            message: error,
            code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
          })));
        }

        return {
          name: MaterialUtils.formatMaterialName(material.name),
          quantity: material.quantity,
          unit: material.unit,
          unitCost: material.unitCost,
          supplier: material.supplier,
          totalCost: MaterialUtils.calculateTotalCost(material.quantity, material.unitCost)
        };
      });

      const createdMaterials = await jobService.addJobMaterials(jobId, tradieId, materialData);

      const enrichedMaterials = createdMaterials.map(material => ({
        ...material,
        formattedCost: MaterialUtils.formatCurrency(material.totalCost)
      }));

      logger.info('Materials added to job successfully via API', {
        jobId,
        tradieId,
        materialCount: createdMaterials.length,
        totalCost: MaterialUtils.calculateMaterialsTotal(createdMaterials)
      });

      sendSuccessResponse(res, 'Materials added successfully', enrichedMaterials, 201);
    } catch (error) {
      next(error);
    }
  }

  async getJobMaterials(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);

      const materials = await jobService.getJobMaterials(jobId, tradieId);

      const enrichedMaterials = materials.map(material => ({
        ...material,
        formattedCost: MaterialUtils.formatCurrency(material.totalCost)
      }));

      const materialSummary = MaterialUtils.generateMaterialSummary(materials);

      sendSuccessResponse(res, 'Job materials retrieved successfully', {
        materials: enrichedMaterials,
        summary: {
          ...materialSummary,
          formattedTotalCost: MaterialUtils.formatCurrency(materialSummary.totalCost),
          formattedAverageCost: MaterialUtils.formatCurrency(materialSummary.averageCost)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateJobMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);
      const materialId = parseInt(req.params.materialId);

      const updateData: UpdateMaterialData = {};
      
      if (req.body.name !== undefined) updateData.name = MaterialUtils.formatMaterialName(req.body.name);
      if (req.body.quantity !== undefined) updateData.quantity = req.body.quantity;
      if (req.body.unit !== undefined) updateData.unit = req.body.unit;
      if (req.body.unitCost !== undefined) updateData.unitCost = req.body.unitCost;
      if (req.body.supplier !== undefined) updateData.supplier = req.body.supplier;

      const validationErrors = MaterialUtils.validateMaterialData(updateData);
      if (validationErrors.length > 0) {
        sendValidationError(res, 'Material validation failed', validationErrors.map(error => ({
          field: 'material',
          message: error,
          code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
        })));
        return;
      }

      const material = await jobService.updateJobMaterial(materialId, jobId, tradieId, updateData);

      logger.info('Job material updated successfully via API', {
        jobId,
        materialId,
        tradieId,
        updatedFields: Object.keys(updateData)
      });

      sendSuccessResponse(res, 'Material updated successfully', {
        ...material,
        formattedCost: MaterialUtils.formatCurrency(material.totalCost)
      });
    } catch (error) {
      next(error);
    }
  }

  async removeJobMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);
      const materialId = parseInt(req.params.materialId);

      const deleted = await jobService.removeJobMaterial(materialId, jobId, tradieId);

      if (!deleted) {
        sendNotFoundResponse(res, 'Material not found');
        return;
      }

      logger.info('Job material removed successfully via API', {
        jobId,
        materialId,
        tradieId
      });

      sendSuccessResponse(res, 'Material removed successfully', { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async addJobAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);

      if (!req.file) {
        sendValidationError(res, 'File is required', [{
          field: 'file',
          message: 'No file uploaded',
          code: JOB_CONSTANTS.ERROR_CODES.FILE_UPLOAD_ERROR
        }]);
        return;
      }

      const attachmentData: CreateAttachmentData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      };

      const attachment = await jobService.addJobAttachment(jobId, tradieId, attachmentData);

      logger.info('Attachment added to job successfully via API', {
        jobId,
        tradieId,
        attachmentId: attachment.id,
        filename: attachment.filename,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType
      });

      sendSuccessResponse(res, 'Attachment added successfully', {
        ...attachment,
        formattedSize: `${Math.round(attachment.fileSize / 1024)} KB`
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  async getJobAttachments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);

      const attachments = await jobService.getJobAttachments(jobId, tradieId);

      const enrichedAttachments = attachments.map(attachment => ({
        ...attachment,
        formattedSize: `${Math.round(attachment.fileSize / 1024)} KB`,
        isImage: attachment.mimeType.startsWith('image/'),
        isPdf: attachment.mimeType === 'application/pdf'
      }));

      sendSuccessResponse(res, 'Job attachments retrieved successfully', {
        attachments: enrichedAttachments,
        totalCount: attachments.length,
        totalSize: attachments.reduce((sum, att) => sum + att.fileSize, 0)
      });
    } catch (error) {
      next(error);
    }
  }

  async removeJobAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const jobId = parseInt(req.params.id);
      const attachmentId = parseInt(req.params.attachmentId);

      const deleted = await jobService.removeJobAttachment(attachmentId, jobId, tradieId);

      if (!deleted) {
        sendNotFoundResponse(res, 'Attachment not found');
        return;
      }

      logger.info('Job attachment removed successfully via API', {
        jobId,
        attachmentId,
        tradieId
      });

      sendSuccessResponse(res, 'Attachment removed successfully', { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async getOverdueJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      
      const allJobs = await jobService.getAllJobsByTradieId(tradieId);
      const overdueJobs = JobUtils.getOverdueJobs(allJobs);
      
      const enrichedOverdueJobs = overdueJobs.map(job => ({
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        reference: JobUtils.generateJobReference(job.id, job.jobType),
        daysOverdue: Math.abs(JobUtils.getDaysUntilDue(job)),
        healthScore: JobUtils.getJobHealthScore(job)
      }));

      sendSuccessResponse(res, 'Overdue jobs retrieved successfully', {
        jobs: enrichedOverdueJobs,
        totalCount: overdueJobs.length
      });
    } catch (error) {
      next(error);
    }
  }

  async getUpcomingJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const days = parseInt(req.query.days as string) || 7;
      
      const allJobs = await jobService.getAllJobsByTradieId(tradieId);
      const upcomingJobs = JobUtils.getUpcomingJobs(allJobs, days);
      
      const enrichedUpcomingJobs = upcomingJobs.map(job => ({
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        reference: JobUtils.generateJobReference(job.id, job.jobType),
        daysUntilStart: JobUtils.getDaysUntilDue(job),
        priorityWeight: JobUtils.getJobPriorityWeight(job.priority)
      }));

      const sortedUpcomingJobs = JobUtils.sortJobsByPriority(enrichedUpcomingJobs);

      sendSuccessResponse(res, 'Upcoming jobs retrieved successfully', {
        jobs: sortedUpcomingJobs,
        totalCount: upcomingJobs.length,
        daysRange: days
      });
    } catch (error) {
      next(error);
    }
  }
}

export class ClientController {
  async createClient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const clientData: CreateClientData = {
        name: ClientUtils.formatClientName(req.body.name),
        email: req.body.email,
        phone: ClientUtils.formatPhoneNumber(req.body.phone),
        company: req.body.company,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        postcode: req.body.postcode,
        notes: req.body.notes,
        tags: req.body.tags,
        reference: req.body.reference || ClientUtils.generateClientReference(Date.now()),
        isVIP: req.body.isVIP || false,
        value: req.body.value || 0
      };

      const validationErrors = ClientUtils.validateClientData(clientData);
      if (validationErrors.length > 0) {
        sendValidationError(res, 'Client validation failed', validationErrors.map(error => ({
          field: 'client',
          message: error,
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        })));
        return;
      }

      const client = await clientService.createClient(tradieId, clientData);

      logger.info('Client created successfully via API', {
        clientId: client.id,
        tradieId,
        name: client.name,
        email: client.email,
        reference: ClientUtils.generateClientReference(client.id)
      });

      sendSuccessResponse(res, 'Client created successfully', {
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        tags: ClientUtils.getClientTags(client)
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  async getClientById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const clientId = parseInt(req.params.id);

      const client = await clientService.getClientById(clientId, tradieId);
      const clientJobs = await jobService.getJobsByClientId(clientId, tradieId);

      const enrichedClient: EnrichedClient = {
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        tags: ClientUtils.getClientTags(client),
        value: ClientUtils.calculateClientValue(client),
        lifetimeValue: ClientUtils.getClientLifetimeValue(client, clientJobs),
        rating: ClientUtils.getClientRating(client, clientJobs),
        jobCount: ClientUtils.getClientJobCount(client)
      };

      sendSuccessResponse(res, 'Client retrieved successfully', enrichedClient);
    } catch (error) {
      next(error);
    }
  }
  
  async getClients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      
      const page = parseInt(req.query.page as string) || JOB_CONSTANTS.PAGINATION.DEFAULT_PAGE;
      const limit = Math.min(
        parseInt(req.query.limit as string) || JOB_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
        JOB_CONSTANTS.PAGINATION.MAX_LIMIT
      );

      const filter: ClientFilter = {};
      
      if (req.query.search) {
        filter.search = req.query.search as string;
      }
      
      if (req.query.hasJobs !== undefined) {
        filter.hasJobs = req.query.hasJobs === 'true';
      }
      
      if (req.query.minRevenue) {
        filter.minRevenue = parseFloat(req.query.minRevenue as string);
      }
      
      if (req.query.maxRevenue) {
        filter.maxRevenue = parseFloat(req.query.maxRevenue as string);
      }
      
      if (req.query.lastJobAfter) {
        filter.lastJobAfter = new Date(req.query.lastJobAfter as string);
      }
      
      if (req.query.lastJobBefore) {
        filter.lastJobBefore = new Date(req.query.lastJobBefore as string);
      }
      
      if (req.query.tags) {
        const tags = Array.isArray(req.query.tags) 
          ? req.query.tags as string[]
          : [req.query.tags as string];
        filter.tags = tags as any[];
      }

      const sort: ClientSortOptions = {
        field: (req.query.sortField as ClientSortField) || ClientSortField.CREATED_AT,
        order: (req.query.sortOrder as SortOrder) || SortOrder.DESC
      };

      const options: ClientListOptions = {
        page,
        limit,
        filter,
        sort
      };

      const result = await clientService.getClientsByTradieId(tradieId, options);

      const enrichedClients: EnrichedClient[] = result.clients.map(client => ({
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        value: ClientUtils.calculateClientValue(client),
        lifetimeValue: ClientUtils.getClientLifetimeValue(client, []),
        rating: ClientUtils.getClientRating(client, []),
        jobCount: ClientUtils.getClientJobCount(client)
      }));

      let sortedClients: EnrichedClient[] = enrichedClients;
      if (req.query.sortByValue === 'true') {
        sortedClients = ClientUtils.sortClientsByValue(enrichedClients) as EnrichedClient[];
      } else if (req.query.sortByJobCount === 'true') {
        sortedClients = ClientUtils.sortClientsByJobCount(enrichedClients) as EnrichedClient[];
      }

      sendSuccessResponse(res, 'Clients retrieved successfully', {
        ...result,
        clients: sortedClients
      });
    } catch (error) {
      next(error);
    }
  }
  
  async updateClient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const clientId = parseInt(req.params.id);

      const updateData: UpdateClientData = {};
      
      if (req.body.name !== undefined) updateData.name = ClientUtils.formatClientName(req.body.name);
      if (req.body.email !== undefined) updateData.email = req.body.email;
      if (req.body.phone !== undefined) updateData.phone = ClientUtils.formatPhoneNumber(req.body.phone);
      if (req.body.company !== undefined) updateData.company = req.body.company;
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.city !== undefined) updateData.city = req.body.city;
      if (req.body.state !== undefined) updateData.state = req.body.state;
      if (req.body.postcode !== undefined) updateData.postcode = req.body.postcode;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.tags !== undefined) updateData.tags = req.body.tags;
      if (req.body.reference !== undefined) updateData.reference = req.body.reference;
      if (req.body.isVIP !== undefined) updateData.isVIP = req.body.isVIP;
      if (req.body.value !== undefined) updateData.value = req.body.value;

      const validationErrors = ClientUtils.validateClientData(updateData);
      if (validationErrors.length > 0) {
        sendValidationError(res, 'Client validation failed', validationErrors.map(error => ({
          field: 'client',
          message: error,
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        })));
        return;
      }

      const client = await clientService.updateClient(clientId, tradieId, updateData);

      logger.info('Client updated successfully via API', {
        clientId,
        tradieId,
        updatedFields: Object.keys(updateData)
      });

      sendSuccessResponse(res, 'Client updated successfully', {
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        tags: ClientUtils.getClientTags(client)
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteClient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const clientId = parseInt(req.params.id);

      const deleted = await clientService.deleteClient(clientId, tradieId);

      if (!deleted) {
        sendNotFoundResponse(res, 'Client not found');
        return;
      }

      logger.info('Client deleted successfully via API', {
        clientId,
        tradieId
      });

      sendSuccessResponse(res, 'Client deleted successfully', { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async getVIPClients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      
      const allClients = await clientService.getAllClientsByTradieId(tradieId);
      const vipClients = allClients.filter(client => ClientUtils.isVIPClient(client));
      
      const enrichedVIPClients: EnrichedClient[] = vipClients.map(client => ({
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        value: ClientUtils.calculateClientValue(client),
        lifetimeValue: ClientUtils.getClientLifetimeValue(client, []),
        rating: ClientUtils.getClientRating(client, []),
        jobCount: ClientUtils.getClientJobCount(client),
        tags: ClientUtils.getClientTags(client)
      }));

      const sortedVIPClients = ClientUtils.sortClientsByValue(enrichedVIPClients);

      sendSuccessResponse(res, 'VIP clients retrieved successfully', {
        clients: sortedVIPClients,
        totalCount: vipClients.length
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentClients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const days = parseInt(req.query.days as string) || 30;
      
      const allClients = await clientService.getAllClientsByTradieId(tradieId);
      const recentClients = ClientUtils.getRecentClients(allClients, days);
      
      const enrichedRecentClients: EnrichedClient[] = recentClients.map(client => ({
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        value: ClientUtils.calculateClientValue(client),
        lifetimeValue: ClientUtils.getClientLifetimeValue(client, []),
        rating: ClientUtils.getClientRating(client, []),
        jobCount: ClientUtils.getClientJobCount(client),
        tags: ClientUtils.getClientTags(client)
      }));

      sendSuccessResponse(res, 'Recent clients retrieved successfully', {
        clients: enrichedRecentClients,
        totalCount: recentClients.length,
        daysRange: days
      });
    } catch (error) {
      next(error);
    }
  }

  async getInactiveClients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const days = parseInt(req.query.days as string) || 90;
      
      const allClients = await clientService.getAllClientsByTradieId(tradieId);
      const inactiveClients = ClientUtils.getInactiveClients(allClients, days);
      
      const enrichedInactiveClients: EnrichedClient[] = inactiveClients.map(client => ({
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        value: ClientUtils.calculateClientValue(client),
        lifetimeValue: ClientUtils.getClientLifetimeValue(client, []),
        rating: ClientUtils.getClientRating(client, []),
        jobCount: ClientUtils.getClientJobCount(client),
        tags: ClientUtils.getClientTags(client),
        daysSinceLastJob: client.lastJobDate 
          ? Math.floor((new Date().getTime() - client.lastJobDate.getTime()) / (1000 * 60 * 60 * 24))
          : null
      }));

      sendSuccessResponse(res, 'Inactive clients retrieved successfully', {
        clients: enrichedInactiveClients,
        totalCount: inactiveClients.length,
        inactiveDays: days
      });
    } catch (error) {
      next(error);
    }
  }

  async searchClients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const searchTerm = req.query.q as string;

      if (!searchTerm || searchTerm.trim().length < 2) {
        sendValidationError(res, 'Search term required', [{
          field: 'q',
          message: 'Search term must be at least 2 characters',
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        }]);
        return;
      }

      const allClients = await clientService.getAllClientsByTradieId(tradieId);
      const searchResults = ClientUtils.searchClients(allClients, searchTerm);
      
      const enrichedResults = searchResults.map(client => ({
        ...client,
        reference: ClientUtils.generateClientReference(client.id),
        isVIP: ClientUtils.isVIPClient(client),
        tags: ClientUtils.getClientTags(client)
      }));

      sendSuccessResponse(res, 'Client search completed successfully', {
        clients: enrichedResults,
        totalCount: searchResults.length,
        searchTerm: searchTerm.trim()
      });
    } catch (error) {
      next(error);
    }
  }

  async getClientJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = parseInt(req.user!.id);
      const clientId = parseInt(req.params.id);

      const jobs = await jobService.getJobsByClientId(clientId, tradieId);
      
      const enrichedJobs = jobs.map(job => ({
        ...job,
        progress: JobUtils.calculateJobProgress(job),
        reference: JobUtils.generateJobReference(job.id, job.jobType),
        isOverdue: JobUtils.isJobOverdue(job),
        healthScore: JobUtils.getJobHealthScore(job)
      }));

      const jobStats = {
        totalJobs: jobs.length,
        completedJobs: jobs.filter(job => job.status === JobStatus.COMPLETED).length,
        activeJobs: jobs.filter(job => job.status === JobStatus.ACTIVE).length,
        totalRevenue: jobs.reduce((sum, job) => sum + (job.totalCost || 0), 0),
        averageJobValue: jobs.length > 0 ? jobs.reduce((sum, job) => sum + (job.totalCost || 0), 0) / jobs.length : 0
      };

      sendSuccessResponse(res, 'Client jobs retrieved successfully', {
        jobs: enrichedJobs,
        statistics: {
          ...jobStats,
          formattedTotalRevenue: MaterialUtils.formatCurrency(jobStats.totalRevenue),
          formattedAverageJobValue: MaterialUtils.formatCurrency(jobStats.averageJobValue)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const jobController = new JobController();
export const clientController = new ClientController();
export const materialController = jobController;
export const attachmentController = jobController;

export const handleJobErrors = (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (error instanceof JobNotFoundError) {
    sendNotFoundResponse(res, error.message);
  } else if (error instanceof UnauthorizedJobAccessError) {
    sendErrorResponse(res, error.message, 403);
  } else if (error instanceof ClientNotFoundError) {
    sendNotFoundResponse(res, error.message);
  } else if (error instanceof JobValidationError || error instanceof MaterialValidationError) {
    sendValidationError(res, error.message, error.errors || []);
  } else if (error instanceof FileUploadError) {
    sendErrorResponse(res, error.message, 400);
  } else {
    next(error);
  }
};
