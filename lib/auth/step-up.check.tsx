import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StepUpCodeField,
  TotpStepUpProvider,
} from "../../components/step-up-code-field";
import {
  STEP_UP_FIELD,
  STEP_UP_INVALID,
  STEP_UP_MISSING,
  stepUpFailure,
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

const hidden = renderToStaticMarkup(
  <TotpStepUpProvider enabled={false}>
    <StepUpCodeField />
  </TotpStepUpProvider>,
);
assert.equal(hidden, "");

const shown = renderToStaticMarkup(
  <TotpStepUpProvider enabled>
    <StepUpCodeField />
  </TotpStepUpProvider>,
);
assert.match(shown, new RegExp(`name="${STEP_UP_FIELD}"`));
assert.match(shown, /required/);
assert.match(shown, /Authenticator code/);

const optional = renderToStaticMarkup(
  <TotpStepUpProvider enabled>
    <StepUpCodeField required={false} />
  </TotpStepUpProvider>,
);
assert.doesNotMatch(optional, /required/);

console.log("step-up checks passed");
