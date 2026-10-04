import db, { pool } from '../config/db.js';

class ShoppingList {
    // Generate shopping list for meal plan
    static async generateFromMealPlan(userId, startDate, endDate) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Clear existing meal plan
            await client.query(
                'DELETE FROM shopping_list_items WHERE user_id = $1 AND from_meal_plan = true',
                [userId]);

            // get all ingredients from meal plan
            const ingredientsResult = await client.query(
                `SELECT ri.ingredient_name, ri.unit, SUM(ri.quantity) as total_quantity 
                 FROM meal_plans mp 
                 JOIN recipe_ingredients ri ON mp.recipe_id = ri.recipe_id 
                 WHERE mp.user_id = $1 
                 AND mp.meal_date >= $2 
                 AND mp.meal_date <= $3 
                 GROUP BY ri.ingredient_name, ri.unit`,
                [userId, startDate, endDate]
            );
            const ingredients = ingredientsResult.rows;
            
            // Get pantry items to subtract
            const pantryResult = await client.query(
                `SELECT name, quantity, unit 
                 FROM pantry_items 
                 WHERE user_id = $1`,
                [userId]
            );
            const pantryMap = new Map();
            pantryResult.rows.forEach(item =>{
                const key = `${item.name.toLowerCase()}_${item.unit}`;
                pantryMap.set(key, item.quantity);
            });

            // Insert shopping list items (subtract pantry quantities)
            for (const ing of ingredients) {
                const key = `${ing.ingredient_name.toLowerCase()}_${ing.unit}`;
                const pantryQty = pantryMap.get(key) || 0;
                const neededQty = Math.max(0, parseFloat(ing.total_quantity) - parseFloat(pantryQty));

                if (neededQty > 0) {
                    await client.query(
                        `INSERT INTO shopping_list_items
                        (user_id, ingredient_name, quantity, unit, from_meal_plan, category)
                         VALUES ($1, $2, $3, $4, true, $5)`,
                        [userId, ing.ingredient_name, neededQty, ing.unit, 'Uncategorized']
                    );
                }
            }

            await client.query('COMMIT');

            return await this.findAll(userId); 
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Add manual item to shopping list 
    static async create(userId, itemData) {
        const { ingredient_name, quantity, unit, category = 'Uncategorized' } = itemData;
        const result = await pool.query(
            `INSERT INTO shopping_list_items 
            (user_id, ingredient_name, quantity, unit, from_meal_plan, category)
             VALUES ($1, $2, $3, $4, false, $5)
             RETURNING *`,
            [userId, ingredient_name, quantity, unit, category]
        );
        return result.rows[0];
    }

    // Get all shopping list items for a user
    static async findAll(userId) {
        const result = await pool.query(
            `SELECT * FROM shopping_list_items
             WHERE user_id = $1
             ORDER BY category, ingredient_name`,
            [userId]
        );
        return result.rows;
    }

    // Get shopping list items grouped by category
    static async getGroupedByCategory(userId) {
        const result = await pool.query(
            `SELECT category, json_agg(
            json_build_object(
            'id', id,
            'ingredient_name', ingredient_name,
            'quantity', quantity,
            'unit', unit,
            'is_checked', is_checked,
            'from_meal_plan', from_meal_plan)
            ) as items
             FROM shopping_list_items
             WHERE user_id = $1
             GROUP BY category
             ORDER BY category`,
            [userId]
        );
        return result.rows;
    }

    // Get shopping list items by category
    static async findByCategory(userId, category) {
        const result = await pool.query(
            `SELECT * FROM shopping_list_items
             WHERE user_id = $1 AND category = $2
             ORDER BY ingredient_name`,
            [userId, category]
        );
        return result.rows;
    }

    // Update shopping List item
    static async update(id, userId, updates) {
        const { ingredient_name, quantity, unit, is_checked, category } = updates;
        const result = await pool.query(
            `UPDATE shopping_list_items
             SET ingredient_name = COALESCE($1, ingredient_name),
                 quantity = COALESCE($2, quantity),
                 unit = COALESCE($3, unit),
                 is_checked = COALESCE($4, is_checked),
                 category = COALESCE($5, category)
             WHERE id = $6 AND user_id = $7
             RETURNING *`,
            [ingredient_name, quantity, unit, is_checked, category, id, userId]
        );
        return result.rows[0];
    }

    // Toggle item checked status
    static async toggleChecked(id, userId) {
        const result = await pool.query(
            `UPDATE shopping_list_items
             SET is_checked = NOT is_checked
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    // Delete shopping list item
    static async delete(id, userId) {
        const result = await pool.query(
            `DELETE FROM shopping_list_items
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    // Clear checked items
    static async clearChecked(userId) {
        const result = await pool.query(
            `DELETE FROM shopping_list_items
             WHERE user_id = $1 AND is_checked = true
             RETURNING *`,
            [userId]
        );
        return result.rows;
    }

    // Clear entire shopping list
    static async clearAll(userId) {
        const result = await pool.query(
            `DELETE FROM shopping_list_items
             WHERE user_id = $1
             RETURNING *`,
            [userId]
        );
        return result.rows;
    }

    // Add checked items to pantry
    static async addCheckedToPantry(userId, expiryDate) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
                // Get checked items
            const checkedItems = await client.query(
                `SELECT * FROM shopping_list_items WHERE user_id = $1 AND is_checked = true`,
                [userId]
            );

            // Add checked items to pantry in a single batch insert
            if (checkedItems.rows.length > 0) {
                const values = checkedItems.rows.map((item, idx) => {
                    const base = idx * 6;
                    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
                }).join(', ');

                const params = checkedItems.rows.flatMap(item => [
                    userId,
                    item.ingredient_name,
                    parseInt(item.quantity),
                    item.unit,
                    item.category,
                    expiryDate
                ]);

                await client.query(
                    `INSERT INTO pantry_items (user_id, name, quantity, unit, category, expiry_date)
                    VALUES ${values}`,
                    params
                );
            }

            // Delete checked items from shopping list
            await client.query(
                `DELETE FROM shopping_list_items WHERE user_id = $1 AND is_checked = true`,
                [userId]
            );

            await client.query('COMMIT');

            return checkedItems.rows;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }

}
export default ShoppingList;