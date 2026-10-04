import { pool } from '../../config/db.js';

class Purchase {
    static async findByBuyerId(buyerId) {
        const result = await pool.query(
            `SELECT p.*, m.title, m.image_url, u.name as seller_name
             FROM purchases p
             LEFT JOIN marketplace_listings m ON p.item_id = m.id
             LEFT JOIN users u ON p.seller_id = u.id
             WHERE p.buyer_id = $1
             ORDER BY p.created_at DESC`,
            [buyerId]
        );
        return result.rows;
    }

    static async findBySellerId(sellerId) {
        const result = await pool.query(
            `SELECT p.*, m.title, m.image_url, u.name as buyer_name
             FROM purchases p
             LEFT JOIN marketplace_listings m ON p.item_id = m.id
             LEFT JOIN users u ON p.buyer_id = u.id
             WHERE p.seller_id = $1
             ORDER BY p.created_at DESC`,
            [sellerId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await pool.query(
            `SELECT * FROM purchases WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }
}

export default Purchase;
