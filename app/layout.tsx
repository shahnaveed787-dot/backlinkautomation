import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Backlink Planner",
  description: "Plan 10 backlink outreach tasks a day. Track them from draft to live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
