# 밀버스 컴포넌트 Storybook 자동 등록 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pnpm build:lwc`(그래서 `pnpm storybook`·`build-storybook`)와 `prepack`이 `force-app`의 `milvus*` 화면 컴포넌트를 찾아 Storybook entry와 기본 스토리를 만들어, 새 컴포넌트를 손으로 등록하지 않아도 Storybook에 뜨게 한다.

**Architecture:** 파일을 쓰지 않는 함수(찾기·이름·`@api`·description 해석·글 만들기)는 `lib/milvus-stories.ts`에 두고, `scripts/generate-milvus-stories.ts`가 그 함수로 `stories/milvus-generated/`(커밋하지 않음)를 지우고 다시 쓴다. `stories/lwc-entry.js`는 손으로 쓰던 밀버스 export 대신 생성 entry를 다시 내보낸다. SLDS 카탈로그 생성기(`scripts/generate-slds-catalog.ts`)와 같은 모양이다.

**Tech Stack:** Node 22.18+ type stripping(`.ts` 직접 실행), `node --test`, `rollup/parseAst`(설치됨, 파싱 테스트), Rollup + `@lwc/rollup-plugin` 9.4.3, Storybook 10.6.0 web-components-vite. 새 의존성 없음.

**Spec:** `docs/specs/2026-10-26-milvus-story-sync-design.md` (승인 2026-10-26, 이슈 #76). 계획과 다르게 읽히는 곳은 설계가 우선이다.

## Global Constraints

- 브랜치 `feat/76-milvus-story-sync`. 커밋과 push는 **사용자가 요청할 때만** 한다(CLAUDE.md 1장). 요청받으면 형식은 `[Feat] 요약 (#76)`, 끝에 `Co-Authored-By` 줄
- pnpm만 쓴다. 새 의존성을 더하지 않는다
- 고객 프로젝트의 `pnpm milvus …` 명령과 `cli/storybook.ts`는 바꾸지 않는다(설계 2장)
- 생성 폴더: `stories/milvus-generated/`. 커밋하지 않는다(`.gitignore`)
- 표시 주석(정확히 이 한 줄, 생성 파일마다 첫 줄): `// 생성 파일: scripts/generate-milvus-stories.ts. 고치지 않는다`
- 기본 스토리 title: `컴포넌트/밀버스 추가/<스토리 이름>`. export는 `기본`과 `소스_코드` 두 개
- 생성 코드에 들어가는 문자열은 모두 `JSON.stringify`로 넣는다. 템플릿 리터럴에 원문을 끼우지 않는다. 출력은 LF만 쓴다(`\r` 없음)
- 생성물에는 개발자 PC 경로를 넣지 않는다. import는 `c/<폴더 이름>`과 `../helpers.js`만 쓴다
- 테스트는 임시 폴더에만 쓴다(`mkdtempSync`, 이름에 공백·한글). 저장소의 `stories/milvus-generated/`는 읽지도 쓰지도 않는다. 저장소 상태에 묶인 숫자(6개, 0개)로 단언하지 않는다
- 의도적 단순화는 `ponytail:` 주석으로 남긴다(설계 4.5 두 곳: `@api` 정규식, 손 스토리 파일 이름 판정)
- 사용자에게 보이는 문구·오류는 한국어

## Review Focus

설계가 정하지만 아래 테스트 목록이 바로 겨누지 않는 입력이다. 사용자가 실제로 만나기 쉬운 순서다.

1. **Windows 작업 트리의 CRLF**(`core.autocrlf`): `.js`·`.js-meta.xml`이 `\r\n`이어도 Linux CI와 같은 글이 나와야 한다(`\r` 없음, 설명 줄바꿈 같음) → Task 2 테스트 `CRLF 입력도 LF 글`
2. **`@api`가 하나도 없는 컴포넌트**(실제 `milvusBrandLoader`): Controls 없이도 스토리가 만들어지고 파싱되어야 한다 → Task 2 테스트 `@api가 없으면 args·argTypes가 빈 객체`
3. **손 스토리 폴더가 없는 저장소**(새 checkout, 배포 저장소로 옮길 때 구조가 다를 때): 오류 없이 "손 스토리 없음"으로 보고 모두 생성해야 한다 → Task 3 테스트 `손 스토리 폴더가 없으면 모두 생성`
4. **기본값이 상수나 식인 `@api`**(`@api variant = DEFAULT_VARIANT;`, `` @api x = `a`; ``): 식 글자를 값으로 넣지 말고 text, 시작 값 없음이어야 한다 → Task 2 테스트 `기본값이 식이면 text, 시작 값 없음`
5. **클래스 JSDoc 아래 주석 없는 `@api`**(실제 `milvusNotification`의 `variant`): 클래스 설명을 속성 설명으로 가져오면 안 된다. `/** */`와 `@api` 사이가 공백뿐일 때만 설명이다 → Task 2 테스트 `떨어진 JSDoc은 설명이 아니다`

---

## 파일 지도

| 파일 | 할 일 | Task |
| --- | --- | --- |
| `lib/milvus-stories.ts` (새) | 이름 규칙, 찾기, `entry.js` 글 / `@api`·description 해석, 스토리 글 / 손 스토리 판정 | 1, 2, 3 |
| `scripts/generate-milvus-stories.ts` (새) | 지우기 전 확인, 쓰기, CLI | 3 |
| `tests/milvus-stories.test.ts` (새) | 위 둘의 테스트 | 1, 2, 3 |
| `package.json` | `build:lwc`, `prepack` | 4 |
| `.gitignore` | `stories/milvus-generated/` | 3 |
| `stories/lwc-entry.js` | 밀버스 export 6줄 → 생성 entry 한 줄 | 4 |
| `tests/storybook-cli.test.ts` | `makePkg`가 생성 entry를 직접 쓴다 | 4 |
| `tests/pack.test.ts` | entry 목록, R1 경로 검사, 스크립트 순서 | 4 |
| `CLAUDE.md`, `README.md` | 새 컴포넌트 순서, 생성 폴더, `build-storybook` 설명 | 4 |

---

### Task 1: 이름 규칙, 찾기, `entry.js` 글

**Files:**
- Create: `lib/milvus-stories.ts`
- Create: `tests/milvus-stories.test.ts`

**Interfaces:**
- Produces:
  - `export const GENERATED_MARK = "// 생성 파일: scripts/generate-milvus-stories.ts. 고치지 않는다";`
  - `export class GenerateError extends Error {}` — 사용자가 고칠 수 있는 오류(이름 규칙, 지우기 거부). CLI가 한국어 문구와 종료 코드 1로 바꾼다
  - `export type ComponentNames = { folder: string; exportName: string; tag: string; storyName: string }`
  - `export function componentNames(folder: string): ComponentNames` — `folder`가 `/^milvus[A-Z][A-Za-z0-9]*$/`가 아니면 `GenerateError("밀버스 컴포넌트 폴더 이름은 milvus 다음 첫 글자가 영문 대문자여야 한다(예: milvusFoo): " + folder)`. `exportName` = 첫 글자 대문자, `tag` = `"c-" +` camelCase를 kebab-case로, `storyName` = `folder.slice(6)`
  - `export function findMilvusComponents(lwcDir: string): ComponentNames[]` — `lwcDir` 바로 아래 폴더 중 이름이 `milvus`로 시작하고 그 안에 `<폴더>.js`와 `<폴더>.html`이 둘 다 있는 것을 이름순으로. 후보에만 `componentNames`를 적용한다(html이 없는 `milvusScript`류는 이름 검사도 하지 않는다). `lwcDir`이 없으면 `[]`
  - `export function entrySource(components: ComponentNames[]): string` — `GENERATED_MARK` 줄, 그다음 컴포넌트마다 `export { default as <exportName> } from "c/<folder>";`, 끝에 `\n`

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`tests/milvus-stories.test.ts`)

  파일 머리에 둘 것:
  - `const root = fileURLToPath(new URL("..", import.meta.url));`
  - `const tmp = mkdtempSync(join(tmpdir(), "밀버스 스토리 테스트-"));`, `after(() => rmSync(tmp, { recursive: true, force: true }));`
  - `let n = 0; const dir = (name: string) => join(tmp, \`${name} ${++n}\`);`
  - `put(base: string, files: Record<string, string>)`: 키(상대 경로)마다 부모 폴더를 만들고 파일을 쓴다
  - `fixtureLwc(extra: Record<string, string> = {}): string` — 새 `dir("lwc")`에 아래를 쓰고 그 경로를 돌려준다. Task 3도 이것을 쓴다
    - `milvusHand/milvusHand.js`·`.html`, `milvusAuto/milvusAuto.js`·`.html`(js는 `export default class X {}`, html은 `<template></template>`)
    - `milvusAuto/__tests__/milvusAuto.test.js`, `milvusLib/milvusLib.js`(html 없음), `accountCard/accountCard.js`·`.html`, `milvusOther/milvusOther.js` + `milvusOther/other.html`
    - 그리고 `extra`

  ```ts
  test("componentNames는 export 이름·태그·스토리 이름을 폴더 이름에서 만든다", () => {
    assert.deepEqual(componentNames("milvusMultiSelect"), {
      folder: "milvusMultiSelect", exportName: "MilvusMultiSelect", tag: "c-milvus-multi-select", storyName: "MultiSelect",
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
    const bad = fixtureLwc({ "milvusfoo/milvusfoo.js": "", "milvusfoo/milvusfoo.html": "<template></template>" });
    assert.throws(() => findMilvusComponents(bad), (e) => e instanceof GenerateError && /milvusfoo/.test(e.message));
    const lib = fixtureLwc({ "milvusfoo/milvusfoo.js": "" });
    assert.deepEqual(findMilvusComponents(lib).map((c) => c.folder), ["milvusAuto", "milvusHand"]);
  });

  test("entrySource는 표시 주석 다음에 컴포넌트마다 export 한 줄", () => {
    const text = entrySource([componentNames("milvusAuto"), componentNames("milvusHand")]);
    assert.equal(text, `${GENERATED_MARK}\nexport { default as MilvusAuto } from "c/milvusAuto";\nexport { default as MilvusHand } from "c/milvusHand";\n`);
  });

  test("실제 저장소: 찾은 목록에 지금 화면 컴포넌트가 들어 있고 milvusScript는 없다(메모리에서만)", () => {
    const found = findMilvusComponents(join(root, "force-app/main/default/lwc")).map((c) => c.folder);
    for (const f of ["milvusBadge", "milvusBrandLoader", "milvusCalendar", "milvusModal", "milvusMultiSelect", "milvusNotification"]) assert.ok(found.includes(f), f);
    assert.ok(!found.includes("milvusScript"));
  });
  ```

