import { pool } from '../../config/db.js';

class Wishlist {
    static async findById(id) {
        const result = await pool.query(
            `SELECT * FROM wishlists WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await pool.query(
            `SELECT * FROM wishlists WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    static async create(userId, name, visibility = 'private') {
        const result = await pool.query(
            `INSERT INTO wishlists (user_id, name, visibility)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [userId, name, visibility]
        );
        return result.rows[0];
    }

    static async getItems(wishlistId) {
        const result = await pool.query(
            `SELECT wi.*, m.title, m.price, m.image_url, m.status, m.seller_id
             FROM wishlist_items wi
             JOIN marketplace_listings m ON wi.product_id = m.id
             WHERE wi.wishlist_id = $1
             ORDER BY wi.created_at DESC`,
            [wishlistId]
        );
        return result.rows;
    }

    static async addItem(wishlistId, productId, priceTracked) {
        const result = await pool.query(
            `INSERT INTO wishlist_items (wishlist_id, product_id, price_tracked)
             VALUES ($1, $2, $3)
             ON CONFLICT (wishlist_id, product_id) DO NOTHING
             RETURNING *`,
            [wishlistId, productId, priceTracked]
        );
        return result.rows[0];
    }

    static async removeItem(wishlistId, productId) {
        const result = await pool.query(
            `DELETE FROM wishlist_items
             WHERE wishlist_id = $1 AND product_id = $2
             RETURNING *`,
            [wishlistId, productId]
        );
        return result.rows[0];
    }

    static async delete(id, userId) {
        const result = await pool.query(
            `DELETE FROM wishlists
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [id, userId]
        );
        return result.rows[0];
    }

    static async verifyOwnership(id, userId) {
        const result = await pool.query(
            `SELECT user_id FROM wishlists WHERE id = $1`,
            [id]
        );
        return result.rows[0]?.user_id === userId;
    }

    static async isPublic(id) {
        const result = await pool.query(
            `SELECT visibility FROM wishlists WHERE id = $1`,
            [id]
        );
        return result.rows[0]?.visibility === 'public';
    }
}

export default Wishlist;
