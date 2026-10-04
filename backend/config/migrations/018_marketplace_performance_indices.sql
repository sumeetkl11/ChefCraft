-- 018_marketplace_performance_indices.sql
-- Optimizes query performance for marketplace catalog, purchases, wishlists, and reviews

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status_created ON marketplace_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);

CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_seller ON purchases(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_item ON purchases(item_id);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product ON wishlist_items(product_id);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

ANALYZE marketplace_listings;
ANALYZE purchases;
ANALYZE wishlists;
ANALYZE wishlist_items;
ANALYZE reviews;
