import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DEBA — ديبا",
    template: "%s | DEBA",
  },
  description:
    "ديبا: سوق حديث لبيع وشراء وتبادل الأشياء المستعملة والجديدة، مع مسار تبرع شفاف وآمن.",
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
