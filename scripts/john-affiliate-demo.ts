import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_DOMAIN = "tbp-john-demo.invalid";
const NAME_PREFIX = "John";
const PASSWORD = "55555555";
const FANOUT = 5;
const DEPTH = 5;
const BATCH = 150;
const CHUNK = 80;
const DEMO_TAG = "john-demo:";
const CAMPAIGN_PREFIX = "John demo";
const LINK_SLUG_PREFIX = "JDEM";
const MANIFEST_JSON = resolve(process.cwd(), "tmp/john-affiliate-demo.json");
const MANIFEST_TXT = resolve(process.cwd(), "tmp/john-affiliate-demo.txt");
const ADMIN_EMAIL_HINT = "click.studio.admin@gmail.com";
const DEMO_RATES = {
  affiliate_default_l1_pct: 10,
  affiliate_default_l2_pct: 5,
  affiliate_default_l3_pct: 3,
  affiliate_default_l4_pct: 2,
  affiliate_default_l5_pct: 1,
};

type Person = {
  path: number[];
  pathKey: string;
  level: number;
  userId: string;
  email: string;
  name: string;
  alias: string;
  code: string;
  parentUserId: string;
  paid: boolean;
  platformMember: boolean;
};

type SettingsSnapshot = {
  affiliate_max_depth: number;
  affiliate_default_l1_pct: number;
  affiliate_default_l2_pct: number;
  affiliate_default_l3_pct: number;
  affiliate_default_l4_pct: number;
  affiliate_default_l5_pct: number;
  ratesFilled: boolean;
};

function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    const raw = process.env[key];
    if (raw?.startsWith("hhttps://")) {
      process.env[key] = `https://${raw.slice("hhttps://".length)}`;
    }
  }
}

function pathKey(path: number[]): string {
  return path.join("-");
}

function emailFor(path: number[]): string {
  return `john.${pathKey(path)}@${EMAIL_DOMAIN}`;
}

function nameFor(path: number[]): string {
  return `${NAME_PREFIX} ${pathKey(path)}`;
}

function codeFor(path: number[]): string {
  return `JHN${path.map((n) => "ABCDE"[n - 1]).join("")}`;
}

function uplineIds(person: Person, byId: Map<string, Person>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = person.parentUserId;
  while (current && !seen.has(current)) {
    seen.add(current);
    ids.push(current);
    current = byId.get(current)?.parentUserId;
  }
  return ids;
}

function buildPeople(adminUserId: string): Person[] {
  const people: Person[] = [];
  const walk = (parentPath: number[], parentUserId: string, level: number) => {
    if (level > DEPTH) {
      return;
    }
    for (let slot = 1; slot <= FANOUT; slot += 1) {
      const path = [...parentPath, slot];
      const userId = randomUUID();
      const paid = slot === 1 || slot === 2;
      people.push({
        path,
        pathKey: pathKey(path),
        level,
        userId,
        email: emailFor(path),
        name: nameFor(path),
        alias: nameFor(path),
        code: codeFor(path),
        parentUserId,
        paid,
        platformMember: slot !== 5,
      });
      walk(path, userId, level + 1);
    }
  };
  walk([], adminUserId, 1);
  return people;
}

async function insertBatch(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    process.stdout.write(`  ${table} ${Math.min(i + chunk.length, rows.length)}/${rows.length}\n`);
  }
}

async function idsByEmailDomain(supabase: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("members")
      .select("user_id")
      .ilike("email", `%@${EMAIL_DOMAIN}`)
      .range(from, from + 999);
    if (error) {
      throw new Error(error.message);
    }
    const rows = data ?? [];
    ids.push(...rows.map((row) => String(row.user_id)));
    if (rows.length < 1000) {
      break;
    }
    from += 1000;
  }
  return ids;
}

async function deleteByColumn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
): Promise<void> {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in(column, ids.slice(i, i + CHUNK));
    if (error) {
      throw new Error(`${table}.${column}: ${error.message}`);
    }
  }
}

