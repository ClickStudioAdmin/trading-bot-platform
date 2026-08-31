import type { CopyCatalogueSort, CopyCatalogueTab } from "./model";

export function copyCatalogueHref(input: {
  tab?: CopyCatalogueTab;
  privateOnly?: boolean;
  query?: string;
  sort?: CopyCatalogueSort;
}): string {
  const params = new URLSearchParams();
  if (input.tab && input.tab !== "all") {
    params.set("tab", input.tab);
  }
  if (input.privateOnly) {
    params.set("private", "1");
  }
  const query = input.query?.trim();
  if (query) {
    params.set("q", query);
  }
  if (input.sort && input.sort !== "roi") {
    params.set("sort", input.sort);
  }
  const qs = params.toString();
  return qs ? `/account/copy?${qs}` : "/account/copy";
}
