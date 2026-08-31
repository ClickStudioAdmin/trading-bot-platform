import { CopyLeaderStrip } from "@/components/copy-leader-strip";
import { loadDeskCopySettings } from "@/lib/copy/follower-settings";
import { loadCopyLeaderStrip } from "@/lib/copy/leader";

export async function CopyDeskPositionsChrome({
  copyOfAccountId,
  deskId,
  next,
}: {
  copyOfAccountId: string | null;
  deskId: string;
  next: string;
}) {
  if (!copyOfAccountId) {
    return null;
  }
  const [leader, settings] = await Promise.all([
    loadCopyLeaderStrip(copyOfAccountId),
    loadDeskCopySettings(deskId),
  ]);
  return (
    <CopyLeaderStrip
      leader={leader}
      paused={settings.paused}
      deskId={deskId}
      next={next}
    />
  );
}
