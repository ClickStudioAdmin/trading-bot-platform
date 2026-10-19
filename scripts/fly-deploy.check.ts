import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(fileURLToPath(new URL(".", import.meta.url)), "fly-deploy.sh");

function run(
  flyctlBody: string,
  env: Record<string, string> = {},
  args: string[] = ["fly.test.toml", "--remote-only"],
) {
  const dir = mkdtempSync(join(tmpdir(), "fly-deploy-"));
  const flyctl = join(dir, "flyctl");
  const countFile = join(dir, "count");
  writeFileSync(flyctl, flyctlBody.replaceAll("{{count}}", countFile));
  chmodSync(flyctl, 0o755);
  return spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH ?? ""}`,
      FLY_DEPLOY_ATTEMPTS: "3",
      FLY_DEPLOY_TIMEOUT: "5s",
      FLY_DEPLOY_RETRY_SLEEP: "0",
      ...env,
    },
  });
}

{
  const result = run("#!/bin/sh\nexit 0\n");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /attempt 1\/3/);
  assert.doesNotMatch(result.stdout, /attempt 2/);
}

{
  const result = run(
    `#!/bin/sh
n=0
if [ -f "{{count}}" ]; then n=$(cat "{{count}}"); fi
n=$((n + 1))
echo "$n" > "{{count}}"
if [ "$n" -eq 1 ]; then sleep 30; fi
exit 0
`,
    { FLY_DEPLOY_TIMEOUT: "1s", FLY_DEPLOY_ATTEMPTS: "2" },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /attempt 1 exited 124/);
  assert.match(result.stdout, /attempt 2\/2/);
}

{
  const result = run("#!/bin/sh\nsleep 30\n", {
    FLY_DEPLOY_TIMEOUT: "1s",
    FLY_DEPLOY_ATTEMPTS: "2",
  });
  assert.equal(result.status, 124);
  assert.match(result.stdout, /attempt 2 exited 124/);
}

{
  const result = run("#!/bin/sh\nexit 0\n", {}, []);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /usage: fly-deploy.sh/);
}

{
  const result = run("#!/bin/sh\nexit 0\n", { FLY_DEPLOY_ATTEMPTS: "0" });
  assert.equal(result.status, 64);
}

console.log("fly-deploy.check ok");
