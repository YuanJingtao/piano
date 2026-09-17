import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "钢琴快速识谱",
  description: "面向钢琴初学者的识谱训练",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
