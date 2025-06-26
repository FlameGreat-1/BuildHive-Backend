import { prisma } from '@/config/database';
import { redis } from '@/config/redis';

export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', service: 'postgresql' };
  } catch (error) {
    return { status: 'unhealthy', service: 'postgresql', error: error.message };
  }
}

export async function checkRedisHealth() {
  try {
    await redis.ping();
    return { status: 'healthy', service: 'redis' };
  } catch (error) {
    return { status: 'unhealthy', service: 'redis', error: error.message };
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
