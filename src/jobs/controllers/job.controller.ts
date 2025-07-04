import { Request, Response, NextFunction } from 'express';
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
  JobStatus
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

export class JobController {
  async createJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobData: CreateJobData = {
        title: req.body.title,
        description: req.body.description,
        jobType: req.body.jobType,
        priority: req.body.priority,
        clientName: req.body.clientName,
        clientEmail: req.body.clientEmail,
        clientPhone: req.body.clientPhone,
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
        clientEmail: job.clientEmail
      });

      sendSuccessResponse(res, 'Job created successfully', job, 201);
    } catch (error) {
      next(error);
    }
  }

  async getJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const job = await jobService.getJobById(jobId, tradieId);

      sendSuccessResponse(res, 'Job retrieved successfully', job);
    } catch (error) {
      next(error);
    }
  }

  async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      
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

      sendSuccessResponse(res, 'Jobs retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async updateJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const updateData: UpdateJobData = {};
      
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.clientName !== undefined) updateData.clientName = req.body.clientName;
      if (req.body.clientEmail !== undefined) updateData.clientEmail = req.body.clientEmail;
      if (req.body.clientPhone !== undefined) updateData.clientPhone = req.body.clientPhone;
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

      const job = await jobService.updateJob(jobId, tradieId, updateData);

      logger.info('Job updated successfully via API', {
        jobId,
        tradieId,
        updatedFields: Object.keys(updateData)
      });

      sendSuccessResponse(res, 'Job updated successfully', job);
    } catch (error) {
      next(error);
    }
  }

  async deleteJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

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

  async updateJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const job = await jobService.updateJobStatus(jobId, tradieId, status);

      logger.info('Job status updated successfully via API', {
        jobId,
        tradieId,
        newStatus: status
      });

      sendSuccessResponse(res, 'Job status updated successfully', job);
    } catch (error) {
      next(error);
    }
  }

  async getJobSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      
      const summary = await jobService.getJobSummary(tradieId);

      sendSuccessResponse(res, 'Job summary retrieved successfully', summary);
    } catch (error) {
      next(error);
    }
  }

  async getJobStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      
      const statistics = await jobService.getJobStatistics(tradieId);

      sendSuccessResponse(res, 'Job statistics retrieved successfully', statistics);
    } catch (error) {
      next(error);
    }
  }
  
    async addJobMaterials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);
      const { materials } = req.body;

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const materialData: CreateMaterialData[] = materials.map((material: any) => ({
        name: material.name,
        quantity: material.quantity,
        unit: material.unit,
        unitCost: material.unitCost,
        supplier: material.supplier
      }));

      const createdMaterials = await jobService.addJobMaterials(jobId, tradieId, materialData);

      logger.info('Materials added to job successfully via API', {
        jobId,
        tradieId,
        materialCount: createdMaterials.length
      });

      sendSuccessResponse(res, 'Materials added successfully', createdMaterials, 201);
    } catch (error) {
      next(error);
    }
  }

  async getJobMaterials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const materials = await jobService.getJobMaterials(jobId, tradieId);

      sendSuccessResponse(res, 'Job materials retrieved successfully', materials);
    } catch (error) {
      next(error);
    }
  }

  async updateJobMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);
      const materialId = parseInt(req.params.materialId);

      if (isNaN(jobId) || isNaN(materialId)) {
        sendValidationError(res, 'Invalid ID', [{
          field: 'id',
          message: 'Job ID and Material ID must be valid numbers',
          code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
        }]);
        return;
      }

      const updateData: UpdateMaterialData = {};
      
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.quantity !== undefined) updateData.quantity = req.body.quantity;
      if (req.body.unit !== undefined) updateData.unit = req.body.unit;
      if (req.body.unitCost !== undefined) updateData.unitCost = req.body.unitCost;
      if (req.body.supplier !== undefined) updateData.supplier = req.body.supplier;

      const material = await jobService.updateJobMaterial(materialId, jobId, tradieId, updateData);

      logger.info('Job material updated successfully via API', {
        jobId,
        materialId,
        tradieId,
        updatedFields: Object.keys(updateData)
      });

      sendSuccessResponse(res, 'Material updated successfully', material);
    } catch (error) {
      next(error);
    }
  }

  async removeJobMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);
      const materialId = parseInt(req.params.materialId);

      if (isNaN(jobId) || isNaN(materialId)) {
        sendValidationError(res, 'Invalid ID', [{
          field: 'id',
          message: 'Job ID and Material ID must be valid numbers',
          code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
        }]);
        return;
      }

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

  async addJobAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

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
        filename: attachment.filename
      });

      sendSuccessResponse(res, 'Attachment added successfully', attachment, 201);
    } catch (error) {
      next(error);
    }
  }

  async getJobAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'id',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const attachments = await jobService.getJobAttachments(jobId, tradieId);

      sendSuccessResponse(res, 'Job attachments retrieved successfully', attachments);
    } catch (error) {
      next(error);
    }
  }

  async removeJobAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.id);
      const attachmentId = parseInt(req.params.attachmentId);

      if (isNaN(jobId) || isNaN(attachmentId)) {
        sendValidationError(res, 'Invalid ID', [{
          field: 'id',
          message: 'Job ID and Attachment ID must be valid numbers',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

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
}

export class ClientController {
  async createClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const clientData: CreateClientData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        company: req.body.company,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        postcode: req.body.postcode,
        notes: req.body.notes,
        tags: req.body.tags
      };

      const client = await clientService.createClient(tradieId, clientData);

      logger.info('Client created successfully via API', {
        clientId: client.id,
        tradieId,
        name: client.name,
        email: client.email
      });

      sendSuccessResponse(res, 'Client created successfully', client, 201);
    } catch (error) {
      next(error);
    }
  }

  async getClientById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const clientId = parseInt(req.params.id);

      if (isNaN(clientId)) {
        sendValidationError(res, 'Invalid client ID', [{
          field: 'id',
          message: 'Client ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        }]);
        return;
      }

      const client = await clientService.getClientById(clientId, tradieId);

      sendSuccessResponse(res, 'Client retrieved successfully', client);
    } catch (error) {
      next(error);
    }
  }

  async getClients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      
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

      sendSuccessResponse(res, 'Clients retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
  
    async updateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const clientId = parseInt(req.params.id);

      if (isNaN(clientId)) {
        sendValidationError(res, 'Invalid client ID', [{
          field: 'id',
          message: 'Client ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        }]);
        return;
      }

      const updateData: UpdateClientData = {};
      
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.email !== undefined) updateData.email = req.body.email;
      if (req.body.phone !== undefined) updateData.phone = req.body.phone;
      if (req.body.company !== undefined) updateData.company = req.body.company;
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.city !== undefined) updateData.city = req.body.city;
      if (req.body.state !== undefined) updateData.state = req.body.state;
      if (req.body.postcode !== undefined) updateData.postcode = req.body.postcode;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.tags !== undefined) updateData.tags = req.body.tags;

      const client = await clientService.updateClient(clientId, tradieId, updateData);

      logger.info('Client updated successfully via API', {
        clientId,
        tradieId,
        updatedFields: Object.keys(updateData)
      });

      sendSuccessResponse(res, 'Client updated successfully', client);
    } catch (error) {
      next(error);
    }
  }

  async deleteClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const clientId = parseInt(req.params.id);

      if (isNaN(clientId)) {
        sendValidationError(res, 'Invalid client ID', [{
          field: 'id',
          message: 'Client ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.CLIENT_NOT_FOUND
        }]);
        return;
      }

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
}

