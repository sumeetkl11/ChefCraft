import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const {Pool} = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const needsSsl = process.env.DATABASE_URL && (
    process.env.NODE_ENV === 'production' ||
    process.env.DATABASE_URL.includes('sslmode=') ||
    process.env.DATABASE_URL.includes('neon.tech')
);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: needsSsl ? {
        rejectUnauthorized: process.env.ALLOW_SELF_SIGNED_CERT !== 'true'
    } : false
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('Running database migration...\n');

        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        const schemaPath = path.join(__dirname, 'config', 'schema.sql');
        const { rows: schemaCheck } = await client.query(
            `SELECT 1 FROM schema_migrations WHERE filename = 'schema.sql'`
        );

        if (schemaCheck.length === 0) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await client.query('BEGIN');
            await client.query(schemaSql);
            await client.query(
                `INSERT INTO schema_migrations (filename) VALUES ('schema.sql')`
            );
            await client.query('COMMIT');
            console.log('  ✅ schema.sql applied');
        } else {
            console.log('  ⏭  schema.sql already applied');
        }

        const migrationsDir = path.join(__dirname, 'config', 'migrations');
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort();

            for (const file of files) {
                const { rows } = await client.query(
                    `SELECT 1 FROM schema_migrations WHERE filename = $1`,
                    [file]
                );

                if (rows.length > 0) {
                    console.log(`  ⏭  ${file} already applied`);
                    continue;
                }

                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    `INSERT INTO schema_migrations (filename) VALUES ($1)`,
                    [file]
                );
                await client.query('COMMIT');
                console.log(`  ✅ ${file} applied`);
            }
        }

        console.log('\n✅ Database migration completed!');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
