import Wishlist from '../../models/marketplace/Wishlist.js';

export const getWishlists = async (req, res) => {
    try {
        const userId = req.user.id;
        const wishlists = await Wishlist.findByUserId(userId);
        res.json({ success: true, data: wishlists });
    } catch (error) {
        console.error('Error fetching wishlists:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const createWishlist = async (req, res) => {
    try {
        const { name, visibility } = req.body;
        const userId = req.user.id;

        const wishlist = await Wishlist.create(userId, name, visibility || 'private');
        res.status(201).json({ success: true, data: wishlist });
    } catch (error) {
        console.error('Error creating wishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getWishlistItems = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify ownership or public visibility
        const isOwner = await Wishlist.verifyOwnership(id, userId);
        const isPublic = await Wishlist.isPublic(id);

        if (!isOwner && !isPublic) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You do not have permission to view this wishlist'
            });
        }

        const items = await Wishlist.getItems(id);
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error fetching wishlist items:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const addWishlistItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { product_id, price_tracked } = req.body;
        const userId = req.user.id;

        // Verify ownership before allowing modifications
        const isOwner = await Wishlist.verifyOwnership(id, userId);
        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only add items to your own wishlists'
            });
        }

        const item = await Wishlist.addItem(id, product_id, price_tracked);
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('Error adding item to wishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
