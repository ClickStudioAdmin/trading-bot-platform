import {
  MEMBER_PAGE_SIZE,
  memberSortColumn,
  type MemberListQuery,
} from "@/lib/members/query";
import { parseMemberRow, type MemberRow } from "@/lib/members/rows";
import { syncMembersFromAuth } from "@/lib/members/sync";
import { createServiceClient } from "@/lib/supabase/admin";

export type MemberListResult = {
  rows: MemberRow[];
  total: number;
  page: number;
  pageCount: number;
  error: string | null;
};

export async function listMembers(
  query: MemberListQuery,
): Promise<MemberListResult> {
  const empty: MemberListResult = {
    rows: [],
    total: 0,
    page: 1,
    pageCount: 1,
    error: null,
  };
  const supabase = createServiceClient();
  if (!supabase) {
    return { ...empty, error: "Service role is not configured." };
  }

  await syncMembersFromAuth();

  let countQuery = supabase
    .from("members")
    .select("id", { count: "exact", head: true });
  let dataQuery = supabase.from("members").select("*");

  if (query.q) {
    const pattern = `%${query.q}%`;
    const filter = `email.ilike.${pattern},name.ilike.${pattern}`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }
  if (query.role) {
    countQuery = countQuery.eq("role", query.role);
    dataQuery = dataQuery.eq("role", query.role);
  }
  if (query.status) {
    countQuery = countQuery.eq("status", query.status);
    dataQuery = dataQuery.eq("status", query.status);
  }

  const { count, error: countError } = await countQuery;
  if (countError || count === null) {
    return { ...empty, error: countError?.message ?? "Could not load members." };
  }

  const pageCount = Math.max(1, Math.ceil(count / MEMBER_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const from = (page - 1) * MEMBER_PAGE_SIZE;
  const to = from + MEMBER_PAGE_SIZE - 1;

  const { data, error } = await dataQuery
    .order(memberSortColumn(query.sort), { ascending: query.dir === "asc" })
    .range(from, to);

  if (error || !data) {
    return {
      ...empty,
      total: count,
      page,
      pageCount,
      error: error?.message ?? "Could not load members.",
    };
  }

  return {
    rows: data.map((row) => parseMemberRow(row as Record<string, unknown>)),
    total: count,
    page,
    pageCount,
    error: null,
  };
}

export async function getMemberById(id: number): Promise<MemberRow | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseMemberRow(data as Record<string, unknown>);
}
