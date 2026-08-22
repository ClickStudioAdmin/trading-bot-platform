import { firstSearchValue } from "@/lib/paper/open";

export const MEMBER_PAGE_SIZE = 20;

export const MEMBER_SORTS = ["name", "email", "role", "status", "created"] as const;

export type MemberSort = (typeof MEMBER_SORTS)[number];
export type MemberDir = "asc" | "desc";

export type MemberListQuery = {
  q: string;
  role: string;
  status: string;
  sort: MemberSort;
  dir: MemberDir;
  page: number;
};

export const DEFAULT_MEMBER_QUERY: MemberListQuery = {
  q: "",
  role: "",
  status: "",
  sort: "created",
  dir: "desc",
  page: 1,
};

export function parseMemberListQuery(
  params: Record<string, string | string[] | undefined>,
): MemberListQuery {
  const sortRaw = firstSearchValue(params.sort) ?? "";
  const dirRaw = firstSearchValue(params.dir) ?? "";
  const pageRaw = Number(firstSearchValue(params.page) ?? "1");
  return {
    q: sanitizeSearch(firstSearchValue(params.q) ?? ""),
    role: parseRoleFilter(firstSearchValue(params.role) ?? ""),
    status: parseStatusFilter(firstSearchValue(params.status) ?? ""),
    sort: isMemberSort(sortRaw) ? sortRaw : DEFAULT_MEMBER_QUERY.sort,
    dir: dirRaw === "asc" || dirRaw === "desc" ? dirRaw : DEFAULT_MEMBER_QUERY.dir,
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function memberListHref(
  query: MemberListQuery,
  overrides: Partial<MemberListQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.q) {
    params.set("q", next.q);
  }
  if (next.role) {
    params.set("role", next.role);
  }
  if (next.status) {
    params.set("status", next.status);
  }
  if (next.sort !== DEFAULT_MEMBER_QUERY.sort) {
    params.set("sort", next.sort);
  }
  if (next.dir !== DEFAULT_MEMBER_QUERY.dir) {
    params.set("dir", next.dir);
  }
  if (next.page > 1) {
    params.set("page", String(next.page));
  }
  const search = params.toString();
  return search ? `/admin/members?${search}` : "/admin/members";
}

export function memberSortColumn(sort: MemberSort): string {
  return sort === "created" ? "created_at" : sort;
}

export function toggleMemberSort(
  query: MemberListQuery,
  sort: MemberSort,
): MemberListQuery {
  if (query.sort === sort) {
    return {
      ...query,
      dir: query.dir === "asc" ? "desc" : "asc",
      page: 1,
    };
  }
  return {
    ...query,
    sort,
    dir: sort === "created" ? "desc" : "asc",
    page: 1,
  };
}

function isMemberSort(value: string): value is MemberSort {
  return (MEMBER_SORTS as readonly string[]).includes(value);
}

function parseRoleFilter(value: string): string {
  return value === "member" || value === "admin" ? value : "";
}

function parseStatusFilter(value: string): string {
  return value === "active" || value === "disabled" ? value : "";
}

function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_,.()\\]/g, "").trim().slice(0, 80);
}
