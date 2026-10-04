import dotenv from 'dotenv';
import crypto from 'crypto';
import { redisClient } from '../cache/redis.js';

dotenv.config();

// ─── Helpers ────────────────────────────────────────────────────────────────

const stripMarkdownCodeFence = (text) => {
    let cleanedText = text.trim();

    if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?|```/g, '').replace(/```\n?|```/g, '');
    } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?|```/g, '');
    }

    return cleanedText.trim();
};

const extractJsonPayload = (text) => {
    const cleanedText = stripMarkdownCodeFence(text);

    try {
        return JSON.parse(cleanedText);
    } catch {
        const objectMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            return JSON.parse(objectMatch[0]);
        }

        const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            return JSON.parse(arrayMatch[0]);
        }

        throw new Error('AI returned non-JSON content');
    }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const normalizeRecipe = (recipe, requestedCuisine, servings) => ({
    ...recipe,
    cuisineType: recipe.cuisineType || recipe.cuisine_type || requestedCuisine,
    prepTime: Number(recipe.prepTime ?? recipe.prep_time ?? 0),
    cookTime: Number(recipe.cookTime ?? recipe.cook_time ?? 0),
    servings: Number(recipe.servings ?? servings),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
    cookingTips: Array.isArray(recipe.cookingTips) ? recipe.cookingTips : [],
    nutrition: recipe.nutrition || {}
});

// ─── Groq chat helper ────────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const groqChat = async (systemPrompt, userPrompt) => {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');

    const attempt = async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const res = await fetch(GROQ_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                const detail = await res.text().catch(() => '');
                const err = new Error(`Groq API error ${res.status}: ${detail.slice(0, 200)}`);
                err.status = res.status;
                throw err;
            }

            const data = await res.json();
            return extractJsonPayload(data.choices[0].message.content);
        } catch (err) {
            // Handle network/timeout errors specifically
            if (err.name === 'AbortError') {
                console.error('Groq API Timeout: Request exceeded 30 seconds');
                const timeoutErr = new Error('AI service request timed out. Please try again.');
                timeoutErr.status = 504;
                timeoutErr.code = 'TIMEOUT_ERROR';
                throw timeoutErr;
            }
            if (err.name === 'TypeError' && err.message.includes('fetch failed')) {
                console.error('Groq API Connection Error:', err.message, err.cause?.code);
                const networkErr = new Error('Unable to connect to AI service. Please check your internet connection or try again later.');
                networkErr.status = 503;
                networkErr.code = 'NETWORK_ERROR';
                throw networkErr;
            }
            if (err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || err.cause?.code === 'ECONNREFUSED' || err.cause?.code === 'ENOTFOUND') {
                console.error('Groq API Network Error:', err.cause.code);
                const networkErr = new Error('AI service is currently unreachable. Please try again later.');
                networkErr.status = 503;
                networkErr.code = 'NETWORK_ERROR';
                throw networkErr;
            }
            throw err;
        }
    };

    // Simple retry: max 2 attempts on 429 or 5xx, wait 2s then 4s
    const delays = [2000, 4000];
    for (let i = 0; i <= 1; i++) {
        try {
            return await attempt();
        } catch (err) {
            const retryable = err.status === 429 || (err.status >= 500 && err.status < 600);
            if (retryable && i < 1) {
                console.warn(`Groq ${err.status} — retrying in ${delays[i]}ms`);
                await sleep(delays[i]);
            } else {
                throw err;
            }
        }
    }
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export const generateRecipe = async ({
    ingredients = [],
    pantryItems = [],
    dietaryRestrictions = [],
    cuisine = 'any',
    servings = 4,
    cookingTime = 'medium',
    regenerate = false,
    previousRecipe = null,
    attemptNumber = 1
}) => {
    const dietaryInfo = dietaryRestrictions.length > 0
        ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}`
        : 'No dietary restrictions';

    const timeGuide = {
        quick: 'under 30 minutes',
        medium: '30-60 minutes',
        long: 'over 60 minutes'
    };

    // Build pantry context with quantities
    let pantryContext = '';
    if (pantryItems.length > 0) {
        pantryContext = '\n\nPantry items available (use these quantities as guidance):\n';
        pantryContext += pantryItems.map(item => 
            `- ${item.name}: ${item.quantity} ${item.unit || 'unit(s)'}`
        ).join('\n');
    }

    // Regeneration guidance
    let regenerationPrompt = '';
    if (regenerate && previousRecipe) {
        regenerationPrompt = `\n\nThis is regeneration attempt #${attemptNumber}. Previous recipe was "${previousRecipe.name}". 
