'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { parseAppFolioExport, ParseError } from '@/lib/parser';
import { lookupProperty } from '@/lib/propertyConfig';

export default function UploadPage() {
  const { session, setSession } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasSession = session && session.returns.length > 0;

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrors([{ message: 'Please upload an Excel file (.xlsx or .xls).' }]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseAppFolioExport(buffer);
      if (result.errors.length > 0 && result.returns.length === 0) {
        setErrors(result.errors);
        return;
      }
      const resolvedName = result.propertyName || file.name.replace(/\.xlsx?$/, '');
      setSession({
        propertyName: resolvedName,
        uploadDate: new Date().toLocaleDateString('en-US'),
        returns: result.returns,
        propertyConfig: lookupProperty(resolvedName),
      });
      if (result.errors.length > 0) setErrors(result.errors);
      router.push('/dashboard');
    } catch (err) {
      setErrors([{ message: err instanceof Error ? err.message : 'Failed to parse file.' }]);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#1c1c1e] flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-[#2c2c2e] border-b border-[#e5e5ea] dark:border-[#38383a] px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#1c1c1e] dark:text-white">AGM Security Deposit Return Tool</h1>
            <p className="text-xs text-[#8e8e93] mt-0.5">AGM Real Estate Group</p>
          </div>
          <div className="flex items-center gap-3">
            {hasSession && (
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Resume session ({session.returns.length} tenant{session.returns.length !== 1 ? 's' : ''}) →
              </button>
            )}
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-[#f2f2f7] dark:bg-[#3a3a3c] flex items-center justify-center text-base hover:bg-[#e5e5ea] dark:hover:bg-[#48484a] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#1c1c1e] dark:text-white">Upload AppFolio Export</h2>
            <p className="text-[#8e8e93] mt-2 text-sm">
              Export your AppFolio move-out report to Excel and upload it here. All move-outs in the file will be loaded at once.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-[#d1d1d6] dark:border-[#48484a] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-[#2c2c2e]'
            }`}
          >
            <div className="text-4xl mb-4">📂</div>
            <p className="text-[#1c1c1e] dark:text-[#ebebf5] font-medium">Drop your .xlsx file here</p>
            <p className="text-[#8e8e93] text-sm mt-1">or click to browse</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
          </div>

          {loading && (
            <div className="text-center text-sm text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              Parsing file...
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-red-700 dark:text-red-400">
                  {e.sheet ? <span className="font-medium">[{e.sheet}]</span> : null} {e.message}
                </p>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#e5e5ea] dark:border-[#38383a] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">What to export from AppFolio</p>
            <ol className="text-sm text-[#1c1c1e] dark:text-[#ebebf5] space-y-2 list-decimal list-inside">
              <li>Run the Move-Out report in AppFolio for the target property</li>
              <li>Export to Excel (.xlsx)</li>
              <li>Ensure the file contains all 4 required sheets: Tenant &amp; Lease, Deposits &amp; Fees, Utility, Ledger</li>
              <li>Upload the file above — all move-outs will populate automatically</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
