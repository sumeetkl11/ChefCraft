import { pool } from '../../config/db.js';

class Listing {
    static async findById(id) {
        const result = await pool.query(
            `SELECT * FROM marketplace_listings WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    static async findByUserId(userId, filters = {}) {
        let query = `SELECT * FROM marketplace_listings WHERE seller_id = $1`;
        const params = [userId];
        let paramCount = 1;

        if (filters.category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            params.push(filters.category);
        }

        if (filters.status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
        }

        query += ` ORDER BY created_at DESC`;

        if (filters.limit) {
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        const result = await pool.query(query, params);
        return result.rows;
    }

    static async findAll(filters = {}) {
        let query = `SELECT * FROM marketplace_listings WHERE status = 'active'`;
        const params = [];
        let paramCount = 0;

        if (filters.category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            params.push(filters.category);
        }

        if (filters.search) {
            paramCount++;
            query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
        }

        if (filters.max_price) {
            paramCount++;
            query += ` AND price <= $${paramCount}`;
            params.push(filters.max_price);
        }

        query += ` ORDER BY created_at DESC`;

        if (filters.limit) {
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        const result = await pool.query(query, params);
        return result.rows;
    }

    static async create(data) {
        const { seller_id, title, description, price, category, image_url, quantity, condition } = data;
        const result = await pool.query(
            `INSERT INTO marketplace_listings
             (seller_id, title, description, price, category, image_url, quantity, condition, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
             RETURNING *`,
            [seller_id, title, description, price, category, image_url, quantity || 1, condition || 'new']
        );
        return result.rows[0];
    }

    static async update(id, sellerId, updates) {
        const { title, description, price, category, image_url, quantity, condition, status } = updates;
        const result = await pool.query(
            `UPDATE marketplace_listings
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 price = COALESCE($3, price),
                 category = COALESCE($4, category),
                 image_url = COALESCE($5, image_url),
                 quantity = COALESCE($6, quantity),
                 condition = COALESCE($7, condition),
                 status = COALESCE($8, status),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $9 AND seller_id = $10
             RETURNING *`,
            [title, description, price, category, image_url, quantity, condition, status, id, sellerId]
        );
        return result.rows[0];
    }

    static async delete(id, sellerId) {
        const result = await pool.query(
            `DELETE FROM marketplace_listings
             WHERE id = $1 AND seller_id = $2
             RETURNING id`,
            [id, sellerId]
        );
        return result.rows[0];
    }

    static async verifyOwnership(id, sellerId) {
        const result = await pool.query(
            `SELECT seller_id FROM marketplace_listings WHERE id = $1`,
            [id]
        );
        return result.rows[0]?.seller_id === sellerId;
    }
}

export default Listing;
