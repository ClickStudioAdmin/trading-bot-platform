import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  STEP_UP_MODAL_TITLE,
  StepUpForm,
  StepUpPrompt,
  TotpStepUpProvider,
} from "../../components/step-up-code-field";
import {
  STEP_UP_FIELD,
  STEP_UP_INVALID,
  STEP_UP_MISSING,
  stepUpFailure,
  stepUpShouldAsk,
  traderAliasNeedsStepUp,
} from "./step-up";

assert.equal(
  stepUpFailure({ enabled: false, code: "", verified: false }),
  null,
);
assert.equal(
  stepUpFailure({ enabled: false, code: "000000", verified: false }),
  null,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "", verified: false }),
  STEP_UP_MISSING,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "   ", verified: true }),
  STEP_UP_MISSING,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "000000", verified: false }),
  STEP_UP_INVALID,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "123456", verified: true }),
  null,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "abcd-ef12", verified: true }),
  null,
);

assert.equal(traderAliasNeedsStepUp(null, "Click"), true);
assert.equal(traderAliasNeedsStepUp("Click", "Click"), false);
assert.equal(traderAliasNeedsStepUp("Click", "click"), true);
assert.equal(traderAliasNeedsStepUp("Click", "Click Desk"), true);

assert.equal(stepUpShouldAsk({ enabled: false, code: "" }), false);
assert.equal(stepUpShouldAsk({ enabled: true, code: "" }), true);
assert.equal(stepUpShouldAsk({ enabled: true, code: "   " }), true);
assert.equal(stepUpShouldAsk({ enabled: true, code: "123456" }), false);
assert.equal(
  stepUpShouldAsk({ enabled: true, code: "", aliasUnchanged: true }),
  false,
);
assert.equal(
  stepUpShouldAsk({ enabled: true, code: "", aliasUnchanged: false }),
  true,
);

const page = renderToStaticMarkup(
  <TotpStepUpProvider enabled>
    <StepUpForm className="mt-4 flex flex-wrap items-end gap-3">
      <button type="submit">Request payout</button>
    </StepUpForm>
  </TotpStepUpProvider>,
);
assert.equal(STEP_UP_MODAL_TITLE, "2FA Authentication Required");
assert.match(page, /Request payout/);
assert.doesNotMatch(page, /Authenticator code/);
assert.doesNotMatch(page, /2FA Authentication Required/);
assert.doesNotMatch(page, new RegExp(`name="${STEP_UP_FIELD}"`));

const off = renderToStaticMarkup(
  <TotpStepUpProvider enabled={false}>
    <StepUpForm>
      <button type="submit">Change password</button>
    </StepUpForm>
  </TotpStepUpProvider>,
);
assert.match(off, /Change password/);
assert.doesNotMatch(off, /Authenticator code/);

const prompt = renderToStaticMarkup(
  <StepUpPrompt formId="reset-account" confirmLabel="Reset Account" danger onCancel={() => {}} />,
);
assert.match(prompt, /Authenticator code/);
assert.match(prompt, new RegExp(`name="${STEP_UP_FIELD}"`));
assert.match(prompt, /form="reset-account"/);
assert.match(prompt, /required/);
assert.match(prompt, /inputMode="numeric"/);
assert.equal((prompt.match(/data-totp-box/g) ?? []).length, 6);
assert.match(prompt, /Use a recovery code/);
assert.match(prompt, /Google Authenticator or a recovery code/);
assert.match(prompt, /type="button"/);
assert.match(prompt, />Cancel</);
assert.match(prompt, /type="submit"/);
assert.match(prompt, /Reset Account/);

const busy = renderToStaticMarkup(
  <StepUpPrompt
    formId="rotate"
    confirmLabel="Rotate URL"
    pending
    error="That Google Authenticator or recovery code is incorrect."
    onCancel={() => {}}
  />,
);
assert.match(busy, /disabled/);
assert.match(busy, /Checking…/);
assert.match(busy, /incorrect/);

console.log("step-up checks passed");
