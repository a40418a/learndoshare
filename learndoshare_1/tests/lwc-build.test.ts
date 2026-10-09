import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLwc, catalogModules, sfdxLwcModules } from "../lib/lwc-build.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = join(root, "tests/fixtures/lwc-ts");
// 저장소 dist/는 다른 테스트(pack)가 지우고 다시 만든다. 결과물은 임시 폴더에만 쓴다
const tmp = mkdtempSync(join(tmpdir(), "milvus-lwc-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const built = buildLwc({
  out: join(tmp, "lwc"),
  entries: { index: join(fixture, "index.js"), catalog: join(fixture, "catalog.js") },
  modules: [{ name: "c/probe", path: join(fixture, "c/probe/probe.ts") }]
});
const output = async (file: string) => (await built, readFileSync(join(tmp, "lwc", file), "utf8"));
// 대체 모듈만 든 번들. 가져오는 파일이 없으므로 data: URL로 실행한다
const platform = buildLwc({ out: join(tmp, "platform"), entries: { platform: join(fixture, "platform.js") }, modules: [] }).then(
  () => import(`data:text/javascript,${encodeURIComponent(readFileSync(join(tmp, "platform/platform.js"), "utf8"))}`)
);

test(".ts 컴포넌트를 빌드하면 @api 속성이 publicProps로 등록된다", async () => {
  await built;
  // 두 진입이 함께 쓰는 Probe는 해시가 붙은 공통 chunk로 빠진다. 모든 .js를 본다
  const files = readdirSync(join(tmp, "lwc")).filter((f) => f.endsWith(".js"));
  const code = (await Promise.all(files.map(output))).join("\n");
  assert.match(code, /publicProps: \{\s*label: \{/);
});

test("lightning/platformResourceLoader와 @salesforce/resourceUrl/x를 import해도 빌드가 실패하지 않는다", async () => {
  await assert.doesNotReject(built);
  const { resourceUrl, loadStyle, loadScript } = await platform;
  assert.equal(resourceUrl, "/milvus-resource/x");
  assert.equal(await loadStyle(), undefined);
  assert.equal(loadScript, loadStyle);
});

test("synthetic-shadow chunk가 index.js의 첫 import다", async () => {
  const firstImport = (await output("index.js")).split("\n").find((line) => line.startsWith("import "));
  assert.match(firstImport ?? "", /^import '\.\/synthetic-shadow-[\w-]+\.js';$/);
});

test("@salesforce/gate/bc.260.enableComboboxElementInternals는 isOpen false", async () => {
  assert.equal((await platform).gate.isOpen(), false);
});

test("sfdxLwcModules는 모든 패키지 폴더의 lwc/<이름>/<이름>.(ts|js)를 c/<이름>으로 찾고, 둘 다 있으면 .ts를 쓴다", () => {
  const project = join(tmp, "sfdx 프로젝트");
  const files = ["force-app/main/default/lwc/a/a.js", "force-app/main/default/lwc/a/a.ts", "force-app/main/default/lwc/a/__tests__/a.test.ts", "force-app/main/default/lwc/a/helper.js", "extra/lwc/b/b.js"];
  for (const file of files) {
    mkdirSync(dirname(join(project, file)), { recursive: true });
    writeFileSync(join(project, file), "");
  }
  writeFileSync(join(project, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app" }, { path: "extra" }] }));
  assert.deepEqual(sfdxLwcModules(project).sort((x, y) => x.name.localeCompare(y.name)), [
    { name: "c/a", path: join(project, "force-app/main/default/lwc/a/a.ts") },
    { name: "c/b", path: join(project, "extra/lwc/b/b.js") }
  ]);
});

test("생성된 examples.json과 카탈로그 스토리에 절대 경로와 'node_modules/' 상대 경로가 없다", () => {
  const out = join(tmp, "slds-catalog");
  const gen = spawnSync(process.execPath, ["scripts/generate-slds-catalog.mjs", out], { cwd: root, encoding: "utf8" });
  assert.equal(gen.status, 0, gen.stderr);
  const files = readdirSync(out);
  assert.ok(files.includes("examples.json") && files.some((f) => f.endsWith(".stories.js")), files.join(", "));
  for (const file of files) {
    const text = readFileSync(join(out, file), "utf8");
    assert.ok(!text.includes(root.replace(/[\\/]$/, "")), `${file}에 저장소 절대 경로가 있다`);
    assert.doesNotMatch(text, /node_modules\//, `${file}에 node_modules/ 경로가 있다`);
  }
  // 상대 경로는 실행 시점에 lightning-base-components 위치 기준으로 실제 파일이 된다
  const examples: { name: string; rel: string }[] = JSON.parse(readFileSync(join(out, "examples.json"), "utf8"));
  assert.deepEqual(examples.filter((e) => isAbsolute(e.rel)), []);
  const lbcDir = join(root, "node_modules/lightning-base-components/src/lightning");
  assert.deepEqual(catalogModules(examples, lbcDir).filter((m) => !existsSync(m.path)), []);
});
