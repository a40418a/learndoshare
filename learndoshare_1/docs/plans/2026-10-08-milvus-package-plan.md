# 밀버스 패키지·CLI 구현 계획

> **에이전트 작업자용:** 필수 하위 skill은 `superpowers:subagent-driven-development`(추천) 또는 `superpowers:executing-plans`다. 이 계획을 태스크 단위로 실행하고, 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** Salesforce 프로젝트에서 `pnpm add` 한 번과 `pnpm milvus init`으로 밀버스 디자인 시스템을 세팅한다. 브랜드 요청을 모든 컴포넌트에 반영해 Storybook에서 확인하고, `pnpm milvus deploy`로 org(LEX·VF)에 적용한다. 그 과정에서 배운 개념은 `Learn/`에 계속 정리한다.

**구조:** 이 저장소(`learndoshare_1/`)를 패키지 `@a40418a/milvus-design-system`으로 발행한다. 코드는 세 층이다.
- `lib/`: 순수 함수. 규칙, 팔레트, XML, 요청 파일, 명세 항목, Rollup·Vite 설정
- `cli/`: 명령 하나에 파일 하나
- `scripts/`: 저장소 전용. 카탈로그 생성, 정적 반영 검사, 브리지 생성

나머지 위치:
- 프로젝트에 복사할 원본은 `templates/`, LWC는 `force-app/main/default/lwc/milvus*`에 둔다
- Storybook은 두 모드로 쓴다. 저장소 모드는 `brands/` 데모를 띄운다. 프로젝트 모드는 프로젝트 메타데이터를 띄운다. 프로젝트 모드가 패키지의 `.ts` 설정을 그대로 쓸 수 있는지는 Task 3 스파이크로 정한다. 안 되면 `dist/storybook`으로 컴파일한다

**기술:** TypeScript(저장소에서는 Node 타입 제거로 실행하고, 발행할 때 `tsc`로 빌드), `node --test`, Jest(`sfdx-lwc-jest`), Rollup + `@lwc/rollup-plugin`, Storybook 10(web-components-vite), postcss, sf CLI, GitHub Packages, GitHub Actions.

**설계 문서:** [`docs/specs/2026-10-08-milvus-package-design.md`](../specs/2026-10-08-milvus-package-design.md). 실행자는 두 문서를 함께 읽는다. 아래 "설계 X.Y"는 설계 문서의 장·절이다.

## 전역 제약

**도구와 형식**
- pnpm만 쓴다. `npm`, `npx`, `yarn`은 금지한다. 처음 쓰는 도구는 `pnpm dlx`로, 설치된 도구는 `pnpm exec`로 실행한다
- `engines.node`: `^22.18.0 || >=23.6.0`
- `package.json`에 `"type": "module"`을 넣는다. CommonJS 설정 파일은 `.cjs`로 둔다
- 패키지는 `@a40418a/milvus-design-system`, 레지스트리는 `https://npm.pkg.github.com`, 실행 파일은 `milvus`다
- CLI·스크립트·`lib`·Storybook 코드는 `.ts`로 쓴다
  - 상대 import에는 `.ts`를 붙인다(`allowImportingTsExtensions`, `rewriteRelativeImportExtensions`)
  - `erasableSyntaxOnly`를 켠다(enum, namespace 값, 생성자 매개변수 속성 금지)
- LWC도 `.ts`로 쓴다: `target: ESNext`, `experimentalDecorators: false`

**메시지와 값**
- 사용자에게 보이는 모든 메시지는 한국어로 쓴다(CLI 출력, 오류, Storybook 화면, skill, Learn). 식별자·명령·경로만 원문으로 둔다
- CLI 종료 코드: 성공 0, 실패 1, `check --style` 실패 2(hook이 stderr를 Claude에게 전달하는 규칙)
- 브랜드 이름: `^[A-Za-z][A-Za-z0-9_]*$`. `__`를 쓰지 않고 `_`로 끝나지 않는다
- 기본 브랜드 색은 `#0176D3`이다
- 로고는 `contentassets/<이름>Logo.asset`에 두고, `BRAND_IMAGE`는 `/file-asset/<이름>Logo?v=1`이다
- 대비 기준은 4.5:1이다. 모달·토스트 움직임 시간의 최솟값은 `0.01ms`다
- 움직임 브리지 변수는 4개다. 기본값은 규칙마다 Salesforce 원래 값이다
  - `--milvus-motion-duration-fast`: 원래 0.1s 이하인 규칙
  - `--milvus-motion-duration-medium`: 0.15~0.2s
  - `--milvus-motion-duration-slow`: 0.25~0.4s
  - `--milvus-motion-easing`

**승인과 보안**
- org 배포·삭제·데이터 변경, 패키지 발행, 태그 push는 **사용자 승인 후에만** 한다. 대상과 명령을 먼저 보여 준다
- 공개 저장소다. org ID, 인증 정보, 고객사 코드, 개발자 PC의 절대 경로를 커밋하거나 발행하지 않는다

**작업 방식**
- 커밋은 `[태그] 요약 (#이슈번호)`, 브랜치는 `<타입>/<이슈번호>-<설명>`으로 쓴다. 병합은 Squash and merge로 한다
- 검증을 통과하지 못하면 커밋하지 않는다
- 이 계획에 적힌 것 밖의 새 의존성은 PR 본문에 이유를 적는다
- **학습 자료(`Learn/`)는 계속 갱신한다.** 마일스톤마다 마지막 "학습 자료 갱신"에서 바뀐 개념을 반영한다. 폐기한 설계는 `<aside class="legacy">`로 감싸 "이전 설계"로 표시하거나 지운다
- **Learn의 모든 내용은 실제 사이트와 공신력 있는 자료를 근거로 쓰고, 출처를 반드시 적는다.**
  - 공신력 있는 자료: 공식 문서(Salesforce Developers·Help, SLDS 사이트, LWC, Node, TypeScript, Storybook, Vite, Rollup, pnpm, GitHub Docs, Claude Code 문서, W3C·MDN), 공식 패키지 소스(`lightning-base-components`, `@salesforce-ux/design-system-2`)
  - 실측(org·로컬)은 근거가 되는 기록을 출처로 적는다: `docs/research/` 문서 링크, 측정 방법, 날짜
  - 형식: `<section>`마다 끝에 `<p class="sources">출처: <a href="…">문서 이름</a> (확인 YYYY-MM-DD) · …</p>`
  - 블로그, 커뮤니티 글, 기억에 의존한 설명은 출처로 쓰지 않는다. 출처를 찾지 못한 내용은 쓰지 않거나 "미확인"으로 표시한다
  - 출처 링크는 내장 브라우저로 직접 열어, 링크가 살아 있고 본문이 문장을 뒷받침하는지 확인한다(Salesforce 문서는 WebFetch가 403이므로 브라우저로 읽는다)
  - 모든 "학습 자료 갱신" 단계는 `node scripts/check-learn.ts`가 0이어야 끝난다

## 리뷰 중점 (테스트가 놓치기 쉬운 입력)

1. **기존 `.claude/settings.json`에 사용자 규칙이 있음:** 병합은 사용자 항목을 지우거나 순서를 바꾸지 않는다. 같은 항목을 두 번 넣지 않는다(Task 10)
2. **util.css 값에 `light-dark()`, `var()` 체인, 주석, 줄바꿈이 섞임:** 규칙 검사는 주석을 무시한다. 대비는 `light-dark()`의 라이트 값으로 잰다(Task 7)
3. **사람이 고쳐서 형식이 조금 다른 브랜드 요청 파일:** 빈 줄, 순서가 바뀐 절, 알 수 없는 절을 지우지 않고 보존한다(Task 19)
4. **`sf` 배포가 실패하거나 인증이 만료됨:** 1단계 배포는 원자적이라 실패하면 롤백된다. 실패 항목을 보여 주고 활성화(2단계)를 하지 않는다. `sf`가 없거나 로그인이 만료되었으면 배포를 시작하지 않는다(Task 22)
5. **경로에 공백이나 한글이 있는 프로젝트 폴더:** 자식 프로세스에는 `spawn`과 인자 배열로 넘긴다. Task 11, 18, 22의 테스트 폴더 이름에 공백과 한글을 넣는다

---

## 마일스톤과 이슈

| 마일스톤 | 날짜 | 이슈 (작업 시작 때 생성) | 브랜치 예 |
| --- | --- | --- | --- |
| **M0 학습 자료 기초** | 10/12 첫 작업 (10/9에 해도 됨) | `[Docs] 학습 자료: 디자인 시스템 개념과 Salesforce 구현` | `docs/<번호>-learn-foundation` |
| M1 설치 경로 스파이크 | 10/12 오전 | `[Spike] 패키지 발행·설치와 node_modules Storybook 확인` | `spike/<번호>-install-path` |
| M2 TS 전환과 규칙 통합 | 10/12 오후 | `[Feat] TypeScript 전환과 util.css 규칙 통합` | `feat/<번호>-ts-rules` |
| M3 init·check | 10/13 | `[Feat] milvus init·check 명령` | `feat/<번호>-init-check` |
| M4 정적 반영 검사·브리지 | 10/13 | `[Feat] 전 컴포넌트 반영 검사와 milvusBridge` | `feat/<번호>-audit-bridge` |
| M5 Storybook 프로젝트 모드·명세·skill | 10/14 | `[Feat] 프로젝트 모드 Storybook, 브랜드 명세 페이지, milvus-brand skill` | `feat/<번호>-storybook-project` |
| M6 deploy·리허설·VF | 10/15 | `[Feat] milvus deploy와 Visualforce 지원` | `feat/<번호>-deploy-vf` |
| M7 update·동적 검사·문서·발행 | 10/16 | `[Feat] milvus update, 동적 반영 검사, 문서 정리` | `feat/<번호>-update-docs` |

- 각 마일스톤은 이슈 템플릿대로 이슈를 만들고, `main`에서 브랜치를 판 뒤 시작한다. 커밋 메시지의 `#N`은 그 이슈 번호다
- 선행 조건: PR #19(`feat/18-slds-s-hooks`)가 `main`에 병합되어 있어야 한다. 병합 전에 BrandStyle 스토리와 `Sample_Forest/util.css`의 "pill이 뱃지도 바꾼다" 문구를 고친다. M2 시작 전에 병합 여부를 사용자에게 확인한다

## 파일 지도

```
learndoshare_1/
  package.json                    이름·type·publishConfig·files·bin·engines·scripts (Task 1, 4)
  tsconfig.json                   저장소 타입 검사 (Task 4)
  tsconfig.build.json             cli·lib → dist/ (Task 1)
  tsconfig.lwc.base.json          프로젝트 lwc/tsconfig.json이 extends (Task 6)
  eslint.config.cjs, jest.config.cjs   CommonJS 설정 (Task 1에서 이름 변경)
  .husky/pre-commit               pnpm precommit (Task 1)
  cli/index.ts                    진입점 (Task 1)
  cli/context.ts                  프로젝트 찾기, milvus.config.json, SfRunner (Task 11)
  cli/init.ts | check.ts | storybook.ts | deploy.ts | update.ts   (Task 11, 12, 18, 22, 25)
  lib/palette.ts, lib/contrast.ts (Task 4, 7)
  lib/hooks-index.ts, lib/rules.ts (Task 7)
  lib/bridge-vars.ts, lib/spec-items.ts, lib/fixed-list.ts, lib/managed.ts (Task 8)
  lib/merge.ts, lib/branding.ts   (Task 10)
  lib/lwc-build.ts                (Task 5)
  lib/storybook-plugin.ts         (Task 17)
  lib/request.ts                  (Task 19)
  lib/vf.ts                       (Task 24)
  lib/sentinel.ts                 (Task 26)
  scripts/build-lwc.ts, generate-slds-catalog.ts, check-brands.ts, build-hooks-index.ts, check-learn.ts
  scripts/audit/*.ts, scripts/bridge/*.ts
  audit/baseline.json, audit/report.json, dist/hooks-index.json (생성)
  templates/                      프로젝트에 복사할 원본
  force-app/main/default/lwc/milvus*/   밀버스 LWC (.ts)
  .storybook/*.ts, stories/**     Storybook
  docs/research/2026-10-08/       분석 스크립트와 결과 (Task 0)
  tests/*.test.ts                 node --test
../.github/workflows/publish.yml  태그 v* 발행 (Task 2)
```

