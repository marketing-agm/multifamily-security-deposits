'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { parseAppFolioExport, ParseError } from '@/lib/parser';

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AGM Security Deposit Return Tool</h1>
            <p className="text-xs text-gray-400 mt-0.5">AGM Real Estate Group</p>
          </div>
          {hasSession && (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Resume session ({session.returns.length} tenant{session.returns.length !== 1 ? 's' : ''}) →
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Upload AppFolio Export</h2>
            <p className="text-gray-500 mt-2 text-sm">
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
              dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-4xl mb-4">📂</div>
            <p className="text-gray-700 font-medium">Drop your .xlsx file here</p>
            <p className="text-gray-400 text-sm mt-1">or click to browse</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
          </div>

          {loading && (
            <div className="text-center text-sm text-blue-600 font-medium animate-pulse">
              Parsing file...
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-red-700">
                  {e.sheet ? <span className="font-medium">[{e.sheet}]</span> : null} {e.message}
                </p>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">What to export from AppFolio</h3>
            <p className="text-xs text-gray-500">
              See <code className="bg-gray-100 px-1 rounded text-gray-700">docs/appfolio-export-spec.md</code> for the exact report and column structure required.
            </p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Run the Move-Out report in AppFolio for the target property</li>
              <li>Export to Excel (.xlsx)</li>
              <li>Ensure the file contains all 4 required sheets: Tenant & Lease, Deposits & Fees, Utility, Ledger</li>
              <li>Upload the file above</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
