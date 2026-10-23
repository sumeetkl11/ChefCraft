import PantryItem from "../models/PantryItem.js";
import cacheService from "../services/cacheService.js";

// Get all pantry items
export const getPantryItems = async(req, res ,next) => {
    try{
        const { category, is_running_low, search } = req.query;

        const items = await PantryItem.findByUserId(req.user.id, {
            category,
            is_running_low: is_running_low === 'true'? true : undefined,
            search
        });

        res.json({
            success: true,
            data: {items}
        });
        
    } catch (error) {
        next(error);
    }
}

// get pantry stats
export const getPantryStats = async(req, res, next) => {
    try {
        const stats = await PantryItem.getStats(req.user.id);
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
}

// get items expiring soon
export const getExpiringItems = async(req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const items = await PantryItem.getExpiringSoon(req.user.id, days);
        res.json({
            success: true,
            data: { items }
        });
    } catch (error) {
        next(error);
    }
}

// add pantry item
export const addPantryItem = async(req, res, next) => {
    try {
        const { name, quantity } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Item name is required'
            });
        }

        const numQuantity = Number(quantity);
        if (isNaN(numQuantity) || numQuantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive number'
            });
        }

        const itemData = {
            ...req.body,
            name: name.trim(),
            quantity: numQuantity
        };

        const item = await PantryItem.create(req.user.id, itemData);
        await cacheService.invalidateDashboardSummary(req.user.id);
        res.status(201).json({
            success: true,
            message: 'Pantry item added successfully',
            data: {item}
        });
    } catch (error) {
        next(error);
    }
}

// update pantry item
export const updatePantryItem = async(req, res, next) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        if (updates.name !== undefined) {
            if (typeof updates.name !== 'string' || !updates.name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Item name cannot be empty'
                });
            }
            updates.name = updates.name.trim();
        }

        if (updates.quantity !== undefined) {
            const numQuantity = Number(updates.quantity);
            if (isNaN(numQuantity) || numQuantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Quantity must be a positive number'
                });
            }
            updates.quantity = numQuantity;
        }

        const item = await PantryItem.update(id, req.user.id, updates);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Pantry item not found'
            });
        }
        
        await cacheService.invalidateDashboardSummary(req.user.id);
        res.json({
            success: true,
            message: 'Pantry item updated successfully',
            data: {item}
        });
    } catch (error) {
        next(error);
    }
}

// delete pantry item
export const deletePantryItem = async(req, res, next) => {
    try {
        const {id} = req.params;
        const item = await PantryItem.delete(id, req.user.id);
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Pantry item not found'
            });
        }
        
        await cacheService.invalidateDashboardSummary(req.user.id);
        res.json({
            success: true,
            message: 'Pantry item deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}