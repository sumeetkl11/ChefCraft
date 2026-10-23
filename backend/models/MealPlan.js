import db, { pool } from "../config/db.js";

class MealPlan {

    static async create (userId, mealData) {
        const {recipeId, planned_date, meal_type, meal_date} = mealData;
        const data = planned_date || meal_date;

        try {
            const result = await pool.query(
                `WITH new_meal AS (
                    INSERT INTO meal_plans (user_id, recipe_id, meal_date, meal_type, meal_data) 
                    VALUES ($1, $2, $3::date, $4, $3::date) 
                    RETURNING *
                )
                SELECT mp.id, mp.user_id, mp.recipe_id, mp.meal_date::text as meal_date, 
                       mp.meal_type, mp.created_at, mp.updated_at, 
                       r.name as recipe_name, r.image_url, r.prep_time, r.cook_time,
                       COALESCE(rn.calories, 0) as calories,
                       COALESCE(rn.protein, 0) as protein,
                       COALESCE(rn.carbs, 0) as carbs,
                       COALESCE(rn.fat, 0) as fat
                FROM new_meal mp
                JOIN recipes r ON mp.recipe_id = r.id
                LEFT JOIN recipe_nutrition rn ON r.id = rn.recipe_id`,
                [userId, recipeId, data, meal_type]
            );
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                const existing = await pool.query(
                    `SELECT mp.id, mp.user_id, mp.recipe_id, mp.meal_date::text as meal_date, 
                            mp.meal_type, mp.created_at, mp.updated_at, 
                            r.name as recipe_name, r.image_url, r.prep_time, r.cook_time,
                            COALESCE(rn.calories, 0) as calories,
                            COALESCE(rn.protein, 0) as protein,
                            COALESCE(rn.carbs, 0) as carbs,
                            COALESCE(rn.fat, 0) as fat
                     FROM meal_plans mp
                     JOIN recipes r ON mp.recipe_id = r.id
                     LEFT JOIN recipe_nutrition rn ON r.id = rn.recipe_id
                     WHERE mp.user_id = $1 AND mp.recipe_id = $2 AND mp.meal_type = $3 AND mp.meal_date = $4::date`,
                    [userId, recipeId, meal_type, data]
                );
                if (existing.rows[0]) {
                    return existing.rows[0];
                }
            }
            throw error;
        }
    }

    static async findbyDataRange (userId, startDate, endDate) {
        const result = await pool.query(
            `SELECT mp.id, mp.user_id, mp.recipe_id, mp.meal_date::text as meal_date, 
            mp.meal_type, mp.created_at, mp.updated_at, 
            r.name as recipe_name, r.image_url, r.prep_time, r.cook_time,
            COALESCE(rn.calories, 0) as calories,
            COALESCE(rn.protein, 0) as protein,
            COALESCE(rn.carbs, 0) as carbs,
            COALESCE(rn.fat, 0) as fat
             FROM meal_plans mp
             JOIN recipes r ON mp.recipe_id = r.id
             LEFT JOIN recipe_nutrition rn ON r.id = rn.recipe_id
             WHERE mp.user_id = $1 
             AND mp.meal_date BETWEEN $2::date AND $3::date
             ORDER BY mp.meal_date ASC,
             CASE mp.meal_type
                WHEN 'breakfast' THEN 1
                WHEN 'lunch' THEN 2
                WHEN 'dinner' THEN 3
             END`,
            [userId, startDate, endDate]
        );
        
        return result.rows;
    }

    // GET WEEKLY MEAL PLAN
    static async getWeeklyMealPlan (userId, weekStartdate) {
        try {
            const endDateObj = new Date(weekStartdate);
            endDateObj.setDate(endDateObj.getDate() + 6);
            const endDate = endDateObj.toISOString().split('T')[0];
            
            return this.findbyDataRange(userId, weekStartdate, endDate);
        } catch (error) {
            console.error('[MealPlan.getWeeklyMealPlan] Database query failed:', {
                error: error.message,
                code: error.code,
                detail: error.detail,
                table: error.table,
                column: error.column,
                userId,
                weekStartdate
            });
            throw error;
        }
    }

    // get upcoming meals (next 7 days)
    static async getUpcomingMeals (userId, limit = 5) {
        try {
            const result = await pool.query(
                `SELECT mp.*, r.name as recipe_name, r.image_url
                 FROM meal_plans mp
                 JOIN recipes r ON mp.recipe_id = r.id
                 WHERE mp.user_id = $1 
                 AND mp.meal_date >= CURRENT_DATE
                 ORDER BY mp.meal_date ASC,
                 CASE mp.meal_type
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'dinner' THEN 3
                 END
                 LIMIT $2`,
                [userId, limit]
            );
            
            return result.rows;
        } catch (error) {
            console.error('[MealPlan.getUpcomingMeals] Database query failed:', {
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

    // dlt meal plan entry

    static async delete(id, userId) {
        const result = await pool.query(
            `DELETE FROM meal_plans WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );
        
        return result.rows[0];
    }

    // get meal plan stats 

    static async getStats(userId) {
        try {
            const result = await pool.query(
                `SELECT 
                    COUNT(*) as total_planned_meals,
                    COUNT(*) FILTER (WHERE meal_date >= CURRENT_DATE AND meal_date < CURRENT_DATE + INTERVAL '7 days') as this_week_count
                 FROM meal_plans 
                 WHERE user_id = $1`,
                [userId]
            );
            
            return result.rows[0];
        } catch (error) {
            console.error('[MealPlan.getStats] Database query failed:', {
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

export default MealPlan;