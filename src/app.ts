import express, { Application, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger-output.json';
import { initializeDatabase } from './shared/database';
import { logger } from './shared/utils';
import { 
  errorHandler, 
  notFoundHandler,
  corsOptions,
  securityHeaders,
  addSecurityHeaders,
  validateOrigin,
  requestLogger
} from './shared/middleware';
import routes from './routes';
import { environment } from './config/auth';

export async function createApp(): Promise<Application> {
  const app = express();

  try {
    logger.info('Initializing BuildHive application...');

    await initializeDatabase();
    logger.info('Database connected successfully');

    // Create upload directories
    const fs = require('fs');
    const path = require('path');
    
    const uploadDirs = [
      '/app/uploads',
      '/app/uploads/jobs',
      '/app/uploads/temp'
    ];

    uploadDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created upload directory: ${dir}`);
      }
    });

    app.use(securityHeaders);
    app.use(addSecurityHeaders);
    app.use(validateOrigin);
    app.use(corsOptions);

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use(requestLogger);

    // 🚀 SWAGGER UI DOCUMENTATION
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'BuildHive API Documentation'
    }));

    app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is healthy',
        timestamp: new Date().toISOString(),
        environment: environment.NODE_ENV,
        version: '1.0.0'
      });
    });

    // Use centralized routing
    app.use('/', routes);

    app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is running',
        version: '1.0.0',
        environment: environment.NODE_ENV,
        timestamp: new Date().toISOString(),
        documentation: {
          swagger: '/api-docs',
          description: 'Interactive API Documentation'
        },
        endpoints: {
          health: '/health',
          auth: '/api/v1/auth',
          profile: '/api/v1/profile',
          validation: '/api/v1/validation',
          jobs: '/api/v1/jobs',
          clients: '/api/v1/clients',
          materials: '/api/v1/materials',
          attachments: '/api/v1/attachments'
        },
        features: {
          authentication: {
            registration: {
              local: '/api/v1/auth/register/local',
              social: '/api/v1/auth/register/social'
            },
            login: '/api/v1/auth/login',
            logout: '/api/v1/auth/logout',
            tokenRefresh: '/api/v1/auth/refresh-token',
            passwordReset: {
              request: '/api/v1/auth/forgot-password',
              confirm: '/api/v1/auth/reset-password',
              change: '/api/v1/auth/change-password'
            },
            emailVerification: {
              verify: '/api/v1/auth/verify-email',
              resend: '/api/v1/auth/resend-verification'
            },
            session: {
              current: '/api/v1/auth/me',
              validate: '/api/v1/auth/validate-session'
            }
          },
          profile: {
            create: '/api/v1/profile/create',
            view: '/api/v1/profile/me',
            update: '/api/v1/profile/me',
            delete: '/api/v1/profile/me',
            completeness: '/api/v1/profile/completeness',
            summary: '/api/v1/profile/summary',
            preferences: '/api/v1/profile/preferences',
            avatar: '/api/v1/profile/avatar',
            metadata: '/api/v1/profile/metadata'
          },
          validation: {
            email: {
              availability: '/api/v1/validation/email/availability',
              format: '/api/v1/validation/email/format'
            },
            username: {
              availability: '/api/v1/validation/username/availability',
              format: '/api/v1/validation/username/format',
              generate: '/api/v1/validation/generate-username'
            },
            password: {
              strength: '/api/v1/validation/password/strength'
            },
            credentials: '/api/v1/validation/login/credentials',
            registration: '/api/v1/validation/registration-data',
            social: '/api/v1/validation/social/data',
            bulk: '/api/v1/validation/bulk-availability'
          },
          jobManagement: {
            jobs: {
              create: '/api/v1/jobs',
              list: '/api/v1/jobs',
              view: '/api/v1/jobs/:id',
              update: '/api/v1/jobs/:id',
              delete: '/api/v1/jobs/:id',
              updateStatus: '/api/v1/jobs/:id/status',
              summary: '/api/v1/jobs/summary',
              statistics: '/api/v1/jobs/statistics'
            },
            materials: {
              add: '/api/v1/jobs/:id/materials',
              list: '/api/v1/jobs/:id/materials',
              update: '/api/v1/jobs/:id/materials/:materialId',
              remove: '/api/v1/jobs/:id/materials/:materialId'
            },
            attachments: {
              upload: '/api/v1/jobs/:id/attachments',
              uploadMultiple: '/api/v1/jobs/:id/attachments/multiple',
              list: '/api/v1/jobs/:id/attachments',
              remove: '/api/v1/jobs/:id/attachments/:attachmentId'
            },
            clients: {
              create: '/api/v1/clients',
              list: '/api/v1/clients',
              view: '/api/v1/clients/:id',
              update: '/api/v1/clients/:id',
              delete: '/api/v1/clients/:id'
            }
          }
        },
        security: {
          rateLimiting: 'enabled',
          inputValidation: 'enabled',
          authenticationRequired: 'selective',
          emailVerificationRequired: 'selective',
          passwordComplexity: 'enforced',
          tokenSecurity: 'jwt-based',
          jobOwnershipValidation: 'enforced',
          fileUploadSecurity: 'enforced',
          materialTracking: 'secured',
          clientDataProtection: 'enforced'
        },
        capabilities: {
          maxFileSize: '10MB',
          supportedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif'],
          maxFilesPerJob: 10,
          maxMaterialsPerJob: 100,
          jobStatusTracking: true,
          realTimeUpdates: true,
          auditLogging: true,
          dataExport: true
        }
      });
    });

    app.use('*', notFoundHandler);
    app.use(errorHandler);

    logger.info('BuildHive application initialized successfully', {
      features: [
        'authentication',
        'profile-management',
        'job-management',
        'client-management',
        'material-tracking',
        'file-attachments',
        'validation',
        'security',
        'rate-limiting',
        'audit-logging',
        'swagger-documentation'
      ],
      totalEndpoints: 44,
      version: '1.0.0',
      documentation: '/api-docs'
    });
    
    return app;

  } catch (error) {
    logger.error('Failed to initialize application', error);
    throw error;
  }
}

export default createApp;
