import type { Metadata } from "next";
// next/font self-hosts these at build time (no runtime request to Google), so
// they work on Cloudflare's edge and never flash a fallback. Inter is Notion's
// UI typeface; Lora is a warm serif that echoes Notion's marketing headings.
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/context/SessionContext";
import { ThemeProvider } from "@/context/ThemeContext";

// Each exposes a CSS variable we hand to Tailwind (see globals.css @theme).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });

export const metadata: Metadata = {
  title: "AGM Security Deposit Return Tool",
  description: "Generate AGM Checkout Report PDFs from AppFolio exports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning: the inline script below adds the `dark` class to
  // <html> before React hydrates. Without it, React treats the class as a
  // mismatch and strips it — causing a flash of light mode on dark reloads.
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${lora.variable}`} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — runs before paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('agm-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();` }} />
      </head>
      <body className="min-h-full bg-bg text-app-text transition-colors">
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
