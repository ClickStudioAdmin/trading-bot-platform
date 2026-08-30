export function memberDisplayName(email: string, name?: string | null): string {
  const trimmed = name?.trim() ?? "";
  if (trimmed) {
    return trimmed.slice(0, 80);
  }
  const local = email.split("@")[0]?.trim() ?? "";
  return (local || "Member").slice(0, 80);
}
