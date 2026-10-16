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
  STEP_UP_REQUEST_FAILED,
  rethrowNextControlFlow,
  stepUpFailure,
  stepUpRejection,
  stepUpRejectionMessage,
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

assert.equal(stepUpRejectionMessage(null), null);
assert.equal(stepUpRejectionMessage({}), null);
assert.equal(stepUpRejectionMessage({ stepUpError: "  " }), null);
assert.equal(stepUpRejectionMessage({ error: STEP_UP_INVALID }), null);
assert.equal(
  stepUpRejectionMessage(stepUpRejection(STEP_UP_INVALID)),
  STEP_UP_INVALID,
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
assert.match(prompt, /type="hidden"/);
assert.match(prompt, new RegExp(`name="${STEP_UP_FIELD}"`));
assert.match(prompt, /form="reset-account"/);
assert.doesNotMatch(prompt, /required/);
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

const dangerBusy = renderToStaticMarkup(
  <StepUpPrompt
    formId="delete-desk"
    confirmLabel="Delete desk"
    danger
    pending
    onCancel={() => {}}
  />,
);
assert.match(dangerBusy, /Checking…/);
assert.match(dangerBusy, /text-ink/);
assert.doesNotMatch(dangerBusy, /text-canvas/);

let redirected = false;
try {
  rethrowNextControlFlow({ digest: "NEXT_REDIRECT;replace;/account;307;" });
} catch {
  redirected = true;
}
assert.equal(redirected, true);
rethrowNextControlFlow(new Error("socket hang up"));
assert.equal(STEP_UP_REQUEST_FAILED, "That request timed out. Try again.");

console.log("step-up checks passed");
