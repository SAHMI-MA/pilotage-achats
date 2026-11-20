import postgres from 'postgres';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL manquante');
const sql=postgres(process.env.DATABASE_URL,{max:1});
try{
 await sql`CREATE TABLE IF NOT EXISTS projects (id text PRIMARY KEY,payload text NOT NULL,revision integer NOT NULL DEFAULT 1,updated_at text NOT NULL)`;
 await sql`CREATE TABLE IF NOT EXISTS notification_deliveries (id text PRIMARY KEY,delivered_at text NOT NULL)`;
 await sql`CREATE TABLE IF NOT EXISTS project_imports (id text PRIMARY KEY,source_hash text NOT NULL,applied_at text NOT NULL,summary text NOT NULL,backup_payload text NOT NULL,snapshot_verified integer NOT NULL CHECK(snapshot_verified=1))`;
 console.log('Tables PostgreSQL créées');
}finally{await sql.end()}
