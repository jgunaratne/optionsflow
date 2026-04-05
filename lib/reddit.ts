/**
 * reddit.ts
 * Reddit API client for OptionsFlow — app-only OAuth (no user login required).
 * Adapted from juni-reddit/src/lib/reddit.js
 */

// --- Types ---

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  numComments: number;
  selftext: string;
  url: string;
  permalink: string;
  createdUtc: number;
  thumbnail: string | null;
  isSelf: boolean;
  domain: string;
  linkFlairText: string | null;
  subreddit: string;
}

interface RedditApiPostData {
  name?: string;
  title?: string;
  author?: string;
  score?: number;
  num_comments?: number;
  selftext?: string;
  url?: string;
  permalink?: string;
  created_utc?: number;
  thumbnail?: string;
  is_self?: boolean;
  domain?: string;
  link_flair_text?: string | null;
}

interface RedditApiListingResponse {
  data?: {
    children?: Array<{
      data?: RedditApiPostData;
    }>;
  };
}

export const DEFAULT_STOCK_SUBREDDITS = [
  'options',
  'thetagang',
  'wallstreetbets',
  'stocks',
  'options_trading',
];

// --- App-Only OAuth Token Cache ---

const USER_AGENT = 'optionsflow/1.0';

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get an app-only OAuth token using client credentials grant.
 * Caches token in memory with ~55 minute TTL (Reddit tokens last 1 hour).
 */
export async function getAppOnlyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set in environment variables');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Reddit] OAuth error ${response.status}:`, body);
    throw new Error(`Reddit OAuth error: ${response.status}`);
  }

  const data = await response.json();

  // Cache with 55-minute TTL (tokens last 3600s, refresh 5 minutes early)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return cachedToken.token;
}

// --- Reddit API Helpers ---

/**
 * Make an authenticated GET request to the Reddit OAuth API.
 */
async function fetchReddit(endpoint: string, token: string): Promise<RedditApiListingResponse> {
  const url = `https://oauth.reddit.com${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Reddit] API error ${response.status} on ${endpoint}:`, body);
    throw new Error(`Reddit API error: ${response.status}`);
  }

  return response.json() as Promise<RedditApiListingResponse>;
}

/**
 * Fetch hot posts for a specific subreddit.
 */
export async function getHotPosts(
  subreddit: string,
  token: string,
  limit = 50,
): Promise<RedditPost[]> {
  try {
    const data = await fetchReddit(`/r/${subreddit}/hot?limit=${limit}`, token);

    const posts: RedditPost[] = (data?.data?.children || []).map((child) => {
      const p = child.data ?? {};
      return {
        id: p.name ?? '',
        title: p.title ?? '',
        author: p.author ?? '[deleted]',
        score: p.score ?? 0,
        numComments: p.num_comments ?? 0,
        selftext: p.selftext || '',
        url: p.url ?? '',
        permalink: p.permalink ? `https://www.reddit.com${p.permalink}` : '',
        createdUtc: p.created_utc ?? 0,
        thumbnail:
          p.thumbnail && p.thumbnail.startsWith('http')
            ? p.thumbnail.replace(/&amp;/g, '&')
            : null,
        isSelf: Boolean(p.is_self),
        domain: p.domain ?? '',
        linkFlairText: p.link_flair_text || null,
        subreddit: subreddit,
      };
    }).filter((post) => Boolean(post.id && post.title));

    return posts;
  } catch (err) {
    console.error(`[Reddit] Failed to fetch posts for r/${subreddit}:`, err);
    throw err;
  }
}

/**
 * Fetch hot posts from multiple subreddits in parallel.
 */
export async function getHotPostsMulti(
  subreddits: string[],
  token: string,
  limitPerSub = 50,
): Promise<RedditPost[]> {
  const results = await Promise.allSettled(
    subreddits.map((sub) => getHotPosts(sub, token, limitPerSub)),
  );

  const allPosts: RedditPost[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allPosts.push(...result.value);
    } else {
      console.error('[Reddit] Failed to fetch from subreddit:', result.reason);
    }
  }

  return allPosts;
}
