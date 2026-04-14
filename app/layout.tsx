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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pudding-theme");if(t==="light"){document.documentElement.classList.remove("dark");document.documentElement.setAttribute("data-theme","light")}else{document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
