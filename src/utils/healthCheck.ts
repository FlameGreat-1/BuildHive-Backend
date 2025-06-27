
import { databaseManager } from '@/config/database';
import { redisManager } from '@/config/redis';
import { HealthStatus } from '@/types/common.types';

export async function checkDatabaseHealth() {
  try {
    const client = databaseManager.getClient();
    await client.$queryRaw`SELECT 1`;
    return { status: 'healthy', service: 'postgresql' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      service: 'postgresql', 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}

export async function checkRedisHealth() {
  try {
    const healthResult = await redisManager.healthCheck();
    return { 
    status: healthResult.status === HealthStatus.HEALTHY ? 'healthy' : 'unhealthy', 
      service: 'redis' 
    };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      service: 'redis', 
      error: error instanceof Error ? error.message : 'Unknown redis error' 
    };
  }
}

export async function checkAllServices() {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth()
  ]);
  
  return {
    database: dbHealth,
    redis: redisHealth,
    overall: dbHealth.status === 'healthy' && redisHealth.status === 'healthy' ? 'healthy' : 'unhealthy'
  };
}
