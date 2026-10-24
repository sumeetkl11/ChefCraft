// Ingredient Image Mapping for Pantry Items
// Dynamically imports local WebP images from src/assets/images/pantry-images

const localImages = import.meta.glob('../assets/images/pantry-images/*.webp', { eager: true, import: 'default' });

export const INGREDIENT_IMAGES = {};

Object.entries(localImages).forEach(([filePath, url]) => {
  const fileName = filePath.split('/').pop().replace(/\.(webp|jpg|jpeg|png)$/i, '');
  const key = fileName.replace(/_/g, ' ').toLowerCase().trim();
  INGREDIENT_IMAGES[key] = url;

  // Common plurals
  if (key === 'tomato') INGREDIENT_IMAGES['tomatoes'] = url;
  if (key === 'potato') INGREDIENT_IMAGES['potatoes'] = url;
  if (key === 'onion') INGREDIENT_IMAGES['onions'] = url;
  if (key === 'carrot') INGREDIENT_IMAGES['carrots'] = url;
  if (key === 'mushroom') INGREDIENT_IMAGES['mushrooms'] = url;
});

// Category fallback images using available local images
export const CATEGORY_FALLBACKS = {
  'Vegetables': INGREDIENT_IMAGES['spinach'] || INGREDIENT_IMAGES['tomato'],
  'Fruits': INGREDIENT_IMAGES['pineapple'] || INGREDIENT_IMAGES['pomegranate'],
  'Dairy': INGREDIENT_IMAGES['milk'] || INGREDIENT_IMAGES['yogurt'],
  'Proteins': INGREDIENT_IMAGES['beef'] || INGREDIENT_IMAGES['shrimp'],
  'Grains': INGREDIENT_IMAGES['flour'] || INGREDIENT_IMAGES['cereal'],
  'Spices': INGREDIENT_IMAGES['basil'] || INGREDIENT_IMAGES['olive oil'],
  'Other': INGREDIENT_IMAGES['olive oil']
};

// Default fallback if nothing matches
export const DEFAULT_FALLBACK = CATEGORY_FALLBACKS['Other'];
