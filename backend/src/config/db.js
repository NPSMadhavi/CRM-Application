import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('[Database] Connected successfully to database');
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
  }
}

