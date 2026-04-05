import { NextRequest, NextResponse } from 'next/server';
import { getQueueItems, addToQueue, removeFromQueue, getDb } from '@/lib/db';

export async function GET() {
  try {
    const items = getQueueItems();
    return NextResponse.json({ queue: items });
  } catch (error) {
    console.error('[API] GET /api/queue error:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidate_id, quantity, notes } = body;
    if (!candidate_id || !quantity) {
      return NextResponse.json({ error: 'candidate_id and quantity are required' }, { status: 400 });
    }

    const db = getDb();
    const fortyEightHoursAgo = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ? AND screened_at > ?').get(candidate_id, fortyEightHoursAgo) as { id: number; is_eligible?: number; rejection_reason?: string | null } | undefined;
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found or is from an old screener run' }, { status: 400 });
    }
    if (candidate.is_eligible === 0) {
      return NextResponse.json({ error: candidate.rejection_reason || 'This contract did not pass screener filters' }, { status: 400 });
    }

    const existing = db.prepare('SELECT id FROM queue WHERE candidate_id = ? AND status = ?').get(candidate_id, 'PENDING');
    if (existing) {
      return NextResponse.json({ error: 'Candidate is already in the queue' }, { status: 400 });
    }

    const item = addToQueue(candidate_id, quantity, notes);
    return NextResponse.json({ queue_item: item }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/queue error:', error);
    return NextResponse.json({ error: 'Failed to add to queue' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const removed = removeFromQueue(parseInt(id));
    if (!removed) return NextResponse.json({ error: 'Queue item not found or not pending' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /api/queue error:', error);
    return NextResponse.json({ error: 'Failed to remove queue item' }, { status: 500 });
  }
}
