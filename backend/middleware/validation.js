import { body, param, query, validationResult } from 'express-validator';

/**
 * Validation middleware to check for validation errors
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

/**
 * Auth validation rules
 */
export const registerValidation = [
    body('email')
        .isEmail().withMessage('Valid email is required')
        .normalizeEmail()
        .trim(),
    body('name')
        .isString().withMessage('Name must be a string')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name contains invalid characters'),
    body('password')
        .isString()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
    validate
];

export const loginValidation = [
    body('email')
        .isEmail().withMessage('Valid email is required')
        .normalizeEmail()
        .trim(),
    body('password')
        .notEmpty().withMessage('Password is required'),
    validate
];

/**
 * Post validation rules
 */
export const createPostValidation = [
    body('recipeId')
        .optional({ values: 'falsy' })
        .isUUID().withMessage('Recipe ID must be a valid UUID'),
    body('caption')
        .optional({ values: 'falsy' })
        .isString()
        .trim()
        .isLength({ max: 2000 }).withMessage('Caption cannot exceed 2000 characters'),
    body('imageUrl')
        .optional({ values: 'falsy' })
        .custom((val) => {
            if (!val) return true;
            try {
                new URL(val);
                return true;
            } catch {
                return false;
            }
        }).withMessage('Image URL must be valid'),
    validate
];

export const updatePostValidation = [
    param('id')
        .isUUID().withMessage('Post ID must be a valid UUID'),
    body('caption')
        .optional({ values: 'falsy' })
        .isString()
        .trim()
        .isLength({ max: 2000 }).withMessage('Caption cannot exceed 2000 characters'),
    validate
];

/**
 * Comment validation rules
 */
export const createCommentValidation = [
    param('postId')
        .isUUID().withMessage('Post ID must be a valid UUID'),
    body('content')
        .isString().withMessage('Comment content is required')
        .trim()
        .isLength({ min: 1, max: 1000 }).withMessage('Comment must be between 1 and 1000 characters')
        .escape(),
    validate
];

/**
 * Message validation rules
 */
export const createMessageValidation = [
    body('conversationId')
        .isUUID().withMessage('Conversation ID must be a valid UUID'),
    body('content')
        .isString().withMessage('Message content is required')
        .trim()
        .isLength({ min: 1, max: 5000 }).withMessage('Message must be between 1 and 5000 characters')
        .escape(),
    validate
];

/**
 * Pagination validation
 */
export const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt(),
    validate
];

/**
 * UUID param validation
 */
export const uuidParamValidation = (paramName = 'id') => [
    param(paramName)
        .isUUID().withMessage(`${paramName} must be a valid UUID`),
    validate
];

// --- Recipe validators ---

const ingredientSchema = {
    'ingredients.*.name': { isString: true, notEmpty: true, errorMessage: 'Ingredient name is required' },
    'ingredients.*.quantity': { optional: true, isString: true },
    'ingredients.*.unit': { optional: true, isString: true },
};

export const generateRecipeValidation = [
    body('ingredients')
        .optional()
        .isArray({ max: 50 }).withMessage('Ingredients must be an array (up to 50 items)'),
    body('ingredients.*')
        .optional()
        .isString().trim().isLength({ max: 100 }).withMessage('Each ingredient must be a string under 100 chars'),
    body().custom((value) => {
        const hasIngredients = Array.isArray(value?.ingredients) && value.ingredients.length > 0;
        const usePantry = Boolean(value?.usePantryIngredients);
        if (!hasIngredients && !usePantry) {
            throw new Error('Please provide at least one ingredient or enable pantry ingredients');
        }
        return true;
    }),
    body('usePantryIngredients')
        .optional()
        .isBoolean().withMessage('usePantryIngredients must be a boolean'),
    body('dietaryRestrictions')
        .optional()
        .isArray({ max: 20 }).withMessage('dietaryRestrictions must be an array'),
    body('dietaryRestrictions.*')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('cuisineType')
        .optional()
        .isString().trim().isLength({ max: 50 }).withMessage('cuisineType must be under 50 chars'),
    body('servings')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Servings must be 1-100'),
    body('cookingTime')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    validate
];

export const regenerateRecipeValidation = [
    body('ingredients')
        .optional()
        .isArray({ max: 50 }).withMessage('Ingredients must be an array (up to 50 items)'),
    body('ingredients.*')
        .optional()
        .isString().trim().isLength({ max: 100 }),
    body('pantryItems')
        .optional()
        .isArray({ max: 200 }),
    body('dietaryRestrictions')
        .optional()
        .isArray({ max: 20 }),
    body('dietaryRestrictions.*')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('cuisineType')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('servings')
        .optional()
        .isInt({ min: 1, max: 100 }),
    body('cookingTime')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('previousRecipe')
        .optional(),
    body('attemptNumber')
        .optional()
        .isInt({ min: 1, max: 10 }),
    body('usePantryIngredients')
        .optional()
        .isBoolean(),
    validate
];

