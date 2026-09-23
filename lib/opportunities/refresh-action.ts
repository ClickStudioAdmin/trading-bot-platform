"use server";

import { persistOpportunities } from "@/lib/opportunities/persist";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";

export async function refreshOpportunityScan(): Promise<boolean> {
  try {
    const rows = await scanCarryOpportunities();
    const saved = await persistOpportunities(rows);
    return saved.status === "saved";
  } catch {
    return false;
  }
}