- [ ] **Step 2: 실패를 확인한다**

  Run: `node --test tests/milvus-stories.test.ts`
  Expected: FAIL — `lib/milvus-stories.ts`를 찾지 못함

- [ ] **Step 3: `lib/milvus-stories.ts`에 Interfaces의 다섯 가지를 만든다**

  파일 머리 주석에 설계 문서 경로와 "파일을 쓰지 않는 함수만 둔다"를 적는다. 폴더 읽기는 `readdirSync(lwcDir, { withFileTypes: true })`로 하고, `existsSync`는 `lwcDir`이 있는지 볼 때만 쓴다. 컴포넌트 폴더 안은 `readdirSync(<폴더>)` 결과에 `<폴더>.js`와 `<폴더>.html`이 대소문자까지 같은 이름으로 있는지로 판정한다(Windows의 `existsSync`는 대소문자를 무시한다. 설계 4.2와 같은 이유).

- [ ] **Step 4: 통과를 확인한다**

  Run: `node --test tests/milvus-stories.test.ts` → Expected: PASS
  Run: `pnpm typecheck` → Expected: 오류 없음

- [ ] **Step 5: 커밋(사용자가 요청할 때)** — `[Feat] 밀버스 컴포넌트 찾기와 Storybook entry 글 만들기 (#76)`

