import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "whatsapp-predefined-bot-backend",
  description: "Backend-only Next.js service for Twilio WhatsApp automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
