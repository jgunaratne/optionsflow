import { NextRequest, NextResponse } from 'next/server';
import { chatQuery } from '@/lib/ai';
import { getCandidates, getQueueItems, getChatHistory, addChatMessage } from '@/lib/db';
import { getBroker } from '@/lib/broker-factory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    addChatMessage('user', message);

    let positions: unknown = null;
    let account: unknown = null;
    try {
      const broker = getBroker();
      const accountData = await broker.getAccountDetails();
      positions = accountData.positions || [];
      account = accountData.balances || {};
    } catch { positions = []; account = {}; }

    const candidates = getCandidates();
    const queue = getQueueItems();
    const chatHistory = getChatHistory(10).reverse();

    const response = await chatQuery(message, {
      candidates: candidates.slice(0, 10), queue, positions, account,
      chatHistory: chatHistory.map(m => ({ role: m.role, content: m.content })),
    });

    addChatMessage('assistant', response);
    return NextResponse.json({ response });
  } catch (error) {
    console.error('[API] POST /api/ai/chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
