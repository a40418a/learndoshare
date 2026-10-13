import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogModules, lightningBaseComponentsDir } from "../lib/lwc-build.ts";
import { RANK } from "../scripts/audit/report.ts";
import { generateCatalog } from "../scripts/generate-slds-catalog.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const lbcDir = lightningBaseComponentsDir();
// 저장소 stories/slds-catalog는 pack 테스트(prepack)가 다시 만든다. 결과물은 임시 폴더에만 쓴다(공백·한글 경로)
const tmp = mkdtempSync(join(tmpdir(), "milvus-catalog-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const out = join(tmp, "카탈로그 출력");
const generated = generateCatalog({ lbcDir, outStories: out });
const cli = (dir: string) => spawnSync(process.execPath, ["scripts/generate-slds-catalog.ts", dir], { cwd: root, encoding: "utf8" });

test("컴포넌트 73개, 예제 249개를 만들고 스토리 파일이 컴포넌트마다 하나 있다", () => {
  assert.deepEqual(generated, { components: 73, examples: 249 });
  assert.equal(readdirSync(out).filter((f) => f.endsWith(".stories.js")).length, 73);
});

test("lightning-base-components 폴더는 설치된 패키지의 src/lightning이다", () => {
  assert.ok(lbcDir.endsWith(join("lightning-base-components", "src", "lightning")), lbcDir);
  assert.ok(existsSync(join(lbcDir, "button/__examples__")));
});

test("생성된 examples.json과 카탈로그 스토리에 절대 경로와 'node_modules/' 상대 경로가 없다", () => {
  const files = readdirSync(out);
  assert.ok(files.includes("examples.json") && files.includes("entry.js"), files.join(", "));
  for (const file of files) {
    const text = readFileSync(join(out, file), "utf8");
    assert.ok(!text.includes(root.replace(/[\\/]$/, "")), `${file}에 저장소 절대 경로가 있다`);
    assert.ok(!text.includes(out), `${file}에 출력 폴더 절대 경로가 있다`);
    assert.doesNotMatch(text, /node_modules\//, `${file}에 node_modules/ 경로가 있다`);
  }
});

test("examples.json은 { name, rel } 형식이고 rel은 lbcDir 기준 상대 경로로 실제 파일이 된다", () => {
  const examples: { name: string; rel: string }[] = JSON.parse(readFileSync(join(out, "examples.json"), "utf8"));
  assert.ok(examples.length >= 249);
  assert.deepEqual(examples.filter((e) => JSON.stringify(Object.keys(e)) !== '["name","rel"]'), []);
  assert.deepEqual(examples.filter((e) => isAbsolute(e.rel)), []);
  assert.ok(examples.some((e) => e.name === "button/basic" && e.rel === "button/__examples__/basic/basic.js"));
  assert.deepEqual(catalogModules(examples, lbcDir).filter((m) => !existsSync(m.path)), []);
});

test("스토리는 @milvus/lwc로 번들을 읽고 예제 HTML 원본을 bare specifier ?raw로 읽는다", () => {
  const story = readFileSync(join(out, "Button.stories.js"), "utf8");
  assert.match(story, /^import \{ createElement \} from "@milvus\/lwc\/index\.js";$/m);
  assert.match(story, /^import \* as ex from "@milvus\/lwc\/catalog\.js";$/m);
  assert.match(story, /^import html0 from "lightning-base-components\/src\/lightning\/button\/__examples__\/\w+\/\w+\.html\?raw";$/m);
  assert.match(story, /scripts\/generate-slds-catalog\.ts/);
});

test("비어 있지 않고 examples.json이 없는 폴더는 지우지 않고 한국어 오류로 거부한다", () => {
  const foreign = join(tmp, "남의 폴더");
  mkdirSync(foreign);
  writeFileSync(join(foreign, "내 파일.txt"), "소중한 내용");
  assert.throws(() => generateCatalog({ lbcDir, outStories: foreign }), /지우지 않는다/);
  assert.deepEqual(readdirSync(foreign), ["내 파일.txt"]);
  // 같은 경우 CLI는 종료 코드 1과 한국어 오류를 낸다
  const run = cli(foreign);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /지우지 않는다/);
  assert.deepEqual(readdirSync(foreign), ["내 파일.txt"]);
});

test("폴더가 아닌 파일이 있는 경로도 지우지 않고 거부한다", () => {
  const file = join(tmp, "파일");
  writeFileSync(file, "x");
  assert.throws(() => generateCatalog({ lbcDir, outStories: file }), /지우지 않는다/);
  assert.equal(readFileSync(file, "utf8"), "x");
});

test("없는 폴더, 빈 폴더, 이전에 만든 폴더(examples.json 있음)는 만들거나 다시 만든다", () => {
  const dir = join(tmp, "다시 만들 폴더");
  assert.deepEqual(generateCatalog({ lbcDir, outStories: dir }), generated);
  writeFileSync(join(dir, "이전 결과.stories.js"), "");
  assert.deepEqual(generateCatalog({ lbcDir, outStories: dir }), generated);
  assert.ok(!existsSync(join(dir, "이전 결과.stories.js")));
  const empty = join(tmp, "빈 폴더");
  mkdirSync(empty);
  assert.deepEqual(generateCatalog({ lbcDir, outStories: empty }), generated);
});

// 원본과 hook 보기(설계 9.5). 데이터는 생성 파일의 `const view = {...};` 한 줄이다
const viewOf = (file: string) => JSON.parse(/^const view = (.*);$/m.exec(readFileSync(join(out, file), "utf8"))![1]);
const req = createRequire(join(root, "package.json"));
const rawImports = (text: string) => [...text.matchAll(/import\("([^"]+)\?raw"\)|from "([^"]+)\?raw"/g)].map((m) => m[1] ?? m[2]);

test("Button 스토리 파일에 '원본과 hook' 스토리가 있고 report의 button 항목을 쓴다", () => {
  const story = readFileSync(join(out, "Button.stories.js"), "utf8");
  assert.match(story, /name: "원본과 hook"/);
  const view = viewOf("Button.stories.js");
  assert.equal(view.tag, "lightning-button");
  assert.equal(view.native, true);
  assert.ok(view.blueprints.includes("button"), view.blueprints.join(" "));
  // 머리 요약의 상태는 audit/report.json byComponent의 button(기본 컴포넌트 폴더와 같은 이름의 블루프린트)과
  // 이 페이지가 함께 보는 블루프린트 항목 중 가장 나쁜 상태와 같다
  const report = JSON.parse(readFileSync(join(root, "audit/report.json"), "utf8"));
  const keys = [view.folder, ...view.blueprints];
  assert.ok(report.byComponent.button && view.folder === "button");
  for (const row of view.summary) {
    for (const mode of ["now", "native"]) {
      const expected = keys.map((k: string) => report.byComponent[k]?.[row.item]?.[mode] ?? "n/a").reduce((a: string, b: string) => ((RANK as string[]).indexOf(b) > (RANK as string[]).indexOf(a) ? b : a));
      assert.equal(row[mode].status, expected, `${row.item} ${mode}`);
    }
  }
  assert.deepEqual(Object.keys(report.byComponent.button).filter((i) => !view.summary.some((r: { item: string }) => r.item === i)), []);
  // hook 표: 페이지에는 읽는 곳, 공유 hook-info.js에는 종류·이어지는 hook·기본값·util.css 허용
  const info = JSON.parse(/^export default (.*);$/m.exec(readFileSync(join(out, "hook-info.js"), "utf8"))![1]);
  const hook = (name: string) => view.hooks.some((h: { name: string }) => h.name === name) && info[name];
  assert.match(story, /^import hookInfo from "\.\/hook-info\.js";$/m);
  assert.ok(view.hooks.find((h: { name: string }) => h.name === "--slds-s-button-radius-border").now > 0);
  assert.deepEqual([hook("--slds-s-button-radius-border")?.kind, hook("--slds-s-button-radius-border")?.next], ["s", "--slds-g-radius-border-2"]);
  assert.equal(hook("--slds-g-radius-border-2")?.light, "0.5rem");
  assert.equal(hook("--slds-g-radius-border-2")?.util, "예");
  assert.equal(hook("--slds-c-button-radius-border")?.kind, "c");
  assert.match(hook("--slds-c-button-radius-border")?.util, /^아니요/);
  // 빈틈 표: 브리지와 고정으로 판정된 선언도 메우는 방법과 함께 보여 준다
  assert.ok(view.gaps.some((g: { how: string }) => g.how.startsWith("브리지")));
  assert.ok(view.gaps.some((g: { how: string }) => g.how.startsWith("Salesforce 고정")));
  // 원본 탭: 기본 컴포넌트 폴더의 html·js·css와 SLDS 2 컴포넌트 CSS를 bare specifier ?raw로 읽는다
  const raws = rawImports(story);
  for (const spec of [
    "lightning-base-components/src/lightning/button/button.html",
    "lightning-base-components/src/lightning/button/button.js",
    "lightning-base-components/src/lightning/button/button.slds.css",
    "@salesforce-ux/design-system-2/dist/components/button/button.css",
  ]) {
    assert.ok(raws.includes(spec), `${spec}이 없다`);
  }
  assert.deepEqual(raws.filter((spec) => !existsSync(req.resolve(spec))), []);
  assert.match(story, /^import \{ sourceAndHooks \} from "\.\.\/salesforce-source\.js";$/m);
});

test("CSS가 없는 컴포넌트(treeGrid)도 '원본과 hook' 스토리가 있다", () => {
  const view = viewOf("TreeGrid.stories.js");
  assert.deepEqual([view.blueprints, view.hooks, view.gaps], [[], [], []]);
  assert.ok(rawImports(readFileSync(join(out, "TreeGrid.stories.js"), "utf8")).includes("lightning-base-components/src/lightning/treeGrid/treeGrid.js"));
});

test("License 페이지와 원본 보기에 Salesforce 이용 약관(LICENSE.txt) 전문이 들어간다", () => {
  // 전문은 두 패키지의 LICENSE.txt를 빌드할 때 읽는다. 원본 보기(salesforce-source.js)와 License 페이지가 같은 licenseBlock을 쓴다
  const view = readFileSync(join(root, "stories/salesforce-source.js"), "utf8");
  const licenses = ["lightning-base-components/LICENSE.txt", "@salesforce-ux/design-system-2/LICENSE.txt"];
  assert.deepEqual(licenses.filter((l) => !rawImports(view).includes(l)), []);
  for (const l of licenses) assert.match(readFileSync(req.resolve(l), "utf8"), /^Terms of Use/);
  assert.match(view, /licenseBlock\(\)/);
  assert.match(view, /원본은 고치는 대상이 아니라 확인 근거다\. 고쳐도 Storybook만 바뀌고 org는 바뀌지 않는다/);
  const page = readFileSync(join(root, "stories/start/License.stories.ts"), "utf8");
  assert.match(page, /^import \{ licenseBlock, NOTICE \} from "\.\.\/salesforce-source\.js";$/m);
  assert.match(page, /title: "시작하기\/Salesforce 이용 약관"/);
  assert.match(page, /render: \(\) => licenseBlock\(\)/);
});

test("CLI는 인자로 받은 폴더에 만들고 종료 코드 0으로 끝낸다", () => {
  const dir = join(tmp, "CLI 출력");
  const run = cli(dir);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /컴포넌트 73개, 공식 예제 249개/);
  assert.ok(existsSync(join(dir, "examples.json")));
});
