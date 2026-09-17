import type { Metadata } from "next";
import { loadPlatformName } from "./brand";

export async function namedPageMetadata(
  title: string,
  description: (name: string) => string,
): Promise<Metadata> {
  const name = await loadPlatformName();
  return { title, description: description(name) };
}
