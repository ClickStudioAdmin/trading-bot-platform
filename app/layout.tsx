import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
import { redirectIfNeedsFirstDesk } from "@/lib/auth/onboarding";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await redirectIfNeedsFirstDesk();

  return (
    <html lang="en" className={geist.className}>
      <body className="min-h-dvh bg-canvas text-ink">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
