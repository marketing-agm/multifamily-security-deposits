// components/AgentForm/index.tsx
// Core processing screen — orchestrates AgentPanel (left) and LiveFormPanel (right).
// Drives the scripted agent conversation step by step.
//
// Think of this like a "controller" class in Java — it holds all the state and
// coordinates the two panels. AgentPanel handles the chat, LiveFormPanel shows the form.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { AgentPanel } from './AgentPanel';
import { LiveFormPanel } from './LiveFormPanel';
import {
  AgentStep, AgentMessage, STEP_ORDER,
  getOpeningMessage, getStepMessage, parseUserCorrection,
} from './agentScript';

// Labels shown in the top progress bar — one per step plus the final Review step.
const STEP_LABELS: Record<AgentStep | 'done', string> = {
  tenant: '1. Tenant',
  lease: '2. Lease',
  utility: '3. Utility',
  charges: '4. Charges',
  done: '5. Review',
};

// The PDF has 72 fillable fields total.
const TOTAL_FIELDS = 72;

interface Props {
  returnId: string;
}

export function AgentForm({ returnId }: Props) {
  // useSession() gives us the current session (all tenant returns) and a way to update one.
  // updateReturn(id, patch) merges `patch` into the matching return and saves to localStorage.
  const { session, updateReturn } = useSession();
  const router = useRouter();

  // Find this specific tenant's return record by ID.
  const tr = session?.returns.find(r => r.id === returnId);

  // messages: the chat history shown in AgentPanel.
  // stepIndex: which scripted step we're on (0 = not started, length = all done).
  // processing: true while we're "thinking" after the user sends a message.
  // filledCount: how many PDF fields are filled so far (shown in LiveFormPanel).
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [filledCount, setFilledCount] = useState(14);

  // On mount: show the opening message, then kick off the first step after a short delay.
  // The empty dependency array means this runs once when the component first appears —
  // similar to a constructor in Java.
  useEffect(() => {
    if (!tr) return;
    setMessages([{ role: 'agent', text: getOpeningMessage(tr) }]);
    setTimeout(() => advanceStep(0), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If no session or no matching return, redirect back to dashboard.
  if (!session || !tr) {
    router.replace('/dashboard');
    return null;
  }

  // Move to the next scripted step: show the step's message and update the filled field count.
  function advanceStep(index: number) {
    if (index >= STEP_ORDER.length) return;
    const step = STEP_ORDER[index];
    const msg = getStepMessage(step, tr!);
    setMessages(prev => [...prev, { role: 'agent', text: msg }]);

    // Each step fills more fields progressively.
    const counts: Record<AgentStep, number> = {
      tenant: 20, lease: 35, utility: 45, charges: 65, done: TOTAL_FIELDS,
    };
    setFilledCount(counts[step] ?? filledCount);
    setStepIndex(index + 1);
  }

  // Called when the user sends a message in AgentPanel.
  // We check if they're correcting a number (e.g. "cleaning was $400").
  // If yes, update that field in the session. If no, respond with a generic message.
  function handleSend(text: string) {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setProcessing(true);

    // Simulate a short "thinking" delay before responding (600ms).
    setTimeout(() => {
      const correction = parseUserCorrection(text);
      if (correction) {
        // The correction applies to either manualCharges or calculatedCharges.
        // We use spread (...) to copy the existing values and only change the one field —
        // same idea as Object.assign() in JavaScript.
        // We use tr! (non-null assertion) here because TypeScript can't see that we already
        // checked `if (!tr)` above and returned early. The ! tells it "trust me, it's defined."
        // This is like casting in Java: (TenantReturn) tr — we're sure of the type.
        if (['generalCleaning', 'carpetShampooing', 'painting', 'other1'].includes(correction.field)) {
          updateReturn(tr!.id, {
            manualCharges: { ...tr!.manualCharges, [correction.field]: correction.value },
          });
        } else if (correction.field === 'rentDue') {
          updateReturn(tr!.id, {
            calculatedCharges: { ...tr!.calculatedCharges, rentDue: correction.value },
          });
        } else if (correction.field === 'utilityCharge') {
          updateReturn(tr!.id, {
            calculatedCharges: { ...tr!.calculatedCharges, utilityCharge: correction.value },
          });
        }
        setMessages(prev => [...prev, {
          role: 'agent',
          text: `Got it — I've updated that to $${correction.value.toFixed(2)}. The live form has been recalculated.`,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'agent',
          text: `Thanks for the note. If you'd like to change a specific number, type it like "cleaning was $400" and I'll update it.\n\nReady to continue whenever you are.`,
        }]);
      }
      setProcessing(false);
    }, 600);
  }

  // Called when the user clicks "Continue →" in the header.
  // If there are more steps, advance. If all done, mark complete and go to the Review screen.
  function handleContinue() {
    if (stepIndex < STEP_ORDER.length) {
      advanceStep(stepIndex);
    } else {
      // processingStatus is a field on TenantReturn that tracks where this return is in the workflow.
      updateReturn(tr!.id, { processingStatus: 'complete' });
      router.push(`/review/${encodeURIComponent(tr!.id)}`);
    }
  }

  const currentStep = STEP_ORDER[Math.min(stepIndex, STEP_ORDER.length - 1)];
  const allStepsDone = stepIndex >= STEP_ORDER.length;

  return (
    // Full-screen layout: header bar on top, two-column panel below.
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Top navigation bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">

        {/* Left side: back link + tenant info */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-blue-600 text-sm hover:text-blue-800"
          >
            ← All returns
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {tr.tenantData.tenantName} — Unit {tr.tenantData.unit}
            </p>
            <p className="text-xs text-gray-400">
              Move-out {tr.tenantData.moveOutDate} ·{' '}
              {tr.utilityData.utilityType === 'RUBS' ? 'RUBS' : 'Flat fee'} ·{' '}
              Inspection {tr.tenantData.inspectionStatus}
            </p>
          </div>
        </div>

        {/* Center: step progress bar */}
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {STEP_ORDER.map((step, i) => {
            const isDone = i < stepIndex;
            const isActive = step === currentStep && !allStepsDone;
            return (
              <div
                key={step}
                className={`px-3 py-1.5 text-xs border-r border-gray-200 last:border-r-0 whitespace-nowrap ${
                  isDone
                    ? 'bg-green-50 text-green-700 font-medium'
                    : isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                {STEP_LABELS[step]}
              </div>
            );
          })}
          {/* The "Review" step isn't in STEP_ORDER, so we render it separately. */}
          <div
            className={`px-3 py-1.5 text-xs whitespace-nowrap ${
              allStepsDone ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-gray-50 text-gray-400'
            }`}
          >
            {STEP_LABELS['done']}
          </div>
        </div>

        {/* Right side: continue / go-to-review button */}
        <button
          onClick={handleContinue}
          className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {allStepsDone ? 'Go to Review →' : 'Continue →'}
        </button>
      </div>

      {/* ── Two-column main area ── */}
      {/* Left column: agent chat. Right column: live PDF form preview. */}
      <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        <div className="border-r border-gray-200 overflow-hidden flex flex-col bg-white">
          <AgentPanel messages={messages} onSend={handleSend} disabled={processing} />
        </div>
        <div className="overflow-hidden flex flex-col bg-white">
          <LiveFormPanel tr={tr} filledCount={filledCount} totalFields={TOTAL_FIELDS} />
        </div>
      </div>
    </div>
  );
}
