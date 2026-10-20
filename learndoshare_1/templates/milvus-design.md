# 밀버스 디자인 시스템 안내

이 파일은 세팅 안내서이자 이 프로젝트에서 Claude Code가 지킬 규칙이다. `pnpm milvus init`이 놓은 밀버스 관리 파일이라 직접 고치지 않는다(`pnpm milvus update`가 갱신한다). 프로젝트 `CLAUDE.md`의 `@milvus-design.md` 한 줄이 이 파일을 불러온다.

## 1. 이 프로젝트의 밀버스 설정

브랜드 이름, 대상 org 별칭, 패키지 버전, VF 사용 여부, 밀버스 관리 파일 목록은 `milvus.config.json`을 본다. 원본을 하나로 두려고 이 파일에는 값을 옮겨 적지 않는다.

## 2. 준비물

- Node 22.18 이상(23.x는 23.6 이상)
- pnpm. `npm`, `npx`, `yarn`은 쓰지 않는다
- Salesforce CLI `sf`와 대상 org 로그인(`sf org login web --alias <별칭>`)
- GitHub classic 토큰(`read:packages`)을 셸 환경변수 `NODE_AUTH_TOKEN`에 넣는다. 토큰 값은 파일에 쓰지 않는다
- `.npmrc` 두 줄. `init`이 프로젝트 `.npmrc`에 없으면 더한다
  ```
  @a40418a:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
  ```
- pnpm 버전에 따라 토큰 줄을 두는 곳이 다르다(`pnpm --version`)
  - 10.34.2 미만(10.x), 11.5.3 미만(11.x): 프로젝트 `.npmrc`의 `${NODE_AUTH_TOKEN}`을 치환한다. 10.13.1에서 설치를 확인했다
  - 10.34.2 이상, 11.5.3 이상: pnpm 문서에 따르면 프로젝트 `.npmrc`의 인증 줄에 있는 `${…}`를 풀지 않고 그 설정을 무시한다. 토큰 줄을 사용자 파일 `~/.npmrc`로 옮긴다. 레지스트리 줄은 프로젝트 `.npmrc`에 남겨도 된다. 이 버전에서 직접 설치해 보지는 않았다(미확인)
  - pnpm 11은 범위 레지스트리를 `pnpm-workspace.yaml`의 `registries`로도 정한다. 토큰은 계속 `.npmrc`에 둔다

## 3. 세팅 순서

- [ ] `pnpm add -D @a40418a/milvus-design-system`
- [ ] `pnpm milvus init --target-org <별칭> --brand <이름>` (org의 지금 테마를 가져오려면 `--brand` 대신 `--from-org`, VF를 안 쓰면 `--no-vf`)
- [ ] `pnpm milvus storybook` → "시작하기 / 브랜드 명세" 페이지에 요청을 입력하고 저장한다(`milvus-brand-request.md`). 저장이 안 되면 채팅에 직접 쓴다
- [ ] Claude Code에 "브랜드 요청 반영해줘" → 브랜드 명세 표 확인 → 승인 → 반영 → `pnpm milvus check`
- [ ] Storybook에서 화면을 확인한다(파일이 바뀌면 저절로 갱신된다)
- [ ] `pnpm milvus deploy`로 배포 계획 확인 → 채팅에서 승인 → `pnpm milvus deploy --yes`

**배포 뒤 사람이 org에서 할 일 두 가지.** 메타데이터로 할 수 없어 `deploy`가 하지 않는다.

- [ ] **VF를 쓰면:** Setup → User Interface → Visualforce Settings에서 "Use SLDS 2 for pages that include `<apex:slds>` when an SLDS 2 theme is active"를 켠다. Metadata API로 읽거나 켤 수 없어 `deploy`가 확인하지 못한다. 꺼져 있으면 VF가 SLDS 1로 그려지고 `milvusBrand.css`가 효과가 없다
- [ ] **앱 전체에 브랜드를 걸려면:** App Manager에서 그 앱을 편집해 유틸리티 바에 `milvusBrandLoader`를 추가하고 "앱이 열릴 때 백그라운드로 로드"(Load in background when app opens)를 체크한다. 앱마다 한다
  - 안 하면 밀버스 컴포넌트가 있는 페이지에만 브랜드 스타일이 걸리고, 다른 표준 화면에는 테마 색만 적용된다
  - 로더는 보이는 유틸리티 항목이라 유틸리티 바에 버튼으로 나온다. 라벨·아이콘은 App Manager에서 정한다. 템플릿이 비어 있어 패널을 열어도 아무것도 그리지 않는다

## 4. 파일 지도

[관리] 밀버스 관리 파일: 직접 고치지 않는다. `milvus.config.json`에 sha256이 있고 `update`가 갱신한다. Claude는 `permissions.deny`로 고칠 수 없다 · [소유] 프로젝트 소유: skill과 사람이 고친다 · [생성] CLI가 만든다