export const saveRecipeValidation = [
    body('name')
        .isString().trim()
        .isLength({ min: 1, max: 200 }).withMessage('Recipe name is required (max 200 chars)'),
    body('description')
        .optional()
        .isString().trim().isLength({ max: 2000 }),
    body('cuisine_type')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('difficulty')
        .optional()
        .isString().isIn(['easy', 'medium', 'hard', 'Easy', 'Medium', 'Hard'])
        .withMessage('Difficulty must be easy, medium, or hard'),
    body('prep_time').optional().isInt({ min: 0, max: 1440 }),
    body('prepTime').optional().isInt({ min: 0, max: 1440 }),
    body('cook_time').optional().isInt({ min: 0, max: 1440 }),
    body('cookTime').optional().isInt({ min: 0, max: 1440 }),
    body('servings')
        .optional()
        .isInt({ min: 1, max: 100 }),
    body('instructions')
        .optional()
        .isArray({ max: 100 }),
    body('instructions.*')
        .optional()
        .isString().isLength({ max: 2000 }),
    body('dietary_tags')
        .optional()
        .isArray({ max: 20 }),
    body('dietary_tags.*')
        .optional()
        .isString().isLength({ max: 50 }),
    body('user_notes')
        .optional()
        .isString().isLength({ max: 5000 }),
    body('image_url')
        .optional()
        .isString().isLength({ max: 2000 }),
    body('ingredients')
        .optional()
        .isArray({ max: 100 }),
    body('nutrition')
        .optional()
        .isObject(),
    validate
];

export const updateRecipeValidation = [
    param('id').isUUID().withMessage('Recipe ID must be a valid UUID'),
    body('name')
        .optional()
        .isString().trim().isLength({ min: 1, max: 200 }),
    body('description')
        .optional()
        .isString().trim().isLength({ max: 2000 }),
    body('cuisine_type')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('difficulty')
        .optional()
        .isString().isIn(['easy', 'medium', 'hard', 'Easy', 'Medium', 'Hard']),
    body('prep_time').optional().isInt({ min: 0, max: 1440 }),
    body('prepTime').optional().isInt({ min: 0, max: 1440 }),
    body('cook_time').optional().isInt({ min: 0, max: 1440 }),
    body('cookTime').optional().isInt({ min: 0, max: 1440 }),
    body('servings').optional().isInt({ min: 1, max: 100 }),
    body('instructions').optional().isArray({ max: 100 }),
    body('dietary_tags').optional().isArray({ max: 20 }),
    body('user_notes').optional().isString().isLength({ max: 5000 }),
    body('image_url').optional().isString().isLength({ max: 2000 }),
    body('ingredients').optional().isArray({ max: 100 }),
    body('nutrition').optional().isObject(),
    validate
];

// --- Pantry validators ---

export const addPantryItemValidation = [
    body('name')
        .isString().trim()
        .isLength({ min: 1, max: 100 }).withMessage('Item name is required (max 100 chars)'),
    body('quantity')
        .isFloat({ min: 0.01 }).withMessage('Quantity must be a positive number'),
    body('unit')
        .optional()
        .isString().trim().isLength({ max: 30 }),
    body('category')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('expiry_date')
        .optional()
        .isISO8601().withMessage('Expiry date must be a valid date'),
    body('is_running_low')
        .optional()
        .isBoolean(),
    validate
];

export const updatePantryItemValidation = [
    param('id').isUUID().withMessage('Item ID must be a valid UUID'),
    body('name')
        .optional()
        .isString().trim().isLength({ min: 1, max: 100 }),
    body('quantity')
        .optional()
        .isFloat({ min: 0.01 }),
    body('unit')
        .optional()
        .isString().trim().isLength({ max: 30 }),
    body('category')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('expiry_date')
        .optional()
        .isISO8601(),
    body('is_running_low')
        .optional()
        .isBoolean(),
    validate
];

// --- Marketplace validators ---

export const createListingValidation = [
    body('title')
        .isString().trim()
        .isLength({ min: 1, max: 200 }).withMessage('Title is required (max 200 chars)'),
    body('category')
        .optional()
        .isString().trim().isLength({ max: 50 }),
    body('price')
        .isFloat({ min: 0.01, max: 999999.99 }).withMessage('Price must be between $0.01 and $999,999.99'),
    body('condition')
        .optional()
        .isString().isIn(['new', 'like_new', 'good', 'fair', 'poor', 'New', 'Like New', 'Good', 'Fair', 'Poor'])
        .withMessage('Invalid condition value'),
    body('image_url')
        .optional()
        .isString().isLength({ max: 2000 }),
    validate
];

export const createWishlistValidation = [
    body('name')
        .isString().trim()
        .isLength({ min: 1, max: 100 }).withMessage('Wishlist name is required (max 100 chars)'),
    body('visibility')
        .optional()
        .isString().isIn(['private', 'public']).withMessage('Visibility must be private or public'),
    validate
];

export const addWishlistItemValidation = [
    param('id').isUUID().withMessage('Wishlist ID must be a valid UUID'),
    body('product_id')
        .isUUID().withMessage('Product ID must be a valid UUID'),
    body('price_tracked')
        .optional()
        .isBoolean(),
    validate
];

export const createPurchaseValidation = [
    body('item_id')
        .isUUID().withMessage('Item ID must be a valid UUID'),
    body('quantity')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Quantity must be 1-100'),
    validate
];
