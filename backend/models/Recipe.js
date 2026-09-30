import db, { pool } from "../config/db.js";

class Recipe {
    
    // Create new reicpe with ingredients and nutrition
    static async create(userId, recipeData) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            
            const {
                name,
                description,
                cuisine_type,
                difficulty,
                prep_time,
                cook_time,
                servings,
                instructions,
                dietary_tags = [],
                user_notes,
                image_url,
                ingredients,
                nutrition
            } = recipeData;

            // Insert recipe
            const recipeResult = await client.query(
                `INSERT INTO recipes (
                    user_id, name, description, cuisine_type, difficulty,
                    prep_time, cook_time, servings, instructions,
                    dietary_tags, user_notes, image_url
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *`, [
                    userId, name, description, cuisine_type, difficulty,
                    prep_time, cook_time, servings, JSON.stringify(instructions),
                    dietary_tags, user_notes, image_url
                ]);
                
            const recipe = recipeResult.rows[0];

            // Insert ingredients
            if (ingredients.length > 0) {
                const ingredientValues = ingredients.map((ing, idx) => 
                    `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4})`
                ).join(', ');
                
                const ingredientParams = [recipe.id];
                ingredients.forEach(ing => {
                    const parsedQty = Math.round(parseFloat(ing.quantity) || 0);
                    ingredientParams.push(ing.name, parsedQty, ing.unit || '');
                });

                await client.query(
                    `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit) VALUES ${ingredientValues}`,
                    ingredientParams
                );
            }

