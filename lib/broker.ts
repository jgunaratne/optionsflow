// Broker abstraction layer — normalized types and interface
// All broker implementations (Schwab, Webull, etc.) must implement this interface.

// --- Normalized Response Types ---

export interface OptionContract {
  putCall: string;
  symbol: string;
  bid: number;
  ask: number;
  delta: number;
  theta: number;
  vega: number;
  openInterest: number;
  daysToExpiration: number;
  strikePrice: number;
  expirationDate: string;
}

export interface OptionsChainResponse {
  symbol: string;
  underlyingPrice: number;
  putExpDateMap: Record<string, Record<string, OptionContract[]>>;
}

export interface PriceCandle {
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  datetime?: number;
}

export interface PriceHistoryResponse {
  candles: PriceCandle[];
}

export interface AccountBalances {
  buyingPower: number;
  liquidationValue: number;
  cashBalance: number;
  availableFunds: number;
  maintenanceRequirement: number;
}

export interface Position {
  shortQuantity: number;
  longQuantity: number;
  averagePrice: number;
  currentDayProfitLoss: number;
  currentDayProfitLossPercentage: number;
  marketValue: number;
  maintenanceRequirement: number;
  instrument: {
    symbol: string;
    assetType: string;
    putCall?: string;
    underlyingSymbol?: string;
    description?: string;
  };
}

export interface AccountDetails {
  balances: AccountBalances;
  positions: Position[];
}

export interface OrderResult {
  orderId: string | null;
  status: string;
}

export interface TokenStatus {
  accessExpiring: boolean;
  refreshExpiring: boolean;
}

export interface AuthSetup {
  url: string;
  state?: string;
}

// --- Broker Interface ---

export interface Broker {
  /** Display name of the broker (e.g., 'Schwab', 'Webull') */
  readonly name: string;

  // --- Auth ---
  isTokenExpiringSoon(): TokenStatus;

  // --- Market Data ---
  getOptionsChain(symbol: string, contractType: string, fromDate: string, toDate: string): Promise<OptionsChainResponse>;
  getQuotes(symbols: string[]): Promise<unknown>;
  getPriceHistory(symbol: string): Promise<PriceHistoryResponse>;

  // --- Account ---
  getAccountDetails(): Promise<AccountDetails>;

  // --- Orders ---
  submitOrder(orderBody: unknown): Promise<OrderResult>;
  dryRunOrder(orderBody: unknown): Promise<unknown>;
  cancelOrder(orderId: string): Promise<unknown>;
  getOrders(): Promise<unknown>;

  // --- Order Construction ---
  buildOCCSymbol(symbol: string, expiry: string, callPut: 'C' | 'P', strike: number): string;
  buildCSPOrder(occSymbol: string, quantity: number, midPrice: number): unknown;
  buildBullPutSpreadOrder(shortPutOCC: string, longPutOCC: string, quantity: number, netCredit: number): unknown;
}
