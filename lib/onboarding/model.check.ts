import assert from "node:assert/strict";
import {
  AUTOMATED_DESK_TYPES,
  MANUAL_DESK_TYPES,
} from "@/lib/accounts/model";
import { judgeBybitApiKey } from "@/lib/exchanges/bybit/permissions";
import {
  allocateSetupName,
  appliesStillToRun,
  blockedSetupDesks,
  buildTourSteps,
  pickTourTarget,
  placeTourCard,
  tourTargetForAccountHref,
  connectionReuseError,
  createdStarterBots,
  desksStillToCreate,
  draftHasSecret,
  emptySetupDraft,
  foldersForDesk,
  makeSetupDesk,
  ONBOARDING_DESK_TYPES,
  onboardingFolders,
  parseSetupDraft,
  activeSetupScreen,
  applyBotSetupChoice,
  applyDeskSetupChoice,
  botsEmptyNote,
  requiresSetupGate,
  setupScreenId,
  setupScreens,
  shouldOfferTour,
  showsBotStep,
  starterTemplateAllowed,
  statusAfterExternalDesk,
  validateSetupForFinish,
  validateSetupNames,
  type SetupDesk,
  type StarterFolder,
} from "@/lib/onboarding/model";

const folder = (
  extra: Partial<StarterFolder> & Pick<StarterFolder, "id" | "deskType">,
): StarterFolder => ({
  name: extra.name ?? extra.id,
  visibility: extra.visibility ?? "platform",
  starterPack: extra.starterPack ?? true,
  templates: extra.templates ?? [
    { id: "11111111-1111-4111-8111-111111111111", name: "BTC", visibility: "platform" },
  ],
  ...extra,
});

const dcaPaper = (): SetupDesk =>
  makeSetupDesk({ deskType: "dca", mode: "paper", takenNames: [] });

assert.equal(requiresSetupGate({
  platformMember: true,
  emailVerified: true,
  deskCount: 0,
  status: null,
}), true);
assert.equal(requiresSetupGate({
  platformMember: false,
  emailVerified: true,
  deskCount: 0,
  status: null,
}), false);
assert.equal(requiresSetupGate({
  platformMember: true,
  emailVerified: false,
  deskCount: 0,
  status: null,
}), false);
assert.equal(requiresSetupGate({
  platformMember: true,
  emailVerified: true,
  deskCount: 0,
  status: "skipped",
}), false);
assert.equal(requiresSetupGate({
  platformMember: true,
  emailVerified: true,
  deskCount: 0,
  status: "completed",
}), false);
assert.equal(requiresSetupGate({
  platformMember: true,
  emailVerified: true,
  deskCount: 1,
  status: null,
}), false);
assert.equal(requiresSetupGate({
  platformMember: true,
  emailVerified: true,
  deskCount: 1,
  status: "pending",
}), true);
assert.equal(requiresSetupGate({
  platformMember: true,
  emailVerified: true,
  deskCount: 0,
  status: "finishing",
}), true);
assert.equal(statusAfterExternalDesk(null), "skipped");
assert.equal(statusAfterExternalDesk("pending"), "skipped");
assert.equal(statusAfterExternalDesk("completed"), "completed");

const paper = dcaPaper();
const connected = makeSetupDesk({
  deskType: "perps_bots",
  mode: "live",
  takenNames: [paper.name],
});
assert.equal(paper.mode, "paper");
assert.equal(paper.connectionId, null);
assert.equal(connected.mode, "live");
assert.equal(connected.bindLater, true);
assert.equal(connected.environmentId, "live");
assert.notEqual(paper.name.toLowerCase(), connected.name.toLowerCase());

const named = validateSetupNames(
  [
    { ...paper, name: "DCA Paper" },
    { ...connected, name: "dca paper" },
  ],
  [],
);
assert.equal(named.ok, false);

