import { PrismaService } from '../../src/prisma/prisma.service.js';

export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "TaskEvent", "Task" RESTART IDENTITY CASCADE',
  );
}