async function listDemoPayoutIds(
  supabase: SupabaseClient,
  johnIds: string[],
): Promise<string[]> {
  const ids = new Set<string>();
  const { data: tagged } = await supabase
    .from("membership_payouts")
    .select("id")
    .like("external_id", `${DEMO_TAG}%`);
  for (const row of tagged ?? []) {
    ids.add(String(row.id));
  }
  for (let i = 0; i < johnIds.length; i += CHUNK) {
    const { data } = await supabase
      .from("membership_payouts")
      .select("id")
      .in("user_id", johnIds.slice(i, i + CHUNK));
    for (const row of data ?? []) {
      ids.add(String(row.id));
    }
  }
  return [...ids];
}

async function listDemoInvoiceIds(
  supabase: SupabaseClient,
  johnIds: string[],
): Promise<string[]> {
  const ids = new Set<string>();
  const { data: tagged } = await supabase
    .from("membership_invoices")
    .select("id")
    .like("external_id", `${DEMO_TAG}%`);
  for (const row of tagged ?? []) {
    ids.add(String(row.id));
  }
  for (let i = 0; i < johnIds.length; i += CHUNK) {
    const { data } = await supabase
      .from("membership_invoices")
      .select("id")
      .in("user_id", johnIds.slice(i, i + CHUNK));
    for (const row of data ?? []) {
      ids.add(String(row.id));
    }
  }
  return [...ids];
}

async function clearDemo(
  supabase: SupabaseClient,
  snapshot?: SettingsSnapshot | null,
): Promise<number> {
  const johnIds = await idsByEmailDomain(supabase);
  const payoutIds = await listDemoPayoutIds(supabase, johnIds);
  const invoiceIds = await listDemoInvoiceIds(supabase, johnIds);

  if (payoutIds.length > 0) {
    await deleteByColumn(supabase, "membership_payout_items", "payout_id", payoutIds);
    await deleteByColumn(supabase, "membership_payouts", "id", payoutIds);
  }
  await supabase
    .from("membership_wallet_entries")
    .delete()
    .like("external_id", `${DEMO_TAG}%`);
  if (johnIds.length > 0) {
    await deleteByColumn(supabase, "membership_wallet_entries", "user_id", johnIds);
    await deleteByColumn(
      supabase,
      "membership_commissions",
      "source_user_id",
      johnIds,
    );
    await deleteByColumn(
      supabase,
      "membership_commissions",
      "earner_user_id",
      johnIds,
    );
  }
  if (invoiceIds.length > 0) {
    await deleteByColumn(supabase, "membership_invoices", "id", invoiceIds);
  }
  if (johnIds.length > 0) {
    await deleteByColumn(supabase, "membership_referrals", "user_id", johnIds);
  }
  await supabase
    .from("membership_affiliate_links")
    .delete()
    .ilike("slug", `${LINK_SLUG_PREFIX}%`);
  await supabase
    .from("membership_affiliate_campaigns")
    .delete()
    .ilike("name", `${CAMPAIGN_PREFIX}%`);
  if (johnIds.length > 0) {
    await deleteByColumn(supabase, "membership_affiliate_links", "user_id", johnIds);
    await deleteByColumn(
      supabase,
      "membership_affiliate_campaigns",
      "user_id",
      johnIds,
    );
    await deleteByColumn(supabase, "membership_referral_codes", "user_id", johnIds);
    await deleteByColumn(supabase, "trader_profiles", "user_id", johnIds);
    await deleteByColumn(supabase, "members", "user_id", johnIds);
  }

  if (snapshot) {
    const update: Record<string, unknown> = {
      affiliate_max_depth: snapshot.affiliate_max_depth,
    };
    if (snapshot.ratesFilled) {
      update.affiliate_default_l1_pct = snapshot.affiliate_default_l1_pct;
      update.affiliate_default_l2_pct = snapshot.affiliate_default_l2_pct;
      update.affiliate_default_l3_pct = snapshot.affiliate_default_l3_pct;
      update.affiliate_default_l4_pct = snapshot.affiliate_default_l4_pct;
      update.affiliate_default_l5_pct = snapshot.affiliate_default_l5_pct;
    }
    await supabase.from("platform_settings").update(update).eq("id", "tbp");
  }

  return johnIds.length;
}

