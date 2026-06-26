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
      {/* Panel header — AGM secondary surface with uppercase label */}
      <div className="px-4 py-2.5 border-b border-[#e8e7e4] bg-[#fbfbfa] flex items-center gap-2">
        <span className="text-[11px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">Agent</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* "Agent" / "You" labels: small muted text */}
            <span className="text-[11px] text-[#9b9b99] mb-1">{m.role === 'agent' ? 'Agent' : 'You'}</span>
            <div
              className={`px-3 py-2 text-sm leading-relaxed max-w-[90%] whitespace-pre-wrap rounded ${
                m.role === 'agent'
                  // Agent bubble: white with AGM border, standard text
                  ? 'bg-white border border-[#e8e7e4] rounded-tr-lg rounded-br-lg rounded-tl-none text-[#1a1a19]'
                  // User bubble: subtle fill, muted text
                  : 'bg-[#f7f6f3] border border-[#e8e7e4] rounded-tl-lg rounded-tr-lg rounded-bl-none text-[#6b6b6a]'
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

      {/* Input area — border-top separator */}
      <div className="border-t border-[#e8e7e4] px-4 py-3 bg-white flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={disabled ? 'Processing…' : 'Type a correction or question…'}
          // Focus ring uses AGM accent blue with a soft glow
          className="flex-1 resize-none text-sm border border-[#e8e7e4] rounded-[6px] px-3 py-2 focus:outline-none focus:border-[#2383e2] focus:shadow-[0_0_0_3px_#e8f0fe] disabled:bg-[#f7f6f3] disabled:text-[#9b9b99]"
          rows={2}
        />
        {/* Send button: AGM near-black primary */}
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-4 py-2 text-sm font-medium bg-[#1a1a19] text-white rounded-[6px] hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send ↗
        </button>
      </div>
    </div>
  );
}