| 파일 | 구분 | 내용 |
| --- | --- | --- |
| `milvus-design.md` | 관리 | 이 안내서 |
| `CLAUDE.md` | 소유 | `@milvus-design.md` 한 줄 |
| `milvus.config.json` | 생성 | 패키지 버전, 브랜드, 대상 org, 관리 파일 목록과 sha256 |
| `milvus-brand-request.md` | 소유 | 브랜드 명세 페이지가 저장한 요청 |
| `.claude/settings.json` | 소유 | 밀버스 permissions·hook 병합 |
| `.claude/skills/milvus-brand/SKILL.md` | 관리 | 브랜드 요청 반영 skill |
| `.claude/hooks/milvus-check.mjs` | 관리 | `milvusBrand.css`·`milvusOverride.css`·`brandingSets/`를 고치면 `check --style` |
| `.gitignore`, `.forceignore`, `.npmrc`, `package.json` | 소유 | `.milvus/`, `**/__tests__/**`, 레지스트리 두 줄, `storybook` 스크립트 |
| `lwc/milvus*/` (밀버스 컴포넌트, `milvusScript`, `milvusBrandLoader`) | 관리 | `.js` |
| `classes/utils/design/` | 관리 | 밀버스 Apex(생기면) |
| `components/milvusHead.component` | 관리, VF | VF 페이지 head |
| `brandingSets/LEXTHEMING<이름>.brandingSet-meta.xml` | 소유 | 브랜드 색(`BRAND_COLOR`)·로고(`BRAND_IMAGE`). 색의 원본 |
| `lightningExperienceThemes/<이름>.lightningExperienceTheme-meta.xml` | 소유 | 기본 BrandingSet을 가리키는 테마 |
| `staticresources/milvusBrand.css` | 소유 | util.css. 모양·중립 색·피드백 색·밀버스 변수 값의 원본. 처음엔 비어 있다 |
| `staticresources/milvusBridge.css` | 관리 | hook이 없는 항목을 `--milvus-*` 변수로 잇는 클래스 규칙 |
| `staticresources/milvusOverride.css` | 소유 | opt-in 클래스 규칙. 처음엔 비어 있다. 공식 권고 밖 |
| `staticresources/milvusVf.css` | 생성, VF | VF용 브랜드 팔레트. `check`·`deploy`가 다시 만든다. 커밋한다 |
| `contentassets/<이름>Logo.asset` | 소유 | 로고(주었을 때) |

(`lwc/`부터는 `force-app/main/default/` 아래다. `.milvus/`는 CLI 작업 폴더라 커밋하지 않는다)

커밋된 `.claude/settings.json`의 hook은 팀원에게도 별도 동의 없이 실행된다(대화형 세션은 폴더 신뢰 대화상자를 받아들일 때까지 hook을 실행하지 않고, `claude -p`·SDK는 그 대화상자도 없이 실행한다. hook은 그 사람의 전체 사용자 권한으로 돈다). 그래서 밀버스 hook은 `milvus-check.mjs` 하나만 둔다.

## 5. 디자인 규칙

- **기본 우선.** 브랜드 요청이 없으면 Salesforce 기본 모양에 브랜드 색·로고(org 테마)만 바꾼다
- **판단 순서.** org 테마(색·로고) → `milvusBrand.css`의 global hook(`--slds-g-*`) → 컴포넌트 hook(`--slds-s-*`) → 브리지 변수(`--milvus-*`) → `milvusOverride.css`(마지막 수단, 공식 권고 밖). 앞 단계로 되면 뒤 단계를 쓰지 않는다
- **override를 쓰면** native shadow 전환·Salesforce 업데이트에 약하다는 것을 사용자에게 알린다. 모양만 바꾸려고 밀버스 컴포넌트를 새로 만들지 않는다. 밀버스 컴포넌트는 SLDS에 기능이 없을 때만 만든다
- **util.css(`milvusBrand.css`):** `:root` 블록 하나. 이름에 color가 없는 g·s hook(읽는 곳이 있는 이름), 중립 색(`light-dark()`, 글자·면 4.5:1 이상), 피드백 색, 색 s hook 6개, 읽는 곳이 있는 `--milvus-*`, `letter-spacing`만 쓴다. 클래스 규칙, `@font-face`, 글꼴 hook, 브랜드 색 계열 hook, `--slds-c-*`는 쓰지 않는다. 고치면 hook이 `check --style`로 검사한다. 자세한 표는 `milvus-brand` skill에 있다
- **색은 `BrandingSet`에서만.** 브랜드 색을 CSS에 적지 않는다. Salesforce는 입력한 색 대신 접근성 색(50단계)을 버튼에 쓴다
- **Salesforce 고정 항목**(토스트 표시 시간, z-index, 아이콘 모양 등)은 바꿀 수 없다고 답하고 목록을 보여 준다. 글꼴은 바꾸지 않는다
- **LWC는 JavaScript(`.js`)로 쓴다.** `.ts` LWC를 그대로 배포하면 org가 타입 검사로 거부한다
- **`milvus` 접두사는 밀버스 전용이다.** 프로젝트 컴포넌트·변수에 `milvus`, `--milvus-`를 쓰지 않는다
- 프로젝트 컴포넌트에서 브랜드 스타일이 필요하면 `c/milvusScript`의 `loadBrand(this)`를 부른다
- 개인정보 필드(`Phone`, `Email`, 주소)와 `FIELDS(ALL)`는 조회하지 않는다. 액세스 토큰을 출력하는 명령(`sf org display`, `sf org open --url-only`·`-r`·`--json`, `sf org list --json`, `sf auth list --json`)과 `SF_CONTENT_TYPE=JSON`(모든 sf 출력을 JSON으로 바꾼다)은 쓰지 않는다. 별칭 확인은 `--json` 없는 `sf org list`로 한다

