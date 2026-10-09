import assert from "node:assert/strict";
import { judgeBybitApiKey } from "@/lib/exchanges/bybit/permissions";
import {
  allocateSetupName,
  appliesStillToRun,
  blockedSetupDesks,
  buildTourSteps,
  connectionReuseError,
  desksStillToCreate,
  draftHasSecret,
  emptySetupDraft,
  foldersForDesk,
  makeSetupDesk,
  onboardingFolders,
  parseSetupDraft,
  activeSetupScreen,
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
});
assert.deepEqual(both.map((screen) => setupScreenId(screen)), [
  "desks:desks",
  "desks:exchanges",
  "bots:" + connected.key,
  "bots:" + paper.key,
  "tour:tour",
]);
assert.deepEqual(
  setupScreens({ desks: [], folders: [dcaFolder] }).map((screen) => setupScreenId(screen)),
  ["desks:desks", "bots:empty", "tour:tour"],
);
assert.equal(
  setupScreenId(activeSetupScreen(both, "desks:exchanges")),
  "desks:exchanges",
);
assert.equal(
  setupScreenId(activeSetupScreen(
    setupScreens({ desks: [paper], folders: [dcaFolder] }),
    "desks:exchanges",
  )),
  "desks:desks",
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

const withdrawal = judgeBybitApiKey({
  permissions: { Wallet: ["Withdraw"], ContractTrade: ["Order"] },
});
assert.equal(withdrawal.ok, false);

console.log("onboarding model checks passed");
