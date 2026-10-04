// backend/models/social/Follow.js
import { pool } from '../../config/db.js';

class Follow {
  static schemaCache = {
    followingColumn: 'followee_id'
  };

  static async getSchemaConfig() {
    return Follow.schemaCache;
  }

  static async create({ followerId, followingId }) {
    const schema = await Follow.getSchemaConfig();

    const result = await pool.query(
      `INSERT INTO follows (follower_id, ${schema.followingColumn})
       VALUES ($1, $2)
       RETURNING id, follower_id, ${schema.followingColumn} AS following_id, created_at`,
      [followerId, followingId]
    );

    return result.rows[0];
  }

  static async delete({ followerId, followingId }) {
    const schema = await Follow.getSchemaConfig();

    const result = await pool.query(
      `DELETE FROM follows
       WHERE follower_id = $1 AND ${schema.followingColumn} = $2`,
      [followerId, followingId]
    );

    return result.rowCount > 0;
  }

  static async exists({ followerId, followingId }) {
    const schema = await Follow.getSchemaConfig();

    const result = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM follows
        WHERE follower_id = $1 AND ${schema.followingColumn} = $2
      ) AS exists`,
      [followerId, followingId]
    );

    return Boolean(result.rows[0]?.exists);
  }

  static async getFollowers(userId, limit = 20, offset = 0) {
    const schema = await Follow.getSchemaConfig();

    const result = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.avatar_url,
        u.bio,
        f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.${schema.followingColumn} = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  static async getFollowing(userId, limit = 20, offset = 0) {
    const schema = await Follow.getSchemaConfig();

    const result = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.avatar_url,
        u.bio,
        f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.${schema.followingColumn}
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }
}

export default Follow;
