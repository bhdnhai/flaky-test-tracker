import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Optional so `prisma generate` works without a database; migrate commands need it.
  datasource: { url: process.env.DATABASE_URL },
});
