import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SessionBar } from "@/components/session-bar";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Trading Bot Platform",
    template: "%s · TBP",
  },
  description: "Development environment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.className}>
      <body>
        <SessionBar />
        {children}
      </body>
    </html>
  );
}
