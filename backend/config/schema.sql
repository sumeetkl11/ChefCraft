-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    avatar_url TEXT,
    google_id VARCHAR(255),
    github_id VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'local',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL;

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, 
    dietary_restrictions TEXT[] DEFAULT '{}',
    allergens TEXT[] DEFAULT '{}',
    preference_cuisine TEXT[] DEFAULT '{}',
    default_servings INT DEFAULT 4,
    measurement_unit VARCHAR(20) DEFAULT 'metric',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Pantry item table
CREATE TABLE IF NOT EXISTS pantry_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    -- ingredient_name VARCHAR(255) NOT NULL,
    quantity INT,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    expiry_date DATE,
    is_running_low BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- UNIQUE(user_id, ingredient_name)
);

-- Recipe table
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cuisine_type VARCHAR(100),
    difficulty VARCHAR(20) DEFAULT 'MEDIUM',
    -- instructions TEXT NOT NULL,
    prep_time INT,
    cook_time INT,
    servings INT DEFAULT 4,
    instructions JSONB NOT NULL,
    dietary_tags TEXT[] DEFAULT '{}',
    user_notes TEXT,
    image_url TEXT,
    -- difficulty VARCHAR(50),
    -- cuisine VARCHAR(100),
    -- category VARCHAR(100),
    -- tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- UNIQUE(user_id, name)
);

-- Recipe ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity INT,
    unit VARCHAR(50) NOT NULL,
    -- category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- UNIQUE(recipe_id, ingredient_name)
);

-- Recipe Nutrition table
CREATE TABLE IF NOT EXISTS recipe_nutrition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    calories INT,
    protein INT,
    carbs INT,
    fat INT,
    fiber INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id)
);

-- Meal plan table
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_type VARCHAR(50) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
    meal_data DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, recipe_id, meal_type, meal_date)
);

-- Shopping list items table
CREATE TABLE IF NOT EXISTS shopping_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    -- recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    is_checked BOOLEAN DEFAULT FALSE,
    from_meal_plan BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- UNIQUE(user_id, ingredient_name)
);

-- Social Feature Tables

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'friends')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'challenge', 'message')),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(participant_1_id, participant_2_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collection items table
CREATE TABLE IF NOT EXISTS collection_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Challenge entries table
CREATE TABLE IF NOT EXISTS challenge_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    notes TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(challenge_id, user_id)
);

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    followee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, followee_id)
);

-- User profile table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);


-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pantry_user_id ON pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_category ON pantry_items(category);
CREATE INDEX IF NOT EXISTS idx_pantry_expiry ON pantry_items(expiry_date);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine_type);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, meal_date);

CREATE INDEX IF NOT EXISTS idx_shopping_list_user ON shopping_list_items(user_id);

-- Social feature indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1_id, participant_2_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_visibility ON collections(visibility);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_recipe_id ON collection_items(recipe_id);

CREATE INDEX IF NOT EXISTS idx_challenges_start_end_date ON challenges(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_challenge_entries_challenge_id ON challenge_entries(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_user_id ON challenge_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id ON follows(followee_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pantry_items_updated_at BEFORE UPDATE ON pantry_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_list_items_updated_at BEFORE UPDATE ON shopping_list_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for social feature tables
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenge_entries_updated_at BEFORE UPDATE ON challenge_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();