export class MaterialController {
  async getMaterialsByJobId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.jobId);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'jobId',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const materials = await materialService.getMaterialsByJobId(jobId, tradieId);

      sendSuccessResponse(res, 'Materials retrieved successfully', materials);
    } catch (error) {
      next(error);
    }
  }

  async updateMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.jobId);
      const materialId = parseInt(req.params.id);

      if (isNaN(jobId) || isNaN(materialId)) {
        sendValidationError(res, 'Invalid ID', [{
          field: 'id',
          message: 'Job ID and Material ID must be valid numbers',
          code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
        }]);
        return;
      }

      const updateData: UpdateMaterialData = {};
      
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.quantity !== undefined) updateData.quantity = req.body.quantity;
      if (req.body.unit !== undefined) updateData.unit = req.body.unit;
      if (req.body.unitCost !== undefined) updateData.unitCost = req.body.unitCost;
      if (req.body.supplier !== undefined) updateData.supplier = req.body.supplier;

      const material = await materialService.updateMaterial(materialId, jobId, tradieId, updateData);

      logger.info('Material updated successfully via API', {
        jobId,
        materialId,
        tradieId,
        updatedFields: Object.keys(updateData)
      });

      sendSuccessResponse(res, 'Material updated successfully', material);
    } catch (error) {
      next(error);
    }
  }

  async deleteMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.jobId);
      const materialId = parseInt(req.params.id);

      if (isNaN(jobId) || isNaN(materialId)) {
        sendValidationError(res, 'Invalid ID', [{
          field: 'id',
          message: 'Job ID and Material ID must be valid numbers',
          code: JOB_CONSTANTS.ERROR_CODES.MATERIAL_NOT_FOUND
        }]);
        return;
      }

      const deleted = await materialService.deleteMaterial(materialId, jobId, tradieId);

      if (!deleted) {
        sendNotFoundResponse(res, 'Material not found');
        return;
      }

      logger.info('Material deleted successfully via API', {
        jobId,
        materialId,
        tradieId
      });

      sendSuccessResponse(res, 'Material deleted successfully', { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

export class AttachmentController {
  async getAttachmentsByJobId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.jobId);

      if (isNaN(jobId)) {
        sendValidationError(res, 'Invalid job ID', [{
          field: 'jobId',
          message: 'Job ID must be a valid number',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const attachments = await attachmentService.getAttachmentsByJobId(jobId, tradieId);

      sendSuccessResponse(res, 'Attachments retrieved successfully', attachments);
    } catch (error) {
      next(error);
    }
  }

  async getAttachmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.jobId);
      const attachmentId = parseInt(req.params.id);

      if (isNaN(jobId) || isNaN(attachmentId)) {
        sendValidationError(res, 'Invalid ID', [{
          field: 'id',
          message: 'Job ID and Attachment ID must be valid numbers',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const attachment = await attachmentService.getAttachmentById(attachmentId, jobId, tradieId);

      sendSuccessResponse(res, 'Attachment retrieved successfully', attachment);
    } catch (error) {
      next(error);
    }
  }

  async deleteAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradieId = req.user!.id;
      const jobId = parseInt(req.params.jobId);
      const attachmentId = parseInt(req.params.id);

      if (isNaN(jobId) || isNaN(attachmentId)) {
        sendValidationError(res, 'Invalid ID', [{
          field: 'id',
          message: 'Job ID and Attachment ID must be valid numbers',
          code: JOB_CONSTANTS.ERROR_CODES.JOB_NOT_FOUND
        }]);
        return;
      }

      const deleted = await attachmentService.deleteAttachment(attachmentId, jobId, tradieId);

      if (!deleted) {
        sendNotFoundResponse(res, 'Attachment not found');
        return;
      }

      logger.info('Attachment deleted successfully via API', {
        jobId,
        attachmentId,
        tradieId
      });

      sendSuccessResponse(res, 'Attachment deleted successfully', { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

export const handleJobErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Job controller error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    tradieId: req.user?.id
  });

  if (error instanceof JobNotFoundError) {
    sendNotFoundResponse(res, error.message);
    return;
  }

  if (error instanceof UnauthorizedJobAccessError) {
    sendErrorResponse(res, error.message, 403);
    return;
  }

  if (error instanceof ClientNotFoundError) {
    sendNotFoundResponse(res, error.message);
    return;
  }

  if (error instanceof JobValidationError || error instanceof MaterialValidationError) {
    sendValidationError(res, error.message, error.errors);
    return;
  }

  if (error instanceof FileUploadError) {
    sendErrorResponse(res, error.message, 400);
    return;
  }

  sendErrorResponse(res, 'Internal server error', 500);
};

export const jobController = new JobController();
export const clientController = new ClientController();
export const materialController = new MaterialController();
export const attachmentController = new AttachmentController();


