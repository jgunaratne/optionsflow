import { NextResponse } from 'next/server';
import { getAppOnlyToken, getHotPostsMulti, DEFAULT_STOCK_SUBREDDITS } from '@/lib/reddit';
import { getCachedRedditPosts, cacheRedditPosts } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subsParam = searchParams.get('subreddits');
    const subreddits = subsParam
      ? subsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_STOCK_SUBREDDITS;

    // Check cache first (15-minute TTL)
    const cached = getCachedRedditPosts(subreddits, 15);
    if (cached.length > 0) {
      return NextResponse.json({
        posts: cached,
        cachedAt: new Date().toISOString(),
        source: 'cache',
      });
    }

    // Fetch fresh from Reddit
    const token = await getAppOnlyToken();
    const posts = await getHotPostsMulti(subreddits, token, 50);

    // Cache results
    if (posts.length > 0) {
      cacheRedditPosts(posts);
    }

    return NextResponse.json({
      posts,
      cachedAt: new Date().toISOString(),
      source: 'live',
    });
  } catch (error: unknown) {
    console.error('[API] /api/reddit/posts error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Reddit posts' },
      { status: 500 },
    );
  }
}
