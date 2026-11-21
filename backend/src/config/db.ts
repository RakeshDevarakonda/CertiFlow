import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn']
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('📦 PostgreSQL database connected via Prisma');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('📦 PostgreSQL database disconnected cleanly');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
};

export default prisma;
