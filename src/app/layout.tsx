import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Behind The Headlines | CMS",
  description: "Editorial workspace for Behind The Headlines.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
