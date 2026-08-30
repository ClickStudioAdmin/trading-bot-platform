import { loadMarketIcons } from "@/lib/market/caps";

export const maxDuration = 15;

export async function GET() {
  const icons = await loadMarketIcons();
  return Response.json({ icons: Object.fromEntries(icons) });
}
