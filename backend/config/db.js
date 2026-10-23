import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env'), override: true });

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'b27efd818ec739ad854063391668cc7697fa39ac84e45a9ef3ab768b0710807e4501daf8ec623c56b5de62d95265e945f8190435b8b99820286387371a053c89';
}

const rawConnectionString = (process.env.DATABASE_URL || '').trim();

// Clean connection string (strip channel_binding which Neon HTTP / pg doesn't need)
const cleanedConnectionString = rawConnectionString
    .replace(/[?&]channel_binding=[^&]+/g, '');

const neonUrlObj = cleanedConnectionString ? new URL(cleanedConnectionString) : null;
const neonHttpEndpoint = neonUrlObj ? `https://${neonUrlObj.hostname}/sql` : null;

const serializeParam = (p) => {
    if (p === undefined) return null;
    if (p instanceof Date) return p.toISOString();
    if (Array.isArray(p)) {
        const escaped = p.map((item) => {
            if (item === null || item === undefined) return 'NULL';
            const str = String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return `"${str}"`;
        });
        return `{${escaped.join(',')}}`;
    }
    return p;
};

/**
 * Execute SQL query against Neon's serverless HTTPS endpoint (port 443).
 * Works reliably in environments where raw TCP port 5432 is blocked.
 */
const neonHttpQuery = async (text = '', params = []) => {
    const sql = String(text).trim();
    if (!sql) return { rows: [], rowCount: 0 };

    const upper = sql.toUpperCase();
    if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
    }

    if (!neonHttpEndpoint) {
        throw new Error('DATABASE_URL is not configured');
    }

    const serializedParams = Array.isArray(params) ? params.map(serializeParam) : [];

    const response = await fetch(neonHttpEndpoint, {
        method: 'POST',
        headers: {
            'Neon-Connection-String': cleanedConnectionString,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: sql,
            params: serializedParams,
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const err = new Error(data.message || `Neon HTTP error ${response.status}`);
        err.code = data.code;
        err.detail = data.detail;
        err.hint = data.hint;
        err.table = data.table;
        err.column = data.column;
        err.constraint = data.constraint;
        throw err;
    }

    return {
        rows: data.rows || [],
        rowCount: typeof data.rowCount === 'number' ? data.rowCount : (data.rows?.length || 0),
        fields: data.fields || [],
        command: data.command,
    };
};

const pool = {
    query: (text, params) => neonHttpQuery(text, params),
    connect: async () => ({
        query: (text, params) => neonHttpQuery(text, params),
        release: () => {},
    }),
    on: () => {},
    end: async () => {},
};

export { pool };

export const initDB = async () => {
    console.log('[DB] Starting Neon HTTPS database initialization...');
    try {
        const connectionTest = await pool.query('SELECT NOW() as current_time');
        console.log('[DB] ✅ Connected to Neon PostgreSQL over HTTPS:', connectionTest.rows[0]?.current_time);
    } catch (err) {
        console.error('[DB] ❌ Neon connection test failed:', err.message);
    }
};

export default {
    query: (text, param) => pool.query(text, param),
    pool,
};
