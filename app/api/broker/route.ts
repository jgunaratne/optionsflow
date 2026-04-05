import { NextRequest, NextResponse } from 'next/server';
import { getActiveBrokerName, setActiveBroker, getSupportedBrokers, type BrokerName } from '@/lib/broker-factory';

export async function GET() {
  try {
    const active = getActiveBrokerName();
    const supported = getSupportedBrokers();
    return NextResponse.json({ active, supported });
  } catch (error) {
    console.error('[API] GET /api/broker error:', error);
    return NextResponse.json({ error: 'Failed to get broker info' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { broker } = body;

    if (!broker || typeof broker !== 'string') {
      return NextResponse.json({ error: 'broker field is required' }, { status: 400 });
    }

    const supported = getSupportedBrokers();
    if (!supported.includes(broker)) {
      return NextResponse.json({ error: `Unsupported broker: ${broker}. Supported: ${supported.join(', ')}` }, { status: 400 });
    }

    setActiveBroker(broker as BrokerName);
    return NextResponse.json({ active: broker, message: `Switched to ${broker}` });
  } catch (error) {
    console.error('[API] PUT /api/broker error:', error);
    return NextResponse.json({ error: 'Failed to switch broker' }, { status: 500 });
  }
}
