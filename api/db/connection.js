import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import 'dotenv/config';

// Create connection string
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'slo_user'}:${process.env.DB_PASSWORD || 'slo_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'slo_dashboard'}`;

// Create postgres client
export const sql = postgres(connectionString, {
  max: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance with schema
export const db = drizzle(sql, { schema });

// Test connection
export async function testConnection() {
  try {
    await sql`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await sql.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await sql.end();
  process.exit(0);
});


