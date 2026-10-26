import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAst } from "rollup/parseAst";
import {
  componentNames,
  entrySource,
  findMilvusComponents,
  GENERATED_MARK,
  GenerateError,
  hasHandStory,
  loadComponent,
  parseApiProps,
  parseDescription,
  storySource,
} from "../lib/milvus-stories.ts";
import { generateMilvusStories } from "../scripts/generate-milvus-stories.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
// 저장소 stories/milvus-generated는 pack 테스트(prepack)가 다시 만든다. 결과물은 임시 폴더에만 쓴다(공백·한글 경로)
const tmp = mkdtempSync(join(tmpdir(), "밀버스 스토리 테스트-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

let n = 0;
const dir = (name: string) => join(tmp, `${name} ${++n}`);
// 상대 경로마다 부모 폴더를 만들고 파일을 쓴다
const put = (base: string, files: Record<string, string>) => {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), text);
  }
};
const JS = "export default class X {}\n";
const HTML = "<template></template>\n";
// 화면 컴포넌트 둘(milvusHand, milvusAuto)과 대상이 아닌 폴더들
const fixtureLwc = (extra: Record<string, string> = {}): string => {
  const lwcDir = dir("lwc");
  put(lwcDir, {
    "milvusHand/milvusHand.js": JS,
    "milvusHand/milvusHand.html": HTML,
    "milvusAuto/milvusAuto.js": JS,
    "milvusAuto/milvusAuto.html": HTML,
    "milvusAuto/__tests__/milvusAuto.test.js": "",
    "milvusLib/milvusLib.js": JS,
    "accountCard/accountCard.js": JS,
    "accountCard/accountCard.html": HTML,
    "milvusOther/milvusOther.js": JS,
    "milvusOther/other.html": HTML,
    ...extra,
  });
  return lwcDir;
};

test("componentNames는 export 이름·태그·스토리 이름을 폴더 이름에서 만든다", () => {
  assert.deepEqual(componentNames("milvusMultiSelect"), {
    folder: "milvusMultiSelect",
    exportName: "MilvusMultiSelect",
    tag: "c-milvus-multi-select",
    storyName: "MultiSelect",
  });
});

test("milvus 다음이 대문자가 아니면 폴더 이름을 보여 주며 GenerateError", () => {
  assert.throws(() => componentNames("milvusfoo"), (e) => e instanceof GenerateError && /milvusfoo/.test(e.message));
});

test("findMilvusComponents는 <폴더>.js와 <폴더>.html이 둘 다 있는 milvus* 폴더만 이름순으로 찾는다", () => {
  assert.deepEqual(findMilvusComponents(fixtureLwc()).map((c) => c.folder), ["milvusAuto", "milvusHand"]);
  assert.deepEqual(findMilvusComponents(join(tmp, "없는 폴더")), []);
});

test("이름 규칙은 화면 컴포넌트 후보에만 적용한다", () => {
  const bad = fixtureLwc({ "milvusfoo/milvusfoo.js": JS, "milvusfoo/milvusfoo.html": HTML });
  assert.throws(() => findMilvusComponents(bad), (e) => e instanceof GenerateError && /milvusfoo/.test(e.message));
  const lib = fixtureLwc({ "milvusfoo/milvusfoo.js": JS });
  assert.deepEqual(findMilvusComponents(lib).map((c) => c.folder), ["milvusAuto", "milvusHand"]);
});

test("entrySource는 표시 주석 다음에 컴포넌트마다 export 한 줄", () => {
  const text = entrySource([componentNames("milvusAuto"), componentNames("milvusHand")]);
  assert.equal(
    text,
    `${GENERATED_MARK}\nexport { default as MilvusAuto } from "c/milvusAuto";\nexport { default as MilvusHand } from "c/milvusHand";\n`,
  );
});

test("실제 저장소: 찾은 목록에 지금 화면 컴포넌트가 들어 있고 milvusScript는 없다(메모리에서만)", () => {
  const found = findMilvusComponents(join(root, "force-app/main/default/lwc")).map((c) => c.folder);
  for (const f of ["milvusBadge", "milvusBrandLoader", "milvusCalendar", "milvusModal", "milvusMultiSelect", "milvusNotification"]) {
    assert.ok(found.includes(f), f);
  }
  assert.ok(!found.includes("milvusScript"));
});

const LWC = () => join(root, "force-app/main/default/lwc");