## 6. Claude에게 시키는 법

브랜드 작업은 `milvus-brand` skill이 맡는다. Claude는 브랜드 명세 표를 먼저 제안하고, 승인을 받은 뒤에 파일을 쓴다.

- "브랜드 요청 반영해줘" (명세 페이지에 저장한 `milvus-brand-request.md`)
- "브랜드 색을 신뢰감 있는 딥그린으로, 각지고 촘촘하게 해줘"
- "회색을 쿨그레이로 바꾸고 카드 그림자는 없애줘"
- "성공 색은 글자 #1B5E20, 배경 #E8F5E9로"
- "이 로고 써줘: assets/logo.png"
- "tokens.json(디자인 토큰, Figma Export modes)을 적용해줘", "이 PDF 브랜드 가이드의 색으로", "https://… 사이트 느낌으로"
- "모달을 더 넓게", "애니메이션을 모두 최소화"
- "반영한 거 배포 계획 보여줘" (배포는 따로 요청할 때만 한다)

## 7. 배포 안전장치

- 브랜드 배포는 `pnpm milvus deploy`로만 한다. 밀버스 메타데이터 배포와 활성 테마 변경을 순서대로 한다
- `--yes` 없이 실행하면 계획만 보여 준다: 대상 org, 지금 활성 테마 → 새 활성 테마, 배포 목록, 경고. Claude는 이 계획을 채팅에서 승인받은 뒤에만 `pnpm milvus deploy --yes`를 실행한다. `permissions.ask`가 한 번 더 묻는다
- 활성 테마 변경은 org 전체 사용자 화면에 적용된다
- 밀버스 메타데이터만 한 번에 올린다. 하나라도 실패하면 전부 롤백되고 테마를 활성화하지 않는다
- 테마 색은 브라우저를 새로고침한 뒤에 보인다. 확인용 `sf org open` 명령을 출력만 한다
- 배포 뒤 사람이 할 일 두 가지는 3절에 있다

## 8. 업데이트와 문제 해결

- **패키지 업데이트:** `pnpm add -D @a40418a/milvus-design-system@<버전>` 뒤 `pnpm milvus update`. 고친 밀버스 관리 파일이 있으면 아무것도 바꾸지 않고 차이를 보여 준다. 패키지 원본으로 되돌리려면 `pnpm milvus update --force`
- **`storybook`이 버전이 다르다고 멈춤:** 패키지만 올리고 `update`를 하지 않아 새 밀버스 컴포넌트(`c/milvus…`)가 프로젝트에 없다. `pnpm milvus update`를 먼저 실행한다
- **`check`가 sha256 차이를 말함:** 밀버스 관리 파일이 바뀌었다. `pnpm milvus update --force`로 되돌린다
- **설치가 인증 오류(401·403)로 실패:** `NODE_AUTH_TOKEN`이 비었거나 만료되었거나 `read:packages` 권한이 없다. `.npmrc` 두 줄과 pnpm 버전(2절)을 확인한다
- **`init`·`deploy`가 org에서 멈춤:** `sf`가 없거나 로그인이 만료되었다. `sf org login web --alias <별칭>`
- **VF:** 페이지에 `<c:milvusHead/>`를 넣는다. `showHeader="false"` 페이지는 `<body>`에 `slds-scope`가 자동으로 붙어 래퍼가 필요 없었다(2026-10-14 측정). `applyBodyTag`·`applyHtmlTag`를 `false`로 두면 `slds-scope`를 직접 넣는다. 프로젝트 전체 배포로 `milvusHead`를 올릴 때는 `milvusVf.css`가 커밋되어 있어야 한다
- **VF가 SLDS 1처럼 보임(버튼 반경 4px):** 3절의 Visualforce Settings 설정을 확인한다
- **표준 화면에 브랜드가 안 보임:** 그 앱 유틸리티 바의 `milvusBrandLoader`와 "앱이 열릴 때 백그라운드로 로드" 체크를 확인한다. 테마 색은 새로고침 뒤에 보인다
- **Storybook 위에 오류 배너:** BrandingSet이 없거나 `milvusBrand.css`가 규칙을 어겼다. `pnpm milvus check`의 안내대로 고친다
