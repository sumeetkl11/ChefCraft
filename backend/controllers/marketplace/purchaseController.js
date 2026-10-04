import { pool } from '../../config/db.js';
import Purchase from '../../models/marketplace/Purchase.js';

export const createPurchase = async (req, res) => {
    const client = await pool.connect();

    try {
        const { item_id, quantity } = req.body;
        const buyerId = req.user.id;
        const purchaseQty = Math.max(1, parseInt(quantity, 10) || 1);

        await client.query('BEGIN');

        // Lock the listing row and fetch server-side price + seller_id
        const listingResult = await client.query(
            `SELECT id, seller_id, price, status
             FROM marketplace_listings
             WHERE id = $1
             FOR UPDATE`,
            [item_id]
        );

        if (listingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }

        const listing = listingResult.rows[0];

        if (listing.seller_id === buyerId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'You cannot purchase your own listing' });
        }

        if (listing.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Listing is no longer available' });
        }

        // Use server-side price and seller_id
        const serverPrice = listing.price;
        const serverSellerId = listing.seller_id;

        const purchaseResult = await client.query(
            `INSERT INTO purchases (buyer_id, item_id, seller_id, quantity, price, status)
             VALUES ($1, $2, $3, $4, $5, 'completed')
             RETURNING *`,
            [buyerId, item_id, serverSellerId, purchaseQty, serverPrice]
        );

        // Mark listing as sold
        await client.query(
            `UPDATE marketplace_listings SET status = 'sold' WHERE id = $1`,
            [item_id]
        );

        await client.query('COMMIT');

        res.status(201).json({ success: true, data: purchaseResult.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating purchase:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
};

export const getPurchaseHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const purchases = await Purchase.findByBuyerId(userId);
        res.json({ success: true, data: purchases });
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getSalesHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const sales = await Purchase.findBySellerId(userId);
        res.json({ success: true, data: sales });
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
