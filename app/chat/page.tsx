'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';
import { MessageSquare, Send, Trash2, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const STARTER_PROMPTS = [
  'SHOW_TOP_CANDIDATES',
  'NET_RISK_EXPOSURE',
  'QUEUE_ANALYSIS',
  'STRESS_TEST_20PCT_DROP',
];

export default function ChatPage() {
  const { messages, loading, sendMessage, clearHistory } = useChatStore();
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col font-mono">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase">AI Intelligence Console</h1>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Query_Engine // LLM_V4</p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { clearHistory(); }}
            className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] font-black text-zinc-500 transition-colors hover:bg-terminal-red/10 hover:text-terminal-red">
            <Trash2 className="h-3 w-3" />
            PURGE_HISTORY
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto border border-zinc-800 bg-black p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-primary bg-primary/10 terminal-cyan">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="mb-1 text-sm font-black text-white uppercase tracking-tighter">System Ready for Input</h3>
              <p className="text-[10px] font-bold text-zinc-600 uppercase">Awaiting query parameters...</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-md w-full">
              {STARTER_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => { setInput(prompt); }}
                  className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left text-[10px] font-black text-zinc-400 transition-all hover:border-primary hover:text-primary">
                  {`> RUN ${prompt}`}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-black",
                  msg.role === 'user' ? "border-zinc-700 bg-zinc-800 text-zinc-300" : "border-primary bg-primary/10 terminal-cyan"
                )}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn(
                  "max-w-[85%] border p-3 text-[12px] leading-relaxed shadow-lg",
                  msg.role === 'user'
                    ? "border-zinc-800 bg-zinc-900/50 text-zinc-300"
                    : "border-primary/30 bg-black text-zinc-100"
                )}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center border border-primary bg-primary/10 terminal-cyan">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="border border-primary/20 bg-black p-3 text-[10px] font-bold terminal-cyan italic animate-pulse uppercase tracking-widest">
                  Processing_Query...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary uppercase">{'>'}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ENTER_QUERY_PARAMETERS..."
            className="w-full border border-zinc-800 bg-zinc-950 pl-8 pr-4 py-3 text-[12px] font-bold text-white placeholder-zinc-700 outline-none focus:border-primary transition-colors uppercase"
            disabled={loading}
          />
        </div>
        <button 
          onClick={handleSend} 
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 border border-primary bg-primary/10 px-6 py-3 text-[11px] font-black text-primary transition-all hover:bg-primary hover:text-black disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed"
        >
          <Send className="h-3 w-3" />
          EXECUTE
        </button>
      </div>
    </div>
  );
}
