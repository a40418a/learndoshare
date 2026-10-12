import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogModules, lightningBaseComponentsDir } from "../lib/lwc-build.ts";
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

test("CLI는 인자로 받은 폴더에 만들고 종료 코드 0으로 끝낸다", () => {
  const dir = join(tmp, "CLI 출력");
  const run = cli(dir);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /컴포넌트 73개, 공식 예제 249개/);
  assert.ok(existsSync(join(dir, "examples.json")));
});
