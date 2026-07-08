// BrandMark — the shared AGM logo tile.
//
// Both AGM Report Studio and the AGM Corporate Library front their headers with
// the same signature: a small brand-black rounded square holding the "AGM"
// wordmark. Reproducing it here is the single strongest cue that this tool
// belongs to the same family. It's pure CSS/text — no image asset to ship.
//
// `size` lets a caller scale the tile (the number is the square's side in px).

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-md bg-[#1a1a19] text-white font-semibold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        // Scale the "AGM" text to the tile so it stays snug at any size.
        fontSize: size * 0.34,
        letterSpacing: '0.02em',
      }}
    >
      AGM
    </span>
  );
}
