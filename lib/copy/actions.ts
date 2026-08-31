"use server";

import { deskIsCopy, deskPath } from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  COPY_SHARE_OFF_OPEN_TRADES,
  copyInviteBlockCode,
  copyLiveTradeCount,
  copySharingOffBlocked,
  evaluateCopyShare,
  formatCopyInviteBlock,
  parseCopyInviteEmail,
  parseDeskCopyListingForm,
  parseTraderLogoUpload,
  parseTraderProfileForm,
} from "./model";
import {
  loadDeskCopyListing,
  loadFirstVenueFillMs,
  saveDeskCopyListing,
} from "./listings";
import {
  removeDeskLogo,
  removeTraderLogo,
  uploadDeskLogo,
  uploadTraderLogo,
} from "./logo";
import { loadTraderProfile, saveTraderProfile } from "./profile";
import { loadCopyPlatformSettings } from "./settings";
import { toggleDeskCopyFavorite } from "./favorites";
import { findMemberByEmail } from "@/lib/templates/store";
import {
  countOpenCopyShares,
  inviteDeskCopyShare,
  loadDeskCopyShares,
  revokeDeskCopyShare,
} from "./shares";

const SETTINGS_PATH = "/account/settings";

function traderSettingsPath(query: {
  error?: string;
  saved?: "trader";
}): string {
  const params = new URLSearchParams();
  if (query.error) {
    params.set("error", query.error);
  }
  if (query.saved) {
    params.set("saved", query.saved);
  }
  const encoded = params.toString();
  return encoded ? `${SETTINGS_PATH}?${encoded}` : SETTINGS_PATH;
}

export async function saveTraderProfileAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const parsed = parseTraderProfileForm({
    alias: formData.get("alias"),
    bio: formData.get("bio"),
  });
  if (!parsed.ok) {
    redirect(traderSettingsPath({ error: parsed.error }));
  }
  const existing = await loadTraderProfile(member.id);
  const file = formData.get("logo");
  const upload = parseTraderLogoUpload(
    file instanceof File ? file : null,
  );
  if (!upload.ok) {
    redirect(traderSettingsPath({ error: upload.error }));
  }
  let logoPath = existing?.logoPath ?? null;
  if (upload.ext && file instanceof File) {
    const stored = await uploadTraderLogo({
      userId: member.id,
      file,
      ext: upload.ext,
      previousPath: logoPath,
    });
    if (!stored.ok) {
      redirect(traderSettingsPath({ error: stored.error }));
    }
    logoPath = stored.path;
  } else if (formData.get("removeLogo") === "on" && logoPath) {
    const removed = await removeTraderLogo(logoPath);
    if (!removed.ok) {
      redirect(traderSettingsPath({ error: removed.error }));
    }
    logoPath = null;
  }
  const saved = await saveTraderProfile({
    userId: member.id,
    alias: parsed.alias,
    bio: parsed.bio,
    logoPath,
  });
  if (!saved.ok) {
    redirect(traderSettingsPath({ error: saved.error }));
  }
  await writeEventLog({
    scope: "system",
    event: "copy.profile_saved",
    message: "Saved trader alias",
    userId: member.id,
    data: { alias: parsed.alias },
  });
  revalidatePath("/", "layout");
  redirect(traderSettingsPath({ saved: "trader" }));
}

export async function saveDeskCopyListingAction(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const account = session.account;
  const settingsHref = (extra: Record<string, string>) =>
    deskPath(FUTURES_PATHS.settings, account.id, extra);
  if (deskIsCopy(account)) {
    redirect(settingsHref({ error: "A copy desk cannot be shared." }));
  }
  const platform = await loadCopyPlatformSettings();
  const parsed = parseDeskCopyListingForm({
    visibility: formData.get("visibility"),
    description: formData.get("description"),
    maxFollowers: formData.get("maxFollowers"),
    minBalanceUsdt: formData.get("minBalanceUsdt"),
    ceiling: platform.maxFollowersCeiling,
    sharingEnabled: formData.get("sharingEnabled"),
    allowNewFollowers: formData.get("allowNewFollowers"),
  });
  if (!parsed.ok) {
    redirect(settingsHref({ error: parsed.error }));
  } else {
    const visibility = parsed.visibility;
    const description = parsed.description;
    const maxFollowers = parsed.maxFollowers;
    const minBalanceUsdt = parsed.minBalanceUsdt;
    const sharingEnabled = parsed.sharingEnabled;
    const allowNewFollowers = parsed.allowNewFollowers;
    const [profile, firstFillMs, settings, existing, usage] =
      await Promise.all([
        loadTraderProfile(session.member.id),
        loadFirstVenueFillMs(account.id),
        loadFuturesSettings(account.id),
        loadDeskCopyListing(account.id),
        loadAccountUsage([account]),
      ]);
    const minDays = platform.minActivityDays;
    const share = evaluateCopyShare({
      mode: account.mode,
      deskType: account.deskType,
      copyOfAccountId: account.copyOfAccountId,
      bound: Boolean(settings.connectionId),
      alias: profile?.alias ?? null,
      firstFillMs,
      minDays,
    });
    if (share.block) {
      redirect(settingsHref({ error: share.block }));
    }
    const used = usage.get(account.id);
    if (
      copySharingOffBlocked({
        currentlyEnabled: existing?.sharingEnabled ?? false,
        nextEnabled: sharingEnabled,
        openTradeCount: copyLiveTradeCount({
          openPositions: used?.futuresOpenCount,
          workingOrders: used?.workingCount,
        }),
      })
    ) {
      redirect(settingsHref({ error: COPY_SHARE_OFF_OPEN_TRADES }));
    }
    const file = formData.get("deskLogo");
    const upload = parseTraderLogoUpload(
      file instanceof File ? file : null,
    );
    if (!upload.ok) {
      redirect(settingsHref({ error: upload.error }));
    }
    let logoPath = existing?.logoPath ?? null;
    if (upload.ext && file instanceof File) {
      const stored = await uploadDeskLogo({
        accountId: account.id,
        file,
        ext: upload.ext,
        previousPath: logoPath,
      });
      if (!stored.ok) {
        redirect(settingsHref({ error: stored.error }));
      }
      logoPath = stored.path;
    } else if (formData.get("removeDeskLogo") === "on" && logoPath) {
      const removed = await removeDeskLogo(logoPath);
      if (!removed.ok) {
        redirect(settingsHref({ error: removed.error }));
      }
      logoPath = null;
    }
    const saved = await saveDeskCopyListing({
      accountId: account.id,
      visibility,
      description,
      maxFollowers,
      minBalanceUsdt,
      sharingEnabled,
      allowNewFollowers,
      logoPath,
    });
    if (!saved.ok) {
      redirect(settingsHref({ error: saved.error }));
    }
    await writeEventLog({
      scope: "system",
      event: "copy.listing_saved",
      message: existing ? "Updated desk share listing" : "Shared a desk",
      userId: session.member.id,
      accountId: account.id,
    data: {
      visibility,
      maxFollowers,
      minBalanceUsdt,
      sharingEnabled,
      allowNewFollowers,
      live: accountCanHoldConnections(account.mode),
    },
    });
    revalidatePath("/", "layout");
    redirect(settingsHref({ saved: "share" }));
  }
}

