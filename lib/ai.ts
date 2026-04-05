import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

interface AIAnalysis {
  score: number;
  flag: 'GREEN' | 'YELLOW' | 'RED';
  brief: string;
  risks: string[];
}

interface CandidateInput {
  symbol: string;
  underlying_price: number;
  strategy: string;
  strike: number;
  expiry: string;
  dte: number;
  premium: number;
  max_loss: number;
  pop: number;
  iv_rank: number;
  delta: number;
}

interface NewsItem {
  title: string;
  snippet: string;
}

function stripJsonFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

export async function analyzeCandidate(candidate: CandidateInput, news: NewsItem[]): Promise<AIAnalysis> {
  const newsText = news.length > 0
    ? news.map(n => `- ${n.title}: ${n.snippet}`).join('\n')
    : '- No recent news found';

  const prompt = `You are an options trading risk analyst. Analyze this options trade and return a JSON object only.

Trade details:
- Symbol: ${candidate.symbol}
- Current price: $${candidate.underlying_price}
- Strategy: ${candidate.strategy} (sell ${candidate.strike} put expiring ${candidate.expiry}, ${candidate.dte} DTE)
- Premium: $${candidate.premium}/share ($${(candidate.premium * 100).toFixed(0)}/contract)
- Max loss: $${candidate.max_loss}/contract
- Probability of profit: ${(candidate.pop * 100).toFixed(1)}%
- IV Rank: ${candidate.iv_rank.toFixed(1)}
- Delta: ${candidate.delta}

Recent news headlines:
${newsText}

Return ONLY a valid JSON object with these exact fields:
{
  "score": <number 0-100, higher = better trade>,
  "flag": "<GREEN | YELLOW | RED>",
  "brief": "<2-3 sentence plain English explanation of the trade and key risks>",
  "risks": ["<risk factor 1>", "<risk factor 2>"]
}

Flag rules:
- GREEN: Clean setup, no major risk factors
- YELLOW: Tradeable but watch closely (mild news risk, borderline IV rank, etc.)
- RED: Avoid (earnings in window, major negative news, extreme sector risk)

Score heavily penalizes: earnings in DTE window, negative news catalyst, VIX > 30, sector concentration risk.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(stripJsonFences(text)) as AIAnalysis;
    return {
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      flag: (['GREEN', 'YELLOW', 'RED'].includes(parsed.flag) ? parsed.flag : 'YELLOW') as AIAnalysis['flag'],
      brief: parsed.brief || 'Analysis generated but brief unavailable.',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    };
  } catch (error) {
    console.error('[AI] Analysis failed:', error);
    return { score: 50, flag: 'YELLOW', brief: 'AI analysis temporarily unavailable. Manual review recommended.', risks: ['AI analysis error — review manually'] };
  }
}

interface ChatContext {
  candidates: unknown[];
  queue: unknown[];
  positions: unknown;
  account: unknown;
  chatHistory: { role: string; content: string }[];
}

export async function chatQuery(userMessage: string, context: ChatContext): Promise<string> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const systemPrompt = `You are OptionsFlow, a personal options trading assistant. You have access to the user's current portfolio, trade queue, and screener results. Answer questions about their positions, help them understand trade setups, flag risks, and run what-if scenarios. You cannot execute trades. Be concise and direct. Use dollar amounts and percentages where relevant. Today's date is ${today}.

Current context:
- Top Candidates: ${JSON.stringify(context.candidates.slice(0, 10))}
- Queue: ${JSON.stringify(context.queue)}
- Positions: ${JSON.stringify(context.positions)}
- Account: ${JSON.stringify(context.account)}`;

  const chatHistory = context.chatHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' as const : 'model' as const,
    parts: [{ text: msg.content }],
  }));

  try {
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: 'Initialize with system context.' }] },
        { role: 'model', parts: [{ text: systemPrompt }] },
        ...chatHistory,
      ],
    });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    console.error('[AI] Chat failed:', error);
    return 'I apologize, but I encountered an error processing your request. Please try again.';
  }
}

interface PreExecutionReview {
  approved: boolean;
  warnings: string[];
  blockers: string[];
}

export async function preExecutionReview(
  queue: Array<{ symbol: string; strategy: string; max_loss: number; premium: number; quantity: number; strike: number }>,
  _positions: unknown,
  account: { buyingPower: number; totalValue: number; currentDeployedPct: number }
): Promise<PreExecutionReview> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const totalNewMaxLoss = queue.reduce((sum, item) => sum + item.max_loss * item.quantity, 0);
  const totalDeployedAfter = account.currentDeployedPct + (totalNewMaxLoss / account.totalValue);

  if (totalDeployedAfter > 0.50) {
    blockers.push(`Total deployed capital would be ${(totalDeployedAfter * 100).toFixed(1)}% of account (limit: 50%). Reduce queue to stay under $${(account.totalValue * 0.50).toFixed(0)} total deployed.`);
  }

  for (const item of queue) {
    const positionPct = (item.max_loss * item.quantity) / account.totalValue;
    if (positionPct > 0.05) {
      blockers.push(`${item.symbol} ${item.strategy} position size is ${(positionPct * 100).toFixed(1)}% of account (limit: 5%).`);
    }
  }

  const symbolCounts: Record<string, number> = {};
  for (const item of queue) {
    symbolCounts[item.symbol] = (symbolCounts[item.symbol] || 0) + 1;
  }
  const duplicates = Object.entries(symbolCounts).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate symbols in queue: ${duplicates.map(([s, c]) => `${s} (${c}x)`).join(', ')}.`);
  }

  const techSymbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN'];
  const techInQueue = queue.filter(item => techSymbols.includes(item.symbol));
  if (techInQueue.length >= 3) {
    warnings.push(`High tech sector concentration: ${techInQueue.map(i => i.symbol).join(', ')} are all tech stocks.`);
  }

  return { approved: blockers.length === 0, warnings, blockers };
}