Create a DIFFERENT recipe with a unique approach. Vary the cooking method, flavor profile, or presentation style.`;
    }

    // Sanitize user inputs to prevent prompt injection
    const sanitizeInput = (input, maxLength = 500) => {
        if (!input) return '';
        return String(input)
            .slice(0, maxLength)
            .replace(/[<>]/g, '') // Remove angle brackets
            .trim();
    };

    const sanitizedCuisine = sanitizeInput(cuisine, 50);
    const sanitizedIngredients = (Array.isArray(ingredients) ? ingredients : [])
        .slice(0, 50) // Max 50 ingredients
        .map(ing => sanitizeInput(ing, 100))
        .filter(Boolean);
    const sanitizedDietary = (Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [])
        .slice(0, 10)
        .map(d => sanitizeInput(d, 50))
        .filter(Boolean);

    const formatPantryItem = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return sanitizeInput(item, 100);
        const name = sanitizeInput(item.name || item.ingredient_name, 100);
        if (!name) return '';
        const qty = item.quantity ? ` (${item.quantity} ${sanitizeInput(item.unit, 20) || 'unit(s)'})` : '';
        return `${name}${qty}`;
    };

    const sanitizedPantry = (Array.isArray(pantryItems) ? pantryItems : [])
        .slice(0, 100)
        .map(formatPantryItem)
        .filter(Boolean);

    // Create cache key based on input hash (skip for regenerations)
    let cacheKey = null;
    if (!regenerate) {
        const cacheInput = JSON.stringify({
            cuisine: sanitizedCuisine,
            ingredients: [...sanitizedIngredients].sort(),
            dietary: [...sanitizedDietary].sort(),
            pantry: [...sanitizedPantry].sort(),
            cookingTime,
            servings: parseInt(servings) || 4
        });
        const hash = crypto.createHash('sha256').update(cacheInput).digest('hex').slice(0, 16);
        cacheKey = `ai:recipe:${hash}`;

        // Try to get from cache (24h TTL)
        if (redisClient?.isReady) {
            try {
                const cached = await redisClient.get(cacheKey);
                if (cached) {
                    console.log('✓ AI cache hit for recipe generation');
                    return normalizeRecipe(JSON.parse(cached), sanitizedCuisine, servings);
                }
            } catch (err) {
                console.warn('[Cache Warning] Failed to read AI cache:', err.message);
            }
        }
    }

    const systemPrompt = 'You are a professional chef. Return ONLY valid JSON with no markdown or code fences.';

    const userPrompt = `Create a recipe with the following requirements:

<cuisine>${sanitizedCuisine}</cuisine>
<servings>${parseInt(servings) || 4}</servings>
<ingredients>${sanitizedIngredients.length > 0 ? sanitizedIngredients.join(', ') : 'use pantry items'}</ingredients>
${sanitizedPantry.length > 0 ? `<pantry>${sanitizedPantry.join(', ')}</pantry>` : ''}
${sanitizedDietary.length > 0 ? `<dietary_restrictions>${sanitizedDietary.join(', ')}</dietary_restrictions>` : ''}
<cooking_time>${timeGuide[cookingTime] || 'any'}</cooking_time>
${regenerationPrompt}

Include specific quantities in instructions (e.g., "Add 2 cups flour" not "Add flour").

Return this JSON structure with actual values:
{
  "name": "Recipe Name",
  "description": "Brief description",
  "cuisineType": "${sanitizedCuisine}",
  "difficulty": "Easy",
  "prepTime": 15,
  "cookTime": 30,
  "servings": ${parseInt(servings) || 4},
  "ingredients": [{"name": "ingredient", "quantity": 1, "unit": "cup"}],
  "instructions": ["Step 1", "Step 2"],
  "nutrition": {"calories": 400, "protein": 20, "carbs": 45, "fat": 15, "fiber": 5},
  "cookingTips": ["Tip 1", "Tip 2"]
}`;

    try {
        const recipe = await groqChat(systemPrompt, userPrompt);
        const normalized = normalizeRecipe(recipe, cuisine, servings);

        // Cache the response (24h TTL) if not a regeneration
        if (cacheKey && redisClient?.isReady) {
            try {
                await redisClient.setEx(cacheKey, 86400, JSON.stringify(recipe)); // 24 hours
                console.log('✓ AI response cached');
            } catch (err) {
                console.warn('[Cache Warning] Failed to cache AI response:', err.message);
            }
        }

        return normalized;
    } catch (error) {
        console.error('Groq API Error (generateRecipe):', error);
        throw error;
    }
};

export const generatePantrySuggestions = async (pantryItem, expiringitems = []) => {
    const Ingredients = pantryItem.map(item => item.name).join(', ');
    const expiringText = expiringitems.length > 0
        ? `\nPriority ingredients (expiring soon): ${expiringitems.join(', ')}` : '';

    const systemPrompt = 'You are a professional chef. Return ONLY valid JSON. No markdown, no code fences.';
    const userPrompt = `Based on these available ingredients: ${Ingredients}${expiringText}
Suggest 3 creative recipe ideas that use these ingredients.
Return ONLY this JSON object:
{"suggestions": ["Recipe idea 1 (1-2 sentences)", "Recipe idea 2 (1-2 sentences)", "Recipe idea 3 (1-2 sentences)"]}`;

    try {
        const result = await groqChat(systemPrompt, userPrompt);
        return result.suggestions;
    } catch (error) {
        console.error('Groq API Error (generatePantrySuggestions):', error);
        throw error;
    }
};

export const generateCookingTips = async (recipe) => {
    const systemPrompt = 'You are a professional chef. Return ONLY valid JSON. No markdown, no code fences.';
    const userPrompt = `For this recipe: "${recipe.name}"
Ingredients: ${recipe.ingredients?.map(i => i.name).join(', ') || 'N/A'}
Provide 3-5 helpful cooking tips to make this recipe better.
Return ONLY this JSON object:
{"tips": ["Tip 1", "Tip 2", "Tip 3"]}`;

    try {
        const result = await groqChat(systemPrompt, userPrompt);
        return result.tips;
    } catch (error) {
        console.error('Groq API Error (generateCookingTips):', error);
        throw error;
    }
};

export const generateRecipeImage = async (recipeName, description, cuisineType, seed = Math.floor(Math.random() * 100000)) => {
    const prompt = encodeURIComponent(
        `${recipeName}, ${description || ''}. Close-up professional food photography, ` +
        `served on a plate, natural daylight, shallow depth of field, garnished, ` +
        `45-degree angle shot, appetizing, high resolution, no text, no watermark`
    );
    return `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed=${seed}`;
};

export default {
    generateRecipe,
    generatePantrySuggestions,
    generateCookingTips,
    generateRecipeImage
};