---

## M0 학습 자료 기초 (최우선)

학습은 **디자인 시스템의 개념과 Salesforce가 그것을 어떻게 구현하는가**에서 출발한다. 다른 Learn 문서는 이 문서를 전제로 읽는다.

### Task 0: `Learn/00-디자인 시스템과 Salesforce.html`, 낡은 내용 정리, 분석 자료 보관

**Files:**
- Create:
  - `Learn/00-디자인 시스템과 Salesforce.html`. `Learn/assets/style.css`에 `aside.legacy` 스타일을 추가한다
  - `docs/research/2026-10-08/`: 분석 스크립트 `extract.cjs`, 요약 `summary.md`, 종합 `synthesis.md`, org 프로브 구성 설명. org ID, 인증 정보, org 주소는 지운다
  - `scripts/check-learn.ts`, `tests/check-learn.test.ts`
- Modify:
  - `Learn/01`~`08` 전부: 출처가 없는 절에 출처를 단다
  - `Learn/01-세일즈포스 디자인 시스템.html`, `Learn/03-스토리북.html`, `Learn/08-Claude Code 런북.html`: 낡은 설계 설명 정리
  - `README.md` 7장: 표 맨 앞에 00을 넣고, 추천 순서를 `0 → 1 → 7 → 2 → 3 → 4 → 5 → 8 → 6`으로 바꾼다

**00 문서의 절.** 각 절은 "개념 → Salesforce에서는 → 밀버스에서는 → 직접 확인하기" 순서로 쓴다.
1. 디자인 시스템이란: 디자인 토큰, 컴포넌트, 패턴, 원칙, 운영(누가 무엇을 바꾸는가)
2. SLDS: SLDS 1과 SLDS 2(Cosmos), 블루프린트(클래스)와 기본 컴포넌트(`lightning-*`)
3. 토큰의 Salesforce 이름인 styling hook: `--slds-r-*` → `--slds-g-*` → `--slds-s-*` → `--slds-c-*`. 예: `--slds-s-button-radius-border` → `--slds-g-radius-border-pill`
4. 브랜드는 어디서 오는가: Themes and Branding, `BrandingSet`·`LightningExperienceTheme` 메타데이터, 브랜드 색 → 팔레트(50단계 = 버튼 색, 접근성 대비)
5. shadow DOM과 스타일이 닿는 범위: synthetic과 native, org 실측(LEX는 synthetic), native 전환 위험
6. LEX와 Visualforce: `loadStyle`과 `<apex:stylesheet>`, `<apex:slds/>`는 SLDS 1
7. 전 컴포넌트 분석: 항목별 hook 비율, hook이 없는 것(움직임 등), "Salesforce 고정" 목록
8. 밀버스의 층과 명령
   - 층: org 테마 → util.css → `milvusBridge.css` → 밀버스 컴포넌트
   - 명령: `init`, `storybook`, `deploy`
9. 용어집

**작성 원칙**
- 개념(1~3절)은 공식 문서를 직접 읽고 쓴다. 예: SLDS 사이트의 styling hooks·design tokens 문서, Salesforce Developers의 LWC 개발자 가이드, Metadata API의 `BrandingSet`·`LightningExperienceTheme`, Help의 Themes and Branding
- 밀버스의 실측과 결정(4~8절)은 설계 1·5·9·13장, README 3장, `docs/research/2026-10-08/`을 근거로 하고, 해당 기록을 출처로 링크한다
- 수치와 사실을 새로 지어내지 않는다. 확인하지 못한 것은 "미확인"으로 표시한다
- `milvusButton`은 폐기한 것이 아니라 역할이 바뀐 것으로 쓴다(hook이 없는 모양, native 전환 대비)

**Steps**
- [ ] **Step 1: 실패하는 검사를 만든다.** `scripts/check-learn.ts`는 `Learn/*.html`을 검사하고, 어기면 파일·절·줄을 출력하고 1로 끝난다
  - legacy: `root.css`·`override.css`가 나오는 모든 위치가 `<aside class="legacy">` 안에 있다
  - 출처: 모든 `<section>`에 `p.sources`가 있고, 그 안에 링크가 하나 이상 있다
  - 출처 링크는 `https://`이고 도메인이 `SOURCE_DOMAINS`에 있거나, `../docs/research/` 아래를 가리키는 상대 링크다
  - 확인 날짜: `p.sources`마다 `확인 YYYY-MM-DD`가 있다
  - `SOURCE_DOMAINS`(스크립트 상수): `developer.salesforce.com`, `help.salesforce.com`, `www.lightningdesignsystem.com`, `v1.lightningdesignsystem.com`, `lwc.dev`, `github.com/salesforce`, `github.com/salesforce-ux`, `www.npmjs.com`, `nodejs.org`, `www.typescriptlang.org`, `storybook.js.org`, `vite.dev`, `rollupjs.org`, `pnpm.io`, `docs.github.com`, `code.claude.com`, `docs.anthropic.com`, `www.w3.org`, `developer.mozilla.org`. 새 도메인은 공식 자료일 때만 더한다
  - 테스트(`tests/check-learn.test.ts`): "출처 없는 절은 1", "블로그 도메인 출처는 1", "`../docs/research/` 링크는 허용", "legacy 밖의 `root.css`는 1"
  - 실행: `node scripts/check-learn.ts`. 지금은 1이어야 한다(legacy가 01·03·08에 남아 있고, 출처 표기가 없음)
- [ ] **Step 2:** 00 문서를 쓴다. 절마다 공식 문서를 내장 브라우저로 직접 열어 읽고, 그 문서를 출처로 단다
- [ ] **Step 2-1:** 01~08의 모든 절에 출처를 단다. 지금 본문에 있는 링크는 실제로 열어 확인한 뒤 `p.sources`로 옮긴다. 근거를 찾지 못한 문장은 고치거나 "미확인"으로 표시한다. 01·03·08의 낡은 절은 고치거나 legacy로 감싸고, 바꾼 곳에 "2026-10-09 갱신"을 남긴다
- [ ] **Step 3:** 스크래치의 분석 자료를 `docs/research/2026-10-08/`로 옮긴다. `grep -rnE "orgfarm|00D[A-Za-z0-9]{12,15}" docs/research`의 결과가 비어 있어야 한다
- [ ] **Step 4: 확인한다.** `node scripts/check-learn.ts` → 0, `node --test tests/check-learn.test.ts`(이 시점에는 `test:node` 스크립트가 아직 없다). 브라우저로 00 문서를 열어 목차·표·출처 링크가 깨지지 않는지 본다
- [ ] **Step 5: 커밋.** `[Docs] 학습 자료 00: 디자인 시스템 개념과 Salesforce 구현 (#N)`

---

## M1 설치 경로 스파이크 (10/12 오전)

### Task 1: 패키지 메타데이터, 모듈 형식, CLI 뼈대

**Files:**
- Modify:
  - `package.json`
  - `.husky/pre-commit`: `npm run precommit`을 `pnpm precommit`으로 바꾼다
- Rename: `eslint.config.js` → `eslint.config.cjs`, `jest.config.js` → `jest.config.cjs`
- Create: `tsconfig.build.json`, `cli/index.ts`, `tests/cli-version.test.ts`, `tests/pack.test.ts`

**Interfaces:**
- Produces: `main(argv: string[]): Promise<number>`(`cli/index.ts`). 실행 파일 `milvus` → `dist/cli/index.js`
- Produces: 스크립트 3개. `prepack`은 Task 7·13·17에서 늘어난다
  - `build:cli` = `tsc -p tsconfig.build.json`
  - `test:node` = `node --test "tests/**/*.test.ts"`
  - `prepack` = `pnpm build:cli`

- [ ] **Step 1: 실패하는 테스트**
```ts
test("--version은 package.json 버전을 출력하고 0을 돌려준다", async () => {
  const out = await captureStdout(() => main(["--version"]));
  assert.equal(out.code, 0); assert.equal(out.text.trim(), pkg.version);
});
test("알 수 없는 명령은 stderr에 '알 수 없는 명령'과 1", ...);
// tests/pack.test.ts: 임시 폴더로 pnpm pack → tar -tzf 목록 검사
test("pack 결과에 dist/cli/index.js가 있고 __tests__가 없으며, 텍스트 파일에 '/Users/'가 없다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
  - **의존성**
    - `pnpm add -D typescript@5.9 @types/node@22`를 실행한다. `typescript`는 Task 4에서 `dependencies`로 옮긴다
    - Task 3 스파이크에 필요하므로 다음을 `dependencies`로 옮긴다: `storybook`, `@storybook/*`, `vite`, `rollup`, `@rollup/*`, `@lwc/*`, `lwc`, `lightning-base-components`, `@salesforce-ux/design-system-2`
    - `dependencies`에 `postcss`를 추가한다
  - **`package.json` 필드**
    - `name`: `"@a40418a/milvus-design-system"`, `version`: `"0.0.1"`, `type`: `"module"`. `private`는 지운다
    - `bin`: `{ "milvus": "dist/cli/index.js" }`
    - `publishConfig`: `{ "registry": "https://npm.pkg.github.com" }`
    - `repository`: `{ "type": "git", "url": "https://github.com/a40418a/learndoshare.git", "directory": "learndoshare_1" }`
    - `engines.node`: `"^22.18.0 || >=23.6.0"`
    - `files`: `"dist/cli"`, `"dist/lib"`, `"dist/hooks-index.json"`, `"templates"`, `"force-app/main/default/lwc/milvus*"`, `"!force-app/**/__tests__"`, `"audit/report.json"`, `"tsconfig.lwc.base.json"`, `"stories"`. Storybook 설정 경로는 Task 17에서 추가한다
  - **`tsconfig.build.json`**
    - `module`·`moduleResolution`: `NodeNext`, `rewriteRelativeImportExtensions`
    - 대상은 `cli/**`, `lib/**`, 출력은 `dist/`
    - `dist/cli/index.js`의 첫 줄은 `#!/usr/bin/env node`다
  - **`cli/index.ts`**: `node:util`의 `parseArgs`를 쓰고, 버전은 `import.meta.url` 기준으로 `package.json`에서 읽는다
- [ ] **Step 4: 통과를 확인한다.**
  - `pnpm test:node`, `pnpm lint`
  - `pnpm test:unit`: 설정 파일 이름을 바꾼 뒤에도 동작해야 한다
  - `pnpm build:cli && node dist/cli/index.js --version`
- [ ] **Step 5: 커밋.** `[Spike] 패키지 메타데이터와 milvus CLI 뼈대 (#N)`

### Task 2: 발행 workflow와 v0.0.1 설치 확인 (사용자 승인 필요)

