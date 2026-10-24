import { startTransition, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { RefreshCcw, Sparkles } from 'lucide-react';
import api, { buildApiUrl } from '../services/api';
import { getSocket } from '../services/socket';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import useRevalidateOnFocus from '../hooks/useRevalidateOnFocus';

const FEED_CACHE_KEY = 'social_feed_cache_v1';

export default function SocialFeed() {
  const [posts, setPosts] = useState(() => {
    try {
      const cached = sessionStorage.getItem(FEED_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(posts.length === 0);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasPostsRef = useRef(posts.length > 0);
  const deferredPosts = useDeferredValue(posts);
  const visiblePosts = deferredPosts;

  useEffect(() => {
    hasPostsRef.current = posts.length > 0;
  }, [posts.length]);

  const fetchFeed = useCallback(async (targetPage = 1, replace = false) => {
    try {
      if (targetPage === 1 && replace) {
        setRefreshing(true);
      } else if (targetPage === 1 && hasPostsRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(`/posts?page=${targetPage}&limit=10`);
      const result = response.data;

      if (!result.success) {
        setError('Failed to load feed');
        return;
      }

      const nextPosts = Array.isArray(result.data) ? result.data : [];

      startTransition(() => {
        setPosts((current) => {
          if (targetPage === 1 || replace) {
            return nextPosts;
          }

          const existingIds = new Set(current.map((post) => post.id));
          const uniquePosts = nextPosts.filter((post) => !existingIds.has(post.id));
          return [...current, ...uniquePosts];
        });
      });
      setHasMore(nextPosts.length === 10);
      setError(null);
    } catch (err) {
      setError('Error loading feed');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (posts.length > 0) {
      try {
        // Strip large base64 image data before caching to prevent QuotaExceededError
        const sanitized = posts.slice(0, 10).map((post) => {
          if (post?.image_url && typeof post.image_url === 'string' && post.image_url.startsWith('data:') && post.image_url.length > 2000) {
            const { image_url, ...rest } = post;
            return rest;
          }
          return post;
        });
        sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(sanitized));
      } catch (err) {
        try {
          sessionStorage.removeItem(FEED_CACHE_KEY);
        } catch (_) {}
      }
    }
  }, [posts]);

  useEffect(() => {
    fetchFeed(page, false);
  }, [page, fetchFeed]);

  useRevalidateOnFocus(() => fetchFeed(1, true), { intervalMs: 25000, runOnMount: false });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return undefined;
    }

    const handlePostCreated = (post) => {
      startTransition(() => {
        setPosts((current) => {
          if (current.some((item) => item.id === post.id)) {
            return current;
          }
          return [post, ...current];
        });
      });
    };

    const handlePostDeleted = ({ postId }) => {
      startTransition(() => {
        setPosts((current) => current.filter((post) => post.id !== postId));
      });
    };

    const handleLikeUpdated = ({ postId, likeCount }) => {
      startTransition(() => {
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? { ...post, like_count: typeof likeCount === 'number' ? likeCount : post.like_count }
              : post
          )
        );
      });
    };

    const handleCommentCreated = ({ postId, commentCount }) => {
      startTransition(() => {
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? { ...post, comment_count: typeof commentCount === 'number' ? commentCount : (post.comment_count || 0) + 1 }
              : post
          )
        );
      });
    };

    const handleCommentDeleted = ({ postId, commentCount }) => {
      startTransition(() => {
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? { ...post, comment_count: typeof commentCount === 'number' ? commentCount : Math.max(0, (post.comment_count || 0) - 1) }
              : post
          )
        );
      });
    };

    socket.on('feed:post_created', handlePostCreated);
    socket.on('feed:post_deleted', handlePostDeleted);
    socket.on('feed:like_updated', handleLikeUpdated);
    socket.on('feed:comment_created', handleCommentCreated);
    socket.on('feed:comment_deleted', handleCommentDeleted);

    return () => {
      socket.off('feed:post_created', handlePostCreated);
      socket.off('feed:post_deleted', handlePostDeleted);
      socket.off('feed:like_updated', handleLikeUpdated);
      socket.off('feed:comment_created', handleCommentCreated);
      socket.off('feed:comment_deleted', handleCommentDeleted);
    };
  }, []);

  const handlePostCreated = useCallback((newPost) => {
    startTransition(() => {
      setPosts((current) => [newPost, ...current.filter((post) => post.id !== newPost.id)]);
    });
  }, []);

  const handlePostDeleted = useCallback((postId) => {
    startTransition(() => {
      setPosts((current) => current.filter((post) => post.id !== postId));
    });
  }, []);

  const handlePostUpdated = useCallback((updatedPost) => {
    startTransition(() => {
      setPosts((current) => current.map((post) => (post.id === updatedPost.id ? { ...post, ...updatedPost } : post)));
    });
  }, []);

  if (loading && page === 1 && visiblePosts.length === 0) {
    return (
      <div className="grid gap-4">
        <div className="glass-panel loading-skeleton h-32 rounded-[30px]" />
        <div className="glass-card loading-skeleton h-[60vh] rounded-[30px]" />
      </div>
    );
  }

  if (error && page === 1) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="mb-4 text-sm font-semibold text-rose-500">{error}</p>
        <button
          className="cta-button"
          onClick={() => fetchFeed(1, true)}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="glass-card flex flex-col overflow-visible p-0">
        <div className="page-hero flex shrink-0 items-center justify-between gap-4 border-b border-white/8 p-4 sm:px-6">
          <div>
            <div className="eyebrow mb-3">
              <Sparkles className="h-4 w-4" />
              Editorial Feed
            </div>
            <h2 className="font-display text-2xl text-slate-950">Feed</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{posts.length} posts</p>
          </div>
          <CreatePost onPostCreated={handlePostCreated} />
        </div>

        <div className="bg-white/40 px-3 py-5 sm:px-5">
          {visiblePosts.length === 0 ? (
            <div className="mx-auto max-w-[560px] rounded-[28px] border border-white/8 bg-white/70 p-12 text-center text-slate-600">
              No posts yet. Share your first recipe.
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[560px] space-y-5">
              {visiblePosts.map((post, index) => (
                <PostCard
                  key={post.id}
                  post={post}
                  priority={index < 2}
                  onDeleted={handlePostDeleted}
                  onUpdated={handlePostUpdated}
                />
              ))}
            </div>
          )}

          <div className="mx-auto mt-5 flex w-full max-w-[560px] flex-wrap gap-3 pb-2">
            <button
              className="secondary-button"
              onClick={() => fetchFeed(1, true)}
              disabled={refreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh feed
            </button>

            {hasMore && (
              <button
                className="cta-button"
                onClick={() => setPage((current) => current + 1)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Posts'}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
