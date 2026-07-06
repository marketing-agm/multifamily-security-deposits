import { AdminPanel } from '@/components/Admin';

// Thin page wrapper — Next.js turns this file into the "/admin" route.
// The real UI lives in the AdminPanel component (a client component), matching
// how /dashboard delegates to <Dashboard />.
export default function AdminPage() {
  return <AdminPanel />;
}
