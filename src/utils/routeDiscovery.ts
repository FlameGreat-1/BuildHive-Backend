// src/utils/routeDiscovery.ts 

import { Application } from 'express';
import { logger, createLogContext } from '@/utils/logger';
import { getApiConfig } from '@/config/api';

export interface DiscoveredRoute {
  path: string;
  methods: string[];
  fullUrl: string;
  description: string;
  requiresAuth: boolean;
  middleware: string[];
}

export interface ApiDocumentation {
  service: {
    name: string;
    version: string;
    baseUrl: string;
    environment: string;
    description: string;
  };
  routes: DiscoveredRoute[];
  cors: {
    origins: string[];
    methods: string[];
    headers: string[];
  };
  rateLimiting: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  lastUpdated: Date;
}

class RouteDiscovery {
  private static instance: RouteDiscovery;
  private discoveredRoutes: DiscoveredRoute[] = [];

  private constructor() {}

  public static getInstance(): RouteDiscovery {
    if (!RouteDiscovery.instance) {
      RouteDiscovery.instance = new RouteDiscovery();
    }
    return RouteDiscovery.instance;
  }

  public discoverRoutes(app: Application): DiscoveredRoute[] {
    const routes: DiscoveredRoute[] = [];
    const config = getApiConfig();

    try {
      this.extractRoutes(app._router, '', routes, config.baseUrl);
      routes.sort((a, b) => a.path.localeCompare(b.path));
      this.discoveredRoutes = routes;

      logger.info('Production routes discovered', 
        createLogContext()
          .withMetadata({ 
            routeCount: routes.length,
            baseUrl: config.baseUrl
          })
          .build()
      );

      return routes;

    } catch (error) {
      logger.error('Route discovery failed', 
        createLogContext()
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          })
          .build()
      );
      return [];
    }
  }

  private extractRoutes(router: any, basePath: string, routes: DiscoveredRoute[], baseUrl: string): void {
    if (!router?.stack) return;

    router.stack.forEach((layer: any) => {
      if (layer.route) {
        const path = basePath + layer.route.path;
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
        
        routes.push({
          path,
          methods,
          fullUrl: `${baseUrl}${path}`,
          requiresAuth: this.checkAuthRequirement(layer.route.stack),
          middleware: this.extractMiddlewareNames(layer.route.stack),
          description: this.getRouteDescription(path, methods),
        });

      } else if (layer.name === 'router') {
        const nestedBasePath = basePath + (layer.regexp.source.match(/^\^\\?\/?(.+?)\\\//)?.[1] || '');
        this.extractRoutes(layer.handle, nestedBasePath, routes, baseUrl);
      }
    });
  }

  private checkAuthRequirement(stack: any[]): boolean {
    return stack.some(layer => 
      ['authenticate', 'requireRole', 'requirePermission'].includes(layer.name)
    );
  }

  private extractMiddlewareNames(stack: any[]): string[] {
    return stack
      .map(layer => layer.name)
      .filter(name => name && !['anonymous', '<anonymous>'].includes(name));
  }

  private getRouteDescription(path: string, methods: string[]): string {
    const descriptions: Record<string, string> = {
      'api/auth/register': 'User registration endpoint',
      'api/auth/login': 'User authentication endpoint',
      'api/auth/logout': 'User logout endpoint',
      'api/auth/verify-email': 'Email verification endpoint',
      'api/auth/verify-phone': 'Phone verification endpoint',
      'api/auth/request-password-reset': 'Password reset request endpoint',
      'api/auth/refresh-token': 'JWT token refresh endpoint',
      'api/auth/validate-token': 'Token validation endpoint',
      'api/auth/profile': 'User profile management endpoint',
      'api/auth/profile/client': 'Client profile endpoint',
      'api/auth/profile/tradie': 'Tradie profile endpoint',
      'api/auth/profile/enterprise': 'Enterprise profile endpoint',
      'api/health': 'Service health check endpoint',
      'api/docs': 'API documentation endpoint',
      '/': 'Root service information endpoint',
    };

    return descriptions[path.replace(/^\//, '')] || `${methods[0]} ${path}`;
  }

  public generateApiDocumentation(): ApiDocumentation {
    const config = getApiConfig();
    
    return {
      service: {
        name: config.serviceName,
        version: config.version,
        baseUrl: config.baseUrl,
        environment: config.environment,
        description: 'TradeConnect Authentication Service - Production API',
      },
      routes: [...this.discoveredRoutes],
      cors: {
        origins: config.corsOrigins,
        methods: config.allowedMethods,
        headers: config.allowedHeaders,
      },
      rateLimiting: config.rateLimiting,
      lastUpdated: new Date(),
    };
  }
}

export const routeDiscovery = RouteDiscovery.getInstance();
export const discoverRoutes = (app: Application): DiscoveredRoute[] => routeDiscovery.discoverRoutes(app);
export const getApiDocumentation = (): ApiDocumentation => routeDiscovery.generateApiDocumentation();
