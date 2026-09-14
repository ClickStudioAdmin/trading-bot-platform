import { requireAdmin } from "@/lib/admin/access";
import { affiliateAirdropCsv } from "@/lib/membership/affiliate";
import { listPayoutsForFile } from "@/lib/membership/affiliate-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const payouts = await listPayoutsForFile(id);
  if (payouts.length === 0) {
    return new Response("Payout file not found.", { status: 404 });
  }
  const csv = affiliateAirdropCsv(
    payouts.flatMap((row) =>
      row.address
        ? [{ address: row.address, amountUsd: row.amountUsd }]
        : [],
    ),
  );
  const network = payouts[0]?.network?.replace(/[^a-z0-9-]/gi, "") || "payout";
  const prefix =
    payouts[0]?.book === "main" ? "wallet-withdraw" : "affiliate-payout";
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${prefix}-${network}-${id.slice(0, 8)}.csv`,
    },
  });
}
