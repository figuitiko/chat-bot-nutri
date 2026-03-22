import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatsApp Course Studio",
  description: "Admin dashboard and runtime for WhatsApp course automation with Twilio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">{children}</body>
    </html>
  );
}
