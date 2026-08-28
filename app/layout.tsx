import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
      <body className="flex min-h-dvh flex-col bg-canvas text-ink">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
