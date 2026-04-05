export interface GreeksSummary { totalDelta: number; totalTheta: number; totalVega: number; }
export interface CapitalAllocation { totalValue: number; deployed: number; available: number; buffer: number; deployedPct: number; availablePct: number; bufferPct: number; }
export interface CrashScenario { label: string; marketMove: number; estimatedPnL: number; portfolioValueAfter: number; }
export interface SectorExposure { sector: string; exposure: number; pct: number; }

const SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', GOOGL: 'Technology', META: 'Technology',
  AMZN: 'Consumer Discretionary', JPM: 'Financials', WMT: 'Consumer Staples',
  SPY: 'Index (Broad)', QQQ: 'Index (Tech)', IVV: 'Index (Broad)',
  TSLA: 'Consumer Discretionary', V: 'Financials', MA: 'Financials',
  UNH: 'Healthcare', JNJ: 'Healthcare', PG: 'Consumer Staples', XOM: 'Energy', CVX: 'Energy',
};

export function getSector(symbol: string): string {
  return SECTOR_MAP[symbol] || 'Other';
}

export function calculateGreeks(positions: Array<{ delta: number; theta: number; vega: number; quantity: number }>): GreeksSummary {
  return positions.reduce((acc, pos) => ({
    totalDelta: acc.totalDelta + pos.delta * pos.quantity * 100,
    totalTheta: acc.totalTheta + pos.theta * pos.quantity * 100,
    totalVega: acc.totalVega + pos.vega * pos.quantity * 100,
  }), { totalDelta: 0, totalTheta: 0, totalVega: 0 });
}

export function calculateCapitalAllocation(totalValue: number, deployedCapital: number, maxDeployedPct = 0.50): CapitalAllocation {
  const buffer = totalValue * (1 - maxDeployedPct);
  const available = Math.max(0, totalValue * maxDeployedPct - deployedCapital);
  return {
    totalValue, deployed: deployedCapital, available, buffer,
    deployedPct: totalValue > 0 ? deployedCapital / totalValue : 0,
    availablePct: totalValue > 0 ? available / totalValue : 0,
    bufferPct: totalValue > 0 ? buffer / totalValue : 0,
  };
}

export function calculateCrashScenarios(
  positions: Array<{ symbol: string; delta: number; quantity: number; underlying_price: number; strike: number; premium: number; max_loss: number; strategy: string }>,
  totalPortfolioValue: number
): CrashScenario[] {
  const scenarios = [
    { label: 'Market -10%', marketMove: -0.10 },
    { label: 'Market -20%', marketMove: -0.20 },
    { label: 'Market -30%', marketMove: -0.30 },
    { label: 'Market -50% (2008-style)', marketMove: -0.50 },
  ];

  return scenarios.map(scenario => {
    let totalPnL = 0;
    for (const pos of positions) {
      const newPrice = pos.underlying_price * (1 + scenario.marketMove);
      if (pos.strategy === 'CSP') {
        if (newPrice < pos.strike) {
          const lossPerContract = (pos.strike - newPrice - pos.premium) * 100;
          totalPnL += Math.max(-pos.max_loss * pos.quantity, -lossPerContract * pos.quantity);
        } else {
          totalPnL += pos.premium * 100 * pos.quantity;
        }
      } else if (pos.strategy === 'BULL_PUT_SPREAD') {
        totalPnL += Math.max(-pos.max_loss * pos.quantity, 0) + pos.premium * 100 * pos.quantity;
      } else {
        const priceChange = pos.underlying_price * scenario.marketMove;
        totalPnL += pos.delta * priceChange * 100 * pos.quantity;
      }
    }
    return { label: scenario.label, marketMove: scenario.marketMove, estimatedPnL: Math.round(totalPnL), portfolioValueAfter: Math.round(totalPortfolioValue + totalPnL) };
  });
}

export function calculateSectorExposure(positions: Array<{ symbol: string; max_loss: number; quantity: number }>): SectorExposure[] {
  const sectorMap = new Map<string, number>();
  for (const pos of positions) {
    const sector = getSector(pos.symbol);
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + pos.max_loss * pos.quantity);
  }
  const total = Array.from(sectorMap.values()).reduce((sum, v) => sum + v, 0);
  return Array.from(sectorMap.entries())
    .map(([sector, exposure]) => ({ sector, exposure, pct: total > 0 ? exposure / total : 0 }))
    .sort((a, b) => b.exposure - a.exposure);
}

export interface CollarRecommendation { symbol: string; currentPrice: number; callStrike: number; putStrike: number; estimatedNetCost: number; maxUpside: number; maxDownside: number; }

export function recommendCollar(symbol: string, currentPrice: number, callPremium = 0, putPremium = 0): CollarRecommendation {
  const callStrike = Math.round(currentPrice * 1.05 * 100) / 100;
  const putStrike = Math.round(currentPrice * 0.90 * 100) / 100;
  return {
    symbol, currentPrice, callStrike, putStrike,
    estimatedNetCost: Math.round((putPremium - callPremium) * 100) / 100,
    maxUpside: Math.round((callStrike - currentPrice) * 100) / 100,
    maxDownside: Math.round((currentPrice - putStrike) * 100) / 100,
  };
}
