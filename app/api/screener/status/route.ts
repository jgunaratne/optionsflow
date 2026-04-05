import { NextResponse } from 'next/server';
import { getScreenerProgress } from '@/lib/screener';

export async function GET() {
  return NextResponse.json(getScreenerProgress());
}
