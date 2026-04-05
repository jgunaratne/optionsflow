import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAppOnlyToken, getHotPostsMulti, DEFAULT_STOCK_SUBREDDITS } from '@/lib/reddit';
import type { RedditPost } from '@/lib/reddit';
import { getCachedRedditPosts, cacheRedditPosts, getCachedRedditAnalysis, cacheRedditAnalysis } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

function stripJsonFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

function buildPrompt(posts: RedditPost[]): string {
  const postBlock = posts
    .slice(0, 100) // Cap at 100 posts to stay within token limits
    .map((p, i) => {
      const text = p.selftext ? p.selftext.slice(0, 200) : '';
      return `[${i + 1}] r/${p.subreddit} | Score: ${p.score} | Comments: ${p.numComments}\nTitle: ${p.title}\n${text ? `Text: ${text}` : ''}`;
    })
    .join('\n\n');

  return `You are a financial analyst specializing in options trading. Analyze these Reddit posts from stock/options trading communities and extract actionable intelligence.

Posts from Reddit:
${postBlock}

Analyze ALL posts and return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "tickers": [
    {
      "symbol": "AAPL",
      "mentions": 5,
      "sentiment": "bullish",
      "avgScore": 342,
      "tradeIdeas": ["AAPL 200C 5/16", "selling CSPs at 180"],
      "strategies": ["covered call", "CSP"],
      "topPosts": [
        { "title": "Post title here", "permalink": "https://reddit.com/...", "score": 500 }
      ]
    }
  ],
  "summary": "2-3 sentence overview of what Reddit's stock/options communities are most excited or concerned about right now."
}

Rules:
- Extract ALL ticker symbols mentioned (format: uppercase, no $). Include ETFs like SPY, QQQ.
- "sentiment" must be exactly one of: "bullish", "bearish", "neutral"
- "tradeIdeas" should capture specific options plays (strikes, expirations, strategies)
- "strategies" should identify options strategies: "CSP", "covered call", "wheel", "spread", "strangle", "straddle", "iron condor", "LEAPS", "naked put", "naked call", "debit spread", "credit spread"
- Sort tickers by mention count descending
- Only include tickers with at least 1 real mention (don't hallucinate tickers)
- avgScore is the average upvote score of posts mentioning this ticker
- topPosts: include up to 3 most upvoted posts per ticker
- "summary" should focus on overall market sentiment, trending tickers, and notable trade ideas`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const subreddits: string[] = body.subreddits || DEFAULT_STOCK_SUBREDDITS;

    // Check analysis cache first (30-minute TTL)
    const cachedAnalysis = getCachedRedditAnalysis(subreddits, 30);
    if (cachedAnalysis) {
      return NextResponse.json({
        ...cachedAnalysis,
        source: 'cache',
      });
    }

    // Get posts (from post cache or fresh)
    let posts = getCachedRedditPosts(subreddits, 15);
    if (posts.length === 0) {
      const token = await getAppOnlyToken();
      posts = await getHotPostsMulti(subreddits, token, 50);
      if (posts.length > 0) {
        cacheRedditPosts(posts);
      }
    }

    if (posts.length === 0) {
      return NextResponse.json({
        tickers: [],
        summary: 'No posts found from the selected subreddits.',
        analyzedAt: new Date().toISOString(),
        postCount: 0,
        subreddits,
        source: 'live',
      });
    }

    // Run Gemini analysis
    const prompt = buildPrompt(posts);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(stripJsonFences(text));

    // Validate structure
    const analysis = {
      tickers: Array.isArray(parsed.tickers) ? parsed.tickers : [],
      summary: parsed.summary || 'Analysis complete.',
    };

    // Cache the analysis
    cacheRedditAnalysis(subreddits, JSON.stringify(analysis), posts.length);

    return NextResponse.json({
      ...analysis,
      analyzedAt: new Date().toISOString(),
      postCount: posts.length,
      subreddits,
      source: 'live',
    });
  } catch (error: any) {
    console.error('[API] /api/reddit/analyze error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze Reddit posts' },
      { status: 500 },
    );
  }
}
