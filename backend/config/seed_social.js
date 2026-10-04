// backend/config/seed_social.js
import { pool } from './db.js';

async function seedSocial() {
  console.log('🌱 Starting Social Seed...');

  const usersResult = await pool.query('SELECT id, name, email FROM users ORDER BY created_at ASC');
  const users = usersResult.rows;

  if (users.length === 0) {
    console.error('❌ No users found in database. Create a user first.');
    process.exit(1);
  }

  const recipesResult = await pool.query('SELECT id, name, description, image_url FROM recipes ORDER BY created_at DESC LIMIT 5');
  const recipes = recipesResult.rows;

  const existingPosts = await pool.query('SELECT COUNT(*) as count FROM posts');
  if (parseInt(existingPosts.rows[0].count, 10) > 0) {
    console.log(`ℹ️ Posts already exist in database (${existingPosts.rows[0].count} posts). Skipping seed.`);
    process.exit(0);
  }

  const user1 = users[0];
  const user2 = users.length > 1 ? users[1] : users[0];

  const samplePosts = [
    {
      user_id: user1.id,
      recipe_id: recipes[0]?.id || null,
      content: 'Just perfected this Sunrise Shakshuka Skillet! The runny yolks with cumin-spiced tomato sauce and fresh herbs came out incredible. Perfect Sunday brunch! 🍳🍅✨',
      image_url: recipes[0]?.image_url || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80'
    },
    {
      user_id: user2.id,
      recipe_id: recipes[1]?.id || null,
      content: 'Healthy dinner prep done right: Coconut Lime Chicken Bowls with crispy roasted veggies. Refreshing, aromatic, and ready in 25 minutes! 🥥🍋🥑',
      image_url: recipes[1]?.image_url || 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80'
    },
    {
      user_id: user1.id,
      recipe_id: recipes[2]?.id || null,
      content: 'Homemade Roasted Tomato Basil Rigatoni tonight. Slow-roasted Roma tomatoes make the richest sauce ever. Who wants a plate? 🍝🌿',
      image_url: recipes[2]?.image_url || 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80'
    },
    {
      user_id: user2.id,
      recipe_id: recipes[3]?.id || null,
      content: 'Maple Harissa Salmon Traybake on a busy weeknight. Sweet, spicy, and the salmon flakes like butter. One tray, minimal cleanup! 🐟🍁🔥',
      image_url: recipes[3]?.image_url || 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80'
    }
  ];

  for (const post of samplePosts) {
    const postRes = await pool.query(
      `INSERT INTO posts (user_id, recipe_id, content, image_url, visibility)
       VALUES ($1, $2, $3, $4, 'public')
       RETURNING id`,
      [post.user_id, post.recipe_id, post.content, post.image_url]
    );

    const postId = postRes.rows[0].id;

    // Add a like from user2 or user1
    await pool.query(
      `INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, user2.id]
    );

    // Add a friendly comment
    await pool.query(
      `INSERT INTO comments (post_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [postId, user2.id, 'Looks absolutely delicious! Saving this to my collection. 😋']
    );
  }

  console.log(`✅ Successfully seeded ${samplePosts.length} social feed posts with likes & comments!`);
  process.exit(0);
}

seedSocial().catch((err) => {
  console.error('❌ Social seed error:', err);
  process.exit(1);
});
