'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';
import { MessageSquare, Send, Trash2, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const STARTER_PROMPTS = [
  'Show top candidates',
  'Net risk exposure',
  'Queue analysis',
  'Stress test 20% drop',
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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-4 mt-2">
        <div>
          <h1 className="text-xl font-medium text-white tracking-tight">AI intelligence console</h1>
          <p className="text-xs text-zinc-500 mt-1">Query engine / LLM</p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { clearHistory(); }}
            className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/30 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-red-950/30 hover:text-red-400 hover:border-red-900/30 rounded-sm">
            <Trash2 className="h-3.5 w-3.5" />
            Clear history
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto border border-zinc-800 bg-black/40 p-5 space-y-6 rounded-sm">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            <div className="flex h-12 w-12 items-center justify-center border border-primary/30 bg-primary/10 text-primary rounded-full">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="text-center">
              <h3 className="mb-2 text-base font-medium text-white">System ready</h3>
              <p className="text-xs text-zinc-500">Awaiting your prompt...</p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
              {STARTER_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => { setInput(prompt); }}
                  className="border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left text-xs text-zinc-400 transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-zinc-200 rounded-sm">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center border rounded-full text-xs",
                  msg.role === 'user' ? "border-zinc-700 bg-zinc-800 text-zinc-400" : "border-primary/30 bg-primary/10 text-primary"
                )}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn(
                  "max-w-[85%] border px-4 py-3 text-sm leading-relaxed shadow-sm rounded-lg",
                  msg.role === 'user'
                    ? "border-zinc-800 bg-zinc-900 text-zinc-200 rounded-tr-none"
                    : "border-primary/20 bg-primary/5 text-zinc-100 rounded-tl-none"
                )}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary rounded-full">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary/70 animate-pulse rounded-lg rounded-tl-none flex items-center">
                  Processing...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-5 flex gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full border border-zinc-800 bg-zinc-950 px-4 py-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors rounded-sm"
            disabled={loading}
          />
        </div>
        <button 
          onClick={handleSend} 
          disabled={loading || !input.trim()}
          className="flex items-center justify-center gap-2 border border-primary bg-primary/10 px-8 py-3.5 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-black disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed rounded-sm"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </div>
    </div>
  );
}
