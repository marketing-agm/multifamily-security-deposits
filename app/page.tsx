'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { parseAppFolioExport, ParseError } from '@/lib/parser';
import { DUMMY_SESSION } from '@/lib/dummyData';

export default function UploadPage() {
  const { session, setSession } = useSession();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // If a session already exists, offer to resume
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
      setSession({
        propertyName: result.propertyName || file.name.replace(/\.xlsx?$/, ''),
        uploadDate: new Date().toLocaleDateString('en-US'),
        returns: result.returns,
      });
      if (result.errors.length > 0) setErrors(result.errors); // non-fatal warnings
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
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col">
      {/* Nav bar — AGM white top bar */}
      <header className="bg-white border-b border-[#e8e7e4] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-lg font-semibold text-[#1a1a19]"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              AGM Security Deposit Return Tool
            </h1>
            <p className="text-xs text-[#9b9b99] mt-0.5">AGM Real Estate Group</p>
          </div>
          {hasSession && (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-[#2383e2] hover:underline font-medium"
            >
              Resume session ({session.returns.length} tenant{session.returns.length !== 1 ? 's' : ''}) →
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center">
            <h2
              className="text-2xl font-bold text-[#1a1a19]"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              Upload AppFolio Export
            </h2>
            <p className="text-[#6b6b6a] mt-2 text-sm">
              Export your AppFolio move-out report to Excel and upload it here. All move-outs in the file will be loaded at once.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-[8px] p-12 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-[#2383e2] bg-[#e6efff]'
                : 'border-[#d4d3d0] hover:border-[#2383e2] hover:bg-[#f7f6f3]'
            }`}
          >
            <div className="text-4xl mb-4">📂</div>
            <p className="text-[#1a1a19] font-medium text-sm">Drop your .xlsx file here</p>
            <p className="text-[#9b9b99] text-xs mt-1">or click to browse</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
          </div>

          {loading && (
            <div className="text-center text-sm text-[#2383e2] font-medium animate-pulse">
              Parsing file…
            </div>
          )}

          {/* Dev/demo banner */}
          <div className="bg-[#fdf3da] border border-[#e8c840]/40 rounded-[6px] px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-[#8b6a00]">
              <span className="font-semibold">No Excel file?</span> Load 3 sample tenants to explore the tool.
            </p>
            <button
              onClick={() => { setSession(DUMMY_SESSION); router.push('/dashboard'); }}
              className="shrink-0 text-xs font-semibold text-[#8b6a00] bg-[#fdf3da] hover:bg-[#f9e8b0] border border-[#8b6a00]/30 rounded-[6px] px-3 py-1.5 transition-colors"
            >
              Load demo data
            </button>
          </div>

          {errors.length > 0 && (
            <div className="bg-[#fceae8] border border-[#b3261e]/20 rounded-[6px] p-4 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-[#b3261e]">
                  {e.sheet ? <span className="font-medium">[{e.sheet}]</span> : null} {e.message}
                </p>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white border border-[#e8e7e4] rounded-[6px] p-5 space-y-3">
            <h3 className="text-[11px] font-semibold text-[#9b9b99] uppercase tracking-[0.05em]">What to export from AppFolio</h3>
            <p className="text-xs text-[#6b6b6a]">
              See <code className="bg-[#f7f6f3] px-1 rounded text-[#1a1a19]">docs/appfolio-export-spec.md</code> for the exact report and column structure required.
            </p>
            <ol className="text-sm text-[#6b6b6a] space-y-1.5 list-decimal list-inside">
              <li>Run the Move-Out report in AppFolio for the target property</li>
              <li>Export to Excel (.xlsx)</li>
              <li>Ensure the file contains all 4 required sheets: Tenant &amp; Lease, Deposits &amp; Fees, Utility, Ledger</li>
              <li>Upload the file above</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