---

### Task 2: `@api`·description 해석과 기본 스토리 글

**Files:**
- Modify: `lib/milvus-stories.ts`
- Modify: `tests/milvus-stories.test.ts`

**Interfaces:**
- Consumes: `ComponentNames`, `componentNames`, `GENERATED_MARK` (Task 1)
- Produces:
  - `export type ApiProp = { name: string; control: "boolean" | "number" | "text" | "object"; value?: boolean | number | string; description?: string }`
  - `export function parseApiProps(js: string): ApiProp[]` — 선언 순서대로
  - `export function parseDescription(metaXml: string | undefined): string` — 없으면 `""`
  - `export type MilvusComponent = ComponentNames & { description: string; props: ApiProp[] }`
  - `export function loadComponent(lwcDir: string, names: ComponentNames): MilvusComponent` — `<폴더>.js`와(있으면) `<폴더>.js-meta.xml`을 읽는다
  - `export function storySource(c: MilvusComponent): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

  ```ts
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
      { name: "variant", control: "text" }, { name: "x", control: "text" },
    ]);
  });

  test("바로 위 /** */가 설명이다. 여러 줄 주석은 한 줄로 합친다", () => {
    const [p] = parseApiProps('/**\n * 기준 날짜 YYYY-MM-DD.\n * 비우면 "오늘"\n */\n@api\nget value() {}');
    assert.deepEqual(p, { name: "value", control: "text", description: '기준 날짜 YYYY-MM-DD. 비우면 "오늘"' });
  });

  test("떨어진 JSDoc은 설명이 아니다(실제 milvusNotification)", () => {
    const props = parseApiProps(readFileSync(join(root, "force-app/main/default/lwc/milvusNotification/milvusNotification.js"), "utf8"));
    assert.equal(props.find((p) => p.name === "variant")?.description, undefined);
  });

  test("parseDescription: 두 줄로 나뉜 여는 태그, XML 기호, 없으면 빈 값", () => {
    assert.equal(parseDescription('<x><description\n  >A &amp; B &quot;C&quot;</description></x>'), 'A & B "C"');
    assert.equal(parseDescription("<x></x>"), "");
    assert.equal(parseDescription(undefined), "");
    // 실제 6개 meta.xml(milvusBrandLoader 포함)은 모두 비어 있지 않다
  });

  test("storySource: title·render·export와 표시 주석", () => {
    const text = storySource({ ...componentNames("milvusProbe"), description: "설명", props: [{ name: "variant", control: "text", value: "info" }] });
    assert.ok(text.startsWith(GENERATED_MARK + "\n"));
    assert.match(text, /title: "컴포넌트\/밀버스 추가\/Probe"/);
    assert.match(text, /lwc\("c-milvus-probe", MilvusProbe, args\)/);
    assert.match(text, /^export const 기본 = \{\};$/m);
    assert.match(text, /^export const 소스_코드 = sourceStory\("milvusProbe"\);$/m);
    assert.match(text, /stories\/components\/milvus\/Probe\.stories\.js/); // 머리 주석·설명의 손 스토리 안내
  });

  test("특수 문자가 든 설명과 기본값도 파싱되는 글이 된다", () => {
    const tricky = 'a "b" `c` ${d} \\e\r\n둘째 줄';
    const text = storySource({ ...componentNames("milvusProbe"), description: tricky,
      props: [{ name: "label", control: "text", value: tricky, description: tricky }] });
    assert.doesNotThrow(() => parseAst(text));
    assert.ok(!text.includes("\r"));
  });

  test("CRLF 입력도 LF 글", () => {
    const js = '/** 첫 줄\r\n * 둘째 줄 */\r\n@api label = "x";\r\n';
    assert.deepEqual(parseApiProps(js), [{ name: "label", control: "text", value: "x", description: "첫 줄 둘째 줄" }]);
  });

  test("@api가 없으면 args·argTypes가 빈 객체(실제 milvusBrandLoader)", () => {
    const c = loadComponent(join(root, "force-app/main/default/lwc"), componentNames("milvusBrandLoader"));
    assert.deepEqual(c.props, []);
    assert.ok(c.description.length > 0);
    const text = storySource(c);
    assert.match(text, /args: \{\}/);
    assert.doesNotThrow(() => parseAst(text));
  });

  test("실제 저장소의 화면 컴포넌트 전부로 만든 글이 파싱된다(파일로는 쓰지 않는다)", () => {
    const lwcDir = join(root, "force-app/main/default/lwc");
    for (const names of findMilvusComponents(lwcDir)) assert.doesNotThrow(() => parseAst(storySource(loadComponent(lwcDir, names))), names.folder);
  });
  ```

  `parseAst`는 `import { parseAst } from "rollup/parseAst";`.

- [ ] **Step 2: 실패를 확인한다** — Run: `node --test tests/milvus-stories.test.ts` → Expected: 새 테스트 FAIL(함수 없음)

- [ ] **Step 3: 해석 함수와 `storySource`를 만든다**

  `parseApiProps`는 먼저 `\r\n`을 `\n`으로 바꾸고 아래 정규식 하나로 훑는다. 주석 본문은 `*/`를 넘지 않게 하고(떨어진 JSDoc을 붙이지 않는다), `/** */`와 `@api` 사이는 공백만 허용한다.

  ```ts
  // ponytail: @api는 정규식으로 읽는다. 한 줄에 선언 둘, 여러 줄 기본값은 text로 떨어진다. 틀리게 나오면 @lwc/babel-plugin-component 메타데이터로 바꾼다
  const API = /(?:\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*)?@api\s+(get\s+)?([A-Za-z_$][\w$]*)\s*(\(|=\s*([^;\n]+)|;)/g;
  ```

  - `get`이 있으면 text, 값 없음. `get`이 없고 다음이 `(`이면 메서드라 뺀다
  - `= 값`: `true`/`false` → boolean, `/^-?\d+(\.\d+)?$/` → number, `"…"`·`'…'` → text(따옴표 안 값), `[`·`{`로 시작 → object(값 없음), 그 밖 → text(값 없음)
  - 설명: 줄마다 앞의 `*`를 지우고 앞뒤 공백을 지운다(trim). 빈 줄을 빼고 공백 하나로 잇는다. 비면 `description`을 넣지 않는다

  `parseDescription`: `/<description\b[^>]*>([\s\S]*?)<\/description>/`, `&amp;`(마지막에) `&lt;` `&gt;` `&quot;` `&apos;` 되돌리기, `\r\n` → `\n`, trim.

  `storySource`가 만드는 글은 설계 4.3의 예시 모양을 따른다. 정해진 부분:
  - 1줄 `GENERATED_MARK`, 2줄 `// 예시나 변형이 필요하면 stories/components/milvus/<storyName>.stories.js를 쓴다. 그 파일이 생기면 다음 빌드부터 이 파일은 만들지 않는다`
  - `import { <exportName>, ORIGIN, lwc, sourceFor, sourceStory } from "../helpers.js";`
  - `title`, `render: (args) => lwc(<tag JSON>, <exportName>, args)`, `args`(값이 있는 prop만), `argTypes`(prop마다 `{ control, description? }`), `parameters.docs.source: sourceFor(<tag JSON>)`, `parameters.docs.description.component: ORIGIN.milvus + "\n\n" + <JSON 문자열>` — JSON 문자열은 description(비면 빼고)과 `> 자동으로 만든 기본 스토리입니다. 예시나 변형이 필요하면 \`stories/components/milvus/<storyName>.stories.js\`를 쓰세요`를 `\n\n`으로 이은 것
  - 값이 있는 prop이 없으면 `args: {}`, prop이 없으면 `argTypes: {}`로 쓴다(테스트가 `args: {}`를 찾는다)
  - 끝에 `export const 기본 = {};`, `export const 소스_코드 = sourceStory(<folder JSON>);`
  - 모든 문자열·값은 `JSON.stringify`로 넣는다. 줄 끝은 `\n`

- [ ] **Step 4: 통과를 확인한다** — Run: `node --test tests/milvus-stories.test.ts`, `pnpm typecheck` → Expected: PASS, 오류 없음

- [ ] **Step 5: 커밋(사용자가 요청할 때)** — `[Feat] @api·설명을 읽어 기본 스토리 글 만들기 (#76)`

---

### Task 3: 생성기 스크립트(손 스토리 판정, 지우기 보호, CLI)

**Files:**
- Modify: `lib/milvus-stories.ts`
- Create: `scripts/generate-milvus-stories.ts`
- Modify: `.gitignore`
- Modify: `tests/milvus-stories.test.ts`

**Interfaces:**
- Consumes: `findMilvusComponents`, `loadComponent`, `entrySource`, `storySource`, `GENERATED_MARK`, `GenerateError` (Task 1·2)
- Produces:
  - `lib`: `export function hasHandStory(handFiles: string[], storyName: string): boolean` — `handFiles`(`readdirSync` 결과)에 `<storyName>.stories.js`나 `<storyName>.stories.ts`가 대소문자까지 같은 이름으로 있으면 true
  - `scripts`: `export function generateMilvusStories(o: { lwcDir: string; handStoriesDir: string; out: string }): { components: number; stories: number }`
  - CLI: `node scripts/generate-milvus-stories.ts [출력 폴더]` — 기본 `stories/milvus-generated`, `lwcDir` = `force-app/main/default/lwc`, `handStoriesDir` = `stories/components/milvus`(cwd 기준). 성공하면 `✓ 밀버스 스토리: 컴포넌트 N개, 기본 스토리 M개 → <out>/`. `GenerateError`면 메시지를 stderr에 쓰고 종료 코드 1, 그 밖의 오류는 그대로 던진다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

  ```ts
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
    for (const out of [foreign, catalogLike, file]) {
      const before = existsSync(out) && statSync(out).isDirectory() ? readdirSync(out) : readFileSync(out, "utf8");
      assert.throws(() => generateMilvusStories({ ...o, out }), (e) => e instanceof GenerateError && /지우지 않는다/.test(e.message));
      assert.deepEqual(statSync(out).isDirectory() ? readdirSync(out) : readFileSync(out, "utf8"), before);
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
    const o = { ...setup(), lwcDir: fixtureLwc({ "milvusfoo/milvusfoo.js": "", "milvusfoo/milvusfoo.html": "<template></template>" }) };
    assert.throws(() => generateMilvusStories(o), GenerateError);
    assert.ok(!existsSync(o.out));
  });
  ```

  CLI 테스트는 저장소 cwd에서 돌지만 출력 폴더는 임시 폴더만 준다(저장소 `stories/milvus-generated/`를 건드리지 않는다). CLI의 이름 규칙 경로는 저장소 `force-app`을 바꿔야 해서 테스트하지 않는다. 함수가 `GenerateError`를 던지고 CLI가 그것을 같은 catch로 받는 것으로 갈음한다.

- [ ] **Step 2: 실패를 확인한다** — Run: `node --test tests/milvus-stories.test.ts` → Expected: 새 테스트 FAIL

- [ ] **Step 3: `hasHandStory`와 `scripts/generate-milvus-stories.ts`를 만든다**

  `generateMilvusStories` 순서: 찾기(이름 규칙 오류는 여기서 난다) → 손 스토리 폴더 읽기(없으면 `[]`) → 지우기 전 확인 → `rmSync`·`mkdirSync` → `entry.js` → 손 스토리 없는 컴포넌트마다 `<storyName>.stories.js`.

  지우기 전 확인은 카탈로그의 `assertErasable` 모양이다: 없으면 통과, 폴더가 아니면 거부, 비었으면 통과, `entry.js` 첫 줄이 `GENERATED_MARK`면 통과, 아니면 `GenerateError("출력 위치가 비어 있지 않고 밀버스 스토리 생성기가 만든 폴더도 아니다. 지우지 않는다: " + out)`. 손 스토리 판정 옆에 `// ponytail: 손 스토리는 파일 이름으로만 판정한다. title이 같고 이름이 다르면 Storybook 중복 오류로 드러난다(설계 5장)`.

  CLI는 카탈로그 생성기와 같은 진입 판정을 쓴다: `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)`. import만 해서는 파일을 건드리지 않는다.

  `.gitignore`: `stories/slds-catalog/` 아래에 `# 자동 생성 (scripts/generate-milvus-stories.ts)`와 `stories/milvus-generated/`를 더한다. Step 4에서 저장소에 CLI를 실행하기 전에 한다(생성 폴더가 커밋에 섞이지 않게).

- [ ] **Step 4: 통과를 확인한다** — Run: `node --test tests/milvus-stories.test.ts`, `pnpm typecheck` → Expected: PASS
  Run: `node scripts/generate-milvus-stories.ts` (저장소) → Expected: `✓ 밀버스 스토리: 컴포넌트 6개, 기본 스토리 0개 → stories/milvus-generated/` (지금 6개 모두 손 스토리가 있다)

- [ ] **Step 5: 커밋(사용자가 요청할 때)** — `[Feat] 밀버스 스토리 생성기와 지우기 보호 (#76)`

---

### Task 4: 빌드·패키지 연결, 기존 테스트, 문서

**Files:**
- Modify: `package.json` (`scripts.build:lwc`, `scripts.prepack`)
- Modify: `stories/lwc-entry.js`
- Modify: `tests/storybook-cli.test.ts` (`makePkg`, "plan 그대로 buildLwc" 테스트)
- Modify: `tests/pack.test.ts`
- Modify: `CLAUDE.md` (2장 "절대 줄이지 않는 것"의 스토리 항목, 4장 `build-storybook` 행), `README.md` (10장 작업 규칙)

**Interfaces:**
- Consumes: `entrySource`, `findMilvusComponents` (Task 1), `scripts/generate-milvus-stories.ts` CLI (Task 3)
- Produces:
  - `build:lwc` = `node scripts/generate-slds-catalog.ts && node scripts/generate-milvus-stories.ts && node scripts/build-lwc.ts`
  - `prepack` = `pnpm build:cli && node scripts/build-hooks-index.ts && node scripts/generate-slds-catalog.ts && node scripts/generate-milvus-stories.ts`
  - `stories/lwc-entry.js`의 밀버스 부분 = `export * from "./milvus-generated/entry.js";` 한 줄. synthetic shadow import, `createElement`, `NotificationSlotDemo`·`ModalDemo` export는 그대로

- [ ] **Step 1: 기존 테스트를 먼저 고친다(아직 실패해야 정상인 부분 포함)**

  `tests/storybook-cli.test.ts`
  - `makePkg`: light·broken이 아니면 `mkdirSync(join(pkg, "stories/milvus-generated"), { recursive: true })` 뒤 `entrySource(findMilvusComponents(join(repo, "force-app/main/default/lwc")))`를 `stories/milvus-generated/entry.js`에 쓴다. 저장소의 생성 폴더는 복사하지 않는다(주석으로 이유: gitignore 대상이라 CI의 `pnpm test` 시점에 없고, pack 테스트의 `prepack`이 같은 시간에 다시 쓴다)
  - "plan 그대로 buildLwc" 테스트: 기존 `MilvusBadge` 단언을 두고, `MilvusBrandLoader` `MilvusCalendar` `MilvusModal` `MilvusMultiSelect` `MilvusNotification` `NotificationSlotDemo` `ModalDemo`도 `index.js`의 export에 있는지 더한다

  `tests/pack.test.ts`
  - 새 테스트 `pack의 밀버스 entry export가 패키지에 든 milvus 화면 컴포넌트 목록과 같다`: `package/stories/milvus-generated/entry.js`의 `from "c/(\w+)"` 목록 = `entries`에서 `^package/force-app/main/default/lwc/(milvus\w+)/\1\.html$`로 뽑은 목록(정렬해 비교). 같은 파일 첫 줄이 표시 주석
  - 판정 R1 필터에 `e.startsWith("package/stories/milvus-generated/")`를 더한다
  - 새 테스트 `build:lwc와 prepack에 밀버스 스토리 생성이 있다`: `pkg.scripts["build:lwc"]`와 `pkg.scripts.prepack`이 Interfaces의 문자열과 같다

- [ ] **Step 2: 실패를 확인한다**

  먼저 Task 3 Step 4가 저장소에 만든 `stories/milvus-generated/`를 지운다(`rm -rf stories/milvus-generated`). `package.json`의 `files`에 `stories`가 있어, 남은 폴더는 gitignore와 상관없이 pack에 들어가 entry 테스트가 미리 통과해 버린다(`tests/pack.test.ts`가 gitignore된 `slds-catalog`도 pack에 든다고 확인하는 것과 같은 이유).

  Run: `node --test tests/pack.test.ts tests/storybook-cli.test.ts`
  Expected: pack의 새 두 테스트 FAIL(스크립트 문자열이 다르고 생성 폴더가 패키지에 없다). storybook-cli는 아직 PASS(lwc-entry가 그대로라 생성 entry를 읽지 않는다)

- [ ] **Step 3: 연결한다**

  - `package.json`: Interfaces의 두 문자열로 바꾼다
  - `stories/lwc-entry.js`: 밀버스 export 6줄을 `export * from "./milvus-generated/entry.js";`로 바꾸고, 바로 위 주석을 "밀버스 컴포넌트는 `pnpm build:lwc`가 force-app에서 찾아 만든 목록을 다시 내보낸다(scripts/generate-milvus-stories.ts)"로 고친다

- [ ] **Step 4: 통과를 확인한다**

  Run: `node --test tests/pack.test.ts tests/storybook-cli.test.ts tests/milvus-stories.test.ts` → Expected: PASS (Windows에서 원래 실패하는 pack·심볼릭 링크 테스트는 `main`과 같은 목록인지 비교한다)
  Run: `pnpm build:lwc` → Expected: 세 단계 모두 ✓, `stories/milvus-generated/entry.js`에 6줄
  Run: `pnpm lint`, `pnpm test`, `pnpm build-storybook` → Expected: 통과(Windows에서는 `main`에서도 실패하는 node 테스트만 같은 목록으로 남는다)

- [ ] **Step 5: 직접 확인한다**

  `force-app/main/default/lwc/milvusProbe/`에 `@api label = "확인";`·`@api disabled = false;`만 있는 js, `<template><p>{label}</p></template>` html, description이 든 meta.xml을 잠깐 만든다 → `pnpm storybook` → "컴포넌트 / 밀버스 추가 / Probe"가 뜨고 Controls로 label·disabled가 바뀐다 → 폴더를 지우고 `pnpm build:lwc`로 생성 폴더에서 Probe가 사라진 것을 본다. 이 폴더는 커밋하지 않는다

- [ ] **Step 6: 문서를 고친다**

  - `CLAUDE.md` 2장 "절대 줄이지 않는 것"의 "컴포넌트마다 스토리" 뒤에 "(손으로 쓴 스토리. 새 밀버스 컴포넌트는 `force-app/main/default/lwc/milvusFoo/`를 만들고 `pnpm storybook`을 실행하면 기본 스토리로 뜬다. 병합 전에 `stories/components/milvus/Foo.stories.js`를 손으로 쓰고 다시 실행한다. 기본 스토리는 `pnpm build:lwc`가 `stories/milvus-generated/`(커밋하지 않음, 고치지 않음)에 만든다. 설계 2026-10-26 4.4)"
  - `CLAUDE.md` 4장 표 `pnpm build-storybook` 행: "`build:lwc`(카탈로그 생성 + 밀버스 스토리 생성 + Rollup LWC 빌드) 뒤 Storybook 정적 빌드(`storybook-static/`)"
  - `README.md` 10장 작업 규칙에 한 줄: "새 밀버스 컴포넌트는 `force-app/main/default/lwc/milvusFoo/`를 만들고 `pnpm storybook`을 실행하면 '컴포넌트 / 밀버스 추가 / Foo'에 기본 스토리로 뜬다. 병합 전에 `stories/components/milvus/Foo.stories.js`를 손으로 쓰고 다시 실행한다. `stories/milvus-generated/`는 `pnpm build:lwc`·`prepack`이 지우고 다시 만드는 폴더라 커밋하지 않고(`.gitignore`) 손으로 고치지 않는다(설계 2026-10-26)"
  - 설계 문서의 상태 줄은 이미 "승인"이다. 고칠 것 없음

  Run: `pnpm test:learn` → Expected: 통과(README만 바꿨고 Learn은 그대로)

- [ ] **Step 7: 커밋(사용자가 요청할 때)** — `[Feat] 밀버스 컴포넌트를 빌드할 때 Storybook에 자동 등록 (#76)`. 이 브랜치의 첫 커밋에 설계 문서(`docs/specs/2026-10-26-milvus-story-sync-design.md`)와 이 계획을 함께 넣는다
