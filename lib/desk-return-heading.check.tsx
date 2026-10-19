import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DeskReturnHeading } from "../components/desk-return-heading";

const snapshot = renderToStaticMarkup(
  <DeskReturnHeading
    title="Positions Snapshot"
    meta={<span>Open value $1</span>}
    actions={<span>Desk Wide</span>}
  />,
);

assert.match(snapshot, /Positions Snapshot/);
assert.match(snapshot, /Open value \$1/);
assert.match(snapshot, /Desk Wide/);

const manual = renderToStaticMarkup(
  <DeskReturnHeading
    title="Positions Snapshot"
    showTitle={false}
    meta={<span>Open value $1</span>}
    actions={<span>Desk Wide</span>}
  />,
);

assert.equal(manual.includes("Positions Snapshot"), false);
assert.equal(manual.includes("Open value"), false);
assert.match(manual, /Desk Wide/);

const manualBack = renderToStaticMarkup(
  <DeskReturnHeading
    title="Positions Snapshot"
    showTitle={false}
    backHref="/bots"
    meta={<span>Open value $1</span>}
  />,
);

assert.match(manualBack, /Back/);
assert.equal(manualBack.includes("Positions Snapshot"), false);
assert.equal(manualBack.includes("Open value"), false);

console.log("desk return heading checks passed");
