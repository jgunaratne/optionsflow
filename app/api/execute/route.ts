import { NextResponse } from 'next/server';
import { getQueueItems, updateQueueStatus, addTradeHistory } from '@/lib/db';
import { preExecutionReview } from '@/lib/ai';
import { getBroker, getBrokerName } from '@/lib/broker-factory';

export async function POST() {
  try {
    const broker = getBroker();
    const brokerName = getBrokerName().toLowerCase();
    const queueItems = getQueueItems();
    if (queueItems.length === 0) {
      return NextResponse.json({ error: 'No pending trades in queue' }, { status: 400 });
    }

    const { balances } = await broker.getAccountDetails().catch((err: Error) => {
      if (err.message.includes('Client not authorized') && err.message.includes('401')) {
        throw new Error('Schwab Trader API is not enabled. Cannot execute trades. Add "Trader API" product in the Schwab developer portal.');
      }
      throw err;
    });
    const buyingPower = balances.buyingPower;
    const totalValue = balances.liquidationValue;
    const totalQueueMaxLoss = queueItems.reduce((sum, item) => sum + item.max_loss * item.quantity, 0);
    const currentDeployedPct = totalValue > 0 ? totalQueueMaxLoss / totalValue : 0;

    const review = await preExecutionReview(
      queueItems.map(item => ({ symbol: item.symbol, strategy: item.strategy, max_loss: item.max_loss, premium: item.premium, quantity: item.quantity, strike: item.strike })),
      [], { buyingPower, totalValue, currentDeployedPct }
    );

    if (!review.approved) {
      return NextResponse.json({ approved: false, warnings: review.warnings, blockers: review.blockers });
    }

    const results = [];
    const now = Math.floor(Date.now() / 1000);

    for (const item of queueItems) {
      try {
        updateQueueStatus(item.queue_id, 'EXECUTING');
        const occSymbol = broker.buildOCCSymbol(item.symbol, item.expiry, 'P', item.strike);
        const order = broker.buildCSPOrder(occSymbol, item.quantity, item.premium);

        try { await broker.dryRunOrder(order); } catch (dryRunError) {
          updateQueueStatus(item.queue_id, 'FAILED');
          addTradeHistory({ broker: brokerName, symbol: item.symbol, strategy: item.strategy, broker_order_id: null, strike: item.strike, expiry: item.expiry, quantity: item.quantity, fill_price: null, premium_collected: null, max_loss: item.max_loss, status: 'FAILED', executed_at: now, closed_at: null, close_price: null, realized_pnl: null });
          results.push({ symbol: item.symbol, status: 'FAILED', error: `Dry-run failed: ${dryRunError}` });
          continue;
        }

        const orderResult = await broker.submitOrder(order);
        updateQueueStatus(item.queue_id, 'FILLED');
        addTradeHistory({ broker: brokerName, symbol: item.symbol, strategy: item.strategy, broker_order_id: orderResult?.orderId || null, strike: item.strike, expiry: item.expiry, quantity: item.quantity, fill_price: item.premium, premium_collected: item.premium * 100 * item.quantity, max_loss: item.max_loss, status: 'FILLED', executed_at: now, closed_at: null, close_price: null, realized_pnl: null });
        results.push({ symbol: item.symbol, status: 'FILLED', premium: item.premium * 100 * item.quantity });
      } catch (error) {
        updateQueueStatus(item.queue_id, 'FAILED');
        results.push({ symbol: item.symbol, status: 'FAILED', error: String(error) });
      }
    }

    return NextResponse.json({ approved: true, warnings: review.warnings, results, summary: { total: results.length, filled: results.filter(r => r.status === 'FILLED').length, failed: results.filter(r => r.status === 'FAILED').length } });
  } catch (error) {
    console.error('[API] POST /api/execute error:', error);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
