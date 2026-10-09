# 밀버스 디자인 시스템 패키지·CLI 설계

- 작성: 2026-10-08 · 이슈 [#20](https://github.com/a40418a/learndoshare/issues/20)
- 상태: 대화에서 설계 1/4~4/4 승인(2026-10-08). 검토자 4명의 지적 48건 반영. 문서 전체는 사용자 검토 대기
- 이 문서에서 **LEX**는 Lightning Experience, **VF**는 Visualforce를 뜻한다
- 용어: **발행**은 패키지를 GitHub Packages에 올리는 것, **배포**는 메타데이터를 Salesforce org에 올리는 것(`pnpm milvus deploy`)이다. **브랜드 명세 페이지**는 Storybook 화면, **브랜드 요청**은 그 페이지가 저장하는 사용자 입력(`milvus-brand-request.md`), **브랜드 명세 표**는 Claude가 채팅으로 제안하는 적용 값 표다

### 이 문서가 대체하는 것

| 이전 계획 (README, CLAUDE.md) | 이 문서에서 |
| --- | --- |
| `brands/<브랜드>/root.css`, `override.css` | `staticresources/milvusBrand.css` (util.css). hook으로 안 되는 모양은 opt-in `staticresources/milvusOverride.css` (10/9 결정) |
| `scripts/create-project.mjs` | `pnpm milvus init` |
| `pnpm sync:theme` (org → 저장소) | `pnpm milvus init --from-org` (sf 조회). 디자인 시스템 저장소의 데모 브랜드에는 계속 쓴다 |
| hook H7 (관리 파일 직접 수정 차단) | `permissions.deny` |
| hook H2 (sf 데이터 변경·`apex run` 차단) | `permissions.ask` |
| hook H8 (세션 시작 안내) | 두지 않는다. `CLAUDE.md`가 불러오는 `milvus-design.md`가 같은 안내를 한다 |
| hook H4 (스타일 린트, 편집마다) | hook 1개: `pnpm milvus check --style` (정규식 수준, 0.2초 안) |

CLAUDE.md 2장(사다리보다 우선하는 결정)과 README 11장은 구현 첫 PR에서 이 표에 맞게 고친다.

---

## 0. 목표와 성공 기준

**목표:** 어떤 Salesforce 프로젝트든 pnpm으로 밀버스 디자인 시스템을 설치하고, 자연어로 브랜드를 입력해 Storybook에서 확인한 뒤, 명령 하나로 org에 적용한다. 핵심 가치는 **각 프로젝트에 얼마나 쉽게 적용되는가**, 그리고 **브랜드가 버튼 같은 일부가 아니라 모든 컴포넌트에 반영되는가**다.

**흐름**

```
0. 설치 전 준비 (개발자마다 한 번)
   - GitHub에서 read:packages 권한의 classic 토큰을 만들어 셸 환경변수 NODE_AUTH_TOKEN에 넣는다
   - ~/.npmrc(또는 프로젝트 .npmrc)에 두 줄을 넣는다
       @a40418a:registry=https://npm.pkg.github.com
       //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
1. pnpm add -D @a40418a/milvus-design-system
2. pnpm milvus init --target-org <별칭> --brand <이름>     (또는 --from-org)
3. pnpm milvus storybook        → 브랜드 명세 페이지에 항목별·전체 요청 입력 → 저장
4. Claude Code: "브랜드 요청 반영해줘"  → 브랜드 명세 표 제안 → 승인 → 파일 작성 → check → 화면 갱신
5. pnpm milvus deploy           → 배포 계획 확인 → 채팅 승인 → pnpm milvus deploy --yes
```

**성공 기준:** 새 SFDX 프로젝트(`learndoshare_2`)에서 위 흐름이 막힘 없이 org 화면(LEX)까지 이어지고, 브랜드 값이 9장의 자동 확인에서 모든 컴포넌트에 반영된다. VF는 11장 빼는 순서 ②까지 포함한다.

**범위 밖:** 브랜드 글꼴, 앱 전체에 util.css를 거는 유틸리티 바 로더, Figma REST API, Claude Code 플러그인 마켓플레이스, VF 안에서 밀버스 LWC 사용(Lightning Out), 다크 모드.

---

## 1. 지금까지의 결정과 근거

| 날짜 | 결정 | 근거 |
| --- | --- | --- |
| 10/7 | 브랜드 모양은 util.css 파일 하나로 관리한다 (#11) | 이 파일만 고치면 `lightning-*`까지 바뀐다 |
| 10/8 | Storybook은 org처럼 모든 LWC를 synthetic shadow로 그린다 (#16) | org 실측: 기본 컴포넌트가 전부 synthetic이다 |
| 10/8 | util.css에서 컴포넌트 hook(`--slds-s-*`) 중 색이 아닌 것을 허용한다 (#18, PR #19) | 지금 org에서 닿는다. native로 바뀌면 효과가 사라질 수 있다는 것을 알고 택했다 |
| 10/8 | 패키지는 GitHub Packages에 비공개로 발행하고, CLI·템플릿·LWC·Storybook을 패키지 하나에 담는다 | 프로젝트에 추가되는 의존성은 하나다 |
| 10/8 | 밀버스 LWC는 하위 폴더 없이 `force-app/main/default/lwc/milvus*`에 둔다. Apex는 `classes/utils/design/`에 둔다 | `lwc/utils/<번들>`처럼 폴더를 한 단계 더 두면 변환할 때 번들 이름이 `utils`로 잡혀 배포할 수 없다(로컬 변환으로 확인). 실제 프로젝트의 공용 컴포넌트(`utilScript` 등)도 `lwc/` 바로 아래에 두고 배포한다 |
| 10/8 | 브랜드 색은 메타데이터(`BrandingSet`)로 관리하고 배포로 적용한다 | org 실측: 테마 생성, 활성화, 복구가 모두 배포로 된다 |
| 10/8 | Storybook, CLI, 스크립트, LWC를 TypeScript로 쓴다 | 사용자 요청. LWC `.ts` 직접 배포를 org에서 확인했다 |
| 10/8 | VF에도 같은 디자인 시스템을 적용한다 | 사용자 요청. 10/8 프로브에서 `<apex:slds/>`가 SLDS 1로 그려져 SLDS 2 리소스를 따로 둔다. 공식 SLDS 2 설정 경로(14장)가 확인되면 다시 정한다 |
| 10/8 | 피드백 색(성공·경고·오류·정보)은 입력한 색 그대로 넣고 대비를 검사한다 | 사용자 선택 |
| 10/8 | 글꼴은 바꾸지 않는다 | 사용자 선택 |
| 10/8 | 브랜드는 버튼 같은 일부가 아니라 모든 컴포넌트에 반영되어야 한다 | 사용자 요구. 9장의 전 컴포넌트 분석과 자동 확인으로 지킨다 |
| 10/8 | 전 컴포넌트 분석에 따라 util.css 허용 범위를 넓힌다(중립 색, 포커스 그림자 조건부, 기본 컴포넌트가 읽는 s hook, 색 s hook 6개, `letter-spacing`) | 이전 규칙으로는 바탕·면·글자·테두리 같은 중립색 요청을 하나도 들어줄 수 없었다(9.1) |
| 10/8 | 모든 방법을 써도 바꿀 수 없는 항목은 "Salesforce 고정" 목록(9.4)으로 두고 화면과 발표에 표시한다 | 사용자 합의 |
| 10/8 | hook이 없는 항목(움직임 등)에 한해 Salesforce 클래스를 덮어쓰는 규칙을 제한적으로 허용한다. 이 규칙은 패키지의 `milvusBridge.css`에만 두고 밀버스 변수를 읽게 한다 | 사용자 선택(C). synthetic인 지금 org에서는 동작할 것으로 본다(10/8 프로브는 hook만 쟀고 클래스 규칙은 재지 않음 — 14장, 10/12 측정). native 전환·업데이트 때 깨질 수 있어 자동 확인으로 감시한다 |
| 10/9 | **기본 우선.** 기본 상태는 Salesforce 기본 모양에 브랜드 색·로고(BrandingSet, 공식 기능)만 바꾼 것이다. `init` 직후 util.css(`milvusBrand.css`)는 비어 있고, 브랜드 요청이 있을 때만 util.css와 브리지 변수로 모양을 바꾼다. VF는 모양을 바꾸지 않아도 `milvusVf`(SLDS 2 + 팔레트)로 LEX와 맞춘다 | 사용자 선택. util.css는 공식 권고 밖이라 필요할 때만 쓴다. VF가 LEX와 다른 원인은 SLDS 1이지 util.css가 아니다 |
| 10/9 | **opt-in override.** 기존 컴포넌트(`lightning-button` 등)의 모양을 hook·브리지로 바꿀 수 없으면, 새 밀버스 컴포넌트를 만들지 않고 프로젝트 소유 `milvusOverride.css`의 클래스 규칙으로 바꾼다. 공식 권고 밖임을 알고 쓴다. 밀버스 컴포넌트는 기능이 없을 때만 만든다(기존 `milvusButton`은 비교 예시로 유지). 비권고 이유와 실험은 Learn 09에 정리한다 | 사용자 요청. 모양만 바꾸려고 컴포넌트를 새로 만드는 것은 비효율적이다. 지금 org는 synthetic이라 클래스 규칙이 닿을 것으로 본다. 10/8 프로브는 `:root`의 hook 두 개만 넣었고 클래스 규칙은 넣지 않았다. 이 판단은 10/7 synthetic 실측과 LWC 개발자 가이드 Mixed Shadow Mode 설명에서 나온 것이다(**미확인**, 2026-10-09 정정, Learn 09 2절). native 전환·마크업 변경 때 깨질 수 있다는 것을 발표에서 직접 보여 준다 |
| 10/9 | SLDS 2(Cosmos) org를 기준으로 한다. SLDS 1 테마 org 지원은 발표 뒤 검토한다(#22) | 사용자 선택. SLDS 1은 컴포넌트 hook(`--slds-c-*`)이 공식이고 VF가 그대로 맞는 장점이 있지만, org 테마는 고객사가 고르는 설정이고 새 org 기본은 SLDS 2다(Essentials 제외). 지금까지의 실측·Storybook·팔레트가 모두 SLDS 2 기준이다 |

---

## 2. 패키지 구성과 발행

- 이름 `@a40418a/milvus-design-system`. GitHub Packages는 `@범위/이름` 형식만 받는다. 회사 GitHub 조직으로 옮기면 `@조직명/...`으로 바꾼다
- 원본은 이 저장소의 `learndoshare_1/`다. `package.json`에서 `private`를 지우고 `publishConfig.registry`와 `repository`를 넣는다. 패키지에 넣을 파일은 `files`로 정한다
- `engines.node`는 `^22.18.0 || >=23.6.0`이다(`.ts`를 그대로 실행하는 버전)

| 패키지에 넣는 것 | 용도 |
| --- | --- |
| `dist/` | CLI와 Storybook용 스크립트를 JS로 빌드한 것. Node는 `node_modules` 안의 `.ts` 실행을 거부한다. `bin: { "milvus": "dist/cli/index.js" }` |
| `templates/` | 프로젝트에 복사할 원본(3장의 밀버스 관리 파일과 틀). VF 관련 파일은 "선택 항목"으로 표시한다 |
| `force-app/main/default/lwc/milvus*/` | 밀버스 LWC (`.ts`). `__tests__`는 넣지 않는다. `files`에는 `force-app/main/default/lwc/milvus*/*`와 `!force-app/**/__tests__`로 쓴다(`milvus*`로 쓰면 pnpm 10.13.1이 부정 패턴을 적용하지 못한다, 10/9 실측) |
| `force-app/main/default/classes/utils/design/` | 밀버스 Apex (생기면) |
| `.storybook/`, `stories/`, 미리 만든 카탈로그 | 프로젝트 모드 Storybook |

- `prepack`이 `tsc`(dist)와 SLDS 카탈로그 생성을 실행한다
- 의존성: Storybook, Vite, Rollup, `@lwc/*`, `lwc`, `lightning-base-components`, `@salesforce-ux/design-system-2`, `@salesforce/lightning-types`, `typescript`는 `dependencies`다. ESLint, Jest, husky는 `devDependencies`다
- 발행: 태그 `v*`를 붙이면 GitHub Actions가 `GITHUB_TOKEN`(`packages: write`)으로 발행한다. 발행은 **두 번만** 한다. 10/12의 `v0.0.1`은 설치 경로 확인용이고, 10/16에 최종 버전을 발행한다. 그 사이 리허설은 `pnpm pack`으로 만든 tgz를 `pnpm add -D <tgz>`로 설치해 반복한다
- 디자인 시스템 저장소의 `brands/`(밀버스, Sample_Forest)는 저장소 Storybook의 다중 브랜드 데모용으로 남긴다

---

## 3. `init` 후 프로젝트에 생기는 파일

표시: **[관리]** 밀버스 관리 파일(직접 고치지 않음, sha256 기록, `update`가 갱신) · **[소유]** 프로젝트 소유(skill과 사람이 고침) · **[생성]** CLI가 만드는 파일(직접 고치지 않음)

```
milvus-design.md                                   [관리] 세팅 안내서이자 Claude 규칙
CLAUDE.md                                          [소유] @milvus-design.md 한 줄 추가 (없으면 이 한 줄로 생성)
milvus.config.json                                 [생성] 패키지 버전, 브랜드, 대상 org, 밀버스 관리 파일 목록과 sha256
milvus-brand-request.md                            [소유] 브랜드 명세 페이지가 저장 (처음에는 없음)
package.json                                       [소유] "storybook": "milvus storybook" 스크립트 추가 (없을 때만)
.claude/settings.json                              [소유] permissions와 hook 병합 (7.2)
.claude/skills/milvus-brand/SKILL.md               [관리] 브랜드 입력 skill
.claude/hooks/milvus-check.mjs                     [관리] util.css·브랜드 메타데이터 수정 후 check --style
.gitignore                                         [소유] .milvus/ 줄 추가
.forceignore                                       [소유] **/tsconfig.json, **/__tests__/** 줄 추가 (.ts는 배포하므로 넣지 않음)
.npmrc                                             [소유] 범위 두 줄이 없으면 추가 (0장 준비를 팀원과 공유)
sfdx-project.json                                  [소유] "defaultLwcLanguage": "typescript" (키가 없을 때만)
force-app/main/default/
  lwc/milvusBadge/, milvusButton/, milvusMultiSelect/ …   [관리] 밀버스 컴포넌트 (.ts)
  lwc/milvusScript/                                [관리] 공용 함수 (loadBrand 등)
  lwc/tsconfig.json                                [관리] 패키지의 기본 설정을 extends
  classes/utils/design/                            [관리] Apex (생기면)
  components/milvusHead.component (+meta)          [관리, 선택] VF 페이지용
  brandingSets/LEXTHEMING<이름>.brandingSet-meta.xml      [소유] 브랜드 색·로고 ← 색의 원본
  lightningExperienceThemes/<이름>.lightningExperienceTheme-meta.xml   [소유] defaultBrandingSet = LEXTHEMING<이름>
  staticresources/milvusBrand.css (+meta)          [소유] util.css ← 모양과 피드백 색, 밀버스 변수 값의 원본
  staticresources/milvusBridge.css (+meta)         [관리] hook이 없는 항목을 밀버스 변수로 잇는 클래스 규칙 (5.6)
  staticresources/milvusOverride.css (+meta)       [소유] opt-in 클래스 규칙. 처음엔 비어 있음, 공식 권고 밖 (5.1)
  staticresources/milvusVf.css (+meta)             [생성, 선택] VF용 SLDS 2 + 팔레트. deploy·check가 만들고 커밋한다
  contentassets/<이름>Logo.asset (+meta)           [소유] 로고를 주면
```

- Storybook 설정은 패키지 안에 있어서 프로젝트에 Storybook 파일이 생기지 않는다. `init` 직후 `pnpm milvus storybook`(또는 `pnpm storybook`)으로 바로 확인한다
- 이미 있는 파일은 덮어쓰지 않고 건너뛴 뒤 목록으로 알려 준다. 예외로 다음 파일은 기존 내용에 더한다: `.claude/settings.json`(설정 병합), `.gitignore`·`.forceignore`·`.npmrc`(줄 추가), `CLAUDE.md`(`@milvus-design.md` 한 줄 추가, 따옴표와 백틱 없이), `package.json`·`sfdx-project.json`(키가 없을 때만 추가). 다시 실행해도 결과가 같다
- `LightningExperience.settings`(활성 테마)는 만들지 않는다. `deploy`가 그때그때 `.milvus/deploy/`에 `activeThemeName` 한 필드만 담아 만든다. 프로젝트에 같은 이름의 파일이 있어도 쓰지 않는다
- `milvusVf.css`는 생성 파일이지만 커밋한다. `milvusHead`가 이 리소스를 참조하므로, 팀원이 프로젝트 전체를 배포할 때 리소스가 없어 실패하는 일을 막는다. 전체 `check`가 지금 브랜드 색으로 다시 만든다
- Claude의 파일 도구는 `permissions.deny`로 [관리] 파일을 고치지 못한다. 다른 경로로 바뀐 것은 `check`의 sha256 비교가 잡는다

---

## 4. 명령

`package.json`에 스크립트가 없어도 `pnpm milvus <명령>`으로 실행된다(로컬 확인). 실패하면 0이 아닌 종료 코드로 끝내고, 무엇이 왜 틀렸는지와 고칠 값을 한국어로 알려 준다.

### 4.1 `init --target-org <별칭> (--brand <이름> | --from-org) [--no-vf]`
1. 사전 점검. 하나라도 실패하면 아무것도 쓰지 않고 멈춘다
   - `sfdx-project.json`이 있고 기본 패키지 폴더가 `force-app`이다
   - Node 22.18 이상(23.x는 23.6 이상)
   - `sf` CLI가 설치되어 있고 `<별칭>` org에 로그인되어 있다
   - `.claude/settings.json`이 있으면 올바른 JSON이다
   - `--brand`와 `--from-org` 중 정확히 하나만 있다
2. `<이름>` 규칙: `^[A-Za-z][A-Za-z0-9_]*$`, `__`를 쓰지 않고 `_`로 끝나지 않는다. 한글은 쓸 수 없다
3. `--brand`: 3장의 브랜드 파일을 Salesforce 기본색(`#0176D3`)으로 만든다
4. `--from-org`: `Settings:LightningExperience`로 활성 테마 이름을 먼저 읽는다. 그 테마의 `LightningExperienceTheme`, `BrandingSet`, 로고 `ContentAsset`만 임시 폴더로 받아 검증한 뒤 프로젝트에 복사하고 그 이름을 그대로 쓴다. 커스텀 테마가 없거나 조회가 실패하면 아무것도 쓰지 않고 멈춘다
   - `--no-vf`면 VF 파일(`milvusHead`, `milvusVf`)을 만들지 않는다. 기본은 포함한다(`milvus.config.json`의 `vf`)
5. 3장의 나머지 파일을 만들고, `milvus.config.json`에 대상 org, 브랜드, 밀버스 관리 파일 목록과 sha256을 기록한다

### 4.2 `storybook [--build <폴더>]`
- CLI가 `MILVUS_PROJECT_DIR=<sfdx-project.json이 있는 절대 경로>`를 넘기고, 패키지 안의 설정으로 Storybook을 띄운다
- 패키지 안의 설정은 `.storybook/`(원본 `.ts`)이다. 컴파일하지 않고 그대로 발행한다(Task 3 스파이크, 13장). 띄우는 방법은 세 가지를 지킨다
  - storybook 실행 파일은 프로젝트가 아니라 패키지 기준으로 찾는다
  - `-c`에는 패키지 `.storybook/`의 실제 경로(realpath)를 넘긴다. pnpm의 심볼릭 링크 경로(`node_modules/@a40418a/...`)를 넘기면 미리보기가 빈 화면이 된다
  - `--host localhost`로 띄운다. 기본은 모든 네트워크 주소에서 듣는데, `server.fs.allow`에 프로젝트 폴더가 들어가므로 프로젝트 파일이 같은 네트워크에 열린다(다른 PC에서 직접 재지는 않았다)
- `.storybook/main.ts`는 `server.fs.allow`에 `searchForWorkspaceRoot(root)`와 프로젝트 폴더를 함께 넣는다(`allow`를 직접 주면 Vite 기본값이 빠진다)
- 브랜드: `milvus.config.json`의 브랜드 이름으로 `brandingSets/LEXTHEMING<이름>`을 읽는다. `BRAND_COLOR` → 팔레트 계산 → `--slds-r-color-brand-*`. `milvusBrand.css`는 문서에 넣는다. 로고는 사이드바에 쓴다. 비교용으로 "SLDS 기본" 브랜드도 함께 고를 수 있다
- 내용: SLDS 컴포넌트 카탈로그(공식 예제, 73개 컴포넌트, 패키지에 미리 만들어 넣음), 밀버스 컴포넌트(프로젝트 사본으로 그림), 브랜드 명세 페이지(6장), Foundations(색, 영향 지도), 컴포넌트별 "Salesforce 원본과 읽는 hook" 보기(9.5), 반영 검사 페이지(9.6)
- LWC 빌드: Rollup 앞에서 `typescript.transpileModule`로 타입만 지운다(LWC 컴파일러는 TS를 직접 읽지 못한다). npm에 없는 플랫폼 모듈은 대신하는 모듈로 바꾼다: `lightning/platformResourceLoader`의 `loadStyle`은 바로 끝나는 함수, `@salesforce/resourceUrl/*`은 경로 문자열. 결과는 `.milvus/`에 둔다
- 브랜드 메타데이터가 없거나 util.css가 규칙을 어기면 SLDS 기본 브랜드로 띄우고 화면 위에 오류를 보여 준다
- 대체 경로: `node_modules` 안의 설정으로 띄우는 것이 안 되면 `init`이 `.storybook/`을 프로젝트에 복사한다. Task 3 스파이크에서는 필요하지 않았다. 14장의 남은 확인 항목이 실패할 때만 쓴다

### 4.3 `check [--style]`
- `--style`(hook이 실행): util.css 규칙(5.2)과 피드백 색 대비(5.3)만 본다. 정규식 수준이라 빠르다. 실패하면 종료 코드 2와 함께 고칠 값을 stderr로 낸다. `milvusOverride.css`는 5.1의 경고만 내고(종료 코드 0) `@font-face`·`@import`만 실패시킨다
- 전체(deploy와 CI가 실행): `--style` 항목 + `milvusVf.css`를 지금 `BRAND_COLOR`로 다시 만듦(VF 사용 시) + 밀버스 관리 파일 sha256 비교 + 타입 검사(`lwc/milvus*`만, 패키지의 프로젝트용 tsconfig로 `tsc --noEmit`)
- sha256이 다르면 `pnpm milvus update --force`로 되돌리라고 안내한다

### 4.4 `deploy [--target-org <별칭>] [--yes]`
1. 대상 org: `--target-org` → `milvus.config.json` 순서로 정한다. sf 기본 org는 쓰지 않는다. 정해지지 않으면 로그인된 org 목록을 보여 주고 멈춘다
2. 전체 `check`를 실행한다. 실패하면 멈춘다. 이때 `milvusVf.css`를 다시 만든다(SLDS 2 `slds2.cosmos.css` + `BRAND_COLOR`로 계산한 팔레트, CSS 한 파일, `text/css`)
3. `sf`가 없거나 대상 org 로그인이 만료되었으면 멈춘다
4. **계획 출력:** 대상 org, 지금 활성 테마 → 새 활성 테마, 배포 목록, 경고("활성 테마 변경은 org 전체 사용자 화면에 적용됩니다"). `--yes`가 없으면 여기서 끝난다. 사람이 터미널에서 실행했고 `--yes`가 없으면 y/N을 묻는다
5. `--yes`면 밀버스 관련 메타데이터만 한 번의 배포로 올린다(프로젝트 전체를 배포하지 않는다): 밀버스 LWC, Apex, `milvusBrand`, `milvusBridge`, `milvusOverride`, `BrandingSet`, 테마, 로고, VF 사용 시 `milvusVf`·`milvusHead`. 배포는 원자적이라 하나라도 실패하면 전부 롤백된다
6. 5가 성공했을 때만 `.milvus/deploy/settings-mdapi/`(mdapi 형식: `package.xml` + `settings/LightningExperience.settings`, `activeThemeName` 한 필드)를 만들어 `--metadata-dir`로 배포한다. 5가 실패하면 실패 항목과 이유를 보여 주고 활성화하지 않는다
7. 확인용 명령 `sf org open --target-org <별칭> --path <경로>`를 출력한다(실행하지 않음. `--url-only`는 토큰이 든 주소를 출력하므로 쓰지 않는다). LEX 테마 색은 새로고침 뒤에 반영된다(실측)

### 4.5 `update [--force]`
- 설치된 새 버전의 밀버스 관리 파일을 반영한다. **전부 반영하거나 아무것도 바꾸지 않는다.** 로컬에서 고친 밀버스 관리 파일이 하나라도 있으면 차이를 보여 주고 아무것도 바꾸지 않은 채 종료 코드 1로 끝난다
- `--force`는 로컬 수정을 패키지 원본으로 덮어쓴다. 같은 버전에서 원래대로 되돌릴 때도 쓴다
- `.claude/settings.json`은 `init`과 같은 병합을 다시 한다(새 버전이 추가한 permissions·hook 반영)
- 성공하면 `milvus.config.json`의 버전과 sha256을 함께 바꾼다

---

## 5. 브랜드 스타일 계층

### 5.1 어디에 무엇을 두는가

| 계층 | 원본 | org에 적용되는 방식 |
| --- | --- | --- |
| 브랜드 색, 로고 | `BrandingSet` (`BRAND_COLOR`, `BRAND_IMAGE`) | 테마 배포 + 활성화. LEX, Setup, VF(`<apex:slds/>`)에 반영됨(실측) |
| 모양, 피드백 색, 밀버스 변수 값 | `milvusBrand.css` (util.css) | LEX: 밀버스 컴포넌트가 `loadStyle`로 문서에 넣는다. VF: `milvusHead` |
| hook이 없는 항목(움직임 등) | `milvusBridge.css` (패키지 제공, 밀버스 변수를 읽음) | `milvusBrand`와 같은 경로로 함께 넣는다 |
| hook·브리지로 안 되는 모양 (opt-in) | `milvusOverride.css` (프로젝트 소유, 처음엔 비어 있음, 클래스 규칙) | `milvusBrand` 다음, 마지막에 넣는다 |
| 밀버스 컴포넌트 | `lwc/milvus*` | 배포. 기능이 없을 때만 만든다 |

- 브랜드 요구가 들어오면 org 테마(색·로고) → util.css의 global hook(전체 모양) → util.css의 컴포넌트 hook(특정 컴포넌트) → 브리지 변수(hook이 없는 항목) → `milvusOverride.css`(마지막 수단, 공식 권고 밖) 순으로 제안한다. override를 쓸 때는 그 규칙이 native 전환·Salesforce 업데이트에 약하다는 것을 사용자에게 알린다. 모양만 바꾸려고 밀버스 컴포넌트를 새로 만들지 않는다
- `milvusOverride.css` 규칙(`check --style`은 막지 않고 경고): hex 색(브랜드 색은 org 테마가 원본), `!important`, `.slds-*`가 아닌 선택자, 브랜드 색(accent) hook 재정의를 경고한다. `@font-face`·`@import`는 실패(글꼴은 바꾸지 않는다)
- 헤더 색(`HEADER_BACKGROUND_COLOR`)은 공식 문서상 SLDS 1에서만 쓰여서 다루지 않는다
- 로고: `BRAND_IMAGE` = `/file-asset/<이름>Logo?v=1`

### 5.2 util.css 규칙 (`check --style`이 검사)

util.css에는 `:root` 블록 하나만 둔다. 클래스 규칙과 `@font-face`는 쓰지 않는다(클래스 규칙은 5.6의 `milvusBridge.css`에만). 9장의 전 컴포넌트 분석 결과로 허용 범위를 넓혔다.

| 허용 | 조건 |
| --- | --- |
| `--slds-g-*` 중 이름에 `color`가 없는 것 (반경, 간격, 크기, 테두리 두께, 글자 크기·굵기·줄 간격, 그림자 `-1`~`-4`와 방향형) | `--slds-g-font-family*`는 금지(글꼴은 바꾸지 않음). 그림자를 없앨 때도 `--slds-g-shadow-5`·`-6`은 기본값을 따로 적는다(포커스 표시에 쓰임) |
| 포커스 링 그림자 `--slds-g-shadow-*focus*` | 값 안의 색은 `var(--slds-g-color-brand-base-15)`와 `var(--slds-g-color-neutral-base-100)`만 쓴다. hex·rgb 리터럴 금지(색의 원본은 org 테마) |
| 중립 색 `--slds-g-color-*`: `surface*`, `on-surface*`, `border-1/2`, `neutral-base-*`, `disabled*`, `on-disabled*`, `border-disabled*`, `*inverse*`, `palette-neutral-*`, `palette-yellow-80/90` | 값은 `light-dark(라이트, 다크)`로 쓴다. 의미 hook과 `neutral-base` 단계를 함께 정의한다(모드에 따라 읽는 쪽이 다름). 글자·면 쌍은 4.5:1 이상 |
| 기본 컴포넌트 CSS에만 있는 g 이름 5개: `--slds-g-color-border-base-1`, `-4`, `--slds-g-color-neutral-10-opacity-50`, `--slds-g-color-neutral-100-opacity-10`, `-50` | native 전환 대비용. 지금은 효과가 없다 |
| 피드백 색 hook | 5.3의 표에 있는 이름만 |
| `--slds-s-*` 중 이름에 `color`가 없는 것 | **SLDS 2 CSS 또는 기본 컴포넌트 CSS가 `var()`로 읽는 이름**이어야 한다(읽는 곳이 없으면 효과가 없다) |
| 색 `--slds-s-*` 6개: `backdrop-color-background`, `menu-item-color-background-active`, `table-row-color-background-selected`, `navigation-color-background-hover`, `pill-color-background-hover`, `button-color-background-hover` | 값은 중립 g hook만 참조한다. 기본 hover·선택 바탕의 상당수가 브랜드 틴트라서 "회색 hover" 같은 요청을 들어줄 경로다 |
| `--milvus-*` | 밀버스 컴포넌트(`.css`·`.ts`)나 `milvusBridge.css`가 읽는 이름 |
| 상속 속성 `letter-spacing` | 자간 하나만. 다른 일반 속성은 금지 |

| 금지 | 이유 |
| --- | --- |
| 브랜드 색 계열: `--slds-g-color-accent*`, `on-accent*`, `border-accent*`, `brand-base*`, `--slds-r-color-brand*` | 색의 원본은 org 테마다 |
| 위 6개를 뺀 색 `--slds-s-*`, 그 밖의 `--slds-g-color-*` | 브랜드 색에 이어진 것이 많다 |
| `--slds-c-*`, `--sds-c-*` | SLDS 2 지원이 미확인이고 `:root`에 두면 모든 변형을 덮는다. native에서만 메울 수 있는 c hook 목록은 9.2에 준비만 해 둔다 |
| 읽는 곳이 없는 이름, 오타 | 아무 효과 없이 지나간다 |

PR #19의 검사 스크립트, CLAUDE.md 3장, 이 표가 지금 서로 다르다. 10/12에 셋을 이 표로 맞춘다.

### 5.3 피드백 색 (성공·경고·오류·정보)

입력한 글자색과 배경색을 그대로 넣는다. SLDS 2 CSS가 실제로 읽는 hook만 쓴다(설치된 2.264.2에서 확인).

| 종류 | 글자 | 배경 위 글자 | 배경 | 테두리 | hover·active |
| --- | --- | --- | --- | --- | --- |
| 성공 | `success-1` | `on-success-1` | `success-container-1` | `border-success-1` | `success-container-2` |
| 경고 | `warning-1` | `on-warning-1` | `warning-container-1` | 없음 (`border-warning-1`은 읽는 곳이 없음) | — |
| 오류 | `error-1` | `on-error-1` | `error-container-1` | `border-error-1` | `error-container-2`, `border-error-2` |
| 정보 | 없음 (`info-1`은 읽는 곳이 없음) | `on-info-1` | `info-container-1` | 없음 (`border-info-1`은 없는 이름) | — |

(hook 이름 앞의 `--slds-g-color-`는 생략했다)

- 테두리는 따로 정하지 않으면 글자색을 따른다(성공·오류만)
- hover·active hook은 입력한 배경색에서 같은 색조의 한 단계 진한 색을 계산해 넣는다
- 대비 검사: 글자색이 배경색 위와 흰색 위에서 모두 4.5:1 이상이어야 한다. 미달이면 막고, 같은 색조에서 기준을 넘는 색(우리 팔레트 규칙의 40단계)을 제안한다
- 참고: SLDS 기본 피드백 팔레트는 40단계 글자가 90단계 배경 위에서 약 5.3:1, 흰색 위에서 약 6.7:1이다

### 5.4 브랜드 색과 접근성
- Salesforce는 입력한 브랜드 색 대신 접근성 색(50단계)을 버튼에 쓴다. 이 색은 색상각을 유지하고, 명도를 L* 49로 맞추고, 채도를 다시 계산한 색이다. 그래서 흰 글자 대비가 모든 색에서 4.62~4.68:1이라 기준을 항상 넘는다. 막지 않고 설명한다
- skill과 명세 페이지는 입력한 색, 실제 버튼 색(50), 링크 색(40)을 대비와 함께 보여 준다
- "접근성 색 무시(override)" 설정은 넣지 않는다
- 팔레트 자체 검사에 "50·40·30단계는 흰색과 4.5:1 이상"을 추가한다

### 5.5 LEX와 VF에 util.css를 거는 방법
- **LEX:** 밀버스 컴포넌트가 나타날 때 `milvusScript`의 `loadBrand(this)`가 `loadStyle`로 `milvusBridge`, `milvusBrand`, `milvusOverride`를 차례로 문서 head에 넣는다. 같은 페이지의 표준 UI와 `body`에 붙는 모달까지 바뀐다(실측). 프로젝트 컴포넌트도 같은 함수를 부를 수 있다. 커스텀 컴포넌트가 없는 표준 화면에는 테마 색만 적용된다
- **VF:** 페이지에 `<c:milvusHead/>` 한 줄을 넣는다. `milvusHead`는 `milvusVf`, `milvusBridge`, `milvusBrand`, `milvusOverride` 순서로 `<apex:stylesheet>`를 넣는다. `<apex:slds/>`는 10/8 프로브에서 SLDS 1로 그려져 쓰지 않는다. Help에 따르면 User Interface 설정 "Use SLDS 2 for pages that include `<apex:slds>`…"를 켜고 SLDS 2 테마를 쓰면 SLDS 2가 된다(14장, 10/12 확인). 그렇게 되면 `<apex:slds/>` + `milvusBridge`·`milvusBrand`·`milvusOverride`만으로 충분한지 다시 정한다
- 한계: SLDS 2 CSS가 참조하는 기본 아바타 이미지(`../../public/*.png`)는 패키지에 없어 VF에서 보이지 않는다

### 5.6 `milvusBridge.css` — hook이 없는 항목을 잇는 클래스 규칙 (제한적 허용)
- hook이 0개이거나 허용된 hook이 없는 항목만 다룬다. hook이 있는 항목은 계속 hook만 쓴다
- 규칙은 값을 직접 갖지 않고 `--milvus-*` 변수를 읽는다. 기본값은 Salesforce 원래 값이다. 예: `.slds-button { transition-duration: var(--milvus-motion-duration-fast, 0.1s); }`. 브랜드가 변수를 정하지 않으면 화면이 바뀌지 않는다
- 브랜드는 `milvusBrand.css`의 `:root`에 `--milvus-*` 변수 값만 정한다
- 패키지가 SLDS 2 CSS와 기본 컴포넌트 원본에서 하드코딩 위치를 찾아 생성하고, [관리] 파일로 프로젝트에 복사한다. Salesforce가 구조를 바꾸면 다시 생성해 `update`로 퍼뜨린다

| 항목 | 대상 (예) | 근거 |
| --- | --- | --- |
| 움직임 시간·곡선 | `.slds-button`, `.slds-modal`, `.slds-backdrop`, `.slds-dropdown`, `.slds-popover`, 토글, path | SLDS 2의 transition·animation 217선언이 모두 값을 직접 쓴다. `--slds-g-duration-*`는 정의만 있고 읽는 곳이 0이다 |
| 줄인 움직임 | `@media (prefers-reduced-motion: reduce)` | 처리하는 곳이 SLDS 2 CSS 1곳, 기본 컴포넌트 CSS 0곳. 브랜드 선택이 아니라 항상 켜 두는 접근성 규칙으로 넣는다 |
| 컨트롤 높이 | `.slds-button`, `.slds-input`, `.slds-input_faux`, `.slds-select`, `.slds-radio_button`, `.slds-checkbox_button` | `line-height: 1.875rem` 고정 |
| 입력창 테두리 두께 | `.slds-input`, `.slds-textarea` | `1px` 고정 |
| Path 양 끝 반경 | `.slds-path__item:first-child`, `:last-child` | `2rem` 고정 |
| 자간 | `button`, `input`, `select`, `textarea` | 브라우저 기본값으로 다시 초기화되어 상속이 끊긴다 (추정) |
| 영문 대문자 제목 | `.slds-text-title_caps`, `.slds-section-title_divider` | `text-transform: uppercase` 고정 |
| 선택지 라벨 굵기 | `.slds-radio`, `.slds-checkbox`의 라벨 | `font-weight: normal` 고정 |
| 커서, 링크 밑줄 | 비활성 요소, `a:hover` | cursor 78선언, 밑줄 14선언이 값을 직접 쓴다 |
| 팝오버 꼬리 그림자 | `.slds-nubbin_*::after` | 내부 전용 hook(`--_slds-*`)만 있다 |
| 개체 아이콘 배경색 | `.slds-icon-standard-*` 등 973개 | 클래스마다 원래 색을 기본값으로 갖는 규칙을 생성한다 |
| 컨트롤 안 아이콘 크기 | `.slds-button__icon`, `.slds-input__icon` | `0.875rem` 고정 |
| 모달 너비 (원할 때만) | `.slds-modal__container` | 40 / 52.0625 / 75rem 고정 |

- **넣으면 안 되는 값:** 모달과 토스트는 움직임이 끝나는 이벤트(`transitionend`, `animationend`)를 기다려 닫힌다. 시간을 `0s`나 `none`으로 만들면 닫히지 않을 수 있어 최솟값은 `0.01ms`다. 스피너는 점별 지연이 1000ms 기준이라 시간을 바꾸면 순서가 어긋나므로 줄인 움직임 켜기·끄기만 다룬다
- **위험:** 브리지는 지금 org(synthetic)에서 닿지만, 기본 컴포넌트가 native로 바뀌면 그 컴포넌트 안에는 닿지 않는다. 브리지 항목은 명세 페이지와 Storybook에 "native 전환 시 잃음"으로 표시하고 9.6의 검사로 감시한다

---

## 6. 브랜드 명세 페이지와 `milvus-brand` skill

### 6.1 브랜드 명세 페이지 ("시작하기 / 브랜드 명세")

| 항목 | 설명 | 지금 값 (미리보기) | 입력 |
| --- | --- | --- | --- |
| 브랜드 색 | 버튼·링크에 쓰는 색 | 입력 색, 실제 버튼 색(50), 링크 색(40), 대비 | 자연어 |
| 로고 | org 상단 로고 | 지금 로고 | 파일 경로 |
| 모서리 | 버튼, 입력창, 카드 | 각 반경(px) | 자연어 |
| 밀도 | 버튼·입력·라벨 간격 | 지금 간격 | 자연어 |
| 글자 | 기본 크기, 제목·라벨 굵기 | 13px, 지금 굵기 | 자연어 |
| 피드백 색 | 성공·경고·오류·정보의 글자색·배경색 | 색 견본(Foundations / 컬러와 같은 모양) | 자연어 또는 색 값 |
| 컴포넌트별 조정 | 버튼, 입력창, 카드(반경, 그림자) | 지금 값 | 자연어 |
| 밀버스 컴포넌트 | 예: `milvusButton` 커스텀 모드 | 지금 모드 | 자연어 |
| 9장에서 추가하는 항목 | 9.3 참고 | | |
| 글꼴 | 시스템 글꼴 고정 | 지금 글꼴 | 없음 (표시만) |
| 전체 스타일 | 원하는 전체 느낌 | — | 큰 입력창 |

- 페이지를 열면 기존 `milvus-brand-request.md`를 읽어 입력창을 채운다. 저장하면 모든 입력을 담아 파일 전체를 다시 쓰고, 빈 항목은 생략한다(한 항목만 저장해도 다른 요청이 사라지지 않는다)
- 저장은 Storybook 개발 서버(localhost)에서만 동작한다. Vite 개발 서버 미들웨어가 받아 프로젝트 루트의 `milvus-brand-request.md` 하나에만 쓴다(경로 고정). 정적 빌드에서는 입력창을 비활성화한다
- 대체 경로: 저장이 안 되면 채팅에 요청을 직접 쓴다(6.2의 1번)

`milvus-brand-request.md` 형식:

```markdown
# 브랜드 요청
저장: 2026-10-14 15:20

## 브랜드 색
지금: #0176D3 (버튼 #2976CA, 링크 #1F5DA1)
요청: 신뢰감 있는 딥그린

## 로고
요청: assets/logo.png

## 피드백 색 / 성공
지금: 글자 #056764, 배경 #ACF3E4
요청: 글자 #1B5E20, 배경 #E8F5E9

## 전체 스타일
요청: 각지고 단단한 업무용 느낌, 촘촘하게
```

### 6.2 skill 흐름
1. 입력: `milvus-brand-request.md`, 또는 채팅의 브랜드 설명
2. 브랜드 명세 표를 채팅으로 제안한다. 항목마다 값, 출처, 확정/추정, 반영하지 못하는 요구와 대안을 적는다
3. 사용자 승인
4. 작성: `BrandingSet`(색·로고), `milvusBrand.css`. hook·브리지로 안 되는 모양만 `milvusOverride.css`에 쓰고, 그 항목을 "공식 권고 밖"으로 표시해 알린다
5. `pnpm milvus check`. 통과하면 Storybook이 저절로 갱신된다
6. 반영이 끝나면 요청 파일 맨 위에 `반영: <날짜>`를 적는다. 명세 페이지는 다음에 저장할 때 이 줄을 지운다
7. 배포는 사용자가 따로 요청했을 때만 한다. Claude는 `pnpm milvus deploy`로 계획을 보여 주고, 채팅에서 승인을 받은 뒤 `pnpm milvus deploy --yes`를 실행한다(`permissions.ask`가 한 번 더 묻는다)

### 6.3 자연어 프리셋

| 표현 | 쓰는 hook |
| --- | --- |
| 각진 / 기본 / 둥근 | `--slds-g-radius-border-1`, `-2`, `-4`, `-pill` 세트 3단계 |
| 기본 / 촘촘 | 촘촘이면 `--slds-s-button-spacing-inline`, `--slds-s-button-spacing-block`, `--slds-s-input-spacing`, `--slds-s-label-spacing-gap`을 줄인다 |
| 보통 / 굵게 (제목·라벨) | `--slds-s-container-heading-font-weight`, `--slds-s-pageheader-title-font-weight`, `--slds-s-label-font-weight` |
| 그림자 없이 / 기본 / 깊게 | `--slds-g-shadow-1`~`-4`와 방향형 그림자. `-5`·`-6`은 기본값 유지(포커스 표시). 카드는 `--slds-s-container-shadow` |
| 빠르게 / 기본 / 차분하게 (움직임) | 브리지의 `--milvus-motion-duration-fast`, `-medium`, `-slow`, `--milvus-motion-easing` (5.6) |

(위 hook은 SLDS 2 CSS가 `var()`로 읽는 이름이어야 하며, 구현할 때 `check`의 목록으로 다시 확인한다)

### 6.4 입력 형식 5종 (새 파서 없이 skill 지시로 처리)
- 자연어: 6.3 프리셋으로 바꾼다
- 디자인 토큰 JSON: 색·크기만 뽑는다. 형식 4종(DTCG 2025.10 색 객체, 이전 hex 문자열, Figma export, Figma API 0~1 값)은 `node -e` 한 줄로 변환한다
- Figma: 1순위는 사용자가 받은 "Export modes" JSON, 2순위는 Figma MCP(선택 영역). REST API는 Enterprise 플랜 전용이라 쓰지 않는다
- PDF·이미지: PDF의 hex는 텍스트로 정확히 뽑는다. 이미지에서 읽은 색은 "추정"으로 표시하고 확인을 받는다
- URL: `curl`로 HTML과 CSS를 받아 변수와 색 빈도를 찾는다(WebFetch는 CSS가 빠진다). 로고는 내려받지 않고 사용자에게 받는다

---

## 7. `.claude` 묶음

### 7.1 `milvus-design.md` (프로젝트 루트, 200줄 이하, [관리])
1. 이 프로젝트의 밀버스 설정: 값은 쓰지 않고 "`milvus.config.json`을 본다"고만 적는다(원본을 하나로)
2. 준비물: Node 22.18 이상(23.x는 23.6 이상), pnpm, sf CLI, GitHub 토큰 `NODE_AUTH_TOKEN`, `.npmrc` 두 줄, org 로그인
3. 세팅 순서 체크리스트: `init` → 브랜드 요청 입력 → 반영 → `storybook` 확인 → `deploy`
4. 파일 지도: [관리] / [소유] / [생성] (3장과 같음)
5. 디자인 규칙: 판단 순서, util.css 규칙(5.2), 색은 `BrandingSet`에서만, LWC는 TypeScript, `milvus` 접두사는 밀버스 전용
6. Claude에게 시키는 법: 예시 문장, skill 이름
7. 배포 안전장치: 배포는 `pnpm milvus deploy`로만, 계획 확인 후 `--yes`, 활성 테마는 org 전체에 적용, 테마 반영은 새로고침 후
8. 업데이트와 문제 해결: `milvus update`(`--force`), GitHub 토큰 오류, VF는 `<c:milvusHead/>`, 프로젝트 전체 배포로 `milvusHead`를 올릴 때는 `milvusVf.css`가 커밋되어 있어야 함

### 7.2 `.claude/settings.json` (병합할 내용)

```json
{
  "permissions": {
    "ask": [
      "Bash(pnpm milvus deploy *)", "Bash(pnpm exec milvus deploy *)", "Bash(milvus deploy *)",
      "Bash(./node_modules/.bin/milvus deploy *)", "Bash(sf project deploy *)",
      "Bash(sf data create *)", "Bash(sf data delete *)", "Bash(sf data update *)", "Bash(sf data upsert *)", "Bash(sf apex run *)"
    ],
    "deny": [
      "Bash(sf org display)", "Bash(sf org display *)", "Bash(sf org open --url-only *)",
      "Edit(/force-app/main/default/lwc/milvus*/**)",
      "Edit(/force-app/main/default/lwc/tsconfig.json)",
      "Edit(/force-app/main/default/classes/utils/design/**)",
      "Edit(/force-app/main/default/components/milvusHead.component*)",
      "Edit(/force-app/main/default/staticresources/milvusVf.*)",
      "Edit(/force-app/main/default/staticresources/milvusBridge.*)",
      "Edit(/milvus-design.md)", "Edit(/milvus.config.json)",
      "Edit(/.claude/skills/milvus-brand/**)", "Edit(/.claude/hooks/milvus-check.mjs)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/milvus-check.mjs" }] }
    ]
  }
}
```

- `Edit(...)` 규칙 하나가 파일을 고치는 모든 내장 도구를 막는다. 경로 앞의 `/`는 프로젝트 루트 기준이라는 뜻이다(공식 문서)
- `ask`는 auto 모드에서도 실행 전에 묻는다. 규칙 순서는 deny → ask → allow다(공식 문서)
- hook은 바뀐 파일이 `milvusBrand.css`, `milvusOverride.css`, 브랜드 메타데이터일 때만 `pnpm milvus check --style`을 실행한다
- 저장소 hook H2의 2·3층(개인정보 필드·`FIELDS(ALL)` 조회, 토큰을 출력하는 명령)도 프로젝트에 가져간다(10/9 판정). 토큰을 출력하는 `sf org display`와 `sf org open --url-only`는 `deny`로 막는다. 개인정보 필드와 `FIELDS(ALL)`는 명령 패턴으로 막을 수 없어 `milvus-design.md`의 규칙 문장으로 둔다
- 커밋된 설정의 hook은 팀원에게 별도 동의 없이 실행되므로 hook은 하나만 두고 `milvus-design.md`에 적는다

---

## 8. TypeScript

| 대상 | 방식 |
| --- | --- |
| CLI, 스크립트 | `.ts`. 저장소 안에서는 Node가 그대로 실행한다. 패키지 발행 때 `tsc`로 `dist/`에 JS로 빌드 |
| Storybook 설정, 스토리, 카탈로그 생성 스토리 | `.ts`. Vite가 타입을 지우고, 검사는 `tsc --noEmit`. 기존 파일은 손대는 작업에서 함께 바꾼다(11장) |
| Rollup 결과물 `dist/lwc` | JS + 생성기가 만드는 `.d.ts` |
| 밀버스 LWC와 테스트 | `.ts`, `.test.ts`. org에 `.ts`를 그대로 배포한다 |

- `tsconfig` 핵심: `target: ESNext`(데코레이터를 그대로 둔다), `experimentalDecorators: false`, `strict`. CLI용은 `erasableSyntaxOnly`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`
- 타입: `lwc` 패키지 타입을 쓰면 `@api`에 `// @ts-ignore`가 필요 없다(로컬 확인). 기본 컴포넌트 타입은 `@salesforce/lightning-types`
- `sfdx-project.json`의 `"defaultLwcLanguage": "typescript"`로 VS Code가 TS 컴포넌트를 바로 만든다
- `check`의 `--milvus-*` 수집 대상에 `.ts`를 넣는다(지금 스크립트는 `.css`·`.js`만 본다)
- ESLint가 `.ts`를 검사하도록 10/12에 설정한다. 새 의존성이 필요하면 PR에 이유를 적는다
- **위험과 대체 경로:** 공식 LWC 가이드(Developer Preview)에는 "TS는 배포할 수 없다"고 적혀 있어 org 실측(API 67) 결과와 다르다. Salesforce가 동작을 바꾸면 `deploy`가 배포 직전에 `tsc`로 JS를 만들어 보낸다. 이 대체 경로는 로컬에서 확인했다

---

## 9. 모든 컴포넌트에 브랜드 반영하기

근거는 설치된 SLDS 2 CSS(2.264.2)와 `lightning-base-components`(1.28.19-alpha) 원본이다. 2026-10-08에 선언 17,398개를 분류하고, 항목별 에이전트 8개와 종합 1개로 분석했다. 쓴 hook 이름 150개는 모두 원본에 있는 것을 확인했다. "지금"은 org가 실제로 쓰는 경로(synthetic, SLDS 2 CSS)이고, "native"는 Salesforce가 기본 컴포넌트를 native shadow로 바꾼 뒤의 경로(기본 컴포넌트의 `*.slds.css`)다.

### 9.1 한눈에 보는 표

비율은 그 항목의 선언이 있는 컴포넌트 가운데 **모든 선언이 hook으로 정해지는** 컴포넌트의 비율이다.

| 항목 | 지금 | native | 큰 빈틈 | 메우는 방법 |
| --- | --- | --- | --- | --- |
| 색 (중립 바탕·글자·테두리·비활성·어두운 면) | 88% | 79% | 개체 아이콘 배경(CSS 973곳 + JS 966곳). 의미 hook만 바꾸면 `neutral-base` 단계만 읽는 규칙이 남는다 | 의미 hook과 `neutral-base` 단계를 함께 정의(5.2). 개체 아이콘은 브리지 |
| 모양 (반경, 테두리 두께) | 73% | 32% | 입력창 두께 1px, Path 양 끝, native 배지·토글 15rem | g·s hook. 입력창 두께와 Path는 브리지 |
| 간격·밀도·크기 | 45% (선언 기준 76~88%) | — | 컨트롤 높이 1.875rem, 모달 너비, 표 머리글 2rem | `spacing` 단계, 버튼·입력·라벨 s hook. 컨트롤 높이와 모달 너비는 브리지 |
| 글자 (크기, 굵기, 줄 간격, 자간, 대소문자) | 90% | 59% | 자간과 대소문자는 hook이 없다 | g·s hook. 자간은 `:root`의 `letter-spacing` + 브리지, 대문자 제목은 브리지 |
| 그림자·깊이 | 77% | 62% | 드롭다운·팝오버·툴팁 그림자(native), z-index, 투명도 | g 그림자. 배경막은 색 s hook 예외(5.2). 팝오버 꼬리는 브리지. z-index와 투명도는 고정 |
| **움직임** | **0%** | 0% | 시간·곡선 hook을 읽는 컴포넌트가 0개. `@keyframes` 58개 | **브리지로만 가능** (5.6) |
| 포커스·상호작용 | 링 모양 69% | 링 모양 8% | 커서, 링크 밑줄, native 3px 글로우 | 포커스 그림자 hook(5.2 조건부 허용). 커서와 밑줄은 브리지 |
| 아이콘 | 71% | 29% | 개체 아이콘 색, 컨트롤 안 아이콘 크기 0.875rem | `icon`·`avatar` s hook. 색과 컨트롤 안 크기는 브리지 |

**결론**
- hook만으로는 "모든 컴포넌트"를 채울 수 없다. 지금 org에서는 hook(5.2)과 `milvusBridge.css`(5.6)로 거의 모든 컴포넌트에 닿는다
- native로 바뀌면 브리지는 사라지고 hook 비율도 떨어진다. 그래서 native 전환을 자동으로 감지하고(9.2), 끝까지 바꿀 수 없는 것은 "Salesforce 고정" 목록(9.4)으로 합의한다
- 전제 수정: "native에서는 `--slds-s-*`가 닿지 않는다"는 지나친 서술이다. 기본 컴포넌트 원본 어디에도 `--slds-s-*`를 다시 정의하는 곳이 없어서, 기본 컴포넌트의 native CSS가 직접 읽는 s 이름에는 닿을 가능성이 높다(추정). README와 검사 스크립트 주석을 고친다

### 9.2 native 전환 대비

**감지**
1. org에서: 기본 컴포넌트는 synthetic이 아닐 때 호스트에 `data-render-mode="shadow"`를 붙인다(123개 폴더). `loadBrand`가 자기 템플릿 안의 `lightning-*` 호스트에서 이 속성을 확인하고, 있으면 개발 콘솔에 경고한다
2. 패키지 갱신 때: SLDS 2나 기본 컴포넌트 버전을 올리면 9.6의 정적 검사가 native 지원 목록, 새 하드코딩, hook 이름 변화를 기준 파일과 비교해 실패시킨다
3. Salesforce 릴리스(연 3회)마다 릴리스 노트의 native shadow 항목을 사람이 확인한다

**대비**
- 두 모드가 읽는 hook을 함께 정의한다. 예: 표 배경(지금 `surface-container-1/-2`, native `neutral-base-100/-95`), 박스 테두리(지금 `border-1`, native `border-base-1/-4`), 모달 배경막(지금 `--slds-s-backdrop-color-background`, native `neutral-10-opacity-50`), 버튼 굵기(지금 `font-weight-4`, native `--slds-s-button-font-weight`), 입력창 높이(지금 브리지, native `--slds-s-input-sizing-height`)
- native에서만 메울 수 있는 c hook 목록은 준비만 하고 금지를 유지한다: `--slds-c-card-shadow`, `--slds-c-tooltip-color-background`, `--slds-c-tooltip-text-color`, `--slds-c-tooltip-font-size`, `--slds-c-badge-radius-border`, `--slds-c-checkbox-toggle-radius-border`, `--slds-c-pill-radius-border`, `--slds-c-input-sizing-border`, `--slds-c-modalheader-heading-font-size`, `--slds-c-modalfooter-shadow`. 감지가 울리면 열지 사용자가 정한다
- Storybook native 빌드: #14의 `nativeShadow` 플러그인을 환경변수로 켜는 두 번째 빌드로 되살려, 9.6 검사를 두 빌드에서 돌리고 "전환 시 잃는 항목"을 낸다(발표 뒤)

### 9.3 브랜드 명세 페이지에 추가할 항목

기존 항목의 범위를 넓힌다: 모서리(`radius-border-1~4`, `pill` 전체), 밀도(`spacing-1~12` 배율), 글자(크기 단계 `font-scale-neg-2`~`-7`), 브랜드 색(포커스 링 색, 아바타 이니셜 배경이 따른다는 설명), 컴포넌트별 조정(카드 그림자는 native `lightning-card`에 닿지 않음 표시).

| 묶음 | 항목 | 자연어 예시 | 쓰는 곳 | 한계 |
| --- | --- | --- | --- | --- |
| 색 | 바탕·면 색 | "페이지 바탕을 따뜻한 연회색으로", "카드는 아이보리" | `surface-1~3`(`surface-2`가 앱 바탕), `surface-container-1~3`, native용 `neutral-base-100/-95/-90` | `neutral-base-100`은 색 위의 흰 글자로도 쓰여 흰색에 가까운 범위에서만 바꾼다 |
| 색 | 글자색 단계 | "글자를 남색 말고 거의 검정으로" | 제목·본문 `on-surface-3`, 입력값·라벨 `on-surface-2`, 보조·placeholder `on-surface-1` | 보조 아이콘 색이 `on-surface-1`을 같이 쓴다. 대비 4.5:1 검사 |
| 색 | 테두리·구분선 | "구분선은 옅게, 입력창 테두리는 진하게" | `border-1`(구분선·카드), `border-2`(입력·버튼), native용 `border-base-1/-4` | native 일부 하드코딩 |
| 색 | 회색 온도 | "회색을 전부 쿨그레이로" | `neutral-base-0~100` 16단계와 의미 hook을 skill이 한 색조로 계산 | |
| 색 | 비활성 상태 | "비활성 버튼은 더 흐리게" | `disabled-container-1/-2`, `on-disabled-1/-2`, `border-disabled-1/-2`, `disabled-1/-2` | |
| 색 | 어두운 면 | "툴팁을 남색 말고 차콜로" | `surface-inverse-*`, `surface-container-inverse-*`, `on-surface-inverse-*`, `border-inverse-*` | native 툴팁은 고정 |
| 색 | 모달 배경막 | "모달 뒤 막을 더 연하게" | `--slds-s-backdrop-color-background`와 native용 `neutral-10-opacity-50`에 같은 값 | |
| 색 | 검색어 강조 | "형광 노랑 말고 연한 살구색" | `palette-yellow-90/-80` | native 일부 고정 |
| 색 | hover·선택 바탕 | "목록 hover를 회색으로" | `surface-container-2/-3`, 색 s hook 6개 중 5개 | native에서는 2개만 닿는다 |
| 색 | 다크 모드 | "다크 모드는 기본값 그대로" | 모든 색을 `light-dark()`로 쓴다 | |
| 모양 | 테두리 두께 | "전체 테두리를 2px로" | `sizing-border-1/-2`, native 버튼 `--slds-s-button-sizing-border` | 입력창은 브리지 |
| 모양 | 아바타·개체 아이콘 모양 | "프로필 사진을 둥근 사각으로" | `--slds-s-avatar-radius-border`, `--slds-s-icon-radius-border` | |
| 모양 | 탭·페이지 헤더 모양 | "선택된 탭 밑줄을 2px로" | `navigation-sizing-border-*`, `navigation-radius-border`, `pageheader-radius-border`, `pageheader-sizing-border` | native tabBar는 고정 |
| 크기 | 컨트롤 높이 | "버튼과 입력창을 40px로" | 버튼 `--slds-s-button-spacing-block`, 입력·선택·콤보는 브리지, native용 `--slds-s-input-sizing-height` | 브리지 없이 버튼만 키우면 폼에서 높이가 어긋난다 |
| 크기 | 탭·헤더 높이 | "탭 바를 낮게" | `navigation-sizing-height`, `navigation-font-lineheight`, `header-sizing-height` | |
| 크기 | 아이콘 크기 | "기본 아이콘을 36px로" | `--slds-s-icon-sizing`, `--slds-s-icon-spacing`, 컨트롤 안 아이콘은 브리지 | |
| 글자 | 줄 간격 | "본문 줄 간격 1.6" | `font-line-height-base`, `-2`, `-1` | 컨트롤 안 줄 간격은 고정 |
| 글자 | 자간 | "한글 자간 -0.02em" | `:root`의 `letter-spacing` + 브리지 | |
| 글자 | 대소문자 | "영문 소제목을 대문자로 쓰지 마" | 브리지 | |
| 깊이 | 그림자 깊이 | "그림자 없이 평평하게" | `shadow-1~4`, 방향형 그림자. `shadow-5/-6`은 기본값 유지 | native 드롭다운·팝오버·툴팁은 고정 |
| 깊이 | hover·눌림 효과 | "버튼이 떠오르지 않게" | 버튼 떠오름·그림자 s hook, `--slds-s-mark-shadow-checked` | native에는 떠오름이 없다 |
| 움직임 | 속도 | "빠르고 경쾌하게", "차분하게" | 브리지의 `--milvus-motion-duration-fast`(0.1s 이하 규칙), `-medium`(0.15~0.2s), `-slow`(0.25~0.4s). 기본값은 규칙마다 원래 값 | 지금 org에서만. 모달·토스트 최소 0.01ms, 스피너 제외 |
| 움직임 | 곡선 | "부드럽게 감속하며" | 브리지의 `--milvus-motion-easing` | 속도와 같다 |
| 움직임 | 줄인 움직임 | "동작 줄이기를 켠 사람에게는 애니메이션 없이" | 브리지의 `prefers-reduced-motion` 규칙(항상 켬), 선택하면 항상 최소화 | |
| 포커스 | 포커스 링 모양 | "포커스 링을 3px로 굵게" | 포커스 그림자 4종(5.2 조건), native용 s `*-shadow-focus` | 링 색은 브랜드 색을 따른다 |
| 포커스 | 커서·링크 밑줄 | "링크에 밑줄 없이" | 브리지 | |
| 아이콘 | 개체 아이콘 색 | "Account 아이콘을 브랜드 남색으로" | 브리지가 클래스마다 아이콘 배경 hook을 다시 정의(원래 색이 기본값) | 개체를 색으로 구분하던 단서가 사라질 수 있다 |
| 표시만 | Salesforce 고정 | "토스트를 10초 동안" | 입력 없음. 9.4 목록을 보여 준다 | |

(hook 이름 앞의 `--slds-g-color-`, `--slds-g-` 등은 생략했다. 실제 이름은 5.2 표와 분석 원본에 있다)

### 9.4 "Salesforce 고정" 목록 (2026-10-08 사용자 합의)
"모든 컴포넌트" 요구의 예외로 합의했다. 명세 페이지와 발표에 "바꿀 수 없음"으로 그대로 적는다. native 전환 뒤 생기는 고정 항목은 9.2의 감지가 울릴 때 c hook을 열지 다시 정한다.
- **두 모드 모두 고정:** 아이콘 SVG 모양과 개체 아이콘 글리프의 흰색, z-index 층, 0·1이 아닌 투명도, 토스트 표시 시간(JS 상수 4800·9600ms), 스피너 모양, 색 선택기 색상환, Agentforce 영역, 이미지 위 어둡게 처리, 파괴·성공 버튼의 흰 글자, LEX 전역 헤더(org 테마가 원본)
- **native 전환 뒤 생기는 고정:** 드롭다운·팝오버·툴팁 그림자, 툴팁 배경과 글자 크기, native `lightning-card` 그림자, 모달 반경, 배지·토글 15rem, 입력창 두께, 콤보박스 높이, `:focus` 위주 포커스 표시와 3px 글로우, 버튼 떠오름, 표 머리글·hover 회색, 검색 강조 `#ff0`, 모든 움직임(9.2의 c hook을 열면 일부 메울 수 있음)

### 9.5 Storybook의 "Salesforce 원본과 읽는 hook" 보기
- 데이터는 9.6 정적 검사가 빌드할 때 만든다(손으로 쓰지 않음)
- 머리 요약: `lightning-*` 이름과 SLDS 블루프린트 이름, native 지원 목록 포함 여부, 브랜드 명세 항목별 반영 상태(지금·native: 반영 / 일부 / 안 됨 / 해당 없음)
- hook 표: hook(s hook이면 이어지는 g hook), 종류(g / s / c / 내부 전용 / 기본 컴포넌트 전용 / 정의 없음), 기본값(라이트·다크), 지금 브랜드 값, 읽는 곳(지금·native), util.css로 바뀌는가, 명세 항목
- 빈틈 표: 속성과 값, 위치, 모드, 영향, 메우는 방법(브리지 / 밀버스 컴포넌트 / c hook 후보 / Salesforce 고정). JS에 박힌 값(토스트 시간, 개체 아이콘 색)은 따로 보여 준다
- 원본 탭: 기본 컴포넌트 `html`·`js`·`css`, native용 `*.slds.css`, SLDS 2 컴포넌트 CSS. hook과 하드코딩을 색으로 강조한다. Salesforce 이용 약관 전문을 함께 넣는다(약관이 복제·공개 게시·배포를 허락함)
- 원본은 고치는 대상이 아니라 확인 근거다. 고쳐도 Storybook만 바뀌고 org는 바뀌지 않는다
- 미리보기: 기본 브랜드, 프로젝트 브랜드, 센티널 브랜드(9.6)를 나란히 놓고 브리지를 켜고 끌 수 있게 한다

### 9.6 자동 확인
1. **정적 검사 (CI, 브라우저 없이):** SLDS 2 CSS와 기본 컴포넌트 CSS를 postcss(Vite와 함께 이미 설치됨, 스크립트에서 쓰려고 devDependency로 명시)로 파싱해 각 선언의 `var()` 체인을 기본값까지 풀고 "명세 항목 → 닿음 / 브리지 / 빈틈 / 고정"으로 판정한다. 결과를 기준 파일(JSON)과 비교해 새 하드코딩, hook 변화, native 지원 목록 변화, 브리지 선택자 소실이 생기면 실패시킨다. 이 결과가 9.5 보기의 데이터가 된다
2. **동적 검사 (Storybook "반영 검사" 페이지):** 허용된 모든 hook과 브리지 변수에 서로 구별되는 값을 넣은 센티널 브랜드(예: 반경 7·9·11px, hook마다 다른 색상각, 0.777s)를 만든다. 모든 스토리를 기본 브랜드와 센티널 브랜드로 그려 요소마다 `getComputedStyle`(`::before`·`::after` 포함)을 비교한다. 값이 다르면 "반영", 같으면 "빈틈 후보"다. disabled는 스토리 변형으로, focus는 `focus()` 뒤에 잰다. 브리지를 끄고 한 번 더 돌리면 브리지가 맡는 범위가 나온다. 처음에는 수동으로 돌린다(CI 자동화는 헤드리스 브라우저라는 새 의존성이 필요)
3. **org 확인:** 읽기만 하는 확인으로 `lightning-*` 호스트의 `data-render-mode`를 본다. 센티널 브랜드를 org에 배포해 대표 화면을 비교하는 것은 승인을 받은 뒤 10/12 org 프로브와 함께 한다
4. **판정 기준:** 명세 항목마다 "반영된 컴포넌트 수 / 해당 컴포넌트 수"를 지금·native로 낸다. 빈틈이 9.4 목록에 없으면 실패다. 9.4에 새 항목을 넣으려면 사용자 합의가 필요하다

### 9.7 "모든 컴포넌트"에는 "모든 화면"도 들어간다
- util.css와 브리지는 밀버스 컴포넌트가 `loadStyle`을 부른 페이지에만 들어간다. 표준 레코드 페이지만 있는 화면에는 org 테마 색만 적용된다
- 후보: 앱 유틸리티 바에 화면이 없는 밀버스 컴포넌트를 두고 "앱이 열릴 때 백그라운드로 로드"를 켜면 앱의 모든 페이지에서 `loadBrand`가 실행될 수 있다. 공식 문서의 "백그라운드 유틸리티 항목" 패턴은 Aura 전용이라, LWC 유틸리티 항목에 이 설정이 동작하는지는 **미확인**이다. 10/12 org 프로브로 확인하고, 안 되면 "밀버스 컴포넌트가 있는 페이지만"을 한계로 적는다

### 9.8 분석 중 함께 발견한 것
- `brands/Sample_Forest/util.css` 주석의 "버튼·뱃지 등 알약형"은 틀렸다. 뱃지는 `--slds-g-radius-border-1`을 읽는다
- 정의되지 않은 hook을 읽는 곳이 있다: `--slds-g-color-accent-4`(기본 컴포넌트 13개, 기본값 없음), `--slds-g-info-container-1`, `--slds-s-button-shadow-hover`. org가 정의하는지는 미확인이다
- 기본 컴포넌트 `primitiveColorpickerButton`의 포커스 값이 무효라서 포커스 링이 안 보일 수 있다(추정)
- npm 번들의 hook 기본값과 org 런타임의 값이 같은지는 미확인이다

---

## 10. 오류 처리

| 명령 | 상황 | 동작 |
| --- | --- | --- |
| `init` | 사전 점검 실패(4.1의 1) | 쓰지 않고 멈춘 뒤 안내 |
| `init` | 같은 파일이 이미 있음 | 건너뛰고 목록으로 알림 (3장의 병합 예외 제외) |
| `init --from-org` | 커스텀 테마 없음, 조회 실패 | 쓰지 않고 멈춤 |
| 명세 저장 | 저장 요청 | localhost 개발 서버에서만, 정해진 파일 하나에만 씀 |
| `storybook` | 브랜드 메타데이터 없음, util.css 규칙 위반 | SLDS 기본 브랜드로 띄우고 화면 위에 오류 표시 |
| `check` | 규칙 위반, 대비 미달, 밀버스 관리 파일 직접 수정, `milvusVf.css` 불일치 | 0이 아닌 종료 코드, 한국어 설명과 고칠 값 |
| `deploy` | 대상 org 없음, `check` 실패, sf 미설치·인증 만료 | 배포하지 않음 |
| `deploy` | 일부 실패 | 실패 항목과 이유를 보여 주고 활성화 단계로 넘어가지 않음 |
| `update` | 로컬에서 고친 밀버스 관리 파일 | 아무것도 바꾸지 않고 차이 표시, 종료 코드 1. `--force`로 덮어씀 |

---

## 11. 테스트와 CI

- 단위: `node --test`(TS 그대로)
  - 팔레트: "50·40·30단계 대비 4.5:1 이상" 추가
  - `check`: 통과·실패 예시 파일(5.2, 5.3의 각 규칙)
  - `init`: 두 번 실행해도 같은 결과, `CLAUDE.md`에 추가된 줄이 정확히 `@milvus-design.md`인지
  - `update`: 로컬 수정 감지, 전부 반영 또는 아무것도 바꾸지 않음
- LWC: Jest `.test.ts`
- 타입 검사: `tsc --noEmit`
- 전 컴포넌트 반영: 9.6의 정적 검사(CI, 기준 파일 비교)와 센티널 브랜드로 돌리는 동적 검사(Storybook, 처음에는 수동)
- CI: lint, 타입 검사, 테스트, 정적 반영 검사, Storybook 빌드. 태그 `v*`이면 GitHub Packages 발행
- 리허설: `learndoshare_2`에서 `pnpm pack` tgz로 설치 → `init` → 브랜드 요청 입력 → 반영 → Storybook → 배포(승인 후) → LEX·VF 화면 확인

---

## 12. 일정 (10/16 동결, 10/9 휴일)

| 날짜 | 작업 | 완료 기준 |
| --- | --- | --- |
| 10/12(월) 첫 작업 (10/9에 해도 됨) | **학습 자료 기초:** `Learn/00-디자인 시스템과 Salesforce.html`(디자인 시스템 개념과 Salesforce 구현), 낡은 `root.css`·`override.css` 설명 정리, 분석 자료를 `docs/research/`로 보관. Learn의 모든 절에 공신력 있는 출처(공식 문서·공식 소스·실측 기록)를 단다. **Learn 09 "override와 공식 권고"**: SLDS 2가 커스터마이즈를 좁힌 공식 이유, override와 hook을 synthetic·native에 직접 적용해 보는 실험, 밀버스의 선택 | Learn 검사(legacy·출처) 통과 |
| 10/12(월) 오전 | **설치 경로 스파이크:** 패키지 이름·`publishConfig`·`prepack` 정리, `bin`은 버전만 출력, 발행 workflow, `v0.0.1` 발행. `learndoshare_2`에서 토큰으로 설치하고 `pnpm milvus --version` 확인. `node_modules` 안 설정으로 Storybook을 띄워 프로젝트 파일 하나 읽기와 미들웨어 POST 하나 확인 | 14장 첫 세 항목 확인 |
| 10/12(월) 오후 | PR #19 병합. TS 전환 PR: 밀버스 컴포넌트 3개 `.ts`, `milvusScript`/`loadBrand`(native 감지 경고 포함), Rollup 타입 제거와 플랫폼 모듈 대체, ESLint `.ts`. **검사 스크립트·CLAUDE.md·5.2를 하나로 맞춤**(중립 색, 포커스 그림자, s hook 범위, 색 s hook 6개, `letter-spacing`). `templates/`의 모든 파일을 틀이라도 먼저 만든다. 승인받은 org 프로브 1회(피드백 색·중립 색 util.css, VF 테스트 페이지, 유틸리티 바 백그라운드 로드) | `pnpm lint`, `pnpm test`(타입 검사 포함), Storybook 빌드, CI 통과 |
| 10/13(화) | `init`, `check`. 경로 재작업(생성기·Rollup이 루트와 출력 위치를 인자로 받고 결과는 `.milvus/`). **9.6 정적 반영 검사**(분석 스크립트를 옮겨 기준 파일 생성). **`milvusBridge.css` 생성기**(움직임, 줄인 움직임, 컨트롤 높이, 입력창 두께, 자간, 대문자 제목, 커서·밑줄 등. 개체 아이콘 색은 마지막) | `learndoshare_2`에서 `init` 두 번 결과 동일, `pnpm milvus check` 통과, 정적 검사 기준 파일 생성 |
| 10/14(수) | `storybook` 프로젝트 모드, 브랜드 명세 페이지(9.3 항목 포함)와 저장, skill 반영(9.3 매핑), 9.5 원본·hook 보기 | 요청 입력 → 반영 → 화면 갱신, 9.5 보기에서 컴포넌트별 반영 상태 표시 |
| 10/15(목) | 오전: `deploy` 핵심(LWC, `milvusBrand`, `milvusBridge`, BrandingSet, 테마, 로고, 활성화) → `learndoshare_2` 리허설(tgz, VF 없이). 오후: VF(`milvusVf`, `milvusHead`) | 리허설 완료 (org 배포는 승인 후), `init` 두 번 결과 동일 재확인 |
| 10/16(금) | 리허설 문제 수정, `update`, 9.6 동적 반영 검사 페이지, README·CLAUDE.md·문서 정리, 최종 발행, **내용 동결** | 동결 |

마일스톤마다 마지막에 바뀐 개념을 `Learn/`에 반영한다. 세부 순서는 구현 계획(`docs/plans/2026-10-08-milvus-package-plan.md`)에 있다.

**늦어지면 빼는 순서:** ① `update` ② VF 지원 ③ Figma·URL 입력 ④ `init --from-org` ⑤ 9.6 동적 반영 검사 페이지(정적 검사는 유지) ⑥ 개체 아이콘 색 브리지 ⑦ 9.5 원본 탭(hook 표와 반영 상태는 유지) ⑧ 브랜드 명세 페이지 저장(→ 채팅 입력) ⑨ 손대지 않는 기존 Storybook 파일의 TS 전환. Storybook native 빌드(9.2)는 처음부터 발표 뒤로 둔다

**절대 빼지 않는 것:** pnpm 설치 → `init` → 브랜드 요청 입력 → 반영 → Storybook 확인 → 배포. 그리고 "모든 컴포넌트" 요구를 지키는 5.2 규칙 확장, `milvusBridge.css`(개체 아이콘 색 제외), 9.6 정적 반영 검사. 단계마다 대체 경로를 둔다: 설치 → `pnpm pack` tgz, `node_modules` 안 Storybook → `init`이 `.storybook` 복사, 명세 페이지 저장 → 채팅 입력.

---

## 13. 확인된 사실 (2026-10-08)

| 사실 | 확인 방법 |
| --- | --- |
| `BrandingSet`, `LightningExperienceTheme`은 배포로 생성된다. `activeThemeName`만 담은 설정 배포는 그 필드만 바꾼다(다른 42개 필드 그대로) | org 배포 전후 비교 |
| 활성화한 브랜드 색의 LEX accent(`#2E7D32` → `#468244`)가 우리 팔레트 규칙의 50단계와 같다 | org 측정 |
| 테마를 지우면 그 테마의 `BrandingSet`도 함께 지워진다 | 삭제 배포 |
| LEX에서 `loadStyle`한 CSS는 문서 head에 들어가 프로브 컴포넌트, 표준 헤더 버튼, `LightningAlert` 모달까지 바꾼다. 컴포넌트 hook도 닿는다 | org 측정 |
| VF의 `<apex:slds/>`는 SLDS 1이다. 테마 색은 따라오지만 util.css는 효과가 없다. SLDS 2를 넣으면 util.css가 작동하고, 팔레트는 직접 넣어야 한다 | org 측정 |
| 메타데이터로 배포한 새 탭은 프로필에서 숨김이다. 확인용 화면은 `lightning__UrlAddressable`로 연다 | org 측정 |
| `.ts`만 있는 LWC를 배포하면 org가 `.ts`를 저장하고 타입을 지워 실행한다 | org 배포·조회·화면 |
| `tsc`(`target: ESNext`)는 `@api`를 그대로 두고, LWC 컴파일러가 공개 속성으로 등록한다. Jest는 `.ts` 컴포넌트와 테스트를 그대로 통과한다. LWC 컴파일러는 TS를 직접 읽지 못한다 | 로컬 |
| `lwc/utils/<번들>` 구조는 변환할 때 번들 이름이 `<번들>`이 아니라 `utils`로 잡힌다. `lwc/` 바로 아래나 `force-app/x/lwc/<번들>`은 정상이다 | `sf project convert source` |
| 모달, 알림, 토스트, 툴팁은 `document.body`에 붙는다 | `lightning-base-components` 소스 |
| GitHub Packages는 `@범위/이름` 형식이 필요하고, 공개 패키지도 설치에 토큰이 필요하다 | GitHub 공식 문서 |
| Node 22.18+/23.6+는 `.ts`를 그대로 실행하지만 `node_modules` 안의 `.ts`는 거부한다 | Node 공식 문서 |
| `permissions.ask`는 auto 모드에서도 실행 전에 묻는다. `Edit(...)` 규칙 하나가 모든 파일 편집 도구를 막는다. `CLAUDE.md`에 `@milvus-design.md`라고 쓰면 그 파일을 함께 불러온다 | Claude Code 공식 문서 |
| SLDS 2 CSS는 976KB(압축 약 108KB)이고 글꼴 파일을 참조하지 않는다 | 로컬 |
| Salesforce 원본(`lightning-base-components`) 이용 약관은 복제·공개 게시·배포를 허락하고 약관 동봉을 요구한다 | `LICENSE.txt` |
| LWC `.ts` 검사는 `@salesforce/eslint-config-lwc`(4.1.2)의 `recommended-ts` 설정으로 한다. `sfdx-lwc-jest`에 `lightning/platformResourceLoader` stub이 있다 | 설치된 패키지 |
| 패키지에 넣은 Storybook 설정을 `node_modules`에서 그대로 띄울 수 있다. `main.ts`, 형제 `.ts` 모듈(상대 import에 `.ts`), `.ts` 스토리가 동작한다. Storybook이 자체 로더(esbuild)로 `node_modules` 안의 `.ts`도 변환하므로 `dist/`로 컴파일할 필요가 없다. framework(`@storybook/web-components-vite`)와 addon(`addon-docs`, `addon-a11y`, autodocs 화면)도 찾는다 | Task 3 스파이크(2026-10-09): `pnpm pack` tgz를 새 SFDX 프로젝트(`learndoshare_2`)에 `pnpm add -D`, Storybook 10.6.0·Vite 7.3.7, 브라우저로 스토리 화면 확인 |
| 위 조건: `-c`에 패키지 설정 폴더의 실제 경로(realpath)를 넘겨야 한다. 심볼릭 링크 경로를 넘기면 Vite 루트가 그 경로가 되어 브라우저 쪽 import `storybook/internal/preview/runtime`을 찾지 못하고(`Failed to resolve import`) 미리보기가 빈 화면이 된다. pnpm은 패키지의 의존성을 프로젝트 `node_modules` 바로 아래에 두지 않기 때문이다. pnpm이 만드는 `milvus` 실행 파일은 실제 경로의 `dist/cli/index.js`를 실행한다 | 같은 스파이크(심볼릭 링크 경로·실제 경로 두 번 실행), `node_modules/.bin/milvus` |
| 별칭으로 import한 프로젝트 파일(`?raw`)은 `server.fs.allow` 없이도 읽힌다. import하지 않고 직접 요청한 프로젝트 파일은 403이고, `server.fs.allow`에 프로젝트 폴더를 넣으면 200이다. 허용 밖 파일은 계속 403이다. `allow`를 직접 주면 Vite의 작업 공간 루트 기본값이 빠진다 | 같은 스파이크, [Vite server.fs.allow](https://vite.dev/config/server-options.html#server-fs-allow) (확인 2026-10-09) |
| Vite 플러그인의 `configureServer` 미들웨어가 Storybook 개발 서버 포트에서 응답한다(`POST /__milvus/ping` → `{"ok":true}`) | 같은 스파이크 |
| Storybook 개발 서버는 기본으로 모든 네트워크 주소(`*:6007`)에서 듣는다. `--host localhost`를 주면 `[::1]`에서만 듣고, 이때 `127.0.0.1`로는 연결되지 않는다 | 같은 스파이크, `lsof` |
| 설치할 때 pnpm 10.13.1이 `esbuild` 빌드 스크립트를 건너뛰었다고 경고한다. 그래도 Storybook의 `.ts` 설정 변환(esbuild)은 동작한다 | 같은 스파이크 |

## 14. 미확인 (구현 중 확인할 것)

| 항목 | 확인 시점 |
| --- | --- |
| `.npmrc`의 `${NODE_AUTH_TOKEN}` 치환으로 GitHub Packages 설치가 되는가, 공개 저장소에 연결된 패키지의 공개 범위 | 10/12 `v0.0.1` |
| Vite 개발 서버 미들웨어로 요청 파일을 저장할 수 있는가. POST 미들웨어 응답까지는 확인했다(13장) | Task 17 테스트 |
| `node_modules`의 `.storybook`에서 `preview.ts`·`manager.ts`(manager 번들러), `../lib/*.ts` import, 정적 빌드(`storybook build`, `milvus storybook --build`)도 되는가. Task 3 스파이크는 `main.ts`·형제 `.ts`·스토리·addon만 쟀다 | Task 17 후 tgz 리허설 |
| 피드백 색 hook을 util.css로 바꾸면 LEX 표준 화면에도 반영되는가 | 10/12 org 프로브 |
| VF에서 `milvusVf.css` + `milvusBrand`가 SLDS 2·팔레트·util.css를 함께 적용하는가 | 10/12 org 프로브 |
| `loadStyle`로 넣은 클래스 규칙(예: `.slds-button { border-radius: 0 }`)이 LEX의 `lightning-button` 안까지 닿는가. 10/8 프로브는 hook 두 개만 쟀다. `milvusBridge`·`milvusOverride`의 전제다 | 10/12 org 프로브 |
| **VF 공식 SLDS 2 경로:** Help "User Interface Settings"의 "Use SLDS 2 for pages that include `<apex:slds>` when an SLDS 2 theme is active" 설정과 `<apex:slds lightningStyleMode>`(API 65.0+, 기본 Auto)가 있다(2026-10-09 공식 문서 확인, Learn 00·01). 10/8 프로브는 API 67.0 페이지에서 SLDS 1로 그려졌고 그때 설정 상태는 기록이 없다. 설정을 켜면 org 테마 팔레트까지 들어오는가. 들어오면 `milvusVf`는 util.css가 있을 때만 필요하거나 아예 필요 없다(4.4, 5.5, Task 24 재검토) | 10/12 org 프로브(설정 읽기는 자유, 변경은 승인) |
| pnpm 11.5.3 이후(10.x는 10.34.2 이후) 프로젝트 `.npmrc`의 `${…}` 치환을 하지 않는다는 pnpm.io 설명(Learn 07)과 0장·3장의 `.npmrc` 안내가 맞는가. 안 맞으면 토큰 줄은 `~/.npmrc`, 범위 레지스트리는 `pnpm-workspace.yaml`의 `registries`로 안내한다 | 10/12 `v0.0.1` 설치 확인 |
| `Bash(pnpm milvus deploy *)`가 인자 없는 명령에도 걸리는가 | 10/13 |
| `sfdx-project.json`의 `defaultLwcLanguage` 키가 실제 스키마에 있고 VS Code가 따르는가 (설치된 `@salesforce/core` 스키마에서 확인함, VS Code 동작은 미확인) | 10/13 |
| `Edit(...)` deny 규칙이 의도대로 막는가 | 10/13 |
| LWC 유틸리티 바 항목을 "앱이 열릴 때 백그라운드로 로드"로 두면 앱의 모든 페이지에서 `loadBrand`가 실행되는가 (9.7) | 10/12 org 프로브 |
| 중립 색 hook을 util.css로 바꾸면 LEX 표준 화면의 바탕·면이 바뀌는가 (LEX가 페이지 바탕을 따로 칠하는지) | 10/12 org 프로브 |
| native에서 기본 컴포넌트 CSS가 직접 읽는 `--slds-s-*`에 `:root` 값이 닿는가 (9.1 전제 수정) | 발표 뒤 native 빌드 |
| npm 번들의 hook 기본값과 org 런타임 값이 같은가, `--slds-g-color-accent-4` 등 정의 없는 hook을 org가 정의하는가 | 10/12 org 프로브(읽기만) |

## 15. 미정

- 회사 GitHub 조직으로 옮길지(패키지 범위 이름이 바뀐다)
- `BrandingSet`의 SLDS 2 전용 색 속성(`ACCENT_COLOR_1~3`, `CONTAINER_ACCENT_COLOR_1~3`(API 64), `ACCENT_CONTAINER_CONTENT_COLOR_1~3`(API 65))을 브랜드 명세에 넣을지. 공식 기능이라 "기본 우선"에 맞는다(2026-10-09 Metadata API 문서 확인, Learn 00)
- `--slds-s-*` 허용(#18) 유지 여부: 공식 `@salesforce-ux/eslint-plugin-slds`는 `--slds-s-*`를 Salesforce 내부용 private hook으로 분류한다(Learn 00·01). "기본 우선"에서는 util.css가 요청 시에만 쓰이므로 당장 바꾸지 않는다
- 앱 전체에 util.css를 거는 방법(유틸리티 바는 LWC 백그라운드 로딩이 지원되지 않음)
- 브랜드 글꼴(발표 뒤 검토)
- native 전환 감지가 울렸을 때 9.2의 c hook 목록을 열지
