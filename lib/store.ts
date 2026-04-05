'use client';

import { create } from 'zustand';
import type { Candidate, QueueItemWithCandidate } from './db';

// --- Stream Store (SSE data) ---
interface MarketStatus {
  status: 'PRE_MARKET' | 'OPEN' | 'AFTER_HOURS' | 'CLOSED';
  message: string;
}

interface QuoteData {
  [symbol: string]: {
    lastPrice: number;
    netChange: number;
    netPercentChangeInDouble: number;
    mark: number;
    bidPrice: number;
    askPrice: number;
    totalVolume: number;
  };
}

interface StreamState {
  quotes: QuoteData;
  vix: number;
  marketStatus: MarketStatus;
  connected: boolean;
  setQuotes: (quotes: QuoteData) => void;
  setVix: (vix: number) => void;
  setMarketStatus: (status: MarketStatus) => void;
  setConnected: (connected: boolean) => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  quotes: {},
  vix: 0,
  marketStatus: { status: 'CLOSED', message: '' },
  connected: false,
  setQuotes: (quotes) => set({ quotes }),
  setVix: (vix) => set({ vix }),
  setMarketStatus: (status) => set({ marketStatus: status }),
  setConnected: (connected) => set({ connected }),
}));

// --- Candidates Store ---
interface CandidatesState {
  candidates: Candidate[];
  loading: boolean;
  lastScreenedAt: number | null;
  filters: { flag?: string; strategy?: string; min_pop?: number; sortBy: string };
  setCandidates: (candidates: Candidate[]) => void;
  setLoading: (loading: boolean) => void;
  setLastScreenedAt: (ts: number | null) => void;
  setFilters: (filters: Partial<CandidatesState['filters']>) => void;
  fetchCandidates: () => Promise<void>;
}

export const useCandidatesStore = create<CandidatesState>((set, get) => ({
  candidates: [],
  loading: false,
  lastScreenedAt: null,
  filters: { sortBy: 'ai_score' },
  setCandidates: (candidates) => set({ candidates }),
  setLoading: (loading) => set({ loading }),
  setLastScreenedAt: (ts) => set({ lastScreenedAt: ts }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  fetchCandidates: async () => {
    set({ loading: true });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      if (filters.flag) params.set('flag', filters.flag);
      if (filters.strategy) params.set('strategy', filters.strategy);
      if (filters.min_pop !== undefined) params.set('min_pop', String(filters.min_pop));

      const res = await fetch(`/api/candidates?${params.toString()}`);
      const data = await res.json();
      const candidates = data.candidates || [];
      set({ candidates, lastScreenedAt: candidates.length > 0 ? candidates[0].screened_at : null });
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    } finally {
      set({ loading: false });
    }
  },
}));

// --- Queue Store ---
interface QueueState {
  queue: QueueItemWithCandidate[];
  loading: boolean;
  setQueue: (queue: QueueItemWithCandidate[]) => void;
  setLoading: (loading: boolean) => void;
  fetchQueue: () => Promise<void>;
  addToQueue: (candidateId: number, quantity: number, notes?: string) => Promise<boolean>;
  removeFromQueue: (id: number) => Promise<boolean>;
}

export const useQueueStore = create<QueueState>((set) => ({
  queue: [],
  loading: false,
  setQueue: (queue) => set({ queue }),
  setLoading: (loading) => set({ loading }),
  fetchQueue: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      set({ queue: data.queue || [] });
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      set({ loading: false });
    }
  },
  addToQueue: async (candidateId, quantity, notes) => {
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId, quantity, notes }),
      });
      if (!res.ok) return false;
      // Refresh queue
      const qRes = await fetch('/api/queue');
      const data = await qRes.json();
      set({ queue: data.queue || [] });
      return true;
    } catch { return false; }
  },
  removeFromQueue: async (id) => {
    try {
      const res = await fetch(`/api/queue?id=${id}`, { method: 'DELETE' });
      if (!res.ok) return false;
      set((state) => ({ queue: state.queue.filter((q) => q.queue_id !== id) }));
      return true;
    } catch { return false; }
  },
}));

// --- Account Store ---
interface AccountData {
  totalValue: number;
  buyingPower: number;
  cashBalance: number;
  deployedCapital: number;
  deployedPct: number;
  availableFunds: number;
}

interface AccountState {
  account: AccountData | null;
  loading: boolean;
  setAccount: (account: AccountData) => void;
  fetchAccount: () => Promise<void>;
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  loading: false,
  setAccount: (account) => set({ account }),
  fetchAccount: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/account');
      const data = await res.json();
      set({ account: data.account || null });
    } catch (error) {
      console.error('Failed to fetch account:', error);
    } finally {
      set({ loading: false });
    }
  },
}));

// --- Chat Store ---
interface ChatMessage {
  role: string;
  content: string;
  created_at?: number;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: false,
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setLoading: (loading) => set({ loading }),
  sendMessage: async (message) => {
    const userMsg: ChatMessage = { role: 'user', content: message, created_at: Math.floor(Date.now() / 1000) };
    set((state) => ({ messages: [...state.messages, userMsg], loading: true }));

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: 'assistant', content: data.response || 'No response received.',
        created_at: Math.floor(Date.now() / 1000),
      };
      set((state) => ({ messages: [...state.messages, assistantMsg] }));
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant', content: 'Failed to get a response. Please try again.',
        created_at: Math.floor(Date.now() / 1000),
      };
      set((state) => ({ messages: [...state.messages, errorMsg] }));
    } finally {
      set({ loading: false });
    }
  },
  clearHistory: () => set({ messages: [] }),
}));

// --- Broker Store ---
interface BrokerState {
  active: string;
  supported: string[];
  switching: boolean;
  fetchBroker: () => Promise<void>;
  switchBroker: (broker: string) => Promise<boolean>;
}

export const useBrokerStore = create<BrokerState>((set) => ({
  active: 'schwab',
  supported: ['schwab', 'webull'],
  switching: false,
  fetchBroker: async () => {
    try {
      const res = await fetch('/api/broker');
      const data = await res.json();
      set({ active: data.active || 'schwab', supported: data.supported || ['schwab', 'webull'] });
    } catch (error) {
      console.error('Failed to fetch broker:', error);
    }
  },
  switchBroker: async (broker: string) => {
    set({ switching: true });
    try {
      const res = await fetch('/api/broker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      set({ active: data.active });
      return true;
    } catch {
      return false;
    } finally {
      set({ switching: false });
    }
  },
}));
