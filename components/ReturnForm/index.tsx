'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { ManualCharges, TenantReturn, RUBSManualInput, TenantData, DepositData, InspectionPhotos, UtilityType } from '@/types';
import { compressImageFile } from '@/lib/imageCompress';
import { fillAGMCheckoutPDF } from '@/lib/pdfFiller';
import {
  computeCalculatedCharges, calcNRCOffset, calcTotalCharges,
  calcTotalCredits, calcBalance, formatCurrency,
} from '@/lib/calculations';
import { InspectionBadge } from '@/components/shared/InspectionBadge';
import { UtilityTag } from '@/components/shared/UtilityTag';

// The 9 sections mirror the AGM Checkout Report PDF sections.
const SECTIONS = [
  { title: 'Property & Tenant',    subtitle: 'Name, unit, forwarding address' },
  { title: 'Lease & Dates',        subtitle: 'Rent, move-in / move-out' },
  { title: 'NRC Fees',             subtitle: 'Non-refundable cleaning & pet' },
  { title: 'Move-In / Out Photos', subtitle: 'Inspection — drives repair charges' },
  { title: 'Rent Due',             subtitle: 'Pro-rated / lease break' },
  { title: 'Turnover Charges',     subtitle: 'Cleaning, repairs & other' },
  { title: 'Utility Charges',      subtitle: 'RUBS or flat fee' },
  { title: 'Legal / Court Costs',  subtitle: 'Court fees, attorney costs' },
  { title: 'Refunds & Credits',    subtitle: 'Deposits held — final balance' },
];

interface Props { returnId: string; }

