import { runEngineCycle } from "@/lib/engine/cycle";

export async function runPaperEngineTick(options?: {
  silent?: boolean;
  workerId?: string;
  maxMs?: number;
}): Promise<{
  users: number;
  opened: number;
  added: number;
  closed: number;
  clipped: number;
}> {
  const result = await runEngineCycle(options);
  return {
    users: result.users,
    opened: result.opened,
    added: result.added,
    closed: result.closed,
    clipped: result.clipped,
  };
}
