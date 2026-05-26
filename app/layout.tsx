import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deal Scanner",
  description: "Find extremely marked-down items in stores near you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
