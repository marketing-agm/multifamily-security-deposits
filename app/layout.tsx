import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/context/SessionContext";
import { AdminSettingsProvider } from "@/context/AdminSettingsContext";

export const metadata: Metadata = {
  title: "AGM Security Deposit Return Tool",
  description: "Generate AGM Checkout Report PDFs from AppFolio exports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <SessionProvider>
          <AdminSettingsProvider>{children}</AdminSettingsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
