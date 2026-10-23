import ShoppingList from "../models/ShoppingList.js";

// generate shopping list from meal plan
export const generateFromMealPlan = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required"
            });
        }

        const items = await ShoppingList.generateFromMealPlan(req.user.id, startDate, endDate);
        res.json({
            success: true,
            message: "Shopping list generated successfully",
            data: {items}
        });
    } catch (error) {
        next(error);
    }
};

// get shopping list
export const getShoppingList = async (req, res, next) => {
    try {
        const grouped = req.query.grouped === 'true'

        const items = grouped
            ? await ShoppingList.getGroupedByCategory(req.user.id)
            : await ShoppingList.findAll(req.user.id);

        res.json({
            success: true,
            data: {items}
        });
    } catch (error) {
        next(error);
    }
};

// add items to shopping list 
export const addItem = async (req, res, next) => {
    try {
        const item = await ShoppingList.create(req.user.id, req.body);
        
        res.json({
            success: true,
            message: "Item added to shopping list",
            data: {item}
        });
    } catch (error) {
        next(error);
    }
};

// update shopping list item
export const updateItem = async (req, res, next) => {
    try {
        const { id } = req.params;  
        const item = await ShoppingList.update(id,req.user.id, req.body);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Shopping list item not found"
            });
        }
        
        res.json({
            success: true,
            message: "Item updated",
            data: {item}
        });
    } catch (error) {
        next(error);
    }
};

// toggle item checked status
export const toggleChecked = async (req, res, next) => {
    try {
        const { id } = req.params;
        const item = await ShoppingList.toggleChecked(id, req.user.id);
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Shopping list item not found"
            });
        }
        
        res.json({
            success: true,
            data: {item}
        });
    } catch (error) {
        next(error);
    }
};

// delete shopping list item
export const deleteItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const item = await ShoppingList.delete(id, req.user.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Shopping list item not found"
            });
        }
        
        res.json({
            success: true,
            message: "Item deleted",
            data: {item}
        });
    } catch (error) {
        next(error);
    }
};

// clear checked items
export const clearChecked = async (req, res, next) => {
    try {
        const items = await ShoppingList.clearChecked(req.user.id);
        
        res.json({
            success: true,
            message: "Checked items cleared",
            data: {items}
        });
    } catch (error) {
        next(error);
    }
};

// clear all items
export const clearAll = async (req, res, next) => {
    try {
        const items = await ShoppingList.clearAll(req.user.id);

        res.json({
            success: true,
            message: "All items cleared",
            data: {items}
        });
    } catch (error) {
        next(error);
    }
};

// Add checked items to pantry (defaults to +7 days expiry when not specified for 1-click transfer)
export const addCheckedToPantry = async (req, res, next) => {
    try {
        const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const expiryDate = req.body?.expiry_date || defaultExpiry;
        
        const items = await ShoppingList.addCheckedToPantry(req.user.id, expiryDate);
        
        res.json({
            success: true,
            message: "Checked items added to pantry",
            data: items
        });
    } catch (error) {
        next(error);
    }
};
