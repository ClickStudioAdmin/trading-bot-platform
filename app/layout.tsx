import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
import { redirectIfNeedsGate } from "@/lib/auth/onboarding";
import { loadPlatformName } from "@/lib/platform/brand";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  adjustFontFallback: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const name = await loadPlatformName();
  return {
    title: {
      default: name,
      template: `%s · ${name}`,
    },
    description: "Development environment.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await redirectIfNeedsGate();

  return (
    <html
      lang="en"
      className={geist.variable}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
