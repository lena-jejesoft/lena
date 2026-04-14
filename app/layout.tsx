import type { Metadata } from "next";
import "./globals.css";
import "@/components/chart/chartCore/chartCore.css";

export const metadata: Metadata = {
  title: "Lena - Chart Builder",
  description: "Chart Builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
