import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  STEP_UP_MODAL_TITLE,
  StepUpForm,
  StepUpPrompt,
  TotpStepUpProvider,
} from "../../components/step-up-code-field";
import {
  AUTHENTICATOR_CODE_HINT,
  RECOVERY_CODE_HINT,
  RECOVERY_CODE_LABEL,
  STEP_UP_FIELD,
  STEP_UP_INVALID,
  STEP_UP_KIND_FIELD,
  STEP_UP_MISSING,
  STEP_UP_RECOVERY_INVALID,
  STEP_UP_RECOVERY_MISSING,
  secondFactorInvalidMessage,
  secondFactorMissingMessage,
  secondFactorPasswordMessage,
  secondFactorRecoverySelected,
  stepUpFailure,
  stepUpRejection,
  stepUpRejectionMessage,
  stepUpShouldAsk,
  traderAliasNeedsStepUp,
  USE_AUTHENTICATOR_CODE,
  USE_RECOVERY_CODE,
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
  stepUpFailure({ enabled: true, code: "abcd-ef12", verified: false }),
  STEP_UP_RECOVERY_INVALID,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "", verified: false, recovery: true }),
  STEP_UP_RECOVERY_MISSING,
);
assert.equal(
  stepUpFailure({
    enabled: true,
    code: "123456",
    verified: false,
    recovery: true,
  }),
  STEP_UP_RECOVERY_INVALID,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "123456", verified: true }),
  null,
);
assert.equal(
  stepUpFailure({ enabled: true, code: "abcd-ef12", verified: true }),
  null,
);
assert.equal(secondFactorRecoverySelected("recovery", ""), true);
assert.equal(secondFactorRecoverySelected("authenticator", "abcd-ef12"), false);
assert.equal(secondFactorRecoverySelected(null, "abcd-ef12"), true);
assert.equal(secondFactorRecoverySelected(null, "123456"), false);
assert.equal(secondFactorMissingMessage(false), STEP_UP_MISSING);
assert.equal(secondFactorMissingMessage(true), STEP_UP_RECOVERY_MISSING);
assert.equal(secondFactorInvalidMessage(false), STEP_UP_INVALID);
assert.equal(secondFactorInvalidMessage(true), STEP_UP_RECOVERY_INVALID);
assert.equal(
  secondFactorPasswordMessage(false),
  "Enter your password and the Google Authenticator code.",
);
assert.equal(
  secondFactorPasswordMessage(true),
  "Enter your password and a recovery code.",
);
assert.doesNotMatch(AUTHENTICATOR_CODE_HINT, / or /);
assert.doesNotMatch(RECOVERY_CODE_HINT, / or /);
assert.doesNotMatch(USE_AUTHENTICATOR_CODE, / or /);
assert.doesNotMatch(USE_RECOVERY_CODE, / or /);

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
assert.match(prompt, new RegExp(USE_RECOVERY_CODE));
assert.match(prompt, new RegExp(AUTHENTICATOR_CODE_HINT));
assert.match(prompt, new RegExp(`name="${STEP_UP_KIND_FIELD}"`));
assert.doesNotMatch(prompt, / or /);
assert.match(prompt, /type="button"/);
assert.match(prompt, />Cancel</);
assert.match(prompt, /type="submit"/);
assert.match(prompt, /Reset Account/);

const busy = renderToStaticMarkup(
  <StepUpPrompt
    formId="rotate"
    confirmLabel="Rotate URL"
    pending
    error={STEP_UP_INVALID}
    onCancel={() => {}}
  />,
);
assert.match(busy, /disabled/);
assert.match(busy, /Checking…/);
assert.match(busy, /That Google Authenticator code is incorrect/);
assert.doesNotMatch(busy, / or /);

const recoveryPrompt = renderToStaticMarkup(
  <StepUpPrompt
    formId="delete-desk"
    confirmLabel="Delete desk"
    danger
    initialRecovery
    error={STEP_UP_RECOVERY_INVALID}
    onCancel={() => {}}
  />,
);
assert.match(recoveryPrompt, new RegExp(RECOVERY_CODE_LABEL));
assert.match(recoveryPrompt, new RegExp(RECOVERY_CODE_HINT));
assert.match(recoveryPrompt, new RegExp(USE_AUTHENTICATOR_CODE));
assert.match(recoveryPrompt, /That recovery code is incorrect/);
assert.match(recoveryPrompt, /value="recovery"/);
assert.doesNotMatch(recoveryPrompt, /data-totp-box/);
assert.doesNotMatch(recoveryPrompt, / or /);

console.log("step-up checks passed");
