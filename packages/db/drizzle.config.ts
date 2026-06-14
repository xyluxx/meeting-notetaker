import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://pmn:pmn@localhost:5432/pmn',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
