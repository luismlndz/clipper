import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipper — real-time livestream clipper",
  description:
    "Paste a live stream URL and auto-clip interesting moments in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
