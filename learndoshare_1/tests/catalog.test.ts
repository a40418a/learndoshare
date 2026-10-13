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

// 원본과 hook 보기(설계 9.5). 데이터는 생성 파일의 `const view = {...};` 한 줄과 공유 모듈 hook-info.js·shared-info.js의 `export default {...};` 한 줄이다
const viewOf = (file: string) => JSON.parse(/^const view = (.*);$/m.exec(readFileSync(join(out, file), "utf8"))![1]);
const moduleOf = (file: string) => JSON.parse(/^export default (.*);$/m.exec(readFileSync(join(out, file), "utf8"))![1]);
const req = createRequire(join(root, "package.json"));
const rawImports = (text: string) => [...text.matchAll(/import\("([^"]+)\?raw"\)|from "([^"]+)\?raw"/g)].map((m) => m[1] ?? m[2]);
type Section = { counts: Record<string, Record<string, number[]>>; hooks: [string, number, string, number, string][]; gaps: { how: string }[] };
// 절 여러 개의 개수 [hook, 브리지, 고정, 빈틈]를 더한 가장 나쁜 상태(report.json의 판정 방식)
const worst = (sections: Section[], item: string, mode: string) => {
  const n = [0, 0, 0, 0];
  for (const s of sections) s.counts[item]?.[mode].forEach((x, i) => (n[i] += x));
  return n[3] ? "gap" : n[2] ? "fixed" : n[1] ? "bridge" : n[0] ? "reached" : "n/a";
};
const reportWorst = (report: { byComponent: Record<string, Record<string, Record<string, string>>> }, keys: string[], item: string, mode: string) =>
  keys.map((k) => report.byComponent[k]?.[item]?.[mode] ?? "n/a").reduce((a, b) => ((RANK as string[]).indexOf(b) > (RANK as string[]).indexOf(a) ? b : a));
const report = JSON.parse(readFileSync(join(root, "audit/report.json"), "utf8"));
const ITEMS = Object.keys(report.byItem);

test("Button 스토리 파일에 '원본과 hook' 스토리가 있고 report의 button 항목을 쓴다", () => {
  const story = readFileSync(join(out, "Button.stories.js"), "utf8");
  assert.match(story, /name: "원본과 hook"/);
  assert.match(story, /^import hookInfo from "\.\/hook-info\.js";$/m);
  assert.match(story, /^import sharedInfo from "\.\/shared-info\.js";$/m);
  assert.match(story, /^import \{ sourceAndHooks \} from "\.\.\/salesforce-source\.js";$/m);
  const view = viewOf("Button.stories.js");
  const shared = moduleOf("shared-info.js");
  assert.deepEqual([view.tag, view.folder, view.native], ["lightning-button", "button", true]);
  // "이 컴포넌트"(폴더의 자기 파일 + 직접 쓰는 블루프린트)의 판정은 report.json byComponent의 button(폴더와 같은 이름의 블루프린트를 한 키로 센다)과 같다
  const direct = view.blueprints.filter((b: { shared: boolean }) => !b.shared).map((b: { name: string }) => b.name);
  assert.ok(direct.includes("button") && view.shared.length === 0, JSON.stringify(view.blueprints));
  const main = [view.own, ...direct.map((b: string) => shared.blueprints[b])];
  for (const item of ITEMS) for (const mode of ["now", "native"]) assert.equal(worst(main, item, mode), reportWorst(report, [view.folder, ...direct], item, mode), `${item} ${mode}`);
  assert.ok(Object.keys(report.byComponent.button).every((i) => main.some((s) => s.counts[i])));
  // hook 표: 행은 절에, 종류·이어지는 hook·기본값·util.css 허용은 공유 hook-info.js에
  const info = moduleOf("hook-info.js");
  const rows = main.flatMap((s) => s.hooks);
  const hook = (name: string) => rows.some(([n]) => n === name) && info[name];
  assert.ok(rows.some(([n, now]) => n === "--slds-s-button-radius-border" && now > 0));
  assert.deepEqual([hook("--slds-s-button-radius-border")?.kind, hook("--slds-s-button-radius-border")?.next], ["s", "--slds-g-radius-border-2"]);
  assert.equal(hook("--slds-g-radius-border-2")?.light, "0.5rem");
  assert.equal(hook("--slds-g-radius-border-2")?.util, "예");
  assert.equal(hook("--slds-c-button-radius-border")?.kind, "c");
  assert.match(hook("--slds-c-button-radius-border")?.util, /^아니요/);
  // 기본값에 var()가 있으면 푼 식을 함께 둔다(지금 값과 비교해 "기본값"을 가린다)
  assert.match(hook("--slds-g-color-accent-2")?.resolved, /^light-dark\(#[0-9a-f]+, #[0-9a-f]+\)$/i);
  // 빈틈 표: 브리지와 고정으로 판정된 선언도 메우는 방법과 함께 보여 준다
  const gaps = main.flatMap((s) => s.gaps);
  assert.ok(gaps.some((g) => g.how === "브리지"));
  assert.ok(gaps.some((g) => g.how.startsWith("Salesforce 고정")));
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
});

test("Helptext는 공용 사본(form-element.slds.css)과 거기서 온 블루프린트를 이 컴포넌트 것과 나눠 보인다", () => {
  const view = viewOf("Helptext.stories.js");
  const shared = moduleOf("shared-info.js");
  assert.ok(view.shared.some((s: { file: string }) => s.file === "form-element.slds.css"), JSON.stringify(view.shared));
  assert.ok(!view.own.files.includes("form-element.slds.css"));
  const bp = (name: string) => view.blueprints.find((b: { name: string }) => b.name === name);
  assert.deepEqual(bp("checkbox"), { name: "checkbox", shared: true, files: ["form-element.slds.css"] });
  assert.equal(bp("dueling-list")?.shared, true);
  // 폴더 전체(자기 파일 + 공용 사본)는 report.json의 폴더 키 helptext와 같은 판정이다
  const folder = [view.own, ...view.shared.map((s: { file: string }) => ({ ...shared.files[s.file], ...s }))];
  for (const item of ITEMS) for (const mode of ["now", "native"]) assert.equal(worst(folder, item, mode), reportWorst(report, ["helptext"], item, mode), `${item} ${mode}`);
});

test("공용 사본의 판정이 폴더마다 다르면 그 페이지가 덮어쓰고, 폴더 전체는 report.json의 폴더 키와 같다(Carousel, ButtonMenu)", () => {
  const shared = moduleOf("shared-info.js");
  for (const file of ["Carousel.stories.js", "ButtonMenu.stories.js"]) {
    const view = viewOf(file);
    // button.slds.css는 폴더 안 변수 정의에 따라 native 컨트롤 높이 개수가 달라 이 페이지들이 counts를 덮어쓴다
    assert.ok(view.shared.some((s: { file: string; counts?: unknown }) => s.file === "button.slds.css" && s.counts), file);
    // report.json은 폴더와 이름이 같은 블루프린트(carousel)를 폴더 키에 함께 센다
    const sameName = view.blueprints.some((b: { name: string }) => b.name === view.folder) ? [shared.blueprints[view.folder]] : [];
    const folder = [view.own, ...view.shared.map((s: { file: string }) => ({ ...shared.files[s.file], ...s })), ...sameName];
    for (const item of ITEMS) for (const mode of ["now", "native"]) assert.equal(worst(folder, item, mode), reportWorst(report, [view.folder], item, mode), `${file} ${item} ${mode}`);
  }
});

test("폴더 이름과 같은 블루프린트는 공용 사본에서만 와도 직접이다(Accordion)", () => {
  const view = viewOf("Accordion.stories.js");
  const accordion = view.blueprints.find((b: { name: string }) => b.name === "accordion");
  assert.deepEqual(accordion, { name: "accordion", shared: false, files: ["accordion-section.slds.css"] });
  assert.ok(view.shared.some((s: { file: string }) => s.file === "accordion-section.slds.css"));
});

test("블루프린트와 공용 사본 절은 shared-info.js에 한 번만 쓰고, 페이지에는 이름과 출처만 둔다", () => {
  const shared = moduleOf("shared-info.js");
  const pages = readdirSync(out).filter((f) => f.endsWith(".stories.js")).map(viewOf);
  for (const view of pages) {
    for (const b of view.blueprints) {
      assert.deepEqual(Object.keys(b).sort(), ["files", "name", "shared"], view.folder);
      assert.ok(shared.blueprints[b.name], `${view.folder}: ${b.name}`);
    }
    for (const s of view.shared) assert.ok(shared.files[s.file], `${view.folder}: ${s.file}`);
  }
  // 버튼 블루프린트를 여러 페이지가 보지만 행은 shared-info.js에만 있다
  assert.ok(pages.filter((v) => v.blueprints.some((b: { name: string }) => b.name === "button")).length > 5);
  // 읽는 곳의 선택자 자리는 비지 않는다(native 표시만 있던 선택자는 :host)
  const ats = [...pages.map((v) => v.own), ...Object.values(shared.files), ...Object.values(shared.blueprints)].flatMap((s) =>
    (s as Section).hooks.flatMap(([, , nowAt, , nativeAt]) => [nowAt, nativeAt]),
  );
  assert.deepEqual(ats.filter((at) => /^ \{|· +\{|  /.test(at)), []);
  assert.ok(ats.some((at) => at.includes("· :host {")));
});

test("CSS가 없는 컴포넌트(treeGrid)도 '원본과 hook' 스토리가 있다", () => {
  const view = viewOf("TreeGrid.stories.js");
  assert.deepEqual([view.blueprints, view.shared, view.own.hooks, view.own.gaps], [[], [], [], []]);
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