test("parseApiProps: 기본값별 Control(설계 4.3 표)", () => {
  const js = `
    @api on = true;
    @api off = false;
    @api count = 3;
    @api variant = "info";
    @api single = 'one';
    @api options = [];
    @api config = { a: 1 };
    @api plain;
    focus() {}
    @api
    get view() { return this._view; }
    set view(v) { this._view = v; }
    @api reset() {}
  `;
  assert.deepEqual(parseApiProps(js), [
    { name: "on", control: "boolean", value: true },
    { name: "off", control: "boolean", value: false },
    { name: "count", control: "number", value: 3 },
    { name: "variant", control: "text", value: "info" },
    { name: "single", control: "text", value: "one" },
    { name: "options", control: "object" },
    { name: "config", control: "object" },
    { name: "plain", control: "text" },
    { name: "view", control: "text" },
  ]);
});

test("기본값이 식이면 text, 시작 값 없음", () => {
  assert.deepEqual(parseApiProps("@api variant = DEFAULT_VARIANT;\n@api x = `a`;"), [
    { name: "variant", control: "text" },
    { name: "x", control: "text" },
  ]);
});

test("바로 위 /** */가 설명이다. 여러 줄 주석은 한 줄로 합친다", () => {
  const [p] = parseApiProps('/**\n * 기준 날짜 YYYY-MM-DD.\n * 비우면 "오늘"\n */\n@api\nget value() {}');
  assert.deepEqual(p, { name: "value", control: "text", description: '기준 날짜 YYYY-MM-DD. 비우면 "오늘"' });
});

test("떨어진 JSDoc은 설명이 아니다(실제 milvusNotification)", () => {
  const props = parseApiProps(readFileSync(join(LWC(), "milvusNotification/milvusNotification.js"), "utf8"));
  const variant = props.find((p) => p.name === "variant");
  assert.ok(variant);
  assert.equal(variant.description, undefined);
});

test("parseDescription: 두 줄로 나뉜 여는 태그, XML 기호, 없으면 빈 값", () => {
  assert.equal(parseDescription("<x><description\n  >A &amp; B &quot;C&quot;</description></x>"), 'A & B "C"');
  assert.equal(parseDescription("<x></x>"), "");
  assert.equal(parseDescription(undefined), "");
  // meta.xml이 없는 컴포넌트도 설명 없이 읽힌다(설계 5장). 저장소 컴포넌트마다 설명이 있다고 단언하지 않는다(6장)
  assert.equal(loadComponent(fixtureLwc(), componentNames("milvusAuto")).description, "");
});

test("storySource: title·render·export와 표시 주석", () => {
  const text = storySource({
    ...componentNames("milvusProbe"),
    description: "설명",
    props: [{ name: "variant", control: "text", value: "info" }],
  });
  assert.ok(text.startsWith(GENERATED_MARK + "\n"));
  assert.match(text, /title: "컴포넌트\/밀버스 추가\/Probe"/);
  assert.match(text, /lwc\("c-milvus-probe", MilvusProbe, args\)/);
  assert.match(text, /^export const 기본 = \{\};$/m);
  assert.match(text, /^export const 소스_코드 = sourceStory\("milvusProbe"\);$/m);
  assert.match(text, /stories\/components\/milvus\/Probe\.stories\.js/);
});

test("특수 문자가 든 설명과 기본값도 파싱되는 글이 된다", () => {
  const tricky = 'a "b" `c` ${d} \\e\r\n둘째 줄';
  const text = storySource({
    ...componentNames("milvusProbe"),
    description: tricky,
    props: [{ name: "label", control: "text", value: tricky, description: tricky }],
  });
  assert.doesNotThrow(() => parseAst(text));
  assert.ok(!text.includes("\r"));
});

test("CRLF 입력도 LF 글", () => {
  const js = '/** 첫 줄\r\n * 둘째 줄 */\r\n@api label = "x";\r\n';
  assert.deepEqual(parseApiProps(js), [{ name: "label", control: "text", value: "x", description: "첫 줄 둘째 줄" }]);
});

test("@api가 없으면 args·argTypes가 빈 객체(실제 milvusBrandLoader)", () => {
  const c = loadComponent(LWC(), componentNames("milvusBrandLoader"));
  assert.deepEqual(c.props, []);
  assert.ok(c.description.length > 0);
  const text = storySource(c);
  assert.match(text, /args: \{\}/);
  assert.doesNotThrow(() => parseAst(text));
});

