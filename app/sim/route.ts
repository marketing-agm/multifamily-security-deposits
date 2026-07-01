export const runtime = 'edge';

// Serves the simulation HTML at /sim by reading it from the static /sim.html file.
// This is needed because Next.js intercepts /sim before Cloudflare can serve
// the static file from public/sim/index.html.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const simHtml = await fetch(new URL('/sim.html', url.origin));
  const html = await simHtml.text();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
