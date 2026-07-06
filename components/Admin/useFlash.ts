'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// A tiny reusable helper for the "Saved ✓" style confirmation that appears
// next to a Save button and then disappears on its own after a few seconds.
// Report Studio's admin panel repeated this in every tab; here it lives once.
export function useFlash(timeoutMs = 3000): [string, (msg: string) => void] {
  const [message, setMessage] = useState('');
  // useRef holds the pending timer so we can cancel it if flash() fires again
  // before the previous message finished — prevents an early clear.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(
    (msg: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      timer.current = setTimeout(() => setMessage(''), timeoutMs);
    },
    [timeoutMs]
  );

  // Clean up the timer if the component unmounts mid-countdown.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return [message, flash];
}
