import type { AccountBalances, Position } from '@/lib/broker';
import { getBrokerSnapshot, setBrokerSnapshot } from '@/lib/db';

export interface CachedAccountPayload {
  balances: AccountBalances;
  positions: Position[];
}

export interface AccountSummary {
  totalValue: number;
  buyingPower: number;
  cashBalance: number;
  deployedCapital: number;
  deployedPct: number;
  availableFunds: number;
}

function buildAccountSummary(payload: CachedAccountPayload): AccountSummary {
  const totalValue = payload.balances.liquidationValue;
  const optionPositions = payload.positions.filter((position) => position.instrument.assetType === 'OPTION');
  const deployedCapital = optionPositions.reduce(
    (sum, position) => sum + Math.abs(position.maintenanceRequirement || position.marketValue || 0),
    0
  );

  return {
    totalValue,
    buyingPower: payload.balances.buyingPower,
    cashBalance: payload.balances.cashBalance,
    deployedCapital,
    deployedPct: totalValue > 0 ? deployedCapital / totalValue : 0,
    availableFunds: payload.balances.availableFunds,
  };
}

export function getCachedAccountPayload(broker: string) {
  return getBrokerSnapshot<CachedAccountPayload>(broker, 'account_details');
}

export function getCachedAccountSummary(broker: string) {
  const snapshot = getCachedAccountPayload(broker);
  if (!snapshot) return null;

  return {
    account: buildAccountSummary(snapshot.payload),
    updatedAt: snapshot.updated_at,
  };
}

export function saveCachedAccountPayload(broker: string, payload: CachedAccountPayload) {
  const updatedAt = setBrokerSnapshot(broker, 'account_details', payload);
  return {
    account: buildAccountSummary(payload),
    updatedAt,
  };
}
