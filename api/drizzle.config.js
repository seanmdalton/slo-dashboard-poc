import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.js',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'slo_user',
    password: process.env.DB_PASSWORD || 'slo_password',
    database: process.env.DB_NAME || 'slo_dashboard',
  },
  verbose: true,
  strict: true,
});


