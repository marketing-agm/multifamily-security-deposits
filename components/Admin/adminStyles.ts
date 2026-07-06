// Shared Tailwind class strings for the admin panel.
// Report Studio's admin panel kept a set of shared style constants (btnPrimary,
// inputStyle, thStyle, ...) so every tab looked identical. This is the same idea,
// translated to this app's Tailwind conventions (blue primary buttons, gray cards)
// so the panel looks like it belongs in THIS app, not pasted in from another one.

// A white content card — the box that groups a section of settings.
export const card = 'bg-white rounded-xl border border-gray-200 p-5';

// Buttons
export const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
export const btnSecondary =
  'border border-gray-300 text-gray-700 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors';
export const btnDanger =
  'border border-red-300 text-red-600 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-red-50 transition-colors';

// Form pieces
export const input =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
export const fieldLabel = 'block text-xs font-semibold text-gray-600 mb-1.5';
export const fieldHint = 'text-xs text-gray-500 mt-1.5';

// Table header / cell
export const th =
  'text-left text-[11px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2 border-b border-gray-200';
export const td = 'px-3 py-2.5 text-sm text-gray-800 border-b border-gray-100 align-middle';
