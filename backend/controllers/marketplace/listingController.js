import Listing from '../../models/marketplace/Listing.js';

export const createListing = async (req, res) => {
    try {
        const { title, category, price, condition, image_url, description, quantity } = req.body;
        const sellerId = req.user.id;

        const listing = await Listing.create({
            seller_id: sellerId,
            title,
            description,
            price,
            category,
            image_url,
            quantity,
            condition
        });

        res.status(201).json({ success: true, data: listing });
    } catch (error) {
        console.error('Error creating listing:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getListings = async (req, res) => {
    try {
        const listings = await Listing.findAll(req.query);
        res.json({ success: true, data: listings });
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getListing = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);

        if (!listing) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }

        res.json({ success: true, data: listing });
    } catch (error) {
        console.error('Error fetching listing:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
