'use client';

// On this branch (PR #13 sim preview), the root page redirects straight to
// the standalone simulation at /sim so the Cloudflare preview opens it directly.
import { useEffect } from 'react';

export default function Page() {
  useEffect(() => {
    window.location.replace('/sim');
  }, []);
  return null;
}
