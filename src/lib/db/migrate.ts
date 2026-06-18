import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load SQL file
const sqlFilePath = path.join(process.cwd(), 'supabase', 'migrations', '20260614000000_schema.sql');
const migrationSql = fs.readFileSync(sqlFilePath, 'utf8');

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (!directUrl) {
  console.error('Error: DIRECT_URL or DATABASE_URL environment variable is not set.');
  process.exit(1);
}

// Clean and extract credentials safely
const urlObj = new URL(directUrl.replace(/\[|\]/g, ''));
const password = urlObj.password;

// Prepare URL variants
const urlWithBrackets = directUrl.includes(':[') ? directUrl : directUrl.replace(password, `[${password}]`);
const urlWithoutBrackets = directUrl.replace(/\[|\]/g, '');

async function runMigration() {
  console.log('Starting Supabase DB migration...');

  let client: Client | null = null;
  
  // Try without brackets first
  try {
    console.log('Attempting connection (without brackets)...');
    client = new Client({
      connectionString: urlWithoutBrackets,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Successfully connected to Supabase PostgreSQL!');
  } catch (err: any) {
    console.warn('Failed connecting without brackets:', err.message);
    console.log('Attempting connection (with brackets)...');
    try {
      client = new Client({
        connectionString: urlWithBrackets,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      console.log('Successfully connected to Supabase PostgreSQL (using brackets)!');
    } catch (bracketErr: any) {
      console.error('Failed both connection attempts. Error details:', bracketErr.message);
      process.exit(1);
    }
  }

  if (client) {
    try {
      console.log('Executing SQL migration script. This may take a moment...');
      await client.query(migrationSql);
      console.log('Migration completed successfully! All tables, types, and RLS policies are created.');
    } catch (migrationErr: any) {
      console.error('Error during migration execution:', migrationErr);
      process.exit(1);
    } finally {
      await client.end();
    }
  }
}

runMigration();
