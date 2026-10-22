import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDb } from './helpers/db.js';
import { createApp } from './helpers/app.js';

describe('Prisma (e2e)', () => {
  it('connects to the test database with an empty schema', async () => {
    const { app } = await createApp();
    const prisma = app.get(PrismaService);
    await resetDb(prisma);
    expect(await prisma.task.count()).toBe(0);
    expect(await prisma.taskEvent.count()).toBe(0);
    await app.close();
  });
});