**Files:**
- Create: `../.github/workflows/publish.yml`

- [ ] **Step 1: workflow를 쓴다.**
  - 트리거: `push: tags: ['v*']`. 권한: `permissions: { contents: read, packages: write }`
  - `defaults.run.working-directory: learndoshare_1`
  - `pnpm/action-setup`에 `package_json_file: learndoshare_1/package.json`
  - `setup-node`
    - `node-version: 22`, `registry-url: https://npm.pkg.github.com`, `scope: '@a40418a'`
    - `cache-dependency-path: learndoshare_1/pnpm-lock.yaml`
  - 실행 순서: `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm publish --no-git-checks`(env `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`)
- [ ] **Step 2:** M1 PR을 만들고 CI가 통과하면 Squash로 병합한다. 병합은 사용자가 요청할 때 한다
- [ ] **Step 3: 승인을 요청한다.**
  - `main` 최신 커밋에 `git tag v0.0.1`을 붙인다
  - `git push origin v0.0.1`을 보여 주고, 승인을 받은 뒤 push한다
  - `gh run watch`로 발행 성공을 확인하고, 패키지 공개 범위가 비공개인지 확인한다
- [ ] **Step 4: 설치를 확인한다.**
  - 상위 저장소에 `learndoshare_2/`를 만든다(`sf project generate --name learndoshare_2`)
  - 사용자가 `read:packages` classic 토큰을 `NODE_AUTH_TOKEN`에 넣고, `.npmrc`에 설계 0장의 두 줄을 넣는다
  - `pnpm add -D @a40418a/milvus-design-system`을 실행한다. `pnpm milvus --version`이 `0.0.1`이어야 한다
- [ ] **Step 5:** 결과를 설계 13·14장에 반영한다. 커밋: `[Docs] v0.0.1 발행·설치 확인 결과 기록 (#N)`

### Task 3: node_modules 안 Storybook 스파이크 (버리는 코드)

- [ ] **Step 1: 프로브를 만든다.**
  - 임시로 `files`에 `.storybook-probe`를 넣는다(커밋하지 않음)
  - `.storybook-probe/main.ts`와 형제 모듈 `probe-util.ts`, 스토리 `probe.stories.ts`를 만든다
  - 설정이 하는 일은 세 가지다
    - `probe-util.ts`를 import한다
    - 환경변수 `MILVUS_PROJECT_DIR`의 `force-app/main/default/staticresources/milvusBrand.css`를 `?raw`로 읽어 스토리에 출력한다
    - `POST /__milvus/ping`에 `{ok:true}`를 돌려주는 미들웨어를 둔다
- [ ] **Step 2: 설치한 프로젝트에서 띄운다.**
  - `pnpm pack`으로 만든 tgz를 `learndoshare_2`에 `pnpm add -D <tgz>`로 설치한다
  - storybook 실행 파일은 패키지 기준으로 찾는다
    - `node -e "const r=require('node:module').createRequire(require.resolve('@a40418a/milvus-design-system/package.json'));console.log(r.resolve('storybook/package.json'))"`로 경로를 얻는다
    - 그 패키지의 bin으로 실행한다: `MILVUS_PROJECT_DIR=$PWD node <bin> dev -c node_modules/@a40418a/milvus-design-system/.storybook-probe -p 6007`
- [ ] **Step 3: 다섯 가지를 확인한다.**
  1. `.ts` 설정과 형제 `.ts` 모듈이 로드되는가
  2. `.ts` 스토리가 브라우저에서 그려지는가
  3. 프로젝트 파일 내용이 나오는가(`server.fs.allow`)
  4. `curl -X POST localhost:6007/__milvus/ping`이 응답하는가
  5. framework 패키지를 찾는가
- [ ] **Step 4:** 결과를 설계 13·14장에 기록하고, Task 17의 Storybook 배포 방식을 정한다
  - 다섯 가지가 모두 되면 `.storybook`을 원본 `.ts`로 발행한다
  - 1·2만 안 되면 `dist/storybook`으로 컴파일해 발행한다
  - 3~5가 안 되면 설계 4.2의 대체 경로(`init`이 `.storybook`을 프로젝트에 복사)를 쓴다
- [ ] **Step 5: 커밋.** `[Docs] node_modules Storybook 스파이크 결과 기록 (#N)`

---

## M2 TS 전환과 규칙 통합 (10/12 오후)

### Task 4: TypeScript 기반, 팔레트·대비 이동

**Files:**
- Create: `tsconfig.json`, `lib/palette.ts`, `lib/contrast.ts`, `tests/palette.test.ts`
- Delete: `scripts/palette.mjs`
- Modify:
  - `scripts/sync-theme.mjs`: import를 `../lib/palette.ts`로 바꾼다
  - `package.json`: `test:palette`를 지우고 `typecheck`를 추가한다. `typescript`를 `dependencies`로 옮긴다

**Interfaces:**
- Produces (`lib/palette.ts`): `brandPalette(hex: string): Record<number, string>`, `STEPS`, `SETUP_STEPS`. 기존 값 그대로다
- Produces (`lib/contrast.ts`): `contrastRatio(a: string, b: string): number`. WCAG 2.x 공식
- Produces: 스크립트
  - `typecheck` = `tsc --noEmit -p tsconfig.json`. lwc 쪽은 Task 6에서 더한다
  - `test:learn` = `node scripts/check-learn.ts`(Task 0의 검사를 CI에 넣는다)
  - `test` = `pnpm typecheck && pnpm test:unit && pnpm test:node && pnpm test:brands && pnpm test:learn`

- [ ] **Step 1: 실패하는 테스트**
```ts
test("Setup 실측 44색을 평균 ΔE 0.15 이하, 최대 1 이하로 재현한다", ...);   // palette.measured.json, 기존 자체 검사 기준
test("#2E7D32의 50단계는 #468244다", () => assert.equal(brandPalette("#2E7D32")[50], "#468244"));
test("50·40·30단계는 흰색과 4.5:1 이상이다", () => { for (const hex of SAMPLES) for (const s of [50, 40, 30]) assert.ok(contrastRatio(brandPalette(hex)[s], "#ffffff") >= 4.5); });
test("contrastRatio('#000000','#ffffff')는 21", ...);
```
`SAMPLES`는 7색(`#0176D3`, `#2E7D32`, `#FFD400`, `#FF6F00`, `#00A1E0`, `#E01020`, `#111827`)과, 16×16×16 RGB 격자에서 고른 64색이다.
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.** 계산부를 옮기고 타입만 더한다
- [ ] **Step 4: 통과를 확인한다.**
  - `pnpm test`
  - `node -e "import('./scripts/sync-theme.mjs')"`가 import 오류 없이 시작되어야 한다. 인자가 없으니 org 목록 안내까지만 나오면 된다
- [ ] **Step 5: 커밋.** `[Refactor] TypeScript 기반과 팔레트·대비 함수를 lib으로 이동 (#N)`

### Task 5: LWC 빌드를 lib으로, TS·플랫폼 모듈 지원, 카탈로그 경로 이식성

**Files:**
- Create: `lib/lwc-build.ts`, `scripts/build-lwc.ts`, `tests/lwc-build.test.ts`, `tests/fixtures/lwc-ts/`
- Delete: `rollup.lwc.config.mjs`
- Modify:
  - `scripts/generate-slds-catalog.mjs`: 출력을 세 가지 바꾼다
    - import를 `@milvus/lwc/...`로
    - `?raw`를 bare specifier `lightning-base-components/src/lightning/...`로
    - `examples.json`의 경로를 `lbcDir` 기준 상대 경로로
  - `stories/helpers.js`: `@milvus/lwc/index.js`를 import한다
  - `.storybook/main.mjs`: alias `@milvus/lwc` → `dist/lwc`
  - `package.json`: `build:lwc` = `node scripts/generate-slds-catalog.mjs && node scripts/build-lwc.ts`. `dev:lwc`는 지운다

**Interfaces:**
- Produces (`lib/lwc-build.ts`):
  - `lwcRollupOptions(o: { out: string; entries: Record<string, string>; modules: { name: string; path: string }[] }): RollupOptions`
  - `buildLwc(o: Parameters<typeof lwcRollupOptions>[0]): Promise<void>`
  - `sfdxLwcModules(projectRoot: string): { name: string; path: string }[]`. 모든 패키지 폴더의 `**/lwc/<이름>/<이름>.(ts|js)`를 `c/<이름>`으로 찾는다
  - `catalogModules(examplesJson: { name: string; rel: string }[], lbcDir: string): { name: string; path: string }[]`. 상대 경로를 실행 시점에 절대 경로로 바꾼다