export async function inviteDeskCopyShareAction(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const account = session.account;
  const sharedHref = (extra: Record<string, string>) =>
    deskPath(FUTURES_PATHS.shared, account.id, extra);
  if (deskIsCopy(account)) {
    redirect(
      deskPath(FUTURES_PATHS.settings, account.id, {
        error: "A copy desk cannot be shared.",
      }),
    );
  }
  const email = parseCopyInviteEmail(formData.get("email"));
  if (!email.ok) {
    redirect(sharedHref({ error: email.error }));
  }
  const member = await findMemberByEmail(email.email);
  if (!member) {
    redirect(sharedHref({ error: "No member with that email." }));
  }
  if (member.status === "disabled") {
    redirect(sharedHref({ error: "That member is disabled." }));
  }
  const [listing, shares, platform] = await Promise.all([
    loadDeskCopyListing(account.id),
    loadDeskCopyShares(account.id),
    loadCopyPlatformSettings(),
  ]);
  const block = copyInviteBlockCode({
    listing,
    ceiling: platform.maxFollowersCeiling,
    followerCount: countOpenCopyShares(shares),
    fromUserId: session.member.id,
    toUserId: member.userId,
  });
  if (block) {
    redirect(sharedHref({ error: formatCopyInviteBlock(block) }));
  }
  const invited = await inviteDeskCopyShare({
    parentAccountId: account.id,
    fromUserId: session.member.id,
    toUserId: member.userId,
    invitedEmail: member.email,
  });
  if (!invited.ok) {
    redirect(sharedHref({ error: invited.error }));
  }
  await writeEventLog({
    scope: "system",
    event: "copy.invite_sent",
    message: "Invited a member to copy this desk",
    userId: session.member.id,
    accountId: account.id,
    data: { toUserId: member.userId },
  });
  revalidatePath("/", "layout");
  redirect(sharedHref({ saved: "invite" }));
}

export async function revokeDeskCopyShareAction(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const account = session.account;
  const sharedHref = (extra: Record<string, string>) =>
    deskPath(FUTURES_PATHS.shared, account.id, extra);
  const shareId = String(formData.get("shareId") ?? "").trim();
  if (!shareId) {
    redirect(sharedHref({ error: "That invite was not found." }));
  }
  const revoked = await revokeDeskCopyShare({
    shareId,
    parentAccountId: account.id,
    fromUserId: session.member.id,
  });
  if (!revoked.ok) {
    redirect(sharedHref({ error: revoked.error }));
  }
  await writeEventLog({
    scope: "system",
    event: "copy.invite_revoked",
    message: "Revoked a copy invite",
    userId: session.member.id,
    accountId: account.id,
    data: { shareId },
  });
  revalidatePath("/", "layout");
  redirect(sharedHref({ saved: "revoke" }));
}

function safeCopyCataloguePath(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (raw.startsWith("/account/copy")) {
    return raw;
  }
  return "/account/copy";
}

export async function toggleDeskCopyFavoriteAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const accountId = String(formData.get("accountId") ?? "").trim();
  const next = safeCopyCataloguePath(formData.get("next"));
  if (!accountId) {
    redirect(next);
  }
  const favorite = String(formData.get("favorite") ?? "") === "1";
  const saved = await toggleDeskCopyFavorite({
    userId: member.id,
    accountId,
    favorite,
  });
  if (!saved.ok) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}error=${encodeURIComponent(saved.error)}`);
  }
  await writeEventLog({
    scope: "system",
    event: "copy.favorite_toggled",
    message: favorite ? "Starred a copy desk" : "Unstarred a copy desk",
    userId: member.id,
    accountId,
    data: { favorite },
  });
  revalidatePath("/account/copy");
  revalidatePath("/", "layout");
  redirect(next);
}
