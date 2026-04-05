'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/lib/store';

const STARTER_PROMPTS = [
  'Show me my best candidates today',
  'What\'s my total risk exposure?',
  'Is there anything in my queue I should worry about?',
  'What would a 20% market drop do to my portfolio?',
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Chat</h1>
          <p className="text-sm text-zinc-500">Ask OptionsFlow about your trades, positions, and strategies</p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { clearHistory(); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200">
            Clear History
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl shadow-lg shadow-violet-500/20">
              💬
            </div>
            <div className="text-center">
              <h3 className="mb-1 text-lg font-semibold text-white">Ask OptionsFlow anything</h3>
              <p className="text-sm text-zinc-500">Get insights about your portfolio, candidates, and risk</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STARTER_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => { setInput(prompt); }}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-left text-xs text-zinc-300 transition-all hover:border-violet-600/50 hover:bg-zinc-800 hover:text-white">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-200'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500" />
                  </div>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your trades, positions, or strategies..."
          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors focus:border-violet-600 focus:outline-none"
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:shadow-violet-600/30 disabled:cursor-not-allowed disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}
