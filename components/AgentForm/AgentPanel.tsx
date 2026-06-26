'use client';

// AgentPanel.tsx
// Left panel of the core processing screen.
// Shows the scripted agent conversation and accepts PM input for corrections.

import { useEffect, useRef, useState } from 'react';
import { AgentMessage } from './agentScript';

interface Props {
  messages: AgentMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
}

export function AgentPanel({ messages, onSend, disabled }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Agent</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-gray-400 mb-1">{m.role === 'agent' ? 'Agent' : 'You'}</span>
            <div
              className={`px-3 py-2 text-sm leading-relaxed max-w-[90%] whitespace-pre-wrap ${
                m.role === 'agent'
                  ? 'bg-white border border-gray-200 rounded-tl rounded-tr rounded-br rounded-bl-none text-gray-700'
                  : 'bg-gray-100 border border-gray-200 rounded-tl rounded-tr rounded-bl rounded-br-none text-gray-500 font-mono text-xs'
              }`}
              dangerouslySetInnerHTML={m.role === 'agent' ? {
                __html: m.text
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>')
              } : undefined}
            >
              {m.role === 'user' ? m.text : undefined}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 px-4 py-3 bg-white flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={disabled ? 'Processing…' : 'Type a correction or question…'}
          className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send ↗
        </button>
      </div>
    </div>
  );
}
