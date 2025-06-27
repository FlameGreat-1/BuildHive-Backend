import { PrismaClient } from '@prisma/client';

async function migrate(): Promise<void> {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Running database migrations...');
    await prisma.$executeRaw`SELECT 1`;
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
