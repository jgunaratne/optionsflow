'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';
import { MessageSquare, Send, Trash2, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const STARTER_PROMPTS = [
  'Show top candidates today',
  'What is my total risk exposure?',
  'Analyze my current queue',
  'Stress test: 20% market drop',
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
    <div className="flex h-[calc(100vh-10rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4 mt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-zinc-200" />
            AI Intelligence Console
          </h1>
          <p className="text-sm text-zinc-400 mt-1 font-medium">Quant-driven insights and portfolio analysis</p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { clearHistory(); }}
            className="flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-400 transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded">
            <Trash2 className="h-3.5 w-3.5" />
            Purge History
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto border border-white/10 bg-zinc-950/30 backdrop-blur-md shadow-xl p-4 space-y-6 rounded shadow-inner">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
              <div className="relative flex h-16 w-16 items-center justify-center border border-zinc-600/30 bg-zinc-900 text-zinc-200 rounded shadow-2xl">
                <MessageSquare className="h-8 w-8" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white tracking-tight">System Ready</h3>
              <p className="text-sm text-zinc-400 mt-1">Ask anything about your portfolio or the markets</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
              {STARTER_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => { setInput(prompt); }}
                  className="group flex items-center justify-between border border-white/10 bg-white/5 px-5 py-4 text-left text-xs font-bold text-zinc-400 transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-zinc-200 rounded">
                  <span>{prompt}</span>
                  <div className="h-5 w-5 rounded bg-zinc-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Send className="h-3 w-3 text-zinc-200" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center border text-xs shadow-lg rounded",
                  msg.role === 'user' ? "border-zinc-700 bg-zinc-800 text-zinc-300" : "border-zinc-600/30 bg-gradient-to-br from-zinc-700/50 to-zinc-800/50 text-zinc-200"
                )}>
                  {msg.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div className={cn(
                  "max-w-[80%] border px-5 py-4 text-sm leading-relaxed shadow-sm rounded",
                  msg.role === 'user'
                    ? "border-zinc-800 bg-zinc-900 text-zinc-200 rounded-tr-none"
                    : "border-white/10 bg-white/5 text-zinc-100 rounded-tl-none"
                )}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-600/30 bg-zinc-900 text-zinc-200 rounded animate-pulse">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="bg-white/5 border border-white/10 px-5 py-4 rounded rounded-tl-none flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" />
                  </div>
                  <span className="text-xs font-bold text-zinc-200/70 uppercase tracking-widest">Analyzing Data...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="mt-6 flex gap-3 max-w-4xl mx-auto w-full">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Query the system..."
            className="w-full border border-white/10 bg-zinc-900/50 px-6 py-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 focus:bg-zinc-900 transition-all rounded shadow-xl"
            disabled={loading}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
             <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-zinc-400 opacity-100">
               <span className="text-xs">↵</span> Enter
             </kbd>
          </div>
        </div>
        <button 
          onClick={handleSend} 
          disabled={loading || !input.trim()}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-zinc-600 to-zinc-800 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-black/40 hover:shadow-black/60 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:grayscale rounded transition-all"
        >
          <Send className="h-4 w-4" />
          <span>Execute</span>
        </button>
      </div>
    </div>
  );
}
