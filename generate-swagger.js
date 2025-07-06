const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'BuildHive API',
    description: 'BuildHive Backend API for Tradie Job Management',
    version: '1.0.0'
  },
  host: 'buildhive-api.onrender.com',
  schemes: ['https', 'http'],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
      description: 'Enter: Bearer [token]'
    }
  }
};

const outputFile = './src/swagger-output.json';
const endpointsFiles = [
  './src/routes/health.routes.ts',
  './src/auth/routes/auth.routes.ts',
  './src/auth/routes/profile.routes.ts',
  './src/auth/routes/validation.routes.ts',
  './src/jobs/routes/job.routes.ts',
  './src/jobs/routes/client.routes.ts',
  './src/jobs/routes/material.routes.ts',
  './src/jobs/routes/attachment.routes.ts'
];

swaggerAutogen(outputFile, endpointsFiles, doc);