async function findAdmin(supabase: SupabaseClient): Promise<{
  userId: string;
  email: string;
  name: string;
}> {
  const hinted = await supabase
    .from("members")
    .select("user_id, email, name")
    .eq("role", "admin")
    .eq("status", "active")
    .eq("email", ADMIN_EMAIL_HINT)
    .maybeSingle();
  if (hinted.data) {
    return {
      userId: String(hinted.data.user_id),
      email: String(hinted.data.email),
      name: String(hinted.data.name),
    };
  }
  const { data, error } = await supabase
    .from("members")
    .select("user_id, email, name")
    .eq("role", "admin")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw new Error("No active admin member found.");
  }
  return {
    userId: String(data.user_id),
    email: String(data.email),
    name: String(data.name),
  };
}

async function loadSettingsRow(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("platform_settings")
    .select(
      "affiliate_max_depth, affiliate_default_l1_pct, affiliate_default_l2_pct, affiliate_default_l3_pct, affiliate_default_l4_pct, affiliate_default_l5_pct",
    )
    .eq("id", "tbp")
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? "platform_settings row missing.");
  }
  return data as Record<string, number>;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function seed(supabase: SupabaseClient): Promise<void> {
  const existing = await idsByEmailDomain(supabase);
  if (existing.length > 0) {
    throw new Error(
      `${existing.length} Johns already exist. Run: npx tsx scripts/john-affiliate-demo.ts clear`,
    );
  }

  const admin = await findAdmin(supabase);
  const people = buildPeople(admin.userId);
  const byId = new Map(people.map((row) => [row.userId, row]));
  const passwordHash = hashPassword(PASSWORD);

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("id, slug, price_usd")
    .in("slug", ["free", "plus", "pro"]);
  const planBySlug = new Map(
    (plans ?? []).map((row) => [String(row.slug), String(row.id)]),
  );
  const freeId = planBySlug.get("free") ?? null;
  const plusId = planBySlug.get("plus") ?? freeId;
  const proId = planBySlug.get("pro") ?? plusId;

  const settings = await loadSettingsRow(supabase);
  const ratesZero =
    Number(settings.affiliate_default_l1_pct) === 0 &&
    Number(settings.affiliate_default_l2_pct) === 0 &&
    Number(settings.affiliate_default_l3_pct) === 0 &&
    Number(settings.affiliate_default_l4_pct) === 0 &&
    Number(settings.affiliate_default_l5_pct) === 0;
  const snapshot: SettingsSnapshot = {
    affiliate_max_depth: Number(settings.affiliate_max_depth),
    affiliate_default_l1_pct: Number(settings.affiliate_default_l1_pct),
    affiliate_default_l2_pct: Number(settings.affiliate_default_l2_pct),
    affiliate_default_l3_pct: Number(settings.affiliate_default_l3_pct),
    affiliate_default_l4_pct: Number(settings.affiliate_default_l4_pct),
    affiliate_default_l5_pct: Number(settings.affiliate_default_l5_pct),
    ratesFilled: ratesZero,
  };
  const settingsUpdate: Record<string, unknown> = { affiliate_max_depth: 5 };
  if (ratesZero) {
    Object.assign(settingsUpdate, DEMO_RATES);
  }
  const { error: settingsError } = await supabase
    .from("platform_settings")
    .update(settingsUpdate)
    .eq("id", "tbp");
  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const now = new Date().toISOString();
  console.log(`Admin ${admin.email}. Creating ${people.length} Johns…`);
  await insertBatch(
    supabase,
    "members",
    people.map((person) => {
      const paidPlan = person.level % 2 === 0 ? proId : plusId;
      return {
        user_id: person.userId,
        email: person.email,
        name: person.name,
        role: "member",
        status: "active",
        platform_member: person.platformMember,
        plan_id: person.paid ? paidPlan : freeId,
        last_enroll_plan_id: person.paid ? paidPlan : freeId,
        subscription_status: person.paid ? "active" : "none",
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      };
    }),
  );

  await insertBatch(
    supabase,
    "trader_profiles",
    people.map((person) => ({
      user_id: person.userId,
      alias: person.alias,
      bio: "John affiliate demo. Safe to delete.",
    })),
  );

  const { data: adminCodeRow } = await supabase
    .from("membership_referral_codes")
    .select("code")
    .eq("user_id", admin.userId)
    .maybeSingle();
  let adminCode = typeof adminCodeRow?.code === "string" ? adminCodeRow.code : "";
  if (!adminCode) {
    adminCode = "JHNADMN";
    const { error } = await supabase.from("membership_referral_codes").insert({
      user_id: admin.userId,
      code: adminCode,
    });
    if (error && error.code !== "23505") {
      throw new Error(error.message);
    }
  }

  await insertBatch(
    supabase,
    "membership_referral_codes",
    people.map((person) => ({
      user_id: person.userId,
      code: person.code,
    })),
  );

  const campaignYoutube = randomUUID();
  const campaignTwitter = randomUUID();
  const campaignArchived = randomUUID();
  const campaignJohnOne = randomUUID();
  const linkHome = randomUUID();
  const linkAffiliates = randomUUID();
  const linkArchived = randomUUID();
  const linkJohnOne = randomUUID();

  await insertBatch(supabase, "membership_affiliate_campaigns", [
    {
      id: campaignYoutube,
      user_id: admin.userId,
      name: `${CAMPAIGN_PREFIX} YouTube`,
    },
    {
      id: campaignTwitter,
      user_id: admin.userId,
      name: `${CAMPAIGN_PREFIX} Twitter`,
    },
    {
      id: campaignArchived,
      user_id: admin.userId,
      name: `${CAMPAIGN_PREFIX} Archived`,
    },
    {
      id: campaignJohnOne,
      user_id: people[0]?.userId,
      name: `${CAMPAIGN_PREFIX} John 1`,
    },
  ]);

  await insertBatch(supabase, "membership_affiliate_links", [
    {
      id: linkHome,
      user_id: admin.userId,
      campaign_id: campaignYoutube,
      slug: `${LINK_SLUG_PREFIX}HOME1`,
      name: `${CAMPAIGN_PREFIX} home`,
      landing: "home",
    },
    {
      id: linkAffiliates,
      user_id: admin.userId,
      campaign_id: campaignTwitter,
      slug: `${LINK_SLUG_PREFIX}AFF1`,
      name: `${CAMPAIGN_PREFIX} affiliates`,
      landing: "affiliates",
    },
    {
      id: linkArchived,
      user_id: admin.userId,
      campaign_id: campaignArchived,
      slug: `${LINK_SLUG_PREFIX}OLD1`,
      name: `${CAMPAIGN_PREFIX} old link`,
      landing: "home",
    },
    {
      id: linkJohnOne,
      user_id: people[0]?.userId,
      campaign_id: campaignJohnOne,
      slug: `${LINK_SLUG_PREFIX}J1A`,
      name: `${CAMPAIGN_PREFIX} John 1 link`,
      landing: "home",
    },
  ]);
  await supabase
    .from("membership_affiliate_campaigns")
    .update({ archived_at: daysAgo(4) })
    .eq("id", campaignArchived);
  await supabase
    .from("membership_affiliate_links")
    .update({ archived_at: daysAgo(3) })
    .eq("id", linkArchived);

  await insertBatch(
    supabase,
    "membership_referrals",
    people.map((person) => {
      const slot = person.path[0] ?? 1;
      const useAdminLink = person.level === 1;
      return {
        user_id: person.userId,
        referrer_user_id: person.parentUserId,
        code: person.level === 1 ? adminCode : (byId.get(person.parentUserId)?.code ?? adminCode),
        attributed_at: daysAgo(20 - person.level),
        first_paid_at: person.paid ? daysAgo(10 - person.level) : null,
        campaign_id: useAdminLink
          ? slot === 1
            ? campaignYoutube
            : slot === 2
              ? campaignTwitter
              : null
          : person.path[1] === 1
            ? campaignJohnOne
            : null,
        link_id: useAdminLink
          ? slot === 1
            ? linkHome
            : slot === 2
              ? linkAffiliates
              : null
          : person.path[1] === 1
            ? linkJohnOne
            : null,
      };
    }),
  );

  const samplePaid = people.filter(
    (person) =>
      person.paid &&
      (person.path.every((n) => n === 1) ||
        person.level === 1 ||
        (person.level <= 3 && person.path[person.path.length - 1] === 2)),
  );
  const invoiceRows = samplePaid.map((person, index) => ({
    id: randomUUID(),
    user_id: person.userId,
    plan_id: person.level % 2 === 0 ? proId : plusId,
    method: "wallet" as const,
    external_id: `${DEMO_TAG}invoice:${person.userId}`,
    amount_usd: 29 + (index % 3) * 10,
    status: "paid" as const,
    created_at: daysAgo(8),
    source: person,
  }));

  await insertBatch(
    supabase,
    "membership_invoices",
    invoiceRows.map(({ source: _source, ...row }) => row),
  );

  const rates = [10, 5, 3, 2, 1];
  const commissionRows: Record<string, unknown>[] = [];
  const statuses = ["pending", "payable", "paid", "void"] as const;
  for (const invoice of invoiceRows) {
    const earners = uplineIds(invoice.source, byId);
    earners.forEach((earnerId, index) => {
      const level = index + 1;
      const status = statuses[(level + invoice.source.level) % statuses.length];
      const ratePct = rates[level - 1] ?? 0;
      commissionRows.push({
        id: randomUUID(),
        earner_user_id: earnerId,
        source_user_id: invoice.source.userId,
        invoice_id: invoice.id,
        rate_plan_id: plusId,
        campaign_id: invoice.source.level === 1 ? campaignYoutube : null,
        link_id: invoice.source.level === 1 ? linkHome : null,
        level,
        rate_pct: ratePct,
        amount_usd:
          Math.round(((invoice.amount_usd * ratePct) / 100) * 100) / 100,
        status,
        hold_until: status === "pending" ? daysFromNow(12) : daysAgo(2),
        created_at: daysAgo(7),
      });
    });
  }

  await insertBatch(supabase, "membership_commissions", commissionRows);

  const { data: chainRow } = await supabase
    .from("membership_billing_chains")
    .select("slug, affiliate_payouts")
    .order("sort_order", { ascending: true });
  const chain =
    (chainRow ?? []).find((row) => row.affiliate_payouts === true)?.slug ??
    chainRow?.[0]?.slug ??
    "arbitrum";
  const address = "0x5555555555555555555555555555555555555555";

  const levelOnes = people.filter((person) => person.level === 1);
  const payableForAdmin = commissionRows.filter(
    (row) => row.earner_user_id === admin.userId && row.status === "payable",
  );
  const payableForJohn1 = commissionRows.filter(
    (row) =>
      row.earner_user_id === levelOnes[0]?.userId && row.status === "payable",
  );
  const paidForAdmin = commissionRows.filter(
    (row) => row.earner_user_id === admin.userId && row.status === "paid",
  );

  const payouts = [
    {
      id: randomUUID(),
      user_id: admin.userId,
      status: "requested",
      amount: 40,
      items: payableForAdmin.slice(0, 1),
    },
    {
      id: randomUUID(),
      user_id: admin.userId,
      status: "approved",
      amount: 25,
      items: payableForAdmin.slice(1, 2),
    },
    {
      id: randomUUID(),
      user_id: admin.userId,
      status: "rejected",
      amount: 15,
      items: [],
    },
    {
      id: randomUUID(),
      user_id: admin.userId,
      status: "paid",
      amount: 55,
      items: paidForAdmin.slice(0, 2),
      paidAt: daysAgo(1),
    },
    {
      id: randomUUID(),
      user_id: levelOnes[0]?.userId,
      status: "requested",
      amount: 20,
      items: payableForJohn1.slice(0, 1),
    },
    {
      id: randomUUID(),
      user_id: levelOnes[1]?.userId,
      status: "approved",
      amount: 18,
      items: [],
    },
    {
      id: randomUUID(),
      user_id: levelOnes[2]?.userId,
      status: "rejected",
      amount: 12,
      items: [],
    },
    {
      id: randomUUID(),
      user_id: levelOnes[3]?.userId,
      status: "paid",
      amount: 30,
      items: [],
      paidAt: daysAgo(2),
    },
  ];

  await insertBatch(
    supabase,
    "membership_payouts",
    payouts.map((payout) => ({
      id: payout.id,
      user_id: payout.user_id,
      method: "usdt",
      amount_usd: payout.amount,
      status: payout.status,
      network: chain,
      address,
      external_id: `${DEMO_TAG}payout:${payout.status}:${payout.id}`,
      created_at: daysAgo(3),
      paid_at: payout.paidAt ?? null,
    })),
  );

  const itemRows = payouts.flatMap((payout) =>
    payout.items.map((item) => ({
      payout_id: payout.id,
      commission_id: item.id,
    })),
  );
  if (itemRows.length > 0) {
    await insertBatch(supabase, "membership_payout_items", itemRows);
  }

  await insertBatch(
    supabase,
    "membership_wallet_entries",
    payouts.map((payout) => ({
      user_id: payout.user_id,
      book: "affiliate",
      kind: payout.status === "rejected" ? "adjust" : "withdraw",
      amount_usd: payout.amount,
      external_id: `${DEMO_TAG}wallet:${payout.id}`,
      memo:
        payout.status === "rejected"
          ? "John demo reject"
          : "John demo USDT withdraw",
    })),
  );

  mkdirSync(resolve(process.cwd(), "tmp"), { recursive: true });
  const manifest = {
    password: PASSWORD,
    emailDomain: EMAIL_DOMAIN,
    admin,
    settingsBefore: snapshot,
    people: people.map((person) => ({
      path: person.pathKey,
      level: person.level,
      userId: person.userId,
      email: person.email,
      name: person.name,
      code: person.code,
      parentUserId: person.parentUserId,
      paid: person.paid,
    })),
  };
  writeFileSync(MANIFEST_JSON, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    MANIFEST_TXT,
    [
      `John affiliate demo — password ${PASSWORD} (8 characters; sign-in minimum).`,
      `Admin: ${admin.email} (${admin.userId})`,
      `Count: ${people.length}`,
      "",
      "path\tlevel\temail\tname\tcode\tpaid",
      ...people.map(
        (person) =>
          `${person.pathKey}\t${person.level}\t${person.email}\t${person.name}\t${person.code}\t${person.paid ? "paid" : "signup"}`,
      ),
      "",
    ].join("\n"),
  );

  console.log(`Wrote ${MANIFEST_TXT}`);
  console.log(`Password for every John: ${PASSWORD}`);
}

async function main() {
  loadLocalEnv();
  const command = String(process.argv[2] ?? "").trim();
  if (command !== "seed" && command !== "clear") {
    console.error("Usage: npx tsx scripts/john-affiliate-demo.ts seed|clear");
    process.exit(1);
  }
  const supabase = createServiceClient();
  if (!supabase) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }
  if (command === "clear") {
    let snapshot: SettingsSnapshot | null = null;
    if (existsSync(MANIFEST_JSON)) {
      const raw = JSON.parse(readFileSync(MANIFEST_JSON, "utf8")) as {
        settingsBefore?: SettingsSnapshot;
      };
      snapshot = raw.settingsBefore ?? null;
    }
    const removed = await clearDemo(supabase, snapshot);
    console.log(`Removed ${removed} John demo members.`);
    return;
  }
  await seed(supabase);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.cause) {
    console.error(error.cause);
  }
  process.exit(1);
});
