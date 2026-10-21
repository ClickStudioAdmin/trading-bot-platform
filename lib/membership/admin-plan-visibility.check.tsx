import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminPlanVisibilityFields } from "../../components/admin-plan-visibility";

const previewLabel = "Show this draft on the Plans page for preview";

function markup(props: {
  visibility?: "public" | "private" | "draft";
  preview?: boolean;
  isDefault?: boolean;
}) {
  return renderToStaticMarkup(<AdminPlanVisibilityFields {...props} />);
}

const draft = markup({ visibility: "draft", preview: true, isDefault: false });
assert.match(draft, new RegExp(previewLabel));
assert.match(draft, /name="preview"/);
assert.match(draft, /Admins only/);
assert.match(draft, /Default for new members/);
assert.match(draft, /value="draft"/);

const privatePlan = markup({ visibility: "private", preview: true });
assert.equal(privatePlan.includes(previewLabel), false);
assert.equal(privatePlan.includes('name="preview"'), false);
assert.match(privatePlan, /value="private"/);
assert.match(privatePlan, /Default for new members/);
assert.match(privatePlan, /name="isDefault"/);

const publicPlan = markup({ visibility: "public", preview: true });
assert.equal(publicPlan.includes(previewLabel), false);
assert.equal(publicPlan.includes('name="preview"'), false);
assert.match(publicPlan, /value="public"/);

const fresh = markup({});
assert.match(fresh, new RegExp(previewLabel));
assert.match(fresh, /value="draft"/);

console.log("admin plan visibility checks passed");
