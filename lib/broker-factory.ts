import type { Broker } from './broker';
import { getConfig, setConfig } from './db';

let cachedBroker: Broker | null = null;
let cachedBrokerName: string | null = null;

const SUPPORTED_BROKERS = ['schwab', 'webull', 'snaptrade'] as const;
export type BrokerName = (typeof SUPPORTED_BROKERS)[number];

/**
 * Returns the active broker name. Reads from DB config first, falls back to env var.
 */
export function getActiveBrokerName(): BrokerName {
  try {
    const dbBroker = getConfig('active_broker') as string | undefined;
    if (dbBroker && SUPPORTED_BROKERS.includes(dbBroker as BrokerName)) {
      return dbBroker as BrokerName;
    }
  } catch { /* DB not ready, fall through */ }
  return (process.env.ACTIVE_BROKER as BrokerName) || 'schwab';
}

/**
 * Returns the active broker instance.
 * Reads active broker from DB config (set via UI), falls back to ACTIVE_BROKER env var.
 */
export function getBroker(): Broker {
  const name = getActiveBrokerName();

  if (cachedBroker && cachedBrokerName === name) {
    return cachedBroker;
  }

  switch (name) {
    case 'schwab': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SchwabBroker } = require('./schwab');
      cachedBroker = new SchwabBroker();
      break;
    }
    case 'webull': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { WebullBroker } = require('./webull');
      cachedBroker = new WebullBroker();
      break;
    }
    case 'snaptrade': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SnapTradeBroker } = require('./snaptrade');
      cachedBroker = new SnapTradeBroker();
      break;
    }
    default:
      throw new Error(`Unknown broker: ${name}. Supported: ${SUPPORTED_BROKERS.join(', ')}`);
  }

  cachedBrokerName = name;
  return cachedBroker!;
}

/**
 * Returns the display name of the active broker.
 */
export function getBrokerName(): string {
  return getBroker().name;
}

/**
 * Switches the active broker at runtime. Clears cached instance.
 */
export function setActiveBroker(name: BrokerName): void {
  if (!SUPPORTED_BROKERS.includes(name)) {
    throw new Error(`Unsupported broker: ${name}. Supported: ${SUPPORTED_BROKERS.join(', ')}`);
  }
  setConfig('active_broker', name);
  cachedBroker = null;
  cachedBrokerName = null;
}

/**
 * Returns all supported broker names.
 */
export function getSupportedBrokers(): readonly string[] {
  return SUPPORTED_BROKERS;
}