            // Insert nutrition
            if (nutrition && Object.keys(nutrition).length > 0) {
                const parseNutr = (val) => Math.round(parseFloat(val) || 0);
                await client.query(
                    `INSERT INTO recipe_nutrition (recipe_id, calories, protein, carbs, fat, fiber)
            VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        recipe.id,
                        parseNutr(nutrition.calories),
                        parseNutr(nutrition.protein),
                        parseNutr(nutrition.carbs),
                        parseNutr(nutrition.fat),
                        parseNutr(nutrition.fiber)
                    ]
                );
            }

            const recipeRecord = { ...recipe };

            // Fetch ingredients and nutrition within the same transaction to avoid a second pool connection
            const [ingredientsResult, nutritionResult] = await Promise.all([
                client.query(
                    `SELECT ingredient_name as name, quantity, unit FROM recipe_ingredients WHERE recipe_id = $1`,
                    [recipe.id]
                ),
                client.query(
                    `SELECT calories, protein, carbs, fat, fiber FROM recipe_nutrition WHERE recipe_id = $1`,
                    [recipe.id]
                )
            ]);

            recipeRecord.ingredients = ingredientsResult.rows;
            recipeRecord.nutrition = nutritionResult.rows[0] || null;

            if (typeof recipeRecord.instructions === 'string') {
                try {
                    recipeRecord.instructions = JSON.parse(recipeRecord.instructions);
                } catch (e) {
                    recipeRecord.instructions = [];
                }
            }

            await client.query('COMMIT');
            return recipeRecord;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    }
static async findById(id, userId) {
    const recipeResult = await pool.query(
        `SELECT * FROM recipes WHERE id = $1 AND user_id = $2`,
        [id, userId]
    );

    if (recipeResult.rows.length === 0) return null;

    const recipe = recipeResult.rows[0];

    const [ingredientsResult, nutritionResult] = await Promise.all([
        pool.query(
            `SELECT ingredient_name as name, quantity, unit FROM recipe_ingredients WHERE recipe_id = $1`,
            [id]
        ),
        pool.query(
            `SELECT calories, protein, carbs, fat, fiber FROM recipe_nutrition WHERE recipe_id = $1`,
            [id]
        )
    ]);

    return {
        ...recipe,
        ingredients: ingredientsResult.rows,
        nutrition: nutritionResult.rows[0] || null
    };
}

    // get all recipe for a user with filters
    static async findByUserId(userId, filters = {}){
        let query = `SELECT r.*, rn.calories FROM recipes r LEFT JOIN recipe_nutrition rn ON r.id = rn.recipe_id WHERE r.user_id = $1`;
        const params = [userId];
        let paramCount = 1;
        
        // Add filterss
        if (filters.search) {
            paramCount++;
            query += ` AND (r.name ILIKE $${paramCount} OR r.description ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
        }
        
        if (filters.cuisine_type) {
            paramCount++;
            query += ` AND r.cuisine_type = $${paramCount}`;
            params.push(filters.cuisine_type);
        }
        
        if (filters.difficulty) {
            paramCount++;
            query += ` AND r.difficulty = $${paramCount}`;
            params.push(filters.difficulty);
        }

        if (filters.dietary_tag) {
            paramCount++;
            query += ` AND $${paramCount} = ANY(r.dietary_tags)`;
            params.push(filters.dietary_tag);
        }
        
        if (filters.max_cook_time) {
            paramCount++;
            query += ` AND r.cook_time <= $${paramCount}`;
            params.push(filters.max_cook_time);
        }
        
        // SORTING - Whitelist allowed columns to prevent SQL injection
        const ALLOWED_SORT_COLUMNS = ['created_at', 'name', 'prep_time', 'cook_time', 'difficulty', 'servings'];
        const sortBy = ALLOWED_SORT_COLUMNS.includes(filters.sort_by)
            ? filters.sort_by
            : 'created_at';
        const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder}`;

        // PAGINATION
        const limit = filters.limit || 20;
        const offset = filters.offset || 0;
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(limit);
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);

        const result = await pool.query(query, params);
        return result.rows;
    }

    // Get recent recipe
    static async getRecent(userId, limit = 5) {
        try {
            const result = await pool.query(
                `SELECT r.*, rn.calories
                FROM recipes r 
                LEFT JOIN recipe_nutrition rn ON r.id = rn.recipe_id 
                WHERE r.user_id = $1
                ORDER BY r.created_at DESC 
                LIMIT $2`,
                [userId, limit]
            );
            return result.rows;
        } catch (error) {
            console.error('[Recipe.getRecent] Database query failed:', {
                error: error.message,
                code: error.code,
                detail: error.detail,
                table: error.table,
                column: error.column,
                userId,
                limit
            });
            throw error;
        }
    }

    // Update recipe
    static async update(id, userId, updates) {
    const {
        name,
        description,
        cuisine_type,
        difficulty,
        cook_time,
        prep_time,
        servings,
        instructions,
        dietary_tags,
        user_notes,
        image_url
    } = updates;

    const result = await pool.query(
        `UPDATE recipes 
        SET name = COALESCE($1, name), 
        description = COALESCE($2, description), 
        cuisine_type = COALESCE($3, cuisine_type), 
        difficulty = COALESCE($4, difficulty), 
        cook_time = COALESCE($5, cook_time), 
        prep_time = COALESCE($6, prep_time), 
        servings = COALESCE($7, servings), 
        instructions = COALESCE($8, instructions), 
        dietary_tags = COALESCE($9, dietary_tags), 
        user_notes = COALESCE($10, user_notes), 
        image_url = COALESCE($11, image_url) 
        WHERE id = $12 AND user_id = $13 
        RETURNING *`,
        [name, description, cuisine_type, difficulty, cook_time, prep_time, servings, 
            instructions ? JSON.stringify(instructions) : null, dietary_tags, user_notes, image_url, id, userId]
    );
    return result.rows[0];
    }

    // dlt recipe
    static async delete(id, userId) {
        const result = await pool.query(
            `DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    // get recipe stats
    static async getStats(userId) {
        try {
            const result = await pool.query(
                `SELECT 
                    COUNT(*) as total_recipes,
                    COUNT(DISTINCT cuisine_type) as cuisine_types_count,
                    AVG(cook_time) as avg_cook_time
                FROM recipes 
                WHERE user_id = $1`,
                [userId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('[Recipe.getStats] Database query failed:', {
                error: error.message,
                code: error.code,
                detail: error.detail,
                table: error.table,
                column: error.column,
                userId
            });
            throw error;
        }
    }
}                   

export default Recipe;