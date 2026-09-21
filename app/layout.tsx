import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DEBA",
    template: "%s | DEBA",
  },
  description:
    "DEBA — a modern marketplace for buying, selling, exchanging, and giving useful things another life.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