test("실제 저장소의 화면 컴포넌트 전부로 만든 글이 파싱된다(파일로는 쓰지 않는다)", () => {
  for (const names of findMilvusComponents(LWC())) {
    assert.doesNotThrow(() => parseAst(storySource(loadComponent(LWC(), names))), names.folder);
  }
});

test("hasHandStory: .js·.ts를 보고 대소문자까지 같아야 한다", () => {
  assert.equal(hasHandStory(["Auto.stories.ts"], "Auto"), true);
  assert.equal(hasHandStory(["auto.stories.js"], "Auto"), false);
  assert.equal(hasHandStory([], "Auto"), false);
});

// 손 스토리 폴더 하나와 출력 폴더 경로(아직 없음)를 새로 만든다
const setup = () => {
  const handStoriesDir = dir("손 스토리");
  put(handStoriesDir, { "Hand.stories.js": "" });
  return { lwcDir: fixtureLwc(), handStoriesDir, out: join(dir("출력"), "milvus-generated") };
};

test("generateMilvusStories: entry에 화면 컴포넌트 전부, 기본 스토리는 손 스토리 없는 것만", () => {
  const o = setup();
  assert.deepEqual(generateMilvusStories(o), { components: 2, stories: 1 });
  assert.deepEqual(readdirSync(o.out).sort(), ["Auto.stories.js", "entry.js"]);
  assert.ok(readFileSync(join(o.out, "entry.js"), "utf8").startsWith(GENERATED_MARK + "\n"));
  // 생성물에 개발자 PC 경로가 없다(설계 4.2)
  for (const f of readdirSync(o.out)) {
    const text = readFileSync(join(o.out, f), "utf8");
    assert.ok(!text.includes(tmp) && !text.includes(root.replace(/[\\/]$/, "")), f);
  }
});

test("손 스토리 폴더가 없으면 모두 생성", () => {
  const o = { ...setup(), handStoriesDir: join(tmp, "없는 손 스토리") };
  assert.deepEqual(generateMilvusStories(o), { components: 2, stories: 2 });
});

test("다시 실행하면 지운 컴포넌트의 스토리가 남지 않고, 손 스토리를 더하면 기본 스토리가 사라진다", () => {
  const o = setup();
  generateMilvusStories(o);
  writeFileSync(join(o.out, "Old.stories.js"), GENERATED_MARK + "\n");
  generateMilvusStories(o);
  assert.ok(!existsSync(join(o.out, "Old.stories.js")));
  put(o.handStoriesDir, { "Auto.stories.js": "" });
  assert.deepEqual(generateMilvusStories(o), { components: 2, stories: 0 });
  assert.deepEqual(readdirSync(o.out), ["entry.js"]);
});

test("남의 파일이 든 폴더, 표시 주석 없는 entry.js 폴더, 파일 경로는 지우지 않고 거부한다", () => {
  const o = setup();
  const foreign = dir("남의 폴더");
  put(foreign, { "내 파일.txt": "소중한 내용" });
  const catalogLike = dir("카탈로그 모양");
  put(catalogLike, { "entry.js": 'export { default as A } from "a/b";\n' });
  const file = join(dir("파일 자리"), "파일");
  put(dirname(file), { 파일: "x" });
  const snapshot = (p: string) => (statSync(p).isDirectory() ? readdirSync(p) : readFileSync(p, "utf8"));
  for (const out of [foreign, catalogLike, file]) {
    const before = snapshot(out);
    assert.throws(() => generateMilvusStories({ ...o, out }), (e) => e instanceof GenerateError && /지우지 않는다/.test(e.message));
    assert.deepEqual(snapshot(out), before);
  }
});

test("CLI: 거부되면 종료 코드 1과 한국어 오류, 폴더는 그대로", () => {
  const foreign = dir("CLI 남의 폴더");
  put(foreign, { "내 파일.txt": "소중한 내용" });
  const run = spawnSync(process.execPath, ["scripts/generate-milvus-stories.ts", foreign], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /지우지 않는다/);
  assert.deepEqual(readdirSync(foreign), ["내 파일.txt"]);
});

test("이름 규칙 위반은 생성 전에 GenerateError(CLI는 같은 catch로 종료 코드 1)", () => {
  const o = { ...setup(), lwcDir: fixtureLwc({ "milvusfoo/milvusfoo.js": JS, "milvusfoo/milvusfoo.html": HTML }) };
  assert.throws(() => generateMilvusStories(o), GenerateError);
  assert.ok(!existsSync(o.out));
});