const created = desksStillToCreate([
  { ...paper, accountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  connected,
]);
assert.equal(created.length, 1);
assert.equal(created[0]?.key, connected.key);
const starterId = "11111111-1111-4111-8111-111111111111";
const createdDeskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
assert.deepEqual(
  createdStarterBots({
    desks: [
      {
        ...paper,
        name: "DCA Paper",
        accountId: createdDeskId,
        templateIds: [starterId],
      },
    ],
    folders: [folder({ id: "dca-pack", deskType: "dca" })],
    applied: [`${createdDeskId}:${starterId}`],
  }),
  [{ deskName: "DCA Paper", botName: "BTC", templateId: starterId }],
);
assert.deepEqual(
  createdStarterBots({
    desks: [
      {
        ...paper,
        accountId: createdDeskId,
        templateIds: [starterId],
      },
    ],
    folders: [],
    applied: [],
  }),
  [],
);

const sameKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
assert.match(
  connectionReuseError({
    desks: [
      { connectionId: sameKey, name: "A" },
      { connectionId: sameKey, name: "B" },
    ],
  }) ?? "",
  /another desk/,
);
assert.equal(
  connectionReuseError({
    desks: [
      { connectionId: sameKey, name: "A" },
      { connectionId: null, name: "B" },
    ],
  }),
  null,
);

const loose: StarterFolder = folder({
  id: "loose",
  deskType: "dca",
  starterPack: false,
  templates: [
    { id: "22222222-2222-4222-8222-222222222222", name: "Loose", visibility: "platform" },
  ],
});
const userFolder: StarterFolder = folder({
  id: "user",
  deskType: "dca",
  visibility: "user",
  starterPack: true,
});
const dcaFolder = folder({ id: "dca-pack", deskType: "dca", name: "DCA pack" });
const perpsFolder = folder({
  id: "perps-pack",
  deskType: "perps",
  name: "Perps pack",
  templates: [
    { id: "33333333-3333-4333-8333-333333333333", name: "ETH", visibility: "platform" },
    { id: "44444444-4444-4444-8444-444444444444", name: "Mine", visibility: "user" },
  ],
});
const offered = onboardingFolders([loose, userFolder, dcaFolder, perpsFolder]);
assert.deepEqual(offered.map((row) => row.id), ["dca-pack", "perps-pack"]);
assert.equal(offered[1]?.templates.length, 1);
assert.equal(foldersForDesk([loose, dcaFolder], "signal_follower").length, 0);
assert.equal(foldersForDesk([perpsFolder], "perps").length, 0);
assert.equal(foldersForDesk([perpsFolder], "perps_bots").length, 1);
assert.equal(showsBotStep([paper], [loose]), false);
assert.equal(showsBotStep([
  makeSetupDesk({ deskType: "perps", mode: "paper", takenNames: [] }),
  makeSetupDesk({ deskType: "signal_follower", mode: "paper", takenNames: ["Perps Paper"] }),
], [dcaFolder]), false);
const both = setupScreens({
  desks: [paper, connected],
  folders: [dcaFolder, perpsFolder],
  deskChoice: "manual",
  botChoice: "manual",
});
assert.deepEqual(both.map((screen) => setupScreenId(screen)), [
  "desks:choice",
  "desks:desks",
  "desks:exchanges",
  "bots:choice",
  "bots:" + connected.key,
  "bots:" + paper.key,
  "tour:tour",
]);
assert.deepEqual(
  setupScreens({
    desks: [],
    folders: [dcaFolder],
    deskChoice: "none",
    botChoice: null,
  }).map((screen) => setupScreenId(screen)),
  ["desks:choice", "bots:blocked", "tour:tour"],
);
assert.deepEqual(
  setupScreens({
    desks: [paper],
    folders: [dcaFolder],
    deskChoice: "all_paper",
    botChoice: "all",
  }).map((screen) => setupScreenId(screen)),
  ["desks:choice", "bots:choice", "tour:tour"],
);
const paperSet = applyDeskSetupChoice({
  choice: "all_paper",
  desks: [connected],
  takenNames: [],
});
assert.equal(paperSet.length, 5);
assert.deepEqual(ONBOARDING_DESK_TYPES, [
  ...AUTOMATED_DESK_TYPES,
  ...MANUAL_DESK_TYPES,
]);
assert.deepEqual(
  paperSet.map((desk) => desk.deskType),
  [...ONBOARDING_DESK_TYPES],
);
assert.equal(paperSet.every((desk) => desk.mode === "paper"), true);
assert.equal(applyDeskSetupChoice({
  choice: "none",
  desks: paperSet,
  takenNames: [],
}).length, 0);
const withBots = applyBotSetupChoice({
  choice: "all",
  desks: [paper, connected],
  folders: [dcaFolder, perpsFolder],
});
assert.deepEqual(withBots[0]?.templateIds, [dcaFolder.templates[0].id]);
assert.equal(applyBotSetupChoice({
  choice: "none",
  desks: withBots,
  folders: [dcaFolder],
}).every((desk) => desk.templateIds.length === 0), true);
assert.equal(
  setupScreenId(activeSetupScreen(both, "desks:exchanges")),
  "desks:exchanges",
);
assert.equal(
  setupScreenId(activeSetupScreen(
    setupScreens({
      desks: [paper],
      folders: [dcaFolder],
      deskChoice: "all_paper",
      botChoice: null,
    }),
    "desks:exchanges",
  )),
  "desks:choice",
);
assert.match(botsEmptyNote([]), /no starter bots/i);
assert.match(
  botsEmptyNote([
    makeSetupDesk({ deskType: "perps", mode: "paper", takenNames: [] }),
  ]),
  /ticket/i,
);
assert.equal(
  starterTemplateAllowed({
    folders: [loose],
    deskType: "dca",
    templateId: "22222222-2222-4222-8222-222222222222",
  }),
  false,
);
assert.equal(
  starterTemplateAllowed({
    folders: [dcaFolder],
    deskType: "dca",
    templateId: dcaFolder.templates[0].id,
  }),
  true,
);

const accountId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const templateId = dcaFolder.templates[0].id;
const withAccount = { ...paper, accountId, templateIds: [templateId] };
assert.equal(appliesStillToRun([withAccount], []).length, 1);
assert.equal(
  appliesStillToRun([withAccount], [`${accountId}:${templateId}`]).length,
  0,
);

const blocked = blockedSetupDesks(
  [paper, connected],
  [{ deskType: "dca", mode: "paper" }],
);
assert.equal(blocked.length, 1);
assert.equal(blocked[0]?.deskType, "dca");
const refused = validateSetupForFinish({
  draft: { ...emptySetupDraft(), desks: [paper] },
  existingNames: [],
  blocks: [{ deskType: "dca", mode: "paper" }],
  folders: [],
  boundConnectionIds: [],
});
assert.equal(refused.ok, false);

assert.equal(draftHasSecret({ desks: [{ apiSecret: "x" }] }), true);
const secretDraft = parseSetupDraft({ apiKey: "nope", desks: [] });
const readyDraft = parseSetupDraft({ readyForTour: true });
assert.equal(readyDraft.ok, true);
if (readyDraft.ok) {
  assert.equal(readyDraft.draft.readyForTour, true);
}
assert.equal(emptySetupDraft().readyForTour, false);
assert.equal(secretDraft.ok, false);

const liveLater = validateSetupForFinish({
  draft: { ...emptySetupDraft(), desks: [connected] },
  existingNames: [],
  blocks: [],
  folders: [],
  boundConnectionIds: [],
});
assert.equal(liveLater.ok, true);
if (liveLater.ok) {
  assert.equal(liveLater.draft.desks[0]?.connectionId, null);
  assert.equal(liveLater.draft.desks[0]?.mode, "live");
}

const takenName = allocateSetupName("DCA Paper", ["DCA Paper"]);
assert.equal(takenName, "DCA Paper 2");

assert.equal(shouldOfferTour({ platformMember: true, tour: null }), true);
assert.equal(shouldOfferTour({ platformMember: true, tour: "declined" }), true);
assert.equal(shouldOfferTour({ platformMember: true, tour: "skipped" }), false);
assert.equal(shouldOfferTour({ platformMember: false, tour: null }), false);

const noDeskTour = buildTourSteps([]);
assert.deepEqual(noDeskTour.map((step) => step.id), [
  "overview",
  "manage-desks",
  "exchanges",
  "templates",
]);
assert.equal(noDeskTour[0]?.title, "Overview");
assert.equal(noDeskTour[0]?.headline, "This is your home.");
assert.equal(noDeskTour[1]?.title, "Manage desks");
assert.ok(
  noDeskTour.every((step) => step.headline.length > 0 && step.headline !== step.title),
);
const botTour = buildTourSteps([
  { id: accountId, deskType: "dca" },
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", deskType: "signal_follower" },
]);
assert.equal(botTour.some((step) => step.id === "bots"), true);
assert.equal(botTour.some((step) => step.id === "webhooks"), false);
assert.equal(botTour.some((step) => step.id === "desk-list"), true);
const signalTour = buildTourSteps([
  { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", deskType: "signal_follower" },
]);
assert.equal(signalTour.some((step) => step.id === "webhooks"), true);
assert.equal(signalTour.some((step) => step.id === "bots"), false);
assert.equal(tourTargetForAccountHref("/account"), "overview");
assert.equal(tourTargetForAccountHref("/account/sub-accounts"), "manage-desks");
assert.equal(tourTargetForAccountHref("/account/templates"), "templates");
assert.equal(tourTargetForAccountHref("/account/billing"), null);

const besideNav = placeTourCard({
  target: { top: 120, left: 16, width: 240, height: 36 },
  card: { width: 352, height: 180 },
  viewport: { width: 1280, height: 800 },
});
assert.equal(besideNav.side, "right");
assert.ok(besideNav.left >= 16 + 240);
assert.equal(besideNav.arrowTo.x, 16 + 240);
assert.equal(besideNav.arrowTo.y, 120 + 18);
assert.ok(besideNav.arrowFrom.x > besideNav.arrowTo.x);

const belowHeading = placeTourCard({
  target: { top: 80, left: 320, width: 900, height: 48 },
  card: { width: 352, height: 180 },
  viewport: { width: 1280, height: 800 },
});
assert.equal(belowHeading.side, "below");
assert.ok(belowHeading.top >= 80 + 48);
assert.equal(belowHeading.arrowTo.y, 80 + 48);
assert.equal(
  pickTourTarget([
    { id: "page", area: 900 * 700, inAside: false },
    { id: "nav", area: 240 * 36, inAside: true },
  ])?.id,
  "nav",
);
assert.equal(
  pickTourTarget([
    { id: "wide", area: 800 * 48, inAside: false },
    { id: "tab", area: 72 * 32, inAside: false },
  ])?.id,
  "tab",
);

const withdrawal = judgeBybitApiKey({
  permissions: { Wallet: ["Withdraw"], ContractTrade: ["Order"] },
});
assert.equal(withdrawal.ok, false);

console.log("onboarding model checks passed");
