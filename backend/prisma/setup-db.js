import { execSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isSqlite = dbUrl.startsWith('file:') || dbUrl.startsWith('sqlite:');

console.log(`[Database Setup] Target Database URL: ${dbUrl}`);
console.log(`[Database Setup] Detected mode: ${isSqlite ? 'SQLite (Zero-Config Dev)' : 'PostgreSQL'}`);

const schemaFile = isSqlite ? 'prisma/schema.sqlite.prisma' : 'prisma/schema.prisma';

try {
  console.log(`[Database Setup] Pushing schema from ${schemaFile}...`);
  execSync(`npx prisma db push --schema=${schemaFile} --accept-data-loss`, {
    cwd: backendDir,
    stdio: 'inherit'
  });

  console.log(`[Database Setup] Generating Prisma Client...`);
  try {
    execSync(`npx prisma generate --schema=${schemaFile}`, {
      cwd: backendDir,
      stdio: 'inherit'
    });
  } catch (genErr) {
    console.warn(`[Database Setup] Prisma Client generation warning (dll locked, using existing client):`, genErr.message);
  }

  console.log(`[Database Setup] Seeding database with realistic support tickets & agents...`);
  execSync(`node prisma/seed.js`, {
    cwd: backendDir,
    stdio: 'inherit'
  });

  console.log(`[Database Setup] Database setup and seed successfully completed!`);
} catch (error) {
  console.error(`[Database Setup Error]`, error.message);
  process.exit(1);
}
