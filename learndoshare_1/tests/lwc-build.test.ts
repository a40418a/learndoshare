import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RollupLog } from "rollup";
import { buildLwc, lwcRollupOptions, sfdxLwcModules } from "../lib/lwc-build.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = join(root, "tests/fixtures/lwc");
// 저장소 dist/는 다른 테스트(pack)가 지우고 다시 만든다. 결과물은 임시 폴더에만 쓴다
const tmp = mkdtempSync(join(tmpdir(), "milvus-lwc-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const built = buildLwc({
  out: join(tmp, "lwc"),
  entries: { index: join(fixture, "index.js"), catalog: join(fixture, "catalog.js") },
  modules: [{ name: "c/probe", path: join(fixture, "c/probe/probe.js") }]
});
const output = async (file: string) => (await built, readFileSync(join(tmp, "lwc", file), "utf8"));
// 대체 모듈만 든 번들. 가져오는 파일이 없으므로 data: URL로 실행한다
const platform = buildLwc({ out: join(tmp, "platform"), entries: { platform: join(fixture, "platform.js") }, modules: [] }).then(
  () => import(`data:text/javascript,${encodeURIComponent(readFileSync(join(tmp, "platform/platform.js"), "utf8"))}`)
);

test(".js 컴포넌트를 빌드하면 @api 속성이 publicProps로 등록된다", async () => {
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

test("sfdxLwcModules는 모든 패키지 폴더의 lwc/<이름>/<이름>.js를 c/<이름>으로 찾고 .ts는 쓰지 않는다", () => {
  const project = join(tmp, "sfdx 프로젝트");
  const files = ["force-app/main/default/lwc/a/a.js", "force-app/main/default/lwc/a/a.ts", "force-app/main/default/lwc/a/__tests__/a.test.js", "force-app/main/default/lwc/a/helper.js", "force-app/main/default/lwc/t/t.ts", "extra/lwc/b/b.js"];
  for (const file of files) {
    mkdirSync(dirname(join(project, file)), { recursive: true });
    writeFileSync(join(project, file), "");
  }
  writeFileSync(join(project, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app" }, { path: "extra" }] }));
  assert.deepEqual(sfdxLwcModules(project).sort((x, y) => x.name.localeCompare(y.name)), [
    { name: "c/a", path: join(project, "force-app/main/default/lwc/a/a.js") },
    { name: "c/b", path: join(project, "extra/lwc/b/b.js") }
  ]);
});

// onwarn과 manualChunks만 부른다. 입력 파일은 읽지 않는다
const options = (npmFromPackage?: boolean) => lwcRollupOptions({ out: join(tmp, "o"), entries: { index: join(fixture, "index.js") }, modules: [], npmFromPackage });
const warnings = (npmFromPackage: boolean | undefined, ...logs: RollupLog[]) => {
  const shown: RollupLog[] = [];
  for (const log of logs) options(npmFromPackage).onwarn?.(log, (w) => shown.push(w as RollupLog));
  return shown.map((w) => w.code);
};
const LBC = "/p/node_modules/.pnpm/lightning-base-components@1/node_modules/lightning-base-components/src/lightning";
const log = (code: string, extra: Partial<RollupLog> = {}): RollupLog => ({ code, message: code, ...extra });
const lbcWarning = log("PLUGIN_WARNING", { id: `${LBC}/card/card.html` });
const projectWarning = log("PLUGIN_WARNING", { id: "/customer/force-app/main/default/lwc/a/a.html" });

test("npmFromPackage면 lightning-base-components 안의 컴파일 경고와 순환 import 경고를 숨기고 고객 파일 경고는 보인다", () => {
  const cycle = log("CIRCULAR_DEPENDENCY", { ids: [`${LBC}/a/a.js`, `${LBC}/b/b.js`] });
  const customerCycle = log("CIRCULAR_DEPENDENCY", { ids: [`${LBC}/a/a.js`, "/customer/force-app/main/default/lwc/a/a.js"] });
  assert.deepEqual(warnings(true, lbcWarning, cycle), []);
  assert.deepEqual(warnings(true, projectWarning, customerCycle), ["PLUGIN_WARNING", "CIRCULAR_DEPENDENCY"]);
  assert.deepEqual(warnings(true, log("PLUGIN_WARNING", { id: `${LBC.replaceAll("/", "\\")}\\card\\card.html` })), []); // Windows 경로
});

test("npmFromPackage가 없으면(저장소 빌드) 경고를 모두 그대로 보인다", () => {
  assert.deepEqual(warnings(undefined, lbcWarning, log("CIRCULAR_DEPENDENCY", { ids: [`${LBC}/a/a.js`] })), ["PLUGIN_WARNING", "CIRCULAR_DEPENDENCY"]);
});

test("해석하지 못한 import는 npmFromPackage와 무관하게 빌드를 실패시킨다", () => {
  for (const flag of [true, undefined]) {
    assert.throws(() => options(flag).onwarn?.(log("UNRESOLVED_IMPORT", { message: "못 찾음" }), () => {}), /못 찾음/);
  }
});

test("synthetic-shadow chunk 판정은 Windows 경로 구분자도 같게 본다", () => {
  const { manualChunks } = options().output as { manualChunks: (id: string) => string | undefined };
  assert.equal(manualChunks("/p/node_modules/@lwc/synthetic-shadow/dist/index.js"), "synthetic-shadow");
  assert.equal(manualChunks("C:\\p\\node_modules\\@lwc\\synthetic-shadow\\dist\\index.js"), "synthetic-shadow");
  assert.equal(manualChunks("/p/node_modules/@lwc/engine-dom/dist/index.js"), undefined);
});
