import assert from "node:assert/strict";
import {
  AUTOMATED_DESK_TYPES,
  MANUAL_DESK_TYPES,
} from "@/lib/accounts/model";
import { judgeBybitApiKey } from "@/lib/exchanges/bybit/permissions";
import {
  allocateSetupName,
  appendLooseStarterTemplates,
  appliesStillToRun,
  blockedSetupDesks,
  buildTourSteps,
  pickTourTarget,
  placeTourCard,
  tourDeskId,
  tourTargetForAccountHref,
  connectionReuseError,
  createdStarterBots,
  readyDeskRows,
  desksStillToCreate,
  draftHasSecret,
  emptySetupDraft,
  foldersForDesk,
  keptArmTemplateIds,
  makeSetupDesk,
  ONBOARDING_DESK_TYPES,
  onboardingFolders,
  parseSetupDraft,
  activeSetupScreen,
  applyBotSetupChoice,
  applyDeskSetupChoice,
  botsEmptyNote,
  devAccountResetAllowed,
  devResetDeskOrder,
  requiresSetupGate,
  allocateSetupDeskKey,
  setupDeskDetails,
  setupDeskFromDetails,
  setupScreenId,
  setupReviewRows,
  setupScreens,
  starterBotDesks,
  setupStepLabel,
  shouldOfferTour,
  showsBotStep,
  starterStartVerb,
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
assert.equal(devAccountResetAllowed({ VERCEL_ENV: "production" }), false);
assert.equal(devAccountResetAllowed({ VERCEL_ENV: "preview" }), true);
assert.equal(devAccountResetAllowed({ VERCEL_ENV: "development" }), true);
assert.equal(devAccountResetAllowed({}), true);
assert.deepEqual(
  devResetDeskOrder([
    { id: "parent", copyOfAccountId: null },
    { id: "copy", copyOfAccountId: "parent" },
  ]).map((desk) => desk.id),
  ["copy", "parent"],
);

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
assert.deepEqual(setupDeskDetails(paper), {
  mode: "Paper",
  market: "Bybit",
  environment: "—",
  key: "—",
});
assert.deepEqual(setupDeskDetails(connected), {
  mode: "Connected",
  market: "Bybit",
  environment: "Live",
  key: "Bind later",
});
assert.deepEqual(
  setupDeskDetails({
    ...connected,
    bindLater: false,
    connectionId: "11111111-1111-4111-8111-111111111111",
  }),
  {
    mode: "Connected",
    market: "Bybit",
    environment: "Live",
    key: "Key saved",
  },
);
assert.equal(
  setupDeskDetails({ ...connected, bindLater: false, connectionId: null }).key,
  "Key needed",
);
const detailed = setupDeskFromDetails({
  deskType: "dca",
  mode: "paper",
  name: "DCA Hyper",
  venue: "hyperliquid",
  environmentId: null,
  bindLater: false,
  connectionId: null,
  takenNames: [],
  previous: null,
});
assert.equal(detailed.ok, true);
if (detailed.ok) {
  assert.equal(detailed.desk.venue, "hyperliquid");
  assert.equal(detailed.desk.key, "dca:paper");
  const second = setupDeskFromDetails({
    deskType: "dca",
    mode: "paper",
    name: "DCA Paper 2",
    venue: "bybit",
    environmentId: null,
    bindLater: false,
    connectionId: null,
    takenNames: ["DCA Hyper"],
    takenKeys: [detailed.desk.key],
    previous: null,
  });
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.desk.key, "dca:paper:2");
    assert.equal(
      allocateSetupDeskKey("dca", "paper", [detailed.desk.key, second.desk.key]),
      "dca:paper:3",
    );
  }
  const repeated = parseSetupDraft({
    desks: [
      {
        deskType: "dca",
        mode: "paper",
        name: "DCA Hyper",
        venue: "hyperliquid",
        key: "dca:paper",
      },
      {
        deskType: "dca",
        mode: "paper",
        name: "DCA Paper 2",
        venue: "bybit",
        key: "dca:paper:2",
      },
    ],
  });
  assert.equal(repeated.ok, true);
  if (repeated.ok) {
    assert.deepEqual(
      repeated.draft.desks.map((desk) => desk.key),
      ["dca:paper", "dca:paper:2"],
    );
  }
  assert.equal(detailed.desk.nameEdited, true);
  assert.equal(detailed.desk.environmentId, null);
}
assert.equal(
  setupDeskFromDetails({
    deskType: "dca",
    mode: "paper",
    name: "DCA Hyper",
    venue: "bybit",
    environmentId: null,
    bindLater: false,
    connectionId: null,
    takenNames: ["DCA Hyper"],
    previous: null,
  }).ok,
  false,
);
assert.equal(
  setupDeskFromDetails({
    deskType: "cash_and_carry",
    mode: "live",
    name: "Carry",
    venue: "hyperliquid",
    environmentId: "live",
    bindLater: true,
    connectionId: null,
    takenNames: [],
    previous: null,
  }).ok,
  false,
);
const withKey = setupDeskFromDetails({
  deskType: "dca",
  mode: "live",
  name: "DCA Bybit Demo",
  venue: "bybit",
  environmentId: "demo",
  bindLater: false,
  connectionId: "11111111-1111-4111-8111-111111111111",
  takenNames: [],
  previous: null,
});
assert.equal(withKey.ok, true);
if (withKey.ok) {
  assert.equal(withKey.desk.environmentId, "demo");
  assert.equal(withKey.desk.bindLater, false);
  assert.equal(withKey.desk.connectionId, "11111111-1111-4111-8111-111111111111");
}
const moved = setupDeskFromDetails({
  deskType: "dca",
  mode: "live",
  name: "DCA Bybit Demo",
  venue: "bybit",
  environmentId: "live",
  bindLater: false,
  connectionId: "11111111-1111-4111-8111-111111111111",
  takenNames: [],
  previous: withKey.ok ? withKey.desk : null,
});
assert.equal(moved.ok, false);

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
  [{
    deskKey: paper.key,
    deskName: "DCA Paper",
    botName: "BTC",
    templateId: starterId,
  }],
);
const carry = makeSetupDesk({
  deskType: "cash_and_carry",
  mode: "paper",
  takenNames: ["DCA Paper"],
});
assert.deepEqual(
  readyDeskRows({
    desks: [
      {
        ...paper,
        name: "DCA Paper",
        accountId: createdDeskId,
        templateIds: [starterId],
      },
      {
        ...carry,
        accountId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        templateIds: [],
      },
    ],
    folders: [folder({ id: "dca-pack", deskType: "dca" })],
    applied: [`${createdDeskId}:${starterId}`],
  }),
  [
    { key: paper.key, name: "DCA Paper", bots: [{ templateId: starterId, name: "BTC" }] },
    { key: carry.key, name: carry.name, bots: [] },
  ],
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
const flaggedId = "55555555-5555-4555-8555-555555555555";
const withLoose = appendLooseStarterTemplates(
  [loose, userFolder, dcaFolder],
  [
    {
      id: flaggedId,
      name: "DCA God - BTC",
      visibility: "platform",
      deskType: "dca",
      starterPack: true,
    },
    {
      id: dcaFolder.templates[0].id,
      name: "Already in folder",
      visibility: "platform",
      deskType: "dca",
      starterPack: true,
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      name: "User flag",
      visibility: "user",
      deskType: "dca",
      starterPack: true,
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      name: "Unflagged",
      visibility: "platform",
      deskType: "dca",
      starterPack: false,
    },
  ],
);
assert.deepEqual(withLoose.map((row) => row.id), ["dca-pack", "loose:dca"]);
assert.deepEqual(withLoose[1]?.templates.map((template) => template.id), [flaggedId]);
assert.equal(
  starterTemplateAllowed({
    folders: withLoose,
    deskType: "dca",
    templateId: flaggedId,
  }),
  true,
);
assert.equal(foldersForDesk(withLoose, "dca").length, 2);
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
assert.deepEqual(
  starterBotDesks([paper, connected], [dcaFolder, perpsFolder]).map(
    (desk) => desk.key,
  ),
  [connected.key, paper.key],
);
assert.deepEqual(both.map((screen) => setupScreenId(screen)), [
  "intro:video",
  "desks:choice",
  "desks:desks",
  "bots:choice",
  "bots:pick",
  "review:review",
  "tour:tour",
]);
const needsKey = { ...connected, bindLater: false, connectionId: null };
assert.equal(
  setupScreens({
    desks: [needsKey],
    folders: [],
    deskChoice: "manual",
    botChoice: null,
  })
    .map((screen) => setupScreenId(screen))
    .includes("desks:exchanges"),
  true,
);
assert.deepEqual(
  setupScreens({
    desks: [],
    folders: [],
    deskChoice: null,
    botChoice: null,
  }).map((screen) => setupScreenId(screen)),
  ["intro:video", "desks:choice"],
);
assert.deepEqual(
  setupScreens({
    desks: [],
    folders: [dcaFolder],
    deskChoice: "none",
    botChoice: null,
  }).map((screen) => setupScreenId(screen)),
  ["intro:video", "desks:choice", "bots:blocked", "review:review", "tour:tour"],
);
assert.deepEqual(
  setupScreens({
    desks: [paper],
    folders: [dcaFolder],
    deskChoice: "all_paper",
    botChoice: "all",
  }).map((screen) => setupScreenId(screen)),
  ["intro:video", "desks:choice", "bots:choice", "review:review", "tour:tour"],
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
}).every((desk) => desk.templateIds.length === 0 && desk.armTemplateIds.length === 0), true);
const armId = dcaFolder.templates[0].id;
const armedPaper = {
  ...paper,
  templateIds: [armId],
  armTemplateIds: [armId, "not-selected"],
};
assert.deepEqual(
  applyBotSetupChoice({
    choice: "all",
    desks: [armedPaper],
    folders: [dcaFolder],
  })[0]?.armTemplateIds,
  [],
);
assert.deepEqual(
  applyBotSetupChoice({
    choice: "manual",
    desks: [armedPaper],
    folders: [dcaFolder],
  })[0]?.armTemplateIds,
  [armId],
);
assert.deepEqual(
  keptArmTemplateIds({
    mode: "live",
    connectionId: null,
    templateIds: [armId],
    armTemplateIds: [armId],
  }),
  [],
);
assert.equal(starterStartVerb("dca"), "Arm");
assert.equal(starterStartVerb("perps_bots"), "Enable");
assert.equal(starterStartVerb("cash_and_carry"), "Enable");
assert.equal(starterStartVerb("perps"), null);
assert.equal(
  setupScreens({
    desks: [paper],
    folders: [dcaFolder],
    deskChoice: "manual",
    botChoice: null,
  }).some((screen) => setupScreenId(screen) === "review:review"),
  false,
);
const reviewCarry = makeSetupDesk({
  deskType: "cash_and_carry",
  mode: "paper",
  takenNames: ["DCA Paper"],
});
assert.deepEqual(
  setupReviewRows({
    desks: [
      { ...paper, name: "DCA Paper", templateIds: [armId], armTemplateIds: [armId] },
      reviewCarry,
    ],
    folders: [folder({ id: "dca-pack", deskType: "dca" })],
  }),
  [
    {
      key: paper.key,
      name: "DCA Paper",
      bots: [{ templateId: armId, name: "BTC", start: "Armed" }],
    },
    { key: reviewCarry.key, name: reviewCarry.name, bots: [] },
  ],
);
assert.equal(
  setupScreenId(
    activeSetupScreen(
      setupScreens({
        desks: [needsKey],
        folders: [],
        deskChoice: "manual",
        botChoice: null,
      }),
      "desks:exchanges",
    ),
  ),
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
  "intro:video",
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
assert.equal(setupStepLabel("desks"), "Add Desks");
assert.equal(setupStepLabel("bots"), "Add Bots");
assert.equal(setupStepLabel("review"), "Review");
assert.equal(setupStepLabel("tour"), "Take a Tour");
assert.equal(emptySetupDraft().introSeen, false);
const introDraft = parseSetupDraft({ introSeen: true });
assert.equal(introDraft.ok, true);
if (introDraft.ok) {
  assert.equal(introDraft.draft.introSeen, true);
}
const introIgnored = parseSetupDraft({ introSeen: "yes" });
assert.equal(introIgnored.ok, true);
if (introIgnored.ok) {
  assert.equal(introIgnored.draft.introSeen, false);
}
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
const deskSettings = botTour.find((step) => step.id === "desk-settings");
const bots = botTour.find((step) => step.id === "bots");
assert.equal(deskSettings ? tourDeskId(deskSettings) : null, accountId);
assert.equal(bots ? tourDeskId(bots) : null, accountId);
assert.equal(
  tourDeskId(botTour.find((step) => step.id === "positions")!),
  accountId,
);
assert.equal(tourDeskId(botTour.find((step) => step.id === "desk-list")!), null);
assert.equal(tourDeskId(noDeskTour[0]!), null);
assert.equal(tourDeskId(noDeskTour[1]!), null);
assert.equal(
  tourDeskId(signalTour.find((step) => step.id === "webhooks")!),
  "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
);

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