export function ReturnForm({ returnId }: Props) {
  const { session, updateReturn } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();

  const [section, setSection] = useState(0);
  const [showDataPanel, setShowDataPanel] = useState(false);
  // Highest section index the user has reached — drives the green "done" checks
  // in the sidebar. Using the furthest-reached (not just `< section`) means the
  // checkmarks persist even when you click back to an earlier section.
  const [maxReached, setMaxReached] = useState(0);
  useEffect(() => { setMaxReached(m => Math.max(m, section)); }, [section]);

  const tenantReturn = session?.returns.find(r => r.id === returnId);

  // ── Editable state ──────────────────────────────────────────────────────────

  // Tenant + address fields — pre-filled from AppFolio, editable by staff.
  const [tenantData, setTenantData] = useState<TenantData>(
    tenantReturn?.tenantData ?? {
      tenantName: '', coTenant: '', unit: '', monthlyRent: 0,
      moveInDate: '', moveOutDate: '', paidThroughDate: '', noticeDate: '',
      leaseEndDate: '', leaseBreak: false, newTenantMoveInDate: null,
      forwardingAddress: { street: '', city: '', state: '', zip: '' },
      inspectionStatus: 'missing',
    }
  );

  // NRC fees — seeded from property config, editable per unit.
  const [nrcCleaningFee, setNrcCleaningFee] = useState(tenantReturn?.depositData.nrcCleaningFee ?? 0);
  const [nrcPetFee, setNrcPetFee] = useState(tenantReturn?.depositData.nrcPetFee ?? 0);

  const [manualCharges, setManualCharges] = useState<ManualCharges>(
    tenantReturn?.manualCharges ?? {
      generalCleaning: 0, blindDrapeCleaning: 0, windowCoveringReplacement: 0,
      carpetShampooing: 0, flooringRestoration: 0, painting: 0,
      other1Label: 'Other', other1: 0, other2Label: 'Other', other2: 0, legalCourtCosts: 0,
    }
  );
  const [rubsInput, setRubsInput] = useState<RUBSManualInput>(
    tenantReturn?.rubsManualInput ?? { buildingTotal: 0, unitRatio: 0 }
  );
  const [utilityRate, setUtilityRate] = useState(tenantReturn?.utilityData.flatFeeRate ?? 0);
  // Utility type is seeded from the property config but editable per unit.
  const [utilityType, setUtilityType] = useState<UtilityType>(tenantReturn?.utilityData.utilityType ?? 'flat_fee');

  // Move-in / move-out inspection photos (compressed data URLs).
  const [photos, setPhotos] = useState<InspectionPhotos>(
    tenantReturn?.inspectionPhotos ?? { moveIn: [], moveOut: [] }
  );

  // "View full form" — live preview of the real AGM Checkout PDF, filled from
  // whatever's been entered so far (unfilled fields simply stay blank).
  const [fullFormUrl, setFullFormUrl] = useState<string | null>(null);
  const [fullFormLoading, setFullFormLoading] = useState(false);

  useEffect(() => {
    if (!session) router.replace('/');
  }, [session, router]);

  if (!tenantReturn) return null;

  // This tenant's property (an upload can span several); fall back to the session.
  const propertyName = tenantReturn.propertyName ?? session?.propertyName ?? '';
  const propertyConfig = tenantReturn.propertyConfig ?? session?.propertyConfig ?? null;

  // ── Live computed values ────────────────────────────────────────────────────

  const liveDepositData: DepositData = { ...tenantReturn.depositData, nrcCleaningFee, nrcPetFee };
  const liveUtilityData = { ...tenantReturn.utilityData, utilityType, flatFeeRate: utilityRate };
  const withCharges: TenantReturn = {
    ...tenantReturn,
    tenantData,
    depositData: liveDepositData,
    manualCharges,
    rubsManualInput: rubsInput,
    utilityData: liveUtilityData,
  };
  const calculatedCharges = computeCalculatedCharges(withCharges);
  const displayReturn: TenantReturn = { ...withCharges, calculatedCharges };
  const totalCharges = calcTotalCharges(displayReturn);
  const totalCredits = calcTotalCredits(displayReturn);
  const balance = calcBalance(displayReturn);
  const cleaningTenant = calcNRCOffset(manualCharges.generalCleaning, nrcCleaningFee);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function updateTenant<K extends keyof TenantData>(key: K, value: TenantData[K]) {
    setTenantData(prev => ({ ...prev, [key]: value }));
  }
  function updateAddress(field: keyof TenantData['forwardingAddress'], value: string) {
    setTenantData(prev => ({
      ...prev,
      forwardingAddress: { ...prev.forwardingAddress, [field]: value },
    }));
  }
  function updateCharge(key: keyof ManualCharges, value: number | string) {
    setManualCharges(prev => ({ ...prev, [key]: value }));
  }

  function saveProgress() {
    updateReturn(returnId, {
      tenantData,
      depositData: liveDepositData,
      manualCharges,
      rubsManualInput: rubsInput,
      calculatedCharges,
      utilityData: liveUtilityData,
      inspectionPhotos: photos,
      processingStatus: section < 7 ? 'in_progress' : tenantReturn!.processingStatus,
    });
  }

  function goToReview() {
    updateReturn(returnId, {
      tenantData,
      depositData: liveDepositData,
      manualCharges,
      rubsManualInput: rubsInput,
      calculatedCharges,
      utilityData: liveUtilityData,
      inspectionPhotos: photos,
      processingStatus: 'in_progress',
    });
    router.push(`/review/${returnId}`);
  }

  // Compress and add uploaded photos, persisting immediately so they survive
  // navigation even before the next saveProgress().
  async function addPhotos(which: keyof InspectionPhotos, files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const encoded = await Promise.all(Array.from(files).map(compressImageFile));
      // Functional update so two quick uploads (move-in + move-out) don't read
      // the same stale `photos` and clobber each other. Persistence happens in
      // the effect below — never inside the updater (that would setState during
      // render in SessionProvider).
      setPhotos(prev => ({ ...prev, [which]: [...prev[which], ...encoded] }));
    } catch {
      // A single bad image shouldn't break the upload — silently skip.
    }
  }
  function removePhoto(which: keyof InspectionPhotos, index: number) {
    setPhotos(prev => ({ ...prev, [which]: prev[which].filter((_, i) => i !== index) }));
  }
  // Persist photos to the session whenever they change (after render, so it
  // doesn't update SessionProvider mid-render).
  useEffect(() => {
    updateReturn(returnId, { inspectionPhotos: photos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  // Fill the real AGM Checkout PDF with the current (possibly partial) data and
  // open it in an inline preview overlay.
  async function openFullForm() {
    setFullFormLoading(true);
    try {
      const res = await fetch('/AGM_template.pdf');
      if (!res.ok) throw new Error('PDF template not found.');
      const bytes = await res.arrayBuffer();
      const { filled } = await fillAGMCheckoutPDF(bytes, displayReturn, propertyName, propertyConfig);
      const blob = new Blob([filled.buffer as ArrayBuffer], { type: 'application/pdf' });
      setFullFormUrl(URL.createObjectURL(blob));
    } catch {
      // Button simply re-enables; the Review screen also surfaces PDF errors.
    } finally {
      setFullFormLoading(false);
    }
  }
  function closeFullForm() {
    if (fullFormUrl) URL.revokeObjectURL(fullFormUrl);
    setFullFormUrl(null);
  }

  function nextSection() {
    saveProgress();
    if (section < SECTIONS.length - 1) setSection(s => s + 1);
  }
  function prevSection() {
    saveProgress();
    if (section > 0) setSection(s => s - 1);
  }

  const moveOutDisplay = tenantData.moveOutDate
    ? new Date(tenantData.moveOutDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-surface border-b border-separator px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-secondary hover:text-app-text transition-colors shrink-0"
          >
            ← Dashboard
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-app-text truncate">
              {tenantData.tenantName} — Unit {tenantData.unit}
            </h1>
            <p className="text-xs text-secondary mt-0.5">
              {propertyName}
              {moveOutDisplay ? ` · Move-out ${moveOutDisplay}` : ''}
              {' · '}
              <span className="inline-flex items-center gap-1">
                <UtilityTag type={liveUtilityData.utilityType} />
              </span>
              {tenantData.leaseBreak && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-warning/12 text-warning-fg rounded text-xs font-medium">
                  Lease break
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openFullForm}
              disabled={fullFormLoading}
              className="text-sm text-secondary hover:text-app-text border border-separator px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {fullFormLoading ? 'Loading…' : 'View full form'}
            </button>
            <button
              onClick={goToReview}
              className="text-sm bg-accent hover:bg-accent-hover text-on-accent font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Review &amp; Submit →
            </button>
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-fill flex items-center justify-center text-base hover:brightness-95 dark:hover:brightness-110 transition-colors shrink-0"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: sidebar + content ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Section sidebar */}
        <aside className="w-60 shrink-0 bg-surface border-r border-separator flex flex-col overflow-y-auto">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-app-text">Form sections</p>
              <p className="text-xs text-secondary">Click a section to focus it</p>
            </div>
            {/* ⓘ button — opens Data & Calculations panel */}
            <button
              onClick={() => setShowDataPanel(p => !p)}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                showDataPanel
                  ? 'bg-accent/12 text-accent'
                  : 'bg-fill text-secondary hover:bg-fill'
              }`}
              aria-label="Show data & calculations"
              title="Data & Calculations"
            >
              ⓘ
            </button>
          </div>

          <nav className="flex-1 px-2 pb-4 space-y-0.5">
            {SECTIONS.map((s, i) => {
              const isActive = i === section;
              const isDone = !isActive && i <= maxReached;   // reached, not current → complete
              return (
                <button
                  key={i}
                  onClick={() => { saveProgress(); setSection(i); }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-fill text-app-text'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    isActive
                      ? 'bg-accent text-on-accent'
                      : isDone
                      ? 'bg-success/15 text-success-fg'
                      : 'bg-separator text-secondary'
                  }`}>
                    {isDone ? '✓' : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{s.title}</p>
                    <p className="text-xs text-secondary mt-0.5 leading-tight">{s.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

          {section === 0 && (
            <SectionPropertyTenant
              tenantData={tenantData}
              onUpdateTenant={updateTenant}
              onUpdateAddress={updateAddress}
            />
          )}
          {section === 1 && (
            <SectionLeaseDates
              tenantData={tenantData}
              onUpdate={updateTenant}
            />
          )}
          {section === 2 && (
            <SectionNRCFees
              nrcCleaningFee={nrcCleaningFee}
              nrcPetFee={nrcPetFee}
              onCleaningChange={setNrcCleaningFee}
              onPetChange={setNrcPetFee}
            />
          )}
          {section === 3 && (
            <SectionInspection
              inspectionSigned={tenantData.inspectionStatus === 'signed'}
              onToggle={v => updateTenant('inspectionStatus', v ? 'signed' : 'missing')}
              photos={photos}
              onAddPhotos={addPhotos}
              onRemovePhoto={removePhoto}
              moveInDate={tenantData.moveInDate}
              moveOutDate={tenantData.moveOutDate}
            />
          )}
          {section === 4 && (
            <SectionRentDue calculatedCharges={calculatedCharges} tenantData={tenantData} />
          )}
          {section === 5 && (
            <SectionTotalCharges
              manualCharges={manualCharges}
              onChange={updateCharge}
              nrcCleaningFee={nrcCleaningFee}
              cleaningTenant={cleaningTenant}
            />
          )}
          {section === 6 && (
            <SectionUtility
              utilityData={liveUtilityData}
              utilityType={utilityType}
              onTypeChange={setUtilityType}
              rubsInput={rubsInput}
              onRubsChange={setRubsInput}
              utilityCharge={calculatedCharges.utilityCharge}
              utilityRate={utilityRate}
              onRateChange={setUtilityRate}
            />
          )}
          {section === 7 && (
            <SectionLegalCosts
              legalCourtCosts={manualCharges.legalCourtCosts}
              onChange={v => updateCharge('legalCourtCosts', v)}
            />
          )}
          {section === 8 && (
            <SectionRefundsCredits
              depositData={liveDepositData}
              manualCharges={manualCharges}
              cleaningTenant={cleaningTenant}
              calculatedCharges={calculatedCharges}
              totalCredits={totalCredits}
              totalCharges={totalCharges}
              balance={balance}
            />
          )}

          {/* Bottom navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={prevSection}
              disabled={section === 0}
              className="text-sm font-medium text-secondary hover:text-app-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs text-secondary">Section {section + 1} of {SECTIONS.length}</span>
            {section === SECTIONS.length - 1 ? (
              <button
                onClick={goToReview}
                className="text-sm font-semibold bg-accent hover:bg-accent-hover text-on-accent px-4 py-2 rounded-xl transition-colors"
              >
                Review &amp; Submit →
              </button>
            ) : (
              <button
                onClick={nextSection}
                className="text-sm font-medium text-app-text hover:underline transition-colors"
              >
                Next →
              </button>
            )}
          </div>
        </main>
      </div>

      {/* ── Data & Calculations panel (slide-in overlay) ─────────────────────── */}
      {showDataPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
            onClick={() => setShowDataPanel(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-96 bg-surface shadow-2xl overflow-y-auto flex flex-col">
            <div className="px-5 py-4 border-b border-separator flex items-center justify-between sticky top-0 bg-surface">
              <div>
                <p className="text-sm font-semibold text-app-text">Data &amp; Calculations</p>
                <p className="text-xs text-secondary">All values driving this return</p>
              </div>
              <button
                onClick={() => setShowDataPanel(false)}
                className="w-7 h-7 rounded-full bg-fill text-secondary flex items-center justify-center hover:bg-fill text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 space-y-3">
              <DataPanelSection title="Tenant &amp; Property">
                <DataRow label="Tenant" value={tenantData.tenantName} />
                <DataRow label="Co-tenant" value={tenantData.coTenant || 'None'} />
                <DataRow label="Unit" value={tenantData.unit} />
                <DataRow label="Property" value={propertyName} />
                <DataRow label="Forwarding address" value={
                  [tenantData.forwardingAddress.street, tenantData.forwardingAddress.city,
                   tenantData.forwardingAddress.state, tenantData.forwardingAddress.zip]
                    .filter(Boolean).join(', ')
                } />
                <DataRow
                  label="Inspection on file"
                  value={tenantData.inspectionStatus === 'signed' ? '✓ Signed' : '✗ Missing'}
                  highlight={tenantData.inspectionStatus === 'signed' ? 'green' : 'red'}
                />
              </DataPanelSection>

              <DataPanelSection title="Deposits Held">
                <DataRow label="Security deposit" value={formatCurrency(liveDepositData.securityDeposit)} />
                {liveDepositData.petDeposit > 0 && <DataRow label="Pet deposit" value={formatCurrency(liveDepositData.petDeposit)} />}
                {liveDepositData.keyDeposit > 0 && <DataRow label="Key deposit" value={formatCurrency(liveDepositData.keyDeposit)} />}
                {liveDepositData.garageOpenerDeposit > 0 && <DataRow label="Garage opener" value={formatCurrency(liveDepositData.garageOpenerDeposit)} />}
                <DataRow label="Total credits" value={formatCurrency(totalCredits)} bold />
              </DataPanelSection>

              <DataPanelSection title="Lease &amp; Dates">
                <DataRow label="Move-in" value={tenantData.moveInDate} />
                <DataRow label="Move-out" value={tenantData.moveOutDate} />
                <DataRow label="Paid rent through" value={tenantData.paidThroughDate || '—'} />
                <DataRow label="Notice date" value={tenantData.noticeDate || '—'} />
                <DataRow label="Lease end date" value={tenantData.leaseEndDate || '—'} />
                <DataRow label="Monthly rent" value={formatCurrency(tenantData.monthlyRent)} />
                <DataRow label="Lease break?" value={tenantData.leaseBreak ? 'Yes' : 'No'} />
                {tenantData.leaseBreak && <DataRow label="New tenant move-in" value={tenantData.newTenantMoveInDate ?? '—'} />}
              </DataPanelSection>

              <DataPanelSection title="Charges">
                {manualCharges.generalCleaning > 0 && <DataRow label="General cleaning (tenant)" value={formatCurrency(cleaningTenant)} />}
                {manualCharges.carpetShampooing > 0 && <DataRow label="Carpet shampooing" value={formatCurrency(manualCharges.carpetShampooing)} />}
                {manualCharges.painting > 0 && <DataRow label="Painting" value={formatCurrency(manualCharges.painting)} />}
                {manualCharges.legalCourtCosts > 0 && <DataRow label="Legal / court costs" value={formatCurrency(manualCharges.legalCourtCosts)} />}
                {calculatedCharges.rentDue > 0 && <DataRow label="Rent due" value={formatCurrency(calculatedCharges.rentDue)} />}
                {calculatedCharges.utilityCharge > 0 && <DataRow label="Utility charge" value={formatCurrency(calculatedCharges.utilityCharge)} />}
                <DataRow label="Total charges" value={formatCurrency(totalCharges)} bold />
              </DataPanelSection>

              <DataPanelSection title="Balance">
                <div className={`flex justify-between py-2 text-sm font-bold ${
                  balance === 0 ? 'text-secondary'
                  : balance > 0 ? 'text-success-fg'
                  : 'text-danger-fg'
                }`}>
                  <span>{balance === 0 ? 'No balance' : balance > 0 ? 'Return to tenant' : 'Balance owing landlord'}</span>
                  <span>{formatCurrency(Math.abs(balance))}</span>
                </div>
              </DataPanelSection>
            </div>
          </div>
        </>
      )}

      {/* ── Full-form preview overlay (live AGM Checkout PDF) ─────────────────── */}
      {fullFormUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col" onClick={closeFullForm}>
          <div
            className="bg-surface m-auto w-[92vw] h-[92vh] rounded-2xl overflow-hidden flex flex-col shadow-card"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-separator shrink-0">
              <div>
                <p className="text-sm font-semibold text-app-text">AGM Checkout Report — full form preview</p>
                <p className="text-xs text-secondary">Completed fields are filled in; the rest stay blank until you enter them.</p>
              </div>
              <button
                onClick={closeFullForm}
                className="text-sm text-secondary hover:text-app-text border border-separator px-3 py-1.5 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
            <iframe src={fullFormUrl} title="AGM Checkout Report preview" className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────

// Every field uses the SAME neutral, editable style now — no color-coding by
// data source. (The `variant` prop is kept on the field components so existing
// call sites don't break, but it no longer changes the appearance.)
type InputVariant = 'appfolio' | 'manual' | 'calculated';
const NEUTRAL_INPUT = 'bg-surface border-tertiary';
const INPUT_STYLE: Record<InputVariant, string> = {
  appfolio:   NEUTRAL_INPUT,
  manual:     NEUTRAL_INPUT,
  calculated: NEUTRAL_INPUT,
};

function EditField({
  label, value, onChange, variant = 'appfolio', type = 'text', placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  variant?: InputVariant;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-xl px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-accent transition-colors ${INPUT_STYLE[variant]}`}
      />
    </label>
  );
}

// A numeric money/amount input that:
//  • when NOT focused, shows a formatted value ("0.00", "1,575.00") — two decimals
//    for money fields, so blank fields read as "0.00" and filled ones stay tidy;
//  • when focused, lets you type freely and DELETE everything (no sticky "0");
//  • flags a still-blank ($0) field in orange so PMs see what's unfilled.
// `prefix=""` switches off money formatting (used for the RUBS unit ratio).
function AmountInput({
  value, onChange, prefix = '$', widthClass = 'w-full', align = 'left', dense = false,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  widthClass?: string;
  align?: 'left' | 'right';
  dense?: boolean;
}) {
  const money = prefix !== '';
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const isEmpty = !value;
  const flagged = isEmpty && !focused;
  const blurred = money ? value.toFixed(2) : (value === 0 ? '' : String(value));
  const display = focused ? draft : blurred;

  return (
    <div className={`relative ${widthClass}`}>
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={() => { setFocused(true); setDraft(value ? String(value) : ''); }}
        onChange={e => {
          // Keep only digits and a single decimal point; empty is allowed.
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          setDraft(raw);
          const n = parseFloat(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        onBlur={() => setFocused(false)}
        className={`w-full rounded-xl border ${prefix ? 'pl-7' : 'px-3'} ${flagged ? 'pr-16' : 'pr-3'} ${dense ? 'py-1.5' : 'py-2'} text-sm text-app-text ${align === 'right' ? 'text-right' : ''} focus:outline-none focus:ring-2 focus:ring-accent transition-colors ${
          flagged ? 'bg-warning/5 border-warning' : NEUTRAL_INPUT
        }`}
      />
      {flagged && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-warning-fg bg-warning/15 px-1.5 py-0.5 rounded-full pointer-events-none">
          empty
        </span>
      )}
    </div>
  );
}

function NumberField({
  label, value, onChange, prefix = '$',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  variant?: InputVariant;   // kept for existing call sites; no visual effect
  prefix?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-secondary">{label}</span>
      <AmountInput value={value} onChange={onChange} prefix={prefix} />
    </label>
  );
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-separator p-5 space-y-4">
      {title && <p className="text-xs font-semibold text-secondary uppercase tracking-wider">{title}</p>}
      {children}
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-separator">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-sm font-medium text-app-text">{value || '—'}</span>
    </div>
  );
}

// ── Data panel primitives ──────────────────────────────────────────────────────

function DataPanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-separator overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-2 hover:bg-fill transition-colors"
      >
        {/* Use dangerouslySetInnerHTML-safe approach: render as text, not HTML */}
        <span className="text-xs font-semibold text-app-text"
          // title contains &amp; entities which React renders correctly as text
        >{title.replace(/&amp;/g, '&')}</span>
        <span className="text-xs text-secondary">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 py-2 space-y-0">{children}</div>}
    </div>
  );
}

function DataRow({ label, value, bold, highlight }: {
  label: string; value: string; bold?: boolean; highlight?: 'green' | 'red';
}) {
  const valueClass = highlight === 'green'
    ? 'text-success-fg font-medium'
    : highlight === 'red'
    ? 'text-danger-fg font-medium'
    : bold ? 'font-semibold text-app-text'
    : 'text-app-text';
  return (
    <div className="flex justify-between py-1.5 border-b border-separator last:border-0">
      <span className={`text-xs ${bold ? 'font-semibold text-app-text' : 'text-secondary'}`}>{label}</span>
      <span className={`text-xs ${valueClass}`}>{value || '—'}</span>
    </div>
  );
}

// ── Section components ──────────────────────────────────────────────────────────

function SectionPropertyTenant({
  tenantData, onUpdateTenant, onUpdateAddress,
}: {
  tenantData: TenantData;
  onUpdateTenant: <K extends keyof TenantData>(k: K, v: TenantData[K]) => void;
  onUpdateAddress: (f: keyof TenantData['forwardingAddress'], v: string) => void;
}) {
  return (
    <SectionCard title="Property &amp; Tenant">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <EditField label="Primary tenant" value={tenantData.tenantName} onChange={v => onUpdateTenant('tenantName', v)} />
        </div>
        <div className="col-span-2">
          <EditField label="Co-tenant / co-signer" value={tenantData.coTenant} onChange={v => onUpdateTenant('coTenant', v)} placeholder="None" />
        </div>
        <EditField label="Unit #" value={tenantData.unit} onChange={v => onUpdateTenant('unit', v)} />
      </div>
      <p className="text-xs font-medium text-secondary mt-2">Forwarding address (where to mail the check)</p>
      <EditField label="Street" value={tenantData.forwardingAddress.street} onChange={v => onUpdateAddress('street', v)} placeholder="123 Main St" />
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <EditField label="City" value={tenantData.forwardingAddress.city} onChange={v => onUpdateAddress('city', v)} />
        </div>
        <EditField label="State" value={tenantData.forwardingAddress.state} onChange={v => onUpdateAddress('state', v)} placeholder="WA" />
        <EditField label="ZIP" value={tenantData.forwardingAddress.zip} onChange={v => onUpdateAddress('zip', v)} placeholder="98101" />
      </div>
    </SectionCard>
  );
}

function SectionLeaseDates({
  tenantData, onUpdate,
}: {
  tenantData: TenantData;
  onUpdate: <K extends keyof TenantData>(k: K, v: TenantData[K]) => void;
}) {
  return (
      <SectionCard title="Lease &amp; Dates">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Monthly rent" value={tenantData.monthlyRent} onChange={v => onUpdate('monthlyRent', v)} />
          <EditField label="Move-in date" value={tenantData.moveInDate} onChange={v => onUpdate('moveInDate', v)} type="date" />
          <EditField label="Move-out date" value={tenantData.moveOutDate} onChange={v => onUpdate('moveOutDate', v)} type="date" />
          <EditField label="Paid rent through" value={tenantData.paidThroughDate} onChange={v => onUpdate('paidThroughDate', v)} type="date" variant="manual" />
          <EditField label="Notice date" value={tenantData.noticeDate} onChange={v => onUpdate('noticeDate', v)} type="date" />
          <EditField label="Lease end date" value={tenantData.leaseEndDate} onChange={v => onUpdate('leaseEndDate', v)} type="date" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none pt-2">
          <input
            type="checkbox"
            checked={tenantData.leaseBreak}
            onChange={e => onUpdate('leaseBreak', e.target.checked)}
            className="w-4 h-4 rounded border-tertiary accent-accent"
          />
          <span className="text-sm text-app-text">Lease break (early termination)</span>
        </label>
        {tenantData.leaseBreak && (
          <EditField
            label="New tenant move-in date"
            value={tenantData.newTenantMoveInDate ?? ''}
            onChange={v => onUpdate('newTenantMoveInDate', v || null)}
            type="date"
            variant="manual"
          />
        )}
      </SectionCard>
  );
}

function SectionNRCFees({
  nrcCleaningFee, nrcPetFee, onCleaningChange, onPetChange,
}: {
  nrcCleaningFee: number;
  nrcPetFee: number;
  onCleaningChange: (v: number) => void;
  onPetChange: (v: number) => void;
}) {
  return (
    <SectionCard title="NRC Fees">
      <p className="text-sm text-secondary">
        Non-refundable charges (NRC) offset cleaning costs — the tenant's share of general cleaning
        is reduced by the NRC cleaning fee already collected.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="NRC cleaning fee" value={nrcCleaningFee} onChange={onCleaningChange} variant="appfolio" />
        <NumberField label="NRC pet fee" value={nrcPetFee} onChange={onPetChange} variant="appfolio" />
      </div>
      {(nrcCleaningFee > 0 || nrcPetFee > 0) && (
        <p className="text-xs text-success-fg bg-success/10 rounded-xl px-3 py-2">
          Pre-filled from property config. Edit here if this unit's NRC amounts differ.
        </p>
      )}
    </SectionCard>
  );
}

function SectionInspection({
  inspectionSigned, onToggle, photos, onAddPhotos, onRemovePhoto, moveInDate, moveOutDate,
}: {
  inspectionSigned: boolean;
  onToggle: (v: boolean) => void;
  photos: InspectionPhotos;
  onAddPhotos: (which: keyof InspectionPhotos, files: FileList | null) => void;
  onRemovePhoto: (which: keyof InspectionPhotos, index: number) => void;
  moveInDate: string;
  moveOutDate: string;
}) {
  return (
    <SectionCard title="Move-In / Out Photos">
      <p className="text-sm text-secondary">
        A signed move-in inspection report is required to legally defend deductions in small claims court under Washington RCW 59.18.280.
      </p>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={inspectionSigned}
          onChange={e => onToggle(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-tertiary accent-accent"
        />
        <div>
          <span className="text-sm font-medium text-app-text">Signed move-in inspection is on file</span>
          {!inspectionSigned && (
            <p className="text-xs text-danger-fg mt-1">
              ⚠ Without a signed inspection, any repair or cleaning deductions may be challenged.
            </p>
          )}
          {inspectionSigned && (
            <p className="text-xs text-success-fg mt-1">
              ✓ Deductions are defensible in small claims court.
            </p>
          )}
        </div>
      </label>

      {/* Photo upload — move-in and move-out side by side. */}
      <div className="grid grid-cols-2 gap-4 border-t border-separator pt-4">
        <PhotoUpload
          title="Move-in photos"
          date={moveInDate}
          images={photos.moveIn}
          onAdd={files => onAddPhotos('moveIn', files)}
          onRemove={i => onRemovePhoto('moveIn', i)}
        />
        <PhotoUpload
          title="Move-out photos"
          date={moveOutDate}
          images={photos.moveOut}
          onAdd={files => onAddPhotos('moveOut', files)}
          onRemove={i => onRemovePhoto('moveOut', i)}
        />
      </div>
    </SectionCard>
  );
}

// One upload column (move-in or move-out): drop/click to add, thumbnail grid.
function PhotoUpload({
  title, date, images, onAdd, onRemove,
}: {
  title: string;
  date: string;
  images: string[];
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-app-text">{title}</span>
        {date && <span className="text-xs text-secondary">{date}</span>}
      </div>

      {/* Click-to-upload zone */}
      <label className="flex flex-col items-center justify-center gap-1 border border-dashed border-tertiary rounded-xl py-6 cursor-pointer hover:bg-fill transition-colors">
        <span className="text-xl">📷</span>
        <span className="text-xs text-secondary">Click to upload</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { onAdd(e.target.files); e.currentTarget.value = ''; }}
        />
      </label>

      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative group aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${title} ${i + 1}`} className="w-full h-full object-cover rounded-lg border border-separator" />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-secondary text-center">No photos yet</p>
      )}
    </div>
  );
}

function SectionRentDue({
  calculatedCharges, tenantData,
}: {
  calculatedCharges: TenantReturn['calculatedCharges'];
  tenantData: TenantData;
}) {
  return (
    <SectionCard title="Rent Due">
      <p className="text-sm text-secondary">
        Calculated automatically from move-out date vs paid-through date and monthly rent. Set "Paid rent through" in Lease &amp; Dates to compute this.
      </p>
      {!tenantData.paidThroughDate && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 text-sm text-warning-fg">
          ⚠ "Paid rent through" is blank — go to Lease &amp; Dates to fill it in.
        </div>
      )}
      <div className="space-y-1">
        <ReadOnlyRow label="Rent due date range" value={calculatedCharges.rentDueDateRange ?? '—'} />
        <ReadOnlyRow label="Rent due amount" value={calculatedCharges.rentDue > 0 ? formatCurrency(calculatedCharges.rentDue) : '$0.00'} />
        {tenantData.leaseBreak && (
          <p className="text-xs text-warning-fg pt-1">
            Lease break active — this tenant may owe additional lease-break fees (enter under Total Charges → Other).
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function SectionUtility({
  utilityData, utilityType, onTypeChange, rubsInput, onRubsChange, utilityCharge, utilityRate, onRateChange,
}: {
  utilityData: TenantReturn['utilityData'];
  utilityType: UtilityType;
  onTypeChange: (v: UtilityType) => void;
  rubsInput: RUBSManualInput;
  onRubsChange: (v: RUBSManualInput) => void;
  utilityCharge: number;
  utilityRate: number;
  onRateChange: (v: number) => void;
}) {
  return (
    <SectionCard title="Utility Charges">
      {/* Utility type toggle — seeded from the property but editable per unit. */}
      <div>
        <span className="text-xs font-medium text-secondary">Utility type for this unit</span>
        <div className="mt-1 inline-flex rounded-xl border border-tertiary overflow-hidden">
          {(['RUBS', 'flat_fee'] as UtilityType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(t)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                utilityType === t ? 'bg-accent text-on-accent' : 'bg-surface text-secondary hover:text-app-text'
              }`}
            >
              {t === 'RUBS' ? 'RUBS' : 'Flat Fee'}
            </button>
          ))}
        </div>
      </div>

      {utilityData.utilityType === 'flat_fee' && (
        <div className="space-y-3 border-t border-separator pt-4">
          <p className="text-sm text-secondary">
            Monthly flat fee billed at move-out. Pre-filled from property config — edit if this unit differs.
          </p>
          <div className="w-48">
            <NumberField label="Flat fee rate ($/month)" value={utilityRate} onChange={onRateChange} />
          </div>
          {utilityCharge > 0 ? (
            <p className="text-sm font-medium text-app-text">
              Calculated utility charge: {formatCurrency(utilityCharge)}
            </p>
          ) : (
            <p className="text-sm text-secondary">Utility included in rent — no charge at move-out.</p>
          )}
        </div>
      )}

      {utilityData.utilityType === 'RUBS' && (
        <div className="space-y-3 border-t border-separator pt-4">
          <p className="text-sm text-secondary">
            RUBS: tenant pays their proportional share of the final water bill. Charge = Building Total × Unit Ratio.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Building total ($)" value={rubsInput.buildingTotal} onChange={v => onRubsChange({ ...rubsInput, buildingTotal: v })} variant="manual" />
            <NumberField label="Unit ratio (e.g. 0.08)" value={rubsInput.unitRatio} onChange={v => onRubsChange({ ...rubsInput, unitRatio: v })} variant="manual" prefix="" />
          </div>
          <p className="text-sm font-medium text-app-text">
            Calculated tenant share: {formatCurrency(utilityCharge)}
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function SectionLegalCosts({
  legalCourtCosts, onChange,
}: {
  legalCourtCosts: number;
  onChange: (v: number) => void;
}) {
  return (
    <SectionCard title="Legal / Court Costs">
      <p className="text-sm text-secondary">
        Attorney fees, filing fees, or other court costs owed by the tenant. Leave at $0 if none.
      </p>
      <div className="w-48">
        <NumberField label="Legal / court costs" value={legalCourtCosts} onChange={onChange} variant="manual" />
      </div>
    </SectionCard>
  );
}

function ChargeRow({
  label, chargeKey, value, onChange,
}: {
  label: string;
  chargeKey: keyof ManualCharges;
  value: number;
  onChange: (key: keyof ManualCharges, v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-sm text-app-text">{label}</span>
      <AmountInput value={value} onChange={v => onChange(chargeKey, v)} widthClass="w-32" align="right" dense />
    </div>
  );
}

function SectionTotalCharges({
  manualCharges, onChange, nrcCleaningFee, cleaningTenant,
}: {
  manualCharges: ManualCharges;
  onChange: (key: keyof ManualCharges, v: number | string) => void;
  nrcCleaningFee: number;
  cleaningTenant: number;
}) {
  return (
    <SectionCard title="Turnover Charges">
      <p className="text-xs text-secondary">
        Enter the total vendor cost for each item. NRC offset is applied automatically to cleaning.
      </p>
      <div className="space-y-2">
        <ChargeRow label="General cleaning" chargeKey="generalCleaning" value={manualCharges.generalCleaning} onChange={onChange} />
        {nrcCleaningFee > 0 && manualCharges.generalCleaning > 0 && (
          <p className="text-xs text-success-fg pl-1">
            NRC offset: {formatCurrency(nrcCleaningFee)} → Tenant pays {formatCurrency(cleaningTenant)}
          </p>
        )}
        <ChargeRow label="Blind / drape cleaning" chargeKey="blindDrapeCleaning" value={manualCharges.blindDrapeCleaning} onChange={onChange} />
        <ChargeRow label="Window covering replacement" chargeKey="windowCoveringReplacement" value={manualCharges.windowCoveringReplacement} onChange={onChange} />
        <ChargeRow label="Carpet shampooing" chargeKey="carpetShampooing" value={manualCharges.carpetShampooing} onChange={onChange} />
        <ChargeRow label="Flooring restoration" chargeKey="flooringRestoration" value={manualCharges.flooringRestoration} onChange={onChange} />
        <ChargeRow label="Painting" chargeKey="painting" value={manualCharges.painting} onChange={onChange} />

        {/* Other 1 — editable label + amount */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualCharges.other1Label}
            onChange={e => onChange('other1Label', e.target.value)}
            placeholder="Other label"
            className="flex-1 bg-surface border border-tertiary rounded-xl px-3 py-1.5 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <AmountInput value={manualCharges.other1} onChange={v => onChange('other1', v)} widthClass="w-32" align="right" dense />
        </div>
        {/* Other 2 */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualCharges.other2Label}
            onChange={e => onChange('other2Label', e.target.value)}
            placeholder="Other label"
            className="flex-1 bg-surface border border-tertiary rounded-xl px-3 py-1.5 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <AmountInput value={manualCharges.other2} onChange={v => onChange('other2', v)} widthClass="w-32" align="right" dense />
        </div>
      </div>

      <p className="text-xs text-secondary border-t border-separator pt-3">
        The cumulative total (turnover + rent + utility + legal) is shown at the end in
        <span className="font-medium text-app-text"> Refunds &amp; Credits</span>.
      </p>
    </SectionCard>
  );
}

function SectionRefundsCredits({
  depositData, manualCharges, cleaningTenant, calculatedCharges, totalCredits, totalCharges, balance,
}: {
  depositData: DepositData;
  manualCharges: ManualCharges;
  cleaningTenant: number;
  calculatedCharges: TenantReturn['calculatedCharges'];
  totalCredits: number;
  totalCharges: number;
  balance: number;
}) {
  // Turnover/repairs subtotal (cleaning already net of the NRC offset).
  const turnover =
    cleaningTenant +
    manualCharges.blindDrapeCleaning +
    manualCharges.windowCoveringReplacement +
    manualCharges.carpetShampooing +
    manualCharges.flooringRestoration +
    manualCharges.painting +
    manualCharges.other1 +
    manualCharges.other2;

  return (
    <SectionCard title="Refunds &amp; Credits">
      {/* Cumulative charges breakdown — sums everything entered in prior sections. */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Charges</p>
        {turnover > 0 && <ReadOnlyRow label="Turnover charges (cleaning, repairs)" value={formatCurrency(turnover)} />}
        {calculatedCharges.rentDue > 0 && (
          <ReadOnlyRow label={`Rent due${calculatedCharges.rentDueDateRange ? ` (${calculatedCharges.rentDueDateRange})` : ''}`} value={formatCurrency(calculatedCharges.rentDue)} />
        )}
        {calculatedCharges.utilityCharge > 0 && <ReadOnlyRow label="Utility charge" value={formatCurrency(calculatedCharges.utilityCharge)} />}
        {manualCharges.legalCourtCosts > 0 && <ReadOnlyRow label="Legal / court costs" value={formatCurrency(manualCharges.legalCourtCosts)} />}
        <div className="flex justify-between py-2 border-t border-separator">
          <span className="text-sm font-semibold text-app-text">Total charges</span>
          <span className="text-sm font-semibold text-app-text">{formatCurrency(totalCharges)}</span>
        </div>
      </div>

      <div className="space-y-1 border-t border-separator pt-3">
        <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Credits</p>
        <ReadOnlyRow label="Security deposit paid" value={formatCurrency(depositData.securityDeposit)} />
        {depositData.petDeposit > 0 && <ReadOnlyRow label="Pet deposit" value={formatCurrency(depositData.petDeposit)} />}
        {depositData.keyDeposit > 0 && <ReadOnlyRow label="Key deposit" value={formatCurrency(depositData.keyDeposit)} />}
        {depositData.garageOpenerDeposit > 0 && <ReadOnlyRow label="Garage opener deposit" value={formatCurrency(depositData.garageOpenerDeposit)} />}
        <div className="flex justify-between py-2 border-t border-separator">
          <span className="text-sm font-semibold text-app-text">Total credits</span>
          <span className="text-sm font-semibold text-app-text">{formatCurrency(totalCredits)}</span>
        </div>
      </div>

      <div className="border-t border-separator pt-3 space-y-1.5">
        <div className="flex justify-between text-sm text-secondary">
          <span>Total charges</span>
          <span>{formatCurrency(totalCharges)}</span>
        </div>
        <div className="flex justify-between text-sm text-secondary">
          <span>Total credits</span>
          <span>{formatCurrency(totalCredits)}</span>
        </div>
        <div className={`flex justify-between py-2 px-3 rounded-xl text-sm font-bold ${
          balance === 0
            ? 'bg-fill text-secondary'
            : balance > 0
            ? 'bg-success/10 text-success-fg'
            : 'bg-danger/10 text-danger-fg'
        }`}>
          <span>
            {balance === 0 ? '$0 Balance' : balance > 0 ? 'Return to Tenant' : 'Balance Owing Landlord'}
          </span>
          <span>{formatCurrency(Math.abs(balance))}</span>
        </div>
      </div>
    </SectionCard>
  );
}
