import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL is read lazily (not via env()) so `prisma generate` works
// without a database, e.g. in a Docker build. migrate still needs it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
