// backend/controllers/social/postController.js
import Post from '../../models/social/Post.js';
import Comment from '../../models/social/Comment.js';
import Notification from '../../models/social/Notification.js';
import { pool } from '../../config/db.js';
import { emitNotification } from '../../sockets/socialSocket.js';
import cache from '../../services/cacheService.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Get feed posts (paginated)
 * @route GET /api/posts
 */
export const getFeedPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const userId = req.user?.id || null;

    let posts = [];
    let total = 0;

    try {
      posts = await Post.getFeed(userId, limit, offset);
      const totalResult = await pool.query(`SELECT COUNT(*) as count FROM posts`);
      total = parseInt(totalResult.rows[0]?.count || 0, 10);
    } catch (dbError) {
      console.warn('[Feed Posts] Direct fetch failed, returning empty set:', dbError.message);
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({
      success: true,
      data: posts,
      pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    });
  } catch (error) {
    console.error('Error fetching feed posts:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch posts'
    });
  }
};

/**
 * Create a new post
 * @route POST /api/posts
 */
export const createPost = async (req, res, next) => {
  try {
    const { recipeId, caption, imageUrl } = req.body;
    const userId = req.user.id;

    if (!recipeId && !imageUrl && !caption?.trim()) {
      throw ApiError.badRequest('A recipe, image, or caption is required');
    }

    const createdPost = await Post.create({
      userId,
      recipeId,
      caption,
      imageUrl
    });

    const post = await Post.findById(createdPost.id);

    // Invalidate feed caches
    await cache.invalidateFeeds();
    await cache.invalidateUser(userId);

    req.io?.emit('feed:post_created', post);

    res.status(201).json({ success: true, message: 'Post created successfully', data: post });
  } catch (error) {
    console.error('Error creating post:', error);
    next(error instanceof ApiError ? error : ApiError.internal('Failed to create post'));
  }
};

/**
 * Get single post by ID
 * @route GET /api/posts/:id
 */
export const getPost = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Cache individual post with counts
    const cacheKey = cache.CACHE_KEYS.POST(id);
    
    const enrichedPost = await cache.getOrSet(
      cacheKey,
      async () => {
        const post = await Post.findById(id);
        if (!post) {
          throw ApiError.notFound('Post not found');
        }

        // Get likes and comments
        const likes = await pool.query(
          `SELECT COUNT(*) as count FROM likes WHERE post_id = $1`,
          [id]
        );
        const comments = await pool.query(
          `SELECT COUNT(*) as count FROM comments WHERE post_id = $1`,
          [id]
        );

        return {
          ...post,
          like_count: parseInt(likes.rows[0].count, 10),
          comment_count: parseInt(comments.rows[0].count, 10)
        };
      },
      cache.TTL_CONFIG.POST
    );

    res.json({ success: true, data: enrichedPost });
  } catch (error) {
    console.error('Error getting post:', error);
    next(error instanceof ApiError ? error : ApiError.internal('Failed to fetch post'));
  }
};

/**
 * Delete a post (owner only)
 * @route DELETE /api/posts/:id
 */
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check ownership
    const post = await pool.query(
      `SELECT user_id FROM posts WHERE id = $1`,
      [id]
    );

    if (post.rows.length === 0) {
      throw ApiError.notFound('Post not found');
    }

    if (post.rows[0].user_id !== userId) {
      throw ApiError.forbidden('You can only delete your own posts');
    }

    await Post.delete(id);

    // Invalidate caches
    await cache.invalidatePost(id);
    await cache.invalidateFeeds();
    await cache.invalidateUser(userId);

    req.io?.emit('feed:post_deleted', { postId: id });

    res.json({
      success: true,
      message: 'Post deleted successfully',
      data: { id }
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    next(error instanceof ApiError ? error : ApiError.internal('Failed to delete post'));
  }
};

/**
 * Get comments on a post (paginated)
 * @route GET /api/posts/:id/comments
 */
export const getPostComments = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const comments = await Comment.findByPostId(id, limit, offset);
    const totalResult = await pool.query(
      `SELECT COUNT(*) as count FROM comments WHERE post_id = $1`,
      [id]
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    res.json({
      success: true,
      data: comments,
      meta: { page, limit, total }
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  }
};

/**
 * Add comment to a post
 * @route POST /api/posts/:id/comments
 */
export const createComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    // Verify post exists
    const postExists = await pool.query(
      `SELECT id, user_id FROM posts WHERE id = $1`,
      [id]
    );

    if (postExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const createdComment = await Comment.create({
      postId: id,
      userId,
      content
    });

    const comment = await Comment.findById(createdComment.id);

    // Increment comment count
    await Post.incrementCommentCount(id);
    const post = await Post.findById(id);

    // Create notification for post owner (if not own post)
    const postOwnerId = postExists.rows[0].user_id;
    if (postOwnerId !== userId) {
      try {
        const notification = await Notification.create({
          userId: postOwnerId,
          actorId: userId,
          type: 'comment',
          postId: id,
          commentId: comment.id
        });

        const notificationPayload = await Notification.findById(notification.id);
        if (notificationPayload) {
          emitNotification(req.io, postOwnerId, notificationPayload);
        }
      } catch (notificationError) {
        console.error('Error creating comment notification:', notificationError);
      }
    }

    req.io?.emit('feed:comment_created', {
      postId: id,
      comment,
      commentCount: post?.comment_count ?? undefined
    });

    res.status(201).json({
      success: true,
      data: {
        comment,
        comment_count: post?.comment_count ?? 0
      },
      meta: { page: 1, limit: 1, total: 1 }
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create comment'
    });
  }
};

/**
 * Delete a comment (owner only)
 * @route DELETE /api/comments/:id
 */
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check ownership
    const commentResult = await pool.query(
      `SELECT user_id, post_id FROM comments WHERE id = $1`,
      [id]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const { user_id: commentOwnerId, post_id: postId } = commentResult.rows[0];

    if (commentOwnerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments'
      });
    }

    await Comment.delete(id);
    await Post.decrementCommentCount(postId);
    const post = await Post.findById(postId);

    req.io?.emit('feed:comment_deleted', {
      postId,
      commentId: id,
      commentCount: post?.comment_count ?? undefined
    });

    res.json({
      success: true,
      data: {
        id,
        postId,
        comment_count: post?.comment_count ?? 0
      },
      meta: { page: 1, limit: 1, total: 1 }
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
};
