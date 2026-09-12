import { requireAdmin } from "@/lib/admin/access";
import { listPayouts } from "@/lib/membership/affiliate-store";

export async function GET() {
  await requireAdmin();
  const payouts = await listPayouts(500);
  const header = [
    "created_at",
    "status",
    "email",
    "amount_usd",
    "network",
    "address",
    "external_id",
    "paid_at",
  ];
  const lines = [
    header.join(","),
    ...payouts.map((row) =>
      [
        row.createdAt,
        row.status,
        row.email ?? "",
        row.amountUsd.toFixed(2),
        row.network ?? "",
        row.address ?? "",
        row.externalId ?? "",
        row.paidAt ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=affiliate-payouts.csv",
    },
  });
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