- [ ] **Step 1: 실패하는 테스트**
```ts
test(".ts 컴포넌트를 빌드하면 @api 속성이 publicProps로 등록된다", ...);   // fixtures/lwc-ts/c/probe/probe.ts
test("lightning/platformResourceLoader와 @salesforce/resourceUrl/x를 import해도 빌드가 실패하지 않는다", ...);
test("synthetic-shadow chunk가 index.js의 첫 import다", ...);
test("@salesforce/gate/bc.260.enableComboboxElementInternals는 isOpen false", ...);
test("생성된 examples.json과 카탈로그 스토리에 절대 경로와 'node_modules/' 상대 경로가 없다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
  - 지금 `rollup.lwc.config.mjs`의 기능을 그대로 옮긴다: closedGates, manualChunks, `UNRESOLVED_IMPORT` 실패 처리, 동적 컴포넌트
  - LWC 플러그인 앞에 플러그인 두 개를 더한다
    - **타입 제거(`.ts`만):** `typescript.transpileModule(code, { compilerOptions: { target: ESNext, module: ESNext, experimentalDecorators: false } })`
    - **플랫폼 모듈 대체:**
      - `lightning/platformResourceLoader` → `export const loadStyle = () => Promise.resolve(); export const loadScript = loadStyle;`
      - `@salesforce/resourceUrl/<이름>` → `export default "/milvus-resource/<이름>"`
  - 생성 파일(`stories/slds-catalog/`)은 손으로 고치지 않는다. 생성기만 고친다
- [ ] **Step 4: 통과를 확인한다.**
  - 깨끗한 체크아웃을 재현한다: `rm -rf stories/slds-catalog dist/lwc && pnpm build-storybook`
  - `pnpm test:node`
- [ ] **Step 5: 커밋.** `[Feat] LWC 빌드에 TypeScript·플랫폼 모듈 대체 추가, 카탈로그 경로를 이식 가능하게 (#N)`

### Task 6: 밀버스 컴포넌트 TS 전환과 loadBrand

**Files:**
- Rename: `milvusBadge`·`milvusButton`·`milvusMultiSelect`의 `.js` → `.ts`, `__tests__/*.test.js` → `.test.ts`
- Create:
  - `force-app/main/default/lwc/milvusScript/milvusScript.ts`
  - `milvusScript.js-meta.xml`(`isExposed: false`)
  - `__tests__/milvusScript.test.ts`
  - `force-app/main/default/lwc/tsconfig.json`(`extends: "../../../../tsconfig.lwc.base.json"`)
  - `tsconfig.lwc.base.json`
- Modify:
  - `eslint.config.cjs`: `**/lwc/**/*.ts`에 `@salesforce/eslint-config-lwc/recommended-ts`를 쓴다
  - `package.json`
    - `lint` = `eslint "force-app/**/lwc/**/*.{js,ts}"`
    - lint-staged 패턴에 `.ts`를 더한다
    - `typecheck`에 `&& tsc --noEmit -p force-app/main/default/lwc/tsconfig.json`을 더한다
    - devDependency `@types/jest`를 추가한다

**Interfaces:**
- Produces (`c/milvusScript`):
  - `loadBrand(component: LightningElement): Promise<void>`
    - `loadStyle(component, milvusBridge)` 다음에 `loadStyle(component, milvusBrand)`를 부른다(`@salesforce/resourceUrl/milvusBridge`, `/milvusBrand`)
    - 실패해도 던지지 않고 `console.error`로 남긴다
  - `detectNativeShadow(root: ParentNode): string[]`. `data-render-mode="shadow"`인 `lightning-*` 태그 이름을 돌려준다
- 세 컴포넌트는 `connectedCallback`에서 `loadBrand(this)`를 부른다. 첫 `renderedCallback`에서 `detectNativeShadow` 결과가 있으면 `console.warn("[milvus] native shadow로 그려지는 기본 컴포넌트: ...")`를 낸다
- `tsconfig.lwc.base.json`
  - `target`·`module`: `ESNext`, `moduleResolution`: `Bundler`
  - `experimentalDecorators: false`, `strict: true`, `types: ["jest"]`, `include: ["**/*.ts"]`

- [ ] **Step 1: 실패하는 테스트.** `milvusScript.test.ts`에 쓴다. sfdx-lwc-jest의 기본 stub을 쓴다
```ts
it("milvusBridge 다음 milvusBrand 순서로 loadStyle을 부른다", async () => { await loadBrand(el); expect(loadStyle.mock.calls.map((c) => c[1])).toEqual([bridgeUrl, brandUrl]); });
it("data-render-mode=shadow인 lightning-* 이름을 돌려준다", () => expect(detectNativeShadow(fixture)).toEqual(["lightning-button"]));
it("loadStyle이 실패해도 던지지 않고 console.error로 남긴다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:unit`
- [ ] **Step 3: 구현.** 컴포넌트는 확장자를 바꾸고 타입만 더한다. `@api`에 `@ts-ignore`를 붙이지 않는다
- [ ] **Step 4: 통과를 확인한다.** `pnpm lint && pnpm test && pnpm build-storybook`
- [ ] **Step 5: 커밋.** `[Feat] 밀버스 컴포넌트 TypeScript 전환과 loadBrand (#N)`

### Task 7: util.css 규칙 통합 (설계 5.2, 5.3)

**Files:**
- Create: `lib/hooks-index.ts`, `lib/rules.ts`, `scripts/build-hooks-index.ts`, `scripts/check-brands.ts`, `tests/rules.test.ts`, `tests/fixtures/rules/*.css`
- Modify:
  - `lib/contrast.ts`: 함수를 더한다
  - `package.json`: `prepack`에 `node scripts/build-hooks-index.ts`를 더하고, `test:brands` = `node scripts/check-brands.ts`
  - `brands/Sample_Forest/util.css`: 주석을 고친다
  - `CLAUDE.md` 3장, `README.md` 2장
- Delete: `scripts/check-brands.mjs`

**Interfaces:**
- Produces (`lib/contrast.ts`):
  - `suggestPassingText(text: string, bg: string): string`. `text` 색의 팔레트 40, 30, 20단계 중 처음 통과하는 색을 돌려준다
  - `darkerStep(hex: string): string`. 같은 색조에서 한 단계 진한 색을 돌려준다(hover·active용)
- Produces (`lib/hooks-index.ts`):
  - `type HooksIndex = { readSHooks: string[]; readGHooks: string[] }`
  - `buildHooksIndex(src: { sldsCss: string; lbcCss: string[] }): HooksIndex`. `var(--…)`로 **읽히는** 이름만 모은다
  - `type RuleContext = { readSHooks: Set<string>; readGHooks: Set<string>; milvusVars: Set<string> }`
  - `loadRuleContext(o: { pkgRoot: string; projectRoot?: string }): RuleContext`
    - `dist/hooks-index.json`이 있으면 읽고, 없으면(저장소) 원본에서 계산한다
    - `milvusVars`는 다음 파일에서 읽히는 `--milvus-*` 이름을 모은다
      - `projectRoot`가 있으면: 프로젝트의 `lwc/milvus*/**/*.{css,ts}`와 `staticresources/milvusBridge.css`
      - 없으면(저장소): 저장소의 같은 경로와 `templates/**/milvusBridge.css`
- Produces (`lib/rules.ts`):
  - `type Issue = { file: string; rule: string; message: string; fix?: string }`
  - `checkUtilCss(css: string, file: string, ctx: RuleContext): Issue[]`
  - 상수
    - `BRAND_COLOR_PATTERNS`
    - `FEEDBACK_HOOKS`: 설계 5.3 표
    - `COLOR_S_WHITELIST`: 6개
    - `LBC_ONLY_G`: 5개
    - `NEUTRAL_COLOR_PATTERNS`
    - `ALLOWED_PLAIN_PROPS = ["letter-spacing"]`

- [ ] **Step 1: 실패하는 테스트.** 규칙마다 하나씩 쓴다
```ts
test("클래스 규칙, @font-face를 거부한다", ...);
test("브랜드 색 계열(accent·on-accent·border-accent·brand-base·--slds-r-color-brand-*)을 거부한다", ...);
test("--slds-c-button-x, --sds-c-x를 거부한다", ...);
test("--slds-g-font-family-base를 거부한다", ...);
test("포커스 그림자: 값에 hex가 있으면 거부, var(--slds-g-color-brand-base-15)만이면 허용", ...);
test("중립 색: light-dark()이면 허용, 일반 값이면 거부", ...);
test("on-surface-3과 surface-2 쌍이 4.5 미만이면 거부", ...);
test("LBC 전용 g 이름 --slds-g-color-border-base-1은 허용", ...);
test("색 s hook은 화이트리스트 6개만, 값이 중립 g hook만 참조할 때 허용", ...);
test("--slds-s-label-spacing은 기본 컴포넌트가 읽으므로 허용, 아무도 읽지 않는 이름은 거부", ...);
test("--slds-g-color-border-info-1은 거부(없는 이름)", ...);
test("성공 글자색이 배경 위 또는 흰색 위에서 4.5 미만이면 거부하고 fix에 40단계 색", ...);
test("light-dark(#111, #eee)의 대비는 #111로 잰다", ...);
test("주석 안의 선언은 무시한다", ...);
test("letter-spacing은 허용, color 같은 다른 일반 속성은 거부", ...);
test("--milvus-*는 milvusVars에 있을 때만 허용", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.** postcss로 파싱한다. CLAUDE.md 3장과 README 2장의 util.css 규칙을 설계 5.2 표와 같게 고친다
- [ ] **Step 4: 통과를 확인한다.** `pnpm test`
- [ ] **Step 5: 커밋.** `[Feat] util.css 규칙을 설계 5.2로 통합 (#N)`

### Task 8: templates 틀, 브리지 변수, 명세 항목, 고정 목록, 관리 파일

**Files:**
- Create: `templates/` 전부. 내용이 아직 정해지지 않은 파일은 한 줄 주석만 넣는다
  - `templates/milvus-design.md`
  - `templates/claude/settings.json`
  - `templates/claude/skills/milvus-brand/SKILL.md`
  - `templates/claude/hooks/milvus-check.mjs`
  - `templates/force-app/main/default/lwc/tsconfig.json`
  - `templates/force-app/main/default/components/milvusHead.component`(+`-meta.xml`)
  - `templates/force-app/main/default/staticresources/`: `milvusBrand.css`, `milvusBridge.css`, `milvusVf.css`. 각각 `.resource-meta.xml`(`contentType: text/css`)을 둔다
  - `templates/brand/brandingSet.xml`, `templates/brand/theme.xml`
- Create: `lib/bridge-vars.ts`, `lib/spec-items.ts`, `lib/fixed-list.ts`, `lib/managed.ts`, `tests/spec-items.test.ts`, `tests/managed.test.ts`

**Interfaces:**
- Produces (`lib/bridge-vars.ts`): `BRIDGE_VARS: Record<string, string>`. 키는 항목 id, 값은 변수 이름이다
  - 움직임 4개: 전역 제약의 이름
  - 크기·모양: `--milvus-control-height`, `--milvus-input-border-width`, `--milvus-path-end-radius`, `--milvus-control-icon-size`, `--milvus-modal-width-medium`, `--milvus-modal-width-large`
  - 글자: `--milvus-letter-spacing`, `--milvus-caps-transform`, `--milvus-choice-label-weight`
  - 커서·밑줄·그림자: `--milvus-cursor-disabled`, `--milvus-link-decoration-hover`, `--milvus-nubbin-shadow`
  - 아이콘: `--milvus-icon-color-all`
- Produces (`lib/spec-items.ts`):
  - `type SpecItem`
    ```ts
    type SpecItem = {
      id: string;
      group: "기본" | "색" | "모양" | "크기" | "글자" | "깊이" | "움직임" | "포커스" | "아이콘" | "표시만";
      label: string; description: string; examples: string[];
      hooks: string[]; bridgeVars: string[]; limits: string;
      input: "text" | "color" | "path" | "none"; nativeLoss: boolean;
    };
    ```
  - `SPEC_ITEMS: SpecItem[]`. 설계 6.1의 10개와 9.3의 항목 전부다. `bridgeVars`에는 `BRIDGE_VARS`의 값만 쓴다
- Produces (`lib/fixed-list.ts`):
  - `type FixedItem = { id: string; label: string; mode: "both" | "native"; match: { selector?: RegExp; property?: string; source?: "css" | "js" } }`
  - `FIXED_ITEMS: FixedItem[]`. 설계 9.4 목록이다
- Produces (`lib/managed.ts`):
  - `type ManagedFile = { dest: string; kind: "managed" | "owned" | "generated"; src?: string; optional?: "vf" }`. `src`는 `kind`가 `generated`일 때만 생략한다
  - `managedFiles(pkgRoot: string, o: { vf: boolean }): ManagedFile[]`. 목록은 설계 3장의 표시와 같다
  - `sha256(content: string | Buffer): string`
- `templates/claude/settings.json`은 설계 7.2의 값을 그대로 쓴다. hook 명령은 `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/milvus-check.mjs`다
- `templates/.../milvusBrand.css`는 설명 주석과 빈 `:root {}`만 둔다. 기본 상태는 Salesforce 기본 모양이다(설계 1장 10/9 "기본 우선")

- [ ] **Step 1: 실패하는 테스트**
```ts
test("SPEC_ITEMS의 id는 겹치지 않는다", ...);
test("SPEC_ITEMS의 hooks는 모두 loadRuleContext(저장소)의 읽히는 이름이거나 LBC_ONLY_G다", ...);
test("SPEC_ITEMS의 bridgeVars는 모두 BRIDGE_VARS의 값이다", ...);
test("움직임 묶음 항목은 hooks가 비고 bridgeVars가 있으며 nativeLoss가 참이다", ...);
test("managedFiles의 managed+generated 대상은 설계 7.2 deny 경로와 하나씩 대응한다", ...);
test("vf:false면 milvusHead와 milvusVf가 목록에 없다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.** 문구와 hook 이름은 설계 6.1·9.3·9.4 표에서 옮긴다. 표에서 생략된 접두사는 붙인다
- [ ] **Step 4: 통과를 확인한다.** `pnpm test`
- [ ] **Step 5: 커밋.** `[Feat] templates 틀, 브리지 변수, 브랜드 명세 항목, 고정 목록 (#N)`

### Task 9: org 프로브 (사용자 승인 필요, 코드 커밋 없음)

**대상:** `learndoshare_1` org. 프로브 파일은 저장소 밖 임시 폴더에 둔다

- [ ] **Step 1: 배포할 파일을 준비한다.**
  - `milvusBrand`: 중립 색 `surface-2`, `surface-container-1`, `on-surface-3`, `border-1`을 `light-dark()`로 넣고, 피드백 색 hook도 넣는다
  - 빈 `milvusBridge`: `loadBrand`가 참조하므로 필요하다
  - 확인용 LWC: `lightning__UrlAddressable`, `loadBrand` 사용
  - 유틸리티 바용 LWC: 화면 없이 `loadBrand`만 부른다
  - VF 테스트 페이지: SLDS 2 + 팔레트 + util.css
- [ ] **Step 2: 승인을 요청한다.** 대상 org, 명령, 생기는 메타데이터, 유틸리티 바를 붙일 앱을 보여 준다
- [ ] **Step 3: 측정한다.** 각 화면에서 `getComputedStyle`로 읽는다
  - 표준 레코드 화면: `document.documentElement`, 카드의 배경과 글자색
  - 피드백 색이 쓰인 알림과 뱃지
  - VF 페이지의 버튼·입력·배경
  - 유틸리티 바만 있는 표준 화면에 `milvusBrand` link가 생기는가
  - 정의가 없는 hook(`--slds-g-color-accent-4` 등)의 계산 값
  - `lightning-*` 호스트의 `data-render-mode`(읽기만)
- [ ] **Step 4: 정리한다.** 삭제 배포는 따로 승인을 받는다. 테마를 지우면 BrandingSet도 함께 지워지므로 둘을 나눠 배포한다
- [ ] **Step 5: 기록한다.** 설계 13·14장에 반영하고, 이 내용은 M2 PR에 넣는다
  - 유틸리티 바가 안 되면 설계 9.7을 "밀버스 컴포넌트가 있는 페이지만"으로 확정한다
  - 설계 9.6의 3에 "센티널 브랜드의 org 비교는 Task 26 뒤로 미룬다"고 적는다

### M2 마무리: 학습 자료 갱신

- [ ] **Step 1:** 다음 문서를 고친다. `node scripts/check-learn.ts`가 통과해야 한다
  - `Learn/02-LWC 기초.html`: TypeScript LWC, `.ts` 직접 배포, `loadBrand`
  - `Learn/04-LWC와 스토리북 통합.html`: Rollup 타입 제거, 플랫폼 모듈 대체, synthetic 빌드
  - `Learn/01`: util.css 규칙(설계 5.2)
  - `Learn/00` 5·6절: Task 9 결과
- [ ] **Step 2: 커밋.** `[Docs] M2 결과를 학습 자료에 반영 (#N)`

---

## M3 init·check (10/13)

### Task 10: 병합 도구와 브랜드 XML

**Files:**
- Create: `lib/merge.ts`, `lib/branding.ts`, `tests/merge.test.ts`, `tests/branding.test.ts`

**Interfaces:**
- Produces (`lib/merge.ts`):
  - `mergeSettings(existing: Record<string, unknown> | undefined, fragment: Record<string, unknown>): Record<string, unknown>`
    - 배열은 합치고 중복을 빼며, 기존 순서를 지킨다
    - hook은 같은 command가 이미 있으면 넣지 않는다
  - `appendLines(text: string | undefined, lines: string[]): string`
  - `addKeyIfMissing<T extends object>(obj: T, key: string, value: unknown): T`
- Produces (`lib/branding.ts`):
  - `readBranding(xml: string): { brandColor: string; brandImage?: string }`
  - `writeBrandingSet(o: { name: string; brandColor: string; logo?: boolean }): string`. `logo`가 참이면 `BRAND_IMAGE` = `/file-asset/<name>Logo?v=1`
  - `writeTheme(name: string): string`. `defaultBrandingSet` = `LEXTHEMING<name>`, `designSystemVersion` = `SLDS_v2`
  - `writeContentAssetMeta(name: string): string`. `<name>Logo` 자산의 `.asset-meta.xml`
  - `writeActiveThemeSettings(name: string): string`. mdapi 형식의 `LightningExperience.settings`로, `activeThemeName` 한 필드만 담는다
  - `writeSettingsPackageXml(): string`. `Settings` 타입 `LightningExperience` 한 항목의 `package.xml`
  - `isValidBrandName(name: string): boolean`

- [ ] **Step 1: 실패하는 테스트**
```ts
test("기존 permissions.allow와 hooks를 지우지 않고 밀버스 항목을 더한다", ...);   // 리뷰 중점 1
test("같은 fragment를 두 번 병합해도 결과가 같다", ...);
test("appendLines는 이미 있는 .npmrc 줄을 다시 넣지 않는다", ...);
test("writeBrandingSet → readBranding 왕복에서 brandColor가 같고, logo면 BRAND_IMAGE가 /file-asset/AcmeLogo?v=1", ...);
test("writeActiveThemeSettings에는 activeThemeName 하나만 있다", ...);
test("isValidBrandName: 'Milvus_DS' 참, '밀버스'·'A__B'·'Ab_'·'1A' 거짓", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`
- [ ] **Step 5: 커밋.** `[Feat] settings 병합과 브랜드 메타데이터 XML (#N)`

### Task 11: `milvus init`

**Files:**
- Create: `cli/context.ts`, `cli/init.ts`, `tests/init.test.ts`
- Modify: `cli/index.ts`

**Interfaces:**
- Consumes: `managedFiles`, `sha256`(Task 8), `lib/merge.ts`·`lib/branding.ts`(Task 10)
- Produces (`cli/context.ts`):
  - `type MilvusConfig = { version: string; targetOrg: string; brand: string; vf: boolean; managed: Record<string, string> }`
  - `findProject(cwd: string): { root: string; defaultPackageDir: string }`
  - `readConfig(root: string): MilvusConfig | undefined`, `writeConfig(root: string, c: MilvusConfig): void`
  - `type SfRunner = (args: string[], cwd: string) => Promise<{ code: number; stdout: string; stderr: string }>`. 기본 구현 `runSf`는 `spawn("sf", args)`를 쓴다(인자 배열)
- Produces (`cli/init.ts`):
  - `type Op = { kind: "copy" | "create" | "merge-json" | "append-lines" | "add-key"; dest: string; src?: string; content?: string; lines?: string[]; key?: string; value?: unknown }`
  - `planInit(o: { root: string; pkgRoot: string; targetOrg: string; brand: string; vf: boolean; logoFile?: string }): Op[]`
  - `applyOps(root: string, ops: Op[]): { written: string[]; skipped: string[] }`
  - `runInit(argv: string[], deps?: { sf?: SfRunner; nodeVersion?: string }): Promise<number>`. 옵션은 `--target-org`, `--brand`, `--from-org`, `--no-vf`다. 기본은 VF를 포함한다

- [ ] **Step 1: 실패하는 테스트.** 임시 SFDX 프로젝트를 쓰고, 폴더 이름에 공백과 한글을 넣는다
```ts
test("두 번 실행해도 파일 내용과 milvus.config.json이 같다", ...);
test("CLAUDE.md에 정확히 '@milvus-design.md' 한 줄을 추가하고 기존 내용은 그대로다 / 없으면 그 한 줄로 만든다", ...);
test(".npmrc 범위 두 줄이 없을 때만 추가한다", ...);
test("이미 있는 milvusBrand.css는 건너뛰고 skipped에 넣는다", ...);
test("LightningExperience.settings는 만들지 않는다", ...);
test("sfdx-project.json에 defaultLwcLanguage, package.json에 storybook 스크립트를 없을 때만 추가한다", ...);
test("--no-vf면 milvusHead·milvusVf를 만들지 않고 config.vf가 거짓", ...);
// 아래는 모두 '1을 돌려주고 쓴 파일이 0개'
test("Node 22.17", ...); test("깨진 .claude/settings.json", ...); test("--brand와 --from-org를 함께 / 둘 다 없음", ...);
test("브랜드 이름 '1A'", ...); test("기본 패키지 폴더가 force-app이 아님", ...);
test("sf 없음 또는 org 로그인 안 됨 (가짜 SfRunner)", ...);
test("--from-org인데 커스텀 테마가 없거나 조회 실패 (가짜 SfRunner)", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
  - 순서: 사전 점검(설계 4.1) → `planInit` → `applyOps` → `writeConfig`
  - `--from-org`
    - `Settings:LightningExperience`로 활성 테마 이름을 먼저 읽는다
    - 다음 멤버만 **임시 폴더**로 받는다: `LightningExperienceTheme:<이름>`, `BrandingSet:LEXTHEMING<이름>`, 로고가 있으면 `ContentAsset:<로고>`
    - 검증한 뒤 프로젝트에 복사한다. 검증 전에는 프로젝트에 아무것도 쓰지 않는다
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`
- [ ] **Step 5: 커밋.** `[Feat] milvus init (#N)`

### Task 12: `milvus check`와 hook

**Files:**
- Create: `cli/check.ts`, `tests/check.test.ts`
- Modify: `templates/claude/hooks/milvus-check.mjs`, `cli/index.ts`

**Interfaces:**
- Consumes: `loadRuleContext`, `checkUtilCss`(Task 7), `readConfig`, `findProject`(Task 11), `managedFiles`, `sha256`(Task 8)
- Produces (`cli/check.ts`): `runCheck(o: { root: string; style: boolean }): Promise<{ code: 0 | 1 | 2; issues: Issue[]; regenerated: string[] }>`
  - `style: true`: util.css 규칙과 대비만 본다. `dist/hooks-index.json`만 읽는다. 실패하면 2
  - `style: false`: 전체를 본다. 규칙, 밀버스 관리 파일 sha256, 타입 검사(`lwc/milvus*`만). 실패하면 1. VF 처리는 Task 24에서 붙인다
- hook(`milvus-check.mjs`, ESM): stdin의 `tool_input.file_path`가 `staticresources/milvusBrand.css`나 `brandingSets/`일 때만 `pnpm milvus check --style`을 실행한다. 종료 코드와 stderr를 그대로 전달한다

- [ ] **Step 1: 실패하는 테스트**
```ts
test("--style은 규칙 위반에서 2와 stderr의 고칠 값", ...);
test("--style은 200ms 안에 끝난다 (hooks-index.json 사용)", ...);
test("밀버스 관리 파일을 고치면 전체 check가 1이고 'pnpm milvus update --force'를 안내한다", ...);
test("프로젝트 자체 컴포넌트의 타입 오류는 무시한다", ...);
test("hook은 다른 파일 수정에는 check를 실행하지 않는다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.** 타입 검사는 `typescript` API로 `milvus*/**/*.ts`만 본다
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`
- [ ] **Step 5: 커밋.** `[Feat] milvus check와 util.css 검사 hook (#N)`

### Task 13: 카탈로그 생성기 TS 전환과 출력 인자화

**Files:**
- Create: `scripts/generate-slds-catalog.ts`, `tests/catalog.test.ts`
- Delete: `scripts/generate-slds-catalog.mjs`
- Modify:
  - `package.json`: `build:lwc`를 `.ts` 생성기로 바꾸고, `prepack`에 카탈로그 생성을 더한다
  - `.gitignore`: `.milvus/`

**Interfaces:**
- Produces: `generateCatalog(o: { lbcDir: string; outStories: string }): { components: number; examples: number }`
  - 스토리는 `@milvus/lwc/catalog.js`와 bare specifier `?raw`를 쓴다
  - `examples.json`은 `{ name, rel }` 형식으로 쓴다. `rel`은 `lbcDir` 기준 상대 경로다
  - `lbcDir`는 `createRequire`로 찾은 `lightning-base-components/src/lightning`이다
- 패키지에는 `prepack`이 만든 `stories/slds-catalog`가 들어간다(Task 1의 `files`)

- [ ] **Step 1: 실패하는 테스트.** "73개 컴포넌트, 예제 249개", "결과에 절대 경로와 `node_modules/` 상대 경로가 없다"
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `rm -rf stories/slds-catalog dist/lwc && pnpm build-storybook`
- [ ] **Step 5: 커밋.** `[Refactor] 카탈로그 생성기 TS 전환 (#N)`

### M3 마무리: 수동 확인과 학습 자료 갱신

- [ ] **Step 1: 수동 확인.** `pnpm pack` tgz를 `learndoshare_2`에 설치하고 `init`을 실행한 뒤 확인한다. 결과는 설계 13·14장에 옮긴다
  - Claude Code에 `lwc/milvusBadge/milvusBadge.ts`를 고치게 하면 거부되는가(`Edit` deny)
  - 인자 없는 `pnpm milvus deploy`를 실행하게 하면 확인을 묻는가(`ask`)
  - VS Code에서 새 LWC를 만들면 `.ts`로 생기는가(`defaultLwcLanguage`)
- [ ] **Step 2:** 다음 문서를 고친다
  - `Learn/08-Claude Code 런북.html`: `init`, `milvus-design.md`, `permissions.ask`·`deny`, hook 1개
  - `Learn/07-pnpm.html`: 설치 준비, `pnpm milvus`
- [ ] **Step 3: 커밋.** `[Docs] M3 결과를 학습 자료에 반영 (#N)`

---

## M4 정적 반영 검사와 브리지 (10/13)

### Task 14: 정적 반영 검사 (설계 9.6의 1, 4)

**Files:**
- Create: `scripts/audit/classify.ts`, `scripts/audit/report.ts`, `scripts/audit/run.ts`, `audit/baseline.json`, `audit/report.json`, `tests/audit.test.ts`, `tests/fixtures/audit/*`
- Modify: `package.json`(`audit:brand` = `node scripts/audit/run.ts --check`)

**Interfaces:**
- Consumes: `SPEC_ITEMS`, `FIXED_ITEMS`(Task 8), `docs/research/2026-10-08/extract.cjs`의 분류 기준
- Produces: `classify(o: { sldsCss: string; lbcFiles: { comp: string; file: string; css: string }[] }): Decl[]`
  ```ts
  type Decl = {
    src: "slds2" | "lbc"; comp: string; cat: string;
    kind: "g" | "s" | "c" | "r" | "otherVar" | "keyword" | "literal" | "keyframes";
    prop: string; value: string; selector: string; file: string; line: number;
  };
  ```
  - `kind` 판정

    | 값 | kind |
    | --- | --- |
    | `var(--slds-g-…)` | `g` |
    | `var(--slds-s-…)` | `s` |
    | `var(--slds-c-…)`, `--sds-c-…` | `c` |
    | `var(--slds-r-…)` | `r` |
    | 그 밖의 `var(` | `otherVar` |
    | `inherit`, `initial`, `unset`, `none`, `0`, `auto`, `transparent`, `currentcolor`, `100%`, `normal` | `keyword` |
    | `@keyframes` 안 | `keyframes` |
    | 나머지 | `literal` |

  - 값은 자르지 않는다
- Produces: `type Status = "reached" | "bridge" | "gap" | "fixed" | "n/a"`
- Produces: `buildReport(decls: Decl[], items: SpecItem[], bridgeCss: string, fixed: FixedItem[])`. 결과는 세 가지다
  ```ts
  {
    byComponent: Record<string, Record<string, { now: Status; native: Status }>>;
    byItem: Record<string, { now: { reached: number; total: number }; native: { reached: number; total: number } }>;
    gaps: { comp: string; item: string; selector: string; prop: string; value: string }[];
  }
  ```
- `run.ts --write`는 기준 파일을 쓴다. `--check`는 다음 경우에 1로 끝난다
  1. `gaps`(고정 목록에 없는 빈틈)가 하나라도 있다. 기준 파일과 상관없다
  2. 기준 대비 바뀐 것이 있다: 새 하드코딩, hook 변화, `nativeShadowEnabledComponents` 변화, 브리지 선택자 소실

- [ ] **Step 1: 실패하는 테스트.** 작은 예시 CSS로 쓴다
```ts
test("var(--slds-g-radius-border-2)는 g, 0.1s 리터럴 transition은 literal(motion)", ...);
test("var(--slds-s-x)가 :where(html)의 --slds-s-x:var(--slds-g-y)를 거치면 g로 풀린다", ...);
test("브리지가 덮는 리터럴은 bridge, FIXED_ITEMS에 맞으면 fixed, 나머지는 gap", ...);
test("고정 목록에 없는 gap이 있으면 --check가 1", ...);
test("byItem은 항목마다 now·native의 reached/total을 낸다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 기준 파일을 만든다.** `node scripts/audit/run.ts --write`
  - 브리지가 아직 없어 `gaps`가 남으므로, 이 시점의 `--check`는 실패하는 것이 맞다
  - `audit:brand`를 `test`에 넣는 것은 Task 15에서 한다
- [ ] **Step 5: 커밋.** `[Feat] 전 컴포넌트 정적 반영 검사 (#N)`

### Task 15: `milvusBridge.css` 생성기 (개체 아이콘 색 제외)

**Files:**
- Create: `scripts/bridge/targets.ts`, `scripts/bridge/generate.ts`, `tests/bridge.test.ts`
- Modify:
  - `templates/force-app/main/default/staticresources/milvusBridge.css`: 생성 결과
  - `package.json`: `bridge:generate`를 추가하고, `test`에 `audit:brand`를 더한다

**Interfaces:**
- Consumes: `BRIDGE_VARS`(Task 8)
- Produces:
  - `type BridgeTarget = { id: string; selectors: string[]; property: string; varName: string; min?: string }`
  - `BRIDGE_TARGETS: BridgeTarget[]`. 설계 5.6 표에서 개체 아이콘을 뺀 것이다. `varName`은 `BRIDGE_VARS`에서 가져온다
  - `generateBridge(sldsCss: string, targets: BridgeTarget[]): string`
- 생성 규칙
  - 각 선택자·속성의 원래 값을 SLDS 2 CSS에서 찾아 `var()` 기본값으로 쓴다
  - 시간 묶음은 전역 제약을 따른다. 0.4s를 넘는 값과 스피너는 바꾸지 않는다
  - 모달·배경막·토스트는 `max(var(…, <원래값>), 0.01ms)`로 감싼다
  - 줄인 움직임 규칙은 항상 넣는다: `@media (prefers-reduced-motion: reduce)`, 시간 `0.01ms`, `animation-iteration-count: 1`

- [ ] **Step 1: 실패하는 테스트**
```ts
test("모든 규칙의 var() 기본값은 SLDS 2 원래 값과 같다", ...);
test("모달·토스트 시간은 max(..., 0.01ms)로 감싼다", ...);
test("스피너 선택자는 시간 규칙에서 빠지고 줄인 움직임 규칙에만 있다", ...);
test("SPEC_ITEMS의 모든 bridgeVars(개체 아이콘 제외)가 생성된 CSS에서 읽힌다", ...);
test("생성된 --milvus-* 이름이 loadRuleContext의 milvusVars에 잡힌다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 생성하고 확인한다.**
  - `pnpm bridge:generate` → `node scripts/audit/run.ts --write` → `pnpm test`
  - 고정 목록에 없는 빈틈이 남으면 원인을 고친다. 고칠 수 없는 것만 사용자 합의를 받아 `FIXED_ITEMS`에 넣는다
- [ ] **Step 5: 커밋.** `[Feat] milvusBridge.css 생성기 (#N)`

### Task 16: 개체 아이콘 색 브리지 (빼는 순서 ⑥)

**Files:** Modify `scripts/bridge/targets.ts`, `scripts/bridge/generate.ts`, `tests/bridge.test.ts`

**Interfaces:**
- Produces: `.slds-icon-standard-<이름>`, `-custom-`, `-action-` 클래스마다 다음 규칙을 만든다
  `--slds-c-icon-color-background: var(--milvus-icon-<종류>-<이름>, var(--milvus-icon-color-all, <원래 rgb>))`

- [ ] **Step 1: 실패하는 테스트.** "973개 클래스 모두 규칙이 있고 기본값은 원래 색과 같다", "`--milvus-icon-color-all`을 정하면 모든 개체 아이콘이 그 값을 쓴다"
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm bridge:generate && node scripts/audit/run.ts --write && pnpm test`
- [ ] **Step 5: 커밋.** `[Feat] 개체 아이콘 색 브리지 (#N)`

### M4 마무리: 학습 자료 갱신

- [ ] **Step 1:** 다음 문서를 고친다
  - `Learn/00` 7절: 전 컴포넌트 분석 수치를 `audit/report.json`의 `byItem`으로 갱신
  - `Learn/01`: 브리지와 hook이 없는 항목
- [ ] **Step 2: 커밋.** `[Docs] M4 결과를 학습 자료에 반영 (#N)`

---

## M5 Storybook 프로젝트 모드·명세 페이지·skill (10/14)

### Task 17: 두 모드 Storybook과 Vite 플러그인

**Files:**
- Create: `lib/storybook-plugin.ts`, `tests/storybook-plugin.test.ts`
- Rename+Modify: `.storybook/main.mjs` → `main.ts`, `preview.js` → `preview.ts`, `brand.js` → `brand.ts`, `manager.js` → `manager.ts`
- Modify:
  - `stories/foundations/BrandStyle.stories.js`: `../../.storybook/brand.ts`를 import한다
  - `package.json`: Task 3 결과에 따라 `files`를 늘린다. 원본 `.ts`로 발행하면 `.storybook`과 `lib`를 더한다. 컴파일하면 `dist/storybook`을 더하고 `prepack`에 그 빌드를 넣는다

**Interfaces:**
- Consumes: `readBranding`(Task 10), `brandPalette`(Task 4), `loadRuleContext`·`checkUtilCss`(Task 7), `MilvusConfig`(Task 11)
- Produces: `type BrandData = { name: string; label: string; source: "org" | "sample" | "project" | "slds"; palette: Record<number, string>; utilCss: string; bridgeCss: string; logoUrl?: string; error?: string }`
- Produces: `brandsFromRepo(repoDir: string): BrandData[]`, `brandsFromProject(projectDir: string, config: MilvusConfig): BrandData[]`
  - 프로젝트 모드는 프로젝트 브랜드와 "SLDS 기본"(`source: "slds"`, util·bridge 없음)을 돌려준다
  - BrandingSet이 없거나 `checkUtilCss`가 issue를 내면, 프로젝트 브랜드 대신 `error` 메시지를 담은 `slds` 브랜드를 돌려준다
- Produces: `milvusStorybookPlugin(o: { mode: "repo" | "project"; repoDir: string; projectDir?: string }): Plugin`
  - 가상 모듈 `virtual:milvus-brands`는 `export const mode`와 `export const brands: BrandData[]`를 내보낸다. 원본 파일이 바뀌면 다시 로드한다
  - `GET /__milvus/brand-request` → `{ text: string | null; writable: boolean }`
  - `POST /__milvus/brand-request`(본문 `{ text: string }`)는 프로젝트 루트의 `milvus-brand-request.md`에만 쓴다. 저장소 모드와 localhost가 아닌 요청에는 403을 돌려준다
- `.storybook/main.ts`
  - `MILVUS_PROJECT_DIR`가 있으면 프로젝트 모드다
  - alias `@milvus/lwc`는 프로젝트 모드에서 `<projectDir>/.milvus/lwc`, 저장소 모드에서 `dist/lwc`다
  - `server.fs.allow`에 `projectDir`를 넣는다. stories glob은 `../stories/**/*.stories.@(js|ts)`다
- `.storybook/preview.ts`: 브랜드에 `error`가 있으면 화면 위에 오류 배너를 그린다
- `.storybook/brand.ts`: `applyBrand(name)`이 팔레트를 `:root`에 넣는다. 그다음 `<style id="milvus-brand-bridge">`와 `<style id="milvus-brand-util">`를 이 순서로 넣는다

- [ ] **Step 1: 실패하는 테스트**
```ts
test("프로젝트 BrandingSet의 BRAND_COLOR로 팔레트를 계산하고 로고가 있으면 logoUrl을 준다", ...);
test("BrandingSet이 없거나 util.css가 규칙을 어기면 slds 브랜드에 error를 담는다", ...);
test("저장소 모드는 brands/의 Milvus_DesignSystem, Sample_Forest", ...);
test("POST는 milvus-brand-request.md 하나에만 쓰고, 저장소 모드는 403, GET의 writable은 거짓", ...);
test("본문에 경로를 넣어도 고정 경로에만 쓴다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** 저장소 모드로 `pnpm build-storybook`
- [ ] **Step 5: 커밋.** `[Feat] 저장소·프로젝트 두 모드 Storybook (#N)`

### Task 18: `milvus storybook`

**Files:**
- Create: `cli/storybook.ts`, `tests/storybook-cli.test.ts`
- Modify: `cli/index.ts`

**Interfaces:**
- Consumes: `findProject`, `readConfig`(Task 11), `buildLwc`, `sfdxLwcModules`, `catalogModules`(Task 5)
- Produces: `planStorybook(o: { root: string; pkgRoot: string; build?: string }): { env: Record<string, string>; lwc: Parameters<typeof buildLwc>[0]; command: string; args: string[] }`
  - `lwc.entries`: `{ index: <패키지>/stories/lwc-entry.js, catalog: <패키지>/stories/slds-catalog/entry.js }`
  - `lwc.modules`: 프로젝트의 `sfdxLwcModules`와 `catalogModules`를 합친 것
  - `lwc.out`: `<root>/.milvus/lwc`
  - `command`는 `process.execPath`, `args`는 `[<storybook bin>, "dev"|"build", "-c", <설정 폴더>, …]`
- Produces: `runStorybook(argv: string[], deps?: { spawn?: typeof spawn }): Promise<number>`

- [ ] **Step 1: 실패하는 테스트**
  - "공백·한글 경로가 args에 하나의 원소로 들어간다"
  - "LWC 출력이 `<root>/.milvus/lwc`이고 modules에 `c/milvusBadge`와 카탈로그 모듈이 있다"
  - "entries에 catalog가 있다"
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`. 수동 확인: `learndoshare_2`에 tgz를 설치하고 `pnpm milvus storybook`
- [ ] **Step 5: 커밋.** `[Feat] milvus storybook (#N)`

### Task 19: 브랜드 요청 파일과 명세 페이지

**Files:**
- Create: `lib/request.ts`, `tests/request.test.ts`, `stories/start/BrandSpec.stories.ts`, `stories/start/brand-spec-page.ts`

**Interfaces:**
- Consumes: `SPEC_ITEMS`, `FIXED_ITEMS`(Task 8), `virtual:milvus-brands`의 `mode`·`brands`와 `/__milvus/brand-request`(Task 17), `brandPalette`, `contrastRatio`(Task 4)
- Produces (`lib/request.ts`):
  - `type BrandRequest = { appliedAt?: string; savedAt?: string; sections: { id: string; title: string; current?: string; request: string }[]; unknown: string[] }`
  - `parseRequest(md: string): BrandRequest`
  - `serializeRequest(r: BrandRequest): string`. 형식은 설계 6.1이다
- Produces: 명세 페이지(제목 `시작하기/브랜드 명세`)
  - `SPEC_ITEMS`마다 설명, 지금 값(`BrandData`와 `getComputedStyle`), 입력창을 둔다
  - 열 때 GET으로 입력을 채운다. `writable`이 거짓이면 입력을 비활성화한다
  - 저장하면 모든 입력을 POST한다. 빈 항목은 빼고 `appliedAt`은 지운다
  - 브랜드 색 항목은 입력 색, 버튼 색(50), 링크 색(40)과 각각의 대비를 보여 준다
  - `nativeLoss` 항목에는 "native 전환 시 잃음"을 표시한다. 표시만 항목에는 `FIXED_ITEMS`를 보여 준다

- [ ] **Step 1: 실패하는 테스트**
```ts
test("serialize → parse 왕복에서 sections가 같다", ...);
test("알 수 없는 절과 빈 줄은 unknown에 보존되어 다시 쓴 파일에 남는다", ...);   // 리뷰 중점 3
test("'반영: 2026-10-14'를 appliedAt으로 읽는다", ...);
test("로고 절은 '요청: <상대 경로>' 한 줄", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`. 수동 확인: 저장소 모드에서는 입력이 비활성화되고, 프로젝트 모드에서는 저장하면 파일이 생긴다
- [ ] **Step 5: 커밋.** `[Feat] 브랜드 명세 페이지와 요청 파일 (#N)`

### Task 20: `milvus-brand` skill과 `milvus-design.md`

**Files:**
- Modify: `templates/claude/skills/milvus-brand/SKILL.md`, `templates/milvus-design.md`
- Create: `tests/templates.test.ts`

**Interfaces:**
- SKILL.md frontmatter: `name: milvus-brand`, `description`(브랜드 요청 반영, 입력 형식 5종)
- SKILL.md 본문
  - 설계 6.2의 7단계, 6.3 프리셋, 6.4 입력 형식
  - 9.3 매핑 요약(`SPEC_ITEMS` 기준), 5.2 규칙 요약
  - 5.3 피드백 색 처리: 테두리는 글자색을 쓰고, hover·active는 `darkerStep`으로 계산한다(`node -e`)
  - 5.4 브랜드 색 설명: 입력 색, 50단계, 40단계와 대비
  - 로고 처리: 사용자가 준 파일을 `contentassets/<이름>Logo.asset`으로 복사하고, `writeContentAssetMeta` 형식으로 메타를 쓰고, `BRAND_IMAGE`를 설정한다
  - 반영 후 요청 파일에 `반영: <날짜>`를 적는다
  - 배포는 2단계다: `pnpm milvus deploy` → 채팅 승인 → `--yes`
- `milvus-design.md`: 설계 7.1의 8개 절. 1절에는 값을 쓰지 않는다

- [ ] **Step 1: 실패하는 테스트**
```ts
test("milvus-design.md는 200줄 이하이고 8개 절 제목이 있다", ...);
test("SKILL.md frontmatter에 name과 description이 있다", ...);
test("SKILL.md의 hook·브리지 변수 이름은 모두 SPEC_ITEMS에 있다", ...);
test("SKILL.md는 'pnpm milvus deploy --yes'를 채팅 승인 뒤에만 실행하라고 적는다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 작성한다.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`
- [ ] **Step 5: 커밋.** `[Docs] milvus-brand skill과 milvus-design.md 템플릿 (#N)`

### Task 21: Salesforce 원본과 읽는 hook 보기 (설계 9.5)

**Files:**
- Modify: `scripts/generate-slds-catalog.ts`(컴포넌트마다 `원본과 hook` 스토리), `tests/catalog.test.ts`
- Create: `stories/start/License.stories.ts`

**Interfaces:**
- Consumes: `audit/report.json`의 `byComponent`·`gaps`(Task 14), `classify` 결과
- Produces: 컴포넌트 페이지마다 네 가지를 보여 준다
  - 머리 요약: native 지원 목록에 있는지, 항목별 지금·native 상태
  - hook 표
  - 빈틈 표
  - 원본 탭: bare specifier `?raw`로 읽는다
- 빼는 순서 ⑦이 오면 원본 탭만 뺀다

- [ ] **Step 1: 실패하는 테스트.** "Button 스토리 파일에 `원본과 hook` 스토리가 있고 report의 button 항목을 쓴다", "License 페이지에 `LICENSE.txt` 전문이 들어간다"
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm build-storybook`
- [ ] **Step 5: 커밋.** `[Feat] 컴포넌트별 Salesforce 원본과 hook 보기 (#N)`

### M5 마무리: 학습 자료 갱신

- [ ] **Step 1:** 다음 문서를 고친다
  - `Learn/03-스토리북.html`: 두 모드, 브랜드 명세 페이지, 원본과 hook 보기
  - `Learn/08`: 브랜드 요청 → 반영 흐름
- [ ] **Step 2: 커밋.** `[Docs] M5 결과를 학습 자료에 반영 (#N)`

---

## M6 deploy·리허설·VF (10/15)

### Task 22: `milvus deploy` (오전)

**Files:**
- Create: `cli/deploy.ts`, `tests/deploy.test.ts`
- Modify: `cli/index.ts`

**Interfaces:**
- Consumes: `runCheck`(Task 12), `writeActiveThemeSettings`, `writeSettingsPackageXml`(Task 10), `SfRunner`, `MilvusConfig`(Task 11)
- Produces: `type DeployPlan = { targetOrg: string; currentTheme: string; newTheme: string; sourceDirs: string[]; settingsDir: string }`
- Produces: `planDeploy(o: { root: string; config: MilvusConfig; targetOrg?: string }, sf: SfRunner): Promise<DeployPlan>`
  - 대상 org는 `--target-org` → `config.targetOrg` 순서로 정한다. sf 기본 org는 쓰지 않는다
  - 지금 활성 테마는 `Settings:LightningExperience` 조회로 읽는다
  - `sourceDirs`에 넣는 것
    - `lwc/milvus*`: 밀버스 번들 각각
    - `classes/utils/design`: 있으면
    - `staticresources/milvusBrand.*`, `staticresources/milvusBridge.*`
    - `brandingSets/LEXTHEMING<브랜드>.*`, `lightningExperienceThemes/<브랜드>.*`
    - `contentassets/<브랜드>Logo.*`: 있으면
    - `config.vf`가 참이면 `staticresources/milvusVf.*`, `components/milvusHead.*`
  - `settingsDir`: `.milvus/deploy/settings-mdapi`(`package.xml` + `settings/LightningExperience.settings`)
- Produces: `executeDeploy(plan: DeployPlan, sf: SfRunner): Promise<{ code: number; stage: "metadata" | "activate" | "done"; failures: { name: string; problem: string }[] }>`
  - 1단계: `sf project deploy start`에 `sourceDirs`마다 `--source-dir`를 붙이고 `--json`을 쓴다. 원자적이라 실패하면 롤백된다. 실패하면 `componentFailures`를 보여 준다
  - 2단계: 1단계가 성공했을 때만 `sf project deploy start --metadata-dir <settingsDir>`를 실행한다
- Produces: `runDeploy(argv: string[], deps?: { sf?: SfRunner; isTTY?: boolean; ask?: (q: string) => Promise<boolean> }): Promise<number>`
  - `--yes`가 없으면 계획만 출력하고 0으로 끝난다. TTY에서 `--yes` 없이 실행하면 y/N을 묻는다
  - 성공하면 확인용 명령 `sf org open --target-org <별칭> --path <경로>`를 출력한다(실행하지 않는다). `--url-only`는 토큰이 든 주소를 출력하므로 쓰지 않는다

- [ ] **Step 1: 실패하는 테스트.** 가짜 `SfRunner`를 쓰고, 폴더 이름에 공백과 한글을 넣는다
```ts
test("--yes 없이 실행하면 계획만 출력하고 deploy start를 부르지 않는다", ...);
test("인자가 없으면 config.targetOrg를 쓰고 sf 기본 org를 묻지 않는다", ...);
test("milvus.config.json이 없으면 1이고 'pnpm milvus init'을 안내한다", ...);
test("sf가 없거나 로그인 만료(code≠0)면 deploy start를 부르지 않고 1", ...);   // 리뷰 중점 4
test("1단계 실패 시 2단계를 부르지 않고 failures를 출력한다", ...);              // 리뷰 중점 4
test("sourceDirs에 milvusBridge와 contentassets 로고가 있고 프로젝트 자체 컴포넌트는 없다", ...);
test("vf:false면 milvusVf·milvusHead가 없다", ...);
test("settings 파일에는 activeThemeName 하나만", ...);
test("check가 실패하면 배포하지 않는다", ...);
test("경고 '활성 테마 변경은 org 전체 사용자 화면에 적용됩니다'를 출력한다", ...);
test("출력에 --url-only와 액세스 토큰 형식 문자열이 없다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`
- [ ] **Step 5: 커밋.** `[Feat] milvus deploy (#N)`

### Task 23: 리허설 (오전, 사용자 승인 필요)

- [ ] **Step 1: 설치한다.**
  - `pnpm pack`을 실행한다
  - `tar -tzf`로 확인한다. `dist/cli/index.js`, `dist/hooks-index.json`, `audit/report.json`, `templates/`, `stories/slds-catalog/`가 있어야 하고 `__tests__`는 없어야 한다
  - `learndoshare_2`에서 `pnpm add -D <tgz>`
- [ ] **Step 2:** `pnpm milvus init --target-org learndoshare_1 --brand Rehearsal --no-vf`를 두 번 실행해 결과가 같은지 확인한다
- [ ] **Step 3:** `pnpm milvus storybook`을 띄운다. 명세 페이지에서 요청을 입력·저장하고, Claude Code에 "브랜드 요청 반영해줘"를 요청한 뒤 화면이 바뀌는지 확인한다
- [ ] **Step 4:** `pnpm milvus deploy`로 계획을 확인한다. 사용자 승인을 받은 뒤 `--yes`로 실행한다(활성 테마 변경은 org 전체 화면에 적용됨)
- [ ] **Step 5:** LEX를 측정한다(밀버스 컴포넌트가 있는 페이지, 표준 화면). 활성 테마를 되돌리는 배포도 승인을 받아 실행한다
- [ ] **Step 6:** 발견한 문제는 이슈 댓글로 남기고, 고칠 것은 Task 24 전에 처리한다

### Task 24: Visualforce 지원 (오후, 빼는 순서 ②)

**Files:**
- Create: `lib/vf.ts`, `tests/vf.test.ts`
- Modify:
  - `templates/force-app/main/default/components/milvusHead.component`
  - `cli/check.ts`: 전체 check가 `milvusVf.css`를 다시 만든다
  - `cli/init.ts`: VF 기본 포함을 확인한다

**Interfaces:**
- Produces (`lib/vf.ts`): `buildMilvusVfCss(sldsCss: string, brandColor: string): string`. SLDS 2 `slds2.cosmos.css` 전체 뒤에 `:root{--slds-r-color-brand-<단계>: <brandPalette 값>}`을 붙인다
- `runCheck({style:false})`: `config.vf`가 참이면 `milvusVf.css`를 지금 `BRAND_COLOR`로 다시 쓰고 `regenerated`에 넣는다(설계 3장의 "[생성]")
- `milvusHead.component`: `<apex:component>` 안에 `<apex:stylesheet>` 세 개를 이 순서로 둔다: `{!$Resource.milvusVf}`, `{!$Resource.milvusBridge}`, `{!$Resource.milvusBrand}`

- [ ] **Step 1: 실패하는 테스트**
```ts
test("#2E7D32이면 --slds-r-color-brand-50:#468244가 있다", ...);
test("결과 크기가 5MB 미만이다", ...);
test("BRAND_COLOR를 바꾼 뒤 전체 check는 milvusVf.css를 갱신하고 0", ...);
test("BRAND_COLOR를 바꾼 뒤 deploy가 check를 통과해 계획을 출력한다", ...);
```
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 확인한다.** `pnpm test:node`. 리허설 org에 VF 페이지 하나(`<c:milvusHead/>`)를 승인받아 배포하고 측정한다
- [ ] **Step 5: 커밋.** `[Feat] Visualforce용 milvusVf와 milvusHead (#N)`

### M6 마무리: 학습 자료 갱신

- [ ] **Step 1:** 다음 문서를 고친다
  - `Learn/05-테마와 브랜딩 동기화.html`: 메타데이터 배포로 테마 적용, `deploy` 2단계, VF
  - `Learn/06-로컬 개발 도구 비교.html`: Storybook과 Live Preview의 역할
- [ ] **Step 2: 커밋.** `[Docs] M6 결과를 학습 자료에 반영 (#N)`

---

## M7 update·동적 검사·문서·발행 (10/16)

### Task 25: `milvus update` (빼는 순서 ①)

**Files:**
- Create: `cli/update.ts`, `tests/update.test.ts`
- Modify: `cli/index.ts`

**Interfaces:**
- Consumes: `managedFiles`, `sha256`(Task 8), `mergeSettings`(Task 10), `readConfig`·`writeConfig`(Task 11)
- Produces: `planUpdate(o: { root: string; pkgRoot: string; config: MilvusConfig }): { replace: string[]; conflicts: { path: string; diff: string }[] }`. `config.vf`를 `managedFiles`에 넘긴다
- Produces: `runUpdate(argv: string[]): Promise<number>`
  - 충돌이 하나라도 있으면 아무것도 바꾸지 않고 1을 돌려준다
  - `--force`면 덮어쓴다
  - 성공하면 `version`과 `managed`를 바꾸고 `settings.json` 병합을 다시 한다

- [ ] **Step 1: 실패하는 테스트**
  - "로컬 수정이 있으면 어떤 파일도 바뀌지 않고 1"
  - "`--force`면 덮어쓰고 sha256 갱신"
  - "`settings.json`에 새 permissions가 더해진다"
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과를 확인한다.** `pnpm test:node`
- [ ] **Step 5: 커밋.** `[Feat] milvus update (#N)`

### Task 26: 동적 반영 검사 페이지 (설계 9.6의 2, 빼는 순서 ⑤)

**Files:**
- Create: `lib/sentinel.ts`, `tests/sentinel.test.ts`, `stories/start/ReflectCheck.stories.ts`
- Modify: `lib/storybook-plugin.ts`(가상 모듈 `virtual:milvus-sentinel`)

**Interfaces:**
- Consumes: `loadRuleContext`, `checkUtilCss`(Task 7), `SPEC_ITEMS`, `BRIDGE_VARS`(Task 8)
- Produces: `buildSentinelUtilCss(ctx: RuleContext, items: SpecItem[]): string`(Node 쪽)
  - 허용된 모든 hook과 브리지 변수에 서로 구별되는 값을 넣는다. 예: 반경 7·9·11px…, hook마다 다른 색상각, 시간 0.777s
  - 결과는 `checkUtilCss`를 통과해야 한다
  - Vite 플러그인이 결과를 `virtual:milvus-sentinel`(`export const sentinelCss: string`)로 페이지에 넘긴다
- 페이지("시작하기/반영 검사")
  - `index.json`의 모든 스토리를 기본 브랜드와 센티널 브랜드로 각각 iframe에 그린다
  - `shadowRoot`를 따라 내려가며 요소마다 `getComputedStyle`을 비교한다(`::before`·`::after` 포함)
  - disabled는 스토리 변형으로, focus는 `focus()`를 부른 뒤에 잰다
  - 결과는 컴포넌트 × 항목 표와 빈틈 목록으로 보여 준다

- [ ] **Step 1: 실패하는 테스트.** "센티널 util.css는 규칙 검사를 통과한다", "센티널 값은 모두 서로 다르다"
- [ ] **Step 2: 실패를 확인한다.** `pnpm test:node`
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 확인한다.** `pnpm test:node`. 수동 확인: Button의 반경과 움직임이 "반영"으로 나오는지 본다
- [ ] **Step 5: 커밋.** `[Feat] 동적 반영 검사 페이지 (#N)`

### Task 27: 문서 정리

**Files:**
- Modify: `README.md`(1·2·4·7·11장), `CLAUDE.md`(2·3·5장), `Learn/00`·`Learn/07`(최종 버전과 update), `package.json`(`version: "0.1.0"`)

- [ ] **Step 1:** 설계 문서의 "이 문서가 대체하는 것" 표대로 README와 CLAUDE.md를 고친다
  - `root.css`, `override.css`, `create-project.mjs`, hook H2·H7·H8 언급을 바꾼다
  - 설계 문서와 이 계획을 링크한다
- [ ] **Step 2: 확인한다.** `pnpm lint && pnpm test && pnpm build-storybook && node scripts/check-learn.ts`
- [ ] **Step 3: 커밋.** `[Docs] README·CLAUDE.md·학습 자료를 패키지 설계 기준으로 정리 (#N)`

### Task 28: 설계 문서 마무리와 최종 발행 (발행은 사용자 승인 필요)

- [ ] **Step 1:** 실행 중에 확인한 결과를 설계 13·14장에 반영한다. 계획과 달라진 결정은 해당 장에도 반영한다
- [ ] **Step 2:** M7 PR을 만들고, CI가 통과하면 Squash로 병합한다. 병합은 사용자가 요청할 때 한다
- [ ] **Step 3: 승인을 요청한다.**
  - `main` 최신 커밋에 `git tag v0.1.0`을 붙인다
  - `git push origin v0.1.0`을 보여 주고, 승인을 받은 뒤 push한다
  - `gh run watch`로 확인한다
  - `learndoshare_2`에서 레지스트리 버전으로 다시 설치하고 `pnpm milvus --version`을 확인한다
- [ ] **Step 4:** 내용을 동결한다. 이후에는 발표 준비만 한다

---

## 빼는 순서 (설계 12장)

일정이 밀리면 아래 순서대로 뺀다.

1. Task 25 (`update`)
2. Task 24 (VF). 빼면 `init`의 기본을 VF 없음으로 바꾼다
3. skill의 Figma·URL 입력 문단
4. `init --from-org`
5. Task 26 (동적 반영 검사)
6. Task 16 (개체 아이콘 색 브리지)
7. Task 21의 원본 탭
8. 명세 페이지 저장 (채팅 입력으로 대체)
9. 손대지 않는 기존 Storybook 파일의 TS 전환

**절대 빼지 않는 것:**
- Task 0 (학습 자료 기초)
- Task 1·2 (설치)
- Task 7 (규칙), 11 (`init`), 12 (`check`)
- Task 14 (정적 검사), 15 (브리지)
- Task 17·18·19 (Storybook과 명세 페이지)
- Task 20 (skill), 22 (`deploy`)
