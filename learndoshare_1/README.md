# 밀버스 디자인 시스템 — 진행 계획

밀버스 프로젝트들이 공유할 LWC 디자인 시스템을 이 저장소(`learndoshare_1`)에서 검증하고 구축한다.
구상 단계이므로, 이 문서는 **완료 보고가 아니라 실행 계획**이다.

> 표기 규칙: **확정**은 결정되었거나 실제로 확인한 것, **미확인**은 확인이 필요한 것, **미정**은 결정이 필요한 것이다.

---

## 1. 목표와 핵심 시나리오

### 1.1 목표

| 목표 | 핵심 문제 | 해결 수단 |
| --- | --- | --- |
| **브랜드 전환** | 프로젝트(브랜드)마다 색, 로고, 타이포, 버튼 모양이 다르다 | org Themes and Branding(색·로고) + 브랜드 root style(그 외) + SLDS global styling hook |
| **컴포넌트 재사용** | 같은 SLDS를 쓰는데도 페이지마다 동작과 디자인이 미세하게 다르다. SLDS에 없는 컴포넌트는 각자 만든다 | 공용 컴포넌트 + 카탈로그(Storybook) + 린트 |
| **프로젝트 시작 표준화** | 새 프로젝트마다 디자인 기반을 처음부터 다시 잡는다 | 밀버스 디자인 시스템을 **Claude Code 런북**으로 배포하고, 프로젝트 시작 시 전용 Storybook을 생성한다 |

브랜드 전환과 컴포넌트 재사용은 정당화 논리가 다르다. 브랜드 전환은 컴포넌트를 만들지 않아도 풀린다. 컴포넌트 재사용의 근거는 브랜드가 아니라 **중복 구현과 일관성 결여**다.

### 1.2 핵심 시나리오 — 새 프로젝트 시작 (중점 실습)

밀버스 디자인 시스템은 공용 저장소로 배포되어 있다. 새 프로젝트를 시작할 때, 그 프로젝트의 Claude Code가 이 저장소의 런북을 가져와 아래 4단계를 진행한다.

```
① org 테마 세팅          관리자가 Setup > Themes and Branding에서 브랜드 색·로고 지정
        ↓
② 테마 가져오기           pnpm sync:theme → 브랜드 색 → Storybook 메인 컬러 시스템
                                       → 브랜드 로고 → Storybook 로고
        ↓
③ 브랜드 root style 조정   Claude에 브랜드 요구를 입력 (#5)
                          자연어 / 토큰 파일(JSON·CSS 변수) / Figma Variables
                          / 브랜드 가이드(PDF·이미지) / 고객사 웹사이트 URL
                          → brands/<브랜드>/root.css 생성 (허용된 변수만)
                          → Storybook 전체(밀버스 컴포넌트, lightning-* 색, 화면 테마)가 그 브랜드로 바뀜
        ↓
④ 전용 Storybook 생성     Storybook에서 쓸 컴포넌트를 켜고 끔 (#6)
                          → milvus.config.json 저장 (같은 기능은 컴포넌트 하나만)
                          → 켜진 컴포넌트 + 브랜드 root style로 프로젝트 전용 Storybook 생성
                          → Claude Code는 켜진 컴포넌트만 조합해 구현 (hook이 강제)
```

| 단계 | 누가 | 결과물 | 자동화 수단 |
| --- | --- | --- | --- |
| ① | 관리자 | org 테마 레코드 | Setup (배포 불필요) |
| ② | Claude Code가 스크립트 실행 | `brands/<브랜드>/theme.json`, 로고 파일 | `scripts/sync-theme.mjs` |
| ③ | 개발자가 Claude에 요청 | `brands/<브랜드>/root.css` | Claude Code 런북의 규칙 + 린트 |
| ④ | 개발자가 선택, Claude Code가 실행 | 프로젝트 저장소의 `force-app/.../lwc/*`, `.storybook/`, 스토리 | `scripts/create-project.mjs` |

**배포 형태 (미정):** 밀버스 저장소 안에 Claude Code용 런북(skill과 `CLAUDE.md`)을 두고, 각 프로젝트의 Claude Code가 그것을 읽어 위 단계를 수행한다. 후보는 (a) Claude Code 플러그인(skill)으로 설치, (b) 프로젝트 `CLAUDE.md`에서 밀버스 런북을 참조하는 방식이다. 10/23에는 (b)로 시연하고, (a)는 로드맵으로 둔다.

### 1.3 원칙

- **SLDS가 제공하는 것을 최대한 쓴다.** 버튼은 `lightning-button`을 그대로 쓴다. SLDS를 대체하는 자체 디자인 시스템을 만들지 않는다. **(확정)**
- **브랜드 차이는 root에서만 흡수한다.** 브랜드마다 버튼 모양이나 타이포가 달라도 컴포넌트 코드는 바꾸지 않는다. 브랜드 root style에서 **밀버스 변수(`--milvus-*`)**를 정의해 반영한다. SLDS global hook은 읽기 전용이다 ([2. 스타일 계층](#2-스타일-계층--root-style)). **(확정, org 반영 방식은 검증 필요)**
- **표현 컴포넌트와 데이터 컴포넌트를 분리한다.** 표현 컴포넌트는 `@api`로 데이터를 받고 이벤트로 결과를 올린다. `@wire`, Apex, LDS는 컨테이너 컴포넌트만 쓴다. Storybook에서 org 없이 렌더되지 않으면 표현 컴포넌트가 아니다. **(확정)**
- **파일럿은 토큰 레이어 + 컴포넌트 3개(`milvusBadge`, `milvusButton`, `milvusMultiSelect`)로 제한한다.** 검증 대상은 컴포넌트 개수가 아니라 구조다. **(확정)**

---

## 2. 스타일 계층 — root style

> **최신 결정 (2026-10-07, #11): 브랜드 스타일은 `brands/<브랜드>/util.css` 파일 하나로 관리한다.** 이 파일만 고치면 `lightning-*`를 포함한 모든 컴포넌트가 바뀐다.
>
> - **실측 (org, 2026-10-07):** Lightning Experience는 기본 컴포넌트(`lightning-button`·`-input`·`-combobox` 등)를 synthetic shadow로 그린다. 그래서 지금은 global hook, 컴포넌트 hook(`--slds-s-*` 등), `.slds-*` 클래스 규칙이 모두 닿는다. Storybook도 org와 같게 전부 synthetic으로 그린다. (2026-10-09 갱신: org에서 직접 잰 것은 hook이고, 클래스 규칙은 synthetic 실측에서 나온 결론이다. 클래스 규칙은 10/12 org 프로브에서 측정 예정(설계 14장), [Learn 09](<Learn/09-override와 공식 권고.html>) 2절)
>   - 다만 npm 패키지는 기본 컴포넌트 156개를 native shadow 지원으로 지정해 두었다(`package.json`의 `lwc.nativeShadowEnabledComponents`). Salesforce가 이 컴포넌트들을 native로 바꾸면 클래스 규칙은 그 컴포넌트 안에 닿지 않는다. custom property는 g·s 구분 없이 shadow 경계를 넘어 상속되지만, native에서는 SLDS 전역 CSS 안의 읽기 지점이 사라지고 **기본 컴포넌트의 native CSS가 읽는 이름에만 효과가 있다**(전환 시점은 미확인).
>   - **2026-10-09 정정:** 처음에는 "컴포넌트 hook은 닿지 않고 상속되는 global hook(`--slds-g-*`)만 닿는다"고 적었다. 전 컴포넌트 분석([`synthesis.md`](docs/research/2026-10-08/synthesis.md) 0장 5번 전제 수정)과 맞지 않아 고쳤다. native에서 s hook이 실제로 효과가 있는지는 실측이 필요하다(설계 14장).
>   - 경과: #11은 빌드 버그 때문에 모든 LWC가 native로 그려진 Storybook에서 측정했다. #14는 패키지 목록대로 혼합 모드로 그렸다. org 실측(#16)으로 둘 다 바로잡았다.
> - **util.css에는 global hook과 컴포넌트 hook을 쓴다(#18).** global hook(`--slds-g-*`)은 같은 hook을 쓰는 컴포넌트 묶음을 함께 바꾸고(예: 버튼 `radius-border-pill`, 입력창 `radius-border-2`, 카드 `radius-border-4`), 컴포넌트 hook(`--slds-s-*`)은 그 컴포넌트만 바꾼다(예: `--slds-s-button-radius-border`). 컴포넌트 hook은 native 전환 때 효과가 사라질 수 있다는 것을 알고 허용했다(2026-10-07 결정). 색 컴포넌트 hook은 브랜드 색에 이어진 것이 많아 막고, hover·선택 바탕 6개만 중립 g hook을 참조할 때 허용한다(2026-10-10). 영향 지도는 Storybook "Foundations / 브랜드 스타일 (util.css)"에 SLDS CSS에서 자동으로 나온다.
> - native 전환에도 유지해야 하거나 hook이 없는 모양은 밀버스 컴포넌트로 만들고, 그 컴포넌트가 읽는 `--milvus-*` 변수를 util.css에 넣는다. 예: `milvusButton`(#4)은 util.css에 `--milvus-button-custom: on`이 있으면 SLDS 버튼 블루프린트에 `--milvus-button-*`를 적용하고, 없으면 `lightning-button`을 그대로 그린다. `--slds-s-*`와 `--milvus-*`는 실제로 읽는 곳이 있는 이름만 쓸 수 있다(`pnpm test`가 검사).
>   - **2026-10-09 갱신:** 모양만 바꾸려고 밀버스 컴포넌트를 새로 만들지 않는다. hook·브리지로 안 되는 모양은 프로젝트 소유 opt-in `milvusOverride.css`의 클래스 규칙으로 바꾼다(공식 권고 밖, 마지막 수단). 밀버스 컴포넌트는 기능이 없을 때만 만들고, `milvusButton`은 비교 예시로 남는다(설계 1장, [Learn 09](<Learn/09-override와 공식 권고.html>)).
> - 브랜드 색은 util.css에서 바꾸지 않는다(org가 원본). `pnpm test`(`scripts/check-brands.ts`, 규칙은 `lib/rules.ts`)가 규칙을 검사한다.
> - **util.css 규칙 (2026-10-10, [설계](docs/specs/2026-10-08-milvus-package-design.md) 5.2·5.3으로 통합):** `:root` 블록 하나에 아래만 쓴다. 클래스 규칙과 `@font-face`는 쓰지 않는다.
>   - 허용: 이름에 color가 없는 `--slds-g-*`(글꼴 `--slds-g-font-family*` 제외. `--slds-g-shadow-4`를 바꾸면 포커스에 쓰이는 `-5`·`-6`을 기본값으로 따로 적는다), 포커스 그림자(값의 색은 `var(--slds-g-color-brand-base-15)`·`var(--slds-g-color-neutral-base-100)`만), 중립 색(`surface*`, `on-surface*`, `border-1/2`, `neutral-base-*`, `disabled*`, `on-disabled*`, `border-disabled*`, `*inverse*`, `palette-neutral-*`, `palette-yellow-80/90`. 값은 `light-dark()`, 글자·면 4.5:1 이상), 기본 컴포넌트 CSS만 읽는 g 이름 5개, 피드백 색(설계 5.3 표의 이름만. 글자색은 배경 위와 흰색 위 4.5:1 이상, 미달이면 같은 색조 40단계를 제안), SLDS 2 CSS나 기본 컴포넌트 CSS가 `var()`로 읽는 `--slds-s-*`, 색 s hook 6개, 밀버스 컴포넌트나 `milvusBridge.css`가 읽는 `--milvus-*`, 상속 속성 `letter-spacing`
>   - 금지: 브랜드 색 계열(`accent`·`on-accent`·`border-accent`·`brand-base`·`--slds-r-color-brand*`), 그 밖의 색 hook, `--slds-c-*`·`--sds-c-*`, 읽는 곳이 없는 이름(오타), 다른 일반 속성
>   - 이전 검사 스크립트(`check-brands.mjs`), CLAUDE.md 3장, 설계 5.2가 서로 달랐던 것을 이 규칙 하나로 맞췄다([`synthesis.md`](docs/research/2026-10-08/synthesis.md) 2.1)
> - 공식 권고(global hook 재정의 금지) 밖이라는 것을 알고 택한 방식이다. org에서는 정적 리소스 + `loadStyle`로 문서에 넣고, 같은 화면의 표준 UI에도 적용된다.
>
> 아래 2.1~2.4는 이 결정 이전의 설계(root.css, override.css)이며 기록으로 남긴다. root.css는 util.css로 합쳤고 override.css는 만들지 않는다.

브랜드에 따라 바뀌는 모든 것은 아래 계층 중 한 곳에만 있다. **컴포넌트 CSS에는 브랜드 값이 없다.**

| 계층 | 내용 | 출처 | 변경 주체 | 위치 |
| --- | --- | --- | --- | --- |
| **L1 브랜드 색** | 브랜드 색, 헤더 배경색 | org Themes and Branding | 관리자 (배포 불필요) | org → `brands/<브랜드>/theme.json` |
| **L2 로고** | 브랜드 로고 이미지 | org Themes and Branding | 관리자 | org → `brands/<브랜드>/logo.*` |
| **L3 브랜드 root style** | 타이포, 모서리 반경, 버튼 모양, 추가 색 등 org가 다루지 않는 것 | Claude에 입력한 브랜드 요구 | 개발자 (배포 필요) | `brands/<브랜드>/root.css` |
| **L4 컴포넌트** | `lightning-*`와 `milvus*` 컴포넌트 | 밀버스 디자인 시스템 | 디자인 시스템 오너 | `force-app/main/default/lwc/` (hook만 참조) |

### 2.1 제약: `lightning-button`의 모양은 SLDS 2에서 브랜드별로 바꿀 공식 경로가 없다

조사 결과(2026-09-26, 공식 문서 확인) 아래 세 가지가 동시에 성립한다.

| 사실 | 출처 |
| --- | --- |
| 컴포넌트 hook(`--slds-c-*`)은 **SLDS 1에서만** 지원된다. SLDS 2에서는 아직 지원하지 않는다 | LWC 개발자 가이드, `lightning-badge` 레퍼런스 |
| global hook(`--slds-g-*`)은 **재정의하지 말고 읽기 전용으로 쓰라** ("Redefining them can break the UI") | SLDS 2 Color Modes 가이드 |
| 커스텀 변수에 `--slds` 접두사를 쓰면 안 된다. 자체 접두사(예: `--milvus-*`)를 쓴다 | SLDS Linter 규칙 `no-slds-namespace-for-custom-hooks` |

즉 **"root에서 global hook을 바꿔 `lightning-button` 모양을 브랜드별로 바꾼다"는 방식은 공식 권고에 어긋난다.** 우리 org는 SLDS 2(`SLDS_v2`)다.

### 2.2 그래서 브랜드별 버튼은 이렇게 커버한다

**확정 (2026-09-26): 기능 하나에 컴포넌트 하나, root에 따라 자동 전환.** 프로젝트 코드는 항상 `<c-milvus-button>` 하나만 쓴다. 브랜드 root에 버튼 custom 값(신호 변수 `--milvus-button-custom`)이 없으면 내부에서 `lightning-button`을 그대로 렌더하고, 있으면 블루프린트 + `--milvus-button-*`로 렌더한다. Storybook에도 "Button" 항목 하나만 두고 현재 브랜드의 모드(SLDS 기본 / 밀버스 커스텀)를 표시한다. 다른 SLDS 기반 컴포넌트도 같은 방식을 따른다.


root에서 커버한다는 원칙은 유지한다. 다만 root가 바꾸는 대상은 **밀버스 변수(`--milvus-*`)**이고, 그 변수를 읽는 것은 밀버스 컴포넌트다.

| 순서 | 방법 | 적용 범위 | 비고 |
| --- | --- | --- | --- |
| 1 | L1 org 테마 색 | `lightning-button` 포함 전체 | 공식 경로. 코드 변경 없음 |
| 2 | **기본은 `lightning-button` 그대로** | — | 추구미(SLDS 최대 활용). 브랜드 차이가 색뿐이면 여기서 끝 |
| 3 | L3 root style에 `--milvus-button-*` 정의 + **`milvusButton`**(SLDS 버튼 블루프린트 `slds-button` 마크업 기반) | 브랜드 고유 버튼이 필요한 프로젝트 | 모양(반경, 굵기, 패딩)을 브랜드별로 바꾼다. 변수가 없으면 SLDS 기본값으로 떨어지게 `var()` fallback을 둔다 |
| 4 | **opt-in 확장 계층** `brands/<브랜드>/override.css`에서 `--slds-g-*` 재정의 | `lightning-button` 포함 전체 | **공식 권고 밖.** 고객사가 `lightning-button` 자체의 모양까지 요구할 때만 켠다. 아래 2.3 조건을 지킨다 |

**결정 (2026-09-26):** 공식 권고는 아니지만 **고객사별 니즈가 다양하므로 `milvusButton`을 파일럿으로 구현한다.** "SLDS 블루프린트는 있는데 브랜드 대응 LWC가 없다"에 해당하므로 추가 기준에도 맞는다. 변수를 정의하지 않은 브랜드에서는 `lightning-button`과 똑같이 보여야 한다. 그래서 SLDS를 기본으로 쓰는 원칙과 브랜드 고유 버튼이 함께 성립한다.

#### opt-in 확장 계층 (`override.css`) 조건

- 기본은 꺼져 있다. `milvus.config.json`의 `"overrides": true`로 켠 브랜드에만 로드한다
- 재정의할 수 있는 `--slds-g-*`는 **별도 허용 목록**으로 제한한다. 모양 관련만 넣는다. 후보는 반경 `--slds-g-radius-border-1..4`·`-pill`·`-circle`, 폰트 굵기 `--slds-g-font-weight-*`이며, 이름과 값은 SLDS 2 패키지 `@salesforce-ux/design-system-2` 2.264.2 Cosmos CSS에서 확인했다 (`radius-border-1..4` = 0.25 / 0.5 / 0.75 / 1.25rem, `pill` = 15rem). 색(accent 계열)은 org 테마가 원본이므로 재정의하지 않는다
- H4 lint는 이 파일에서 차단 대신 **경고**를 내고, 그 외 파일에서의 재정의는 계속 차단한다
- SLDS 버전 업데이트나 Salesforce 릴리스(연 3회) 때마다 해당 브랜드를 Storybook과 org에서 다시 확인한다
- Salesforce가 SLDS 2 컴포넌트 hook을 지원하면 이 계층을 그쪽으로 옮긴다

### 2.3 root style 규칙 (Claude가 ③단계에서 지켜야 할 것)

- 수정 대상은 `brands/<브랜드>/root.css` **한 파일**뿐이다. 컴포넌트 CSS는 건드리지 않는다
- `root.css`에서 정의할 수 있는 것은 **밀버스 변수(`--milvus-*`) 허용 목록**뿐이다 (타이포, 버튼 모양, 반경 등). 허용 목록은 Phase 3에서 만든다
- `--slds-g-*` 재정의는 `override.css`(opt-in)에서만, 별도 허용 목록 안에서만 한다
- `root.css`와 컴포넌트 CSS에서 `--slds-g-*`는 **읽기만** 한다
- `--slds-c-*`는 쓰지 않는다. SLDS 2에서 지원되지 않는다
- L1 색(브랜드 색)은 root style에서 덮어쓰지 않는다. 색은 org가 원본이다
- "`lightning-button`을 둥글게" 같은 요구는 먼저 `milvusButton`을 제안한다. 사용자가 `lightning-button` 자체를 원하면 `override.css`의 위험(공식 권고 밖, 릴리스마다 재확인)을 설명하고 **확인을 받은 뒤에** 켠다
- 결과는 Storybook에서 눈으로 확인하고, 린트를 통과한 뒤 PR로 리뷰한다

### 2.4 org에는 root style을 어떻게 반영하나 (미확인)

Storybook에서는 브랜드 root style을 래퍼 요소에 주입하면 된다. `--milvus-*` 변수는 CSS 상속으로 shadow DOM 안까지 전달되므로, 실제 org에서도 **상위 요소에 선언만 하면** 밀버스 컴포넌트가 읽을 수 있다. 선언할 위치의 후보는 두 가지다.

- (a) 정적 리소스로 올린 CSS를 `lightning/platformResourceLoader`의 `loadStyle`로 로드
- (b) 밀버스 컴포넌트의 최상위 컨테이너(`:host`)에서 선언

`--milvus-*`는 SLDS 변수가 아니므로 "global hook 재정의 금지" 권고에는 걸리지 않는다. 어느 쪽이 배포와 유지보수에 나은지는 Phase 3에서 비교한다.

---

## 3. 현재까지 확인된 사실

| 항목 | 내용 | 상태 |
| --- | --- | --- |
| 작업 저장소 | `learndoshare/learndoshare_1` (git 루트는 상위 `learndoshare/`) | 확정 |
| 패키지 매니저 | pnpm만 사용. 로컬 pnpm 10.13.1, Node 24.4.1. 최신 pnpm은 12.x | 확정 |
| 테마 레코드 | org `learndoshare_1`에 커스텀 테마 `Milvus_DesignSystem` 1개 (SLDS_v2, 다크 모드 꺼짐) | 확인 |
| 색상 저장 위치 | `LightningExperienceTheme`에는 색 필드가 없다. `DefaultBrandingSetId` → `BrandingSet` → **`BrandingSetProperty`**(`PropertyName`/`PropertyValue`) | 확인 |
| 읽히는 값 | 색은 `BRAND_COLOR` = `#0176D3`, `HEADER_BACKGROUND_COLOR` = `#FFFFFF` 두 개뿐이다. 자동 생성 팔레트는 API로 읽을 수 없다. 로고는 `BRAND_IMAGE`에 org 내부 경로(`/file-asset/...`)로 들어 있다 | 확인 |
| 로고 파일 다운로드 | `BRAND_IMAGE`의 `/file-asset/<이름>` 경로는 Bearer 토큰으로 요청하면 로그인 HTML이 온다(받을 수 없음). 대신 `ContentAsset`(DeveloperName = 경로의 `<이름>`) → `ContentDocumentId` → 최신 `ContentVersion` → REST `/sobjects/ContentVersion/<Id>/VersionData`로 원본 파일을 받을 수 있다 (2026-09-26 실측: 600×120 JPG) | 확인 |
| SLDS 2 | Winter '26부터 전 에디션 GA. 새 org는 기본이다. 단 Essentials Edition은 새 org에서도 기본이 아니고 Setup에서 켠다(2026-10-09 갱신, Learn 01). 기존 org는 Themes and Branding에서 선택. 모바일 앱·빌더·Experience Cloud에는 적용되지 않는다 | 확인 |
| styling hook 제약 | `--slds-c-*`는 SLDS 1에서 GA다. SLDS 2에서는 Winter '27부터 Developer Preview(운영 금지, 케이스로 신청)이고, LWC 개발자 가이드는 아직 "미지원"으로 적는다(2026-10-09 갱신, [조사 기록](docs/research/2026-10-09-slds2-customization.md)). `--slds-g-*`는 재정의 금지(읽기 전용). `var()` fallback 필수(린트 규칙) | 확인 |
| `lightning-*` 로컬 렌더 경로 | npm `lightning-base-components`(Salesforce 배포, MIT, alpha 태그만 존재)에 `badge`, `button` 등이 들어 있다. 조건은 **전역 SLDS CSS**와 **`@lwc/synthetic-shadow`**. 패키지 내부의 `@salesforce/*` 스텁은 **우리 컴포넌트에는 적용되지 않는다** | 확인 (실제 렌더는 미검증) |
| SFDX 경로 모듈 해석 | `@lwc/module-resolver`의 `dir` 레코드에는 `namespace` 옵션이 없다. `force-app/main/default/lwc/x`를 `c/x`로 쓰려면 컴포넌트마다 alias 레코드(`{ name: "c/x", path: ... }`)를 두거나 `c` 심볼릭 링크 폴더를 쓴다 | 확인 (resolver 실험) |
| 브랜드 팔레트 생성 규칙 | Setup 새 테마 화면에서 44색을 넣고 견본 7칸(`COLOR_95`~`COLOR_10`)을 DOM에서 실측해 역산했다(`scripts/palette.measured.json`). **CIELAB 명도 고정**(96·91·49·39·29·19·8, 브랜드 밝기와 무관) + **색상각 유지** + **상대 채도**. 원본 브랜드 색은 그대로 들어가지 않는다(`#0176D3` → 50단계 `#2976ca`, `#FFD600` → `#8a7300`). 50단계 L* 49는 흰 글자 대비 4.5:1(공식: accent는 WCAG 기준으로 자동 생성). 구현 `lib/palette.ts`(검사 `tests/palette.test.ts`): 실측 대비 평균 ΔE 0.07 / 최대 0.64, 학습에 쓰지 않은 20색 평균 0.13. 채도 혼합 계수와 Setup에 안 보이는 10단계는 추정 | 확인 (2026-10-05) |
| SLDS 전체 컴포넌트 카탈로그 | npm `lightning-base-components`의 공식 예제(`__examples__`)를 그대로 컴파일해 Storybook "컴포넌트/기본" 섹션을 자동 생성한다(`scripts/generate-slds-catalog.mjs`). **73개 컴포넌트, 예제 249개 전수 렌더 확인(오류 0).** `primitive*`·`*Private`는 내부용이라 제외. npm에 없는 것(org 데이터 필요): record form 계열, `input-field`, `record-picker`, `file-upload`, `map`, `input-rich-text` → Live Preview로 확인 | 확인 (#9, 2026-10-07) |
| LWC shadow 모드 (org · Storybook) | org(Lightning Experience, SLDS 2)는 기본 컴포넌트를 synthetic으로 그린다. 홈, 계정 목록, 새 계정 화면에서 실측했고 native는 내부 primitive 3개뿐이다. 패키지의 `lwc.nativeShadowEnabledComponents`(156개)는 org에 아직 적용되지 않았다. Storybook도 전부 synthetic으로 그린다. `@lwc/synthetic-shadow`는 엔진보다 먼저 실행돼야 해서 `lib/lwc-build.ts`가 별도 chunk로 뺀다. npm 패키지는 기능 게이트(`@salesforce/gate/*`)를 모두 열어 두는데, combobox의 ElementInternals 게이트(`bc.260.enableComboboxElementInternals`)는 synthetic에서 오류가 나서 닫는다. org에서도 닫혀 있다고 본다 | 확인 (#16, 2026-10-07) |
| SFDX 폴더 구조 | 로컬 `sf project convert source`로 확인. Apex는 `classes/utils/design/X.cls` 중첩 가능. LWC는 `lwc/utils/design/<번들>`이면 번들 이름이 `utils`로 잘못 인식되어 **불가**, `force-app/utils/design/lwc/<번들>`처럼 `lwc` 폴더를 하위 경로에 두면 가능 | 확인 (2026-10-07) |
| SLDS 2 CSS 패키지 | 최신 SLDS 2는 **별도 패키지 `@salesforce-ux/design-system-2`**(2.264.2)다. `@salesforce-ux/design-system`(2.264.1)은 SLDS 1 빌드라서 버튼 색 등이 `rgb(1,118,211)`로 고정돼 브랜드를 따라가지 않는다. SLDS 2의 `slds2.cosmos.css`는 브랜드 참조 팔레트(`--slds-r-color-brand-*`)를 `:where(html)`에 선언하고 accent hook이 그것을 읽는다. 라이선스는 무료 복제·배포·공개 표시 허용 | 확인 (2026-09-26 Storybook에서 실측) |
| Storybook 통합 (분기점) | **통과.** SFDX 경로 alias + `lightning-base-components` + synthetic-shadow + SLDS 2 CSS로 `lightning-button`·`lightning-badge`·`lightning-combobox`가 렌더되고, 브랜드 전환이 `lightning-button` 색까지 반영된다. pnpm에서는 `@lwc/engine-dom`·`@lwc/wire-service`를 직접 선언해야 한다. 아이콘은 SVG 템플릿으로 번들되어 스프라이트가 필요 없다 | 확인 (#3) |
| Storybook | 최신 10.6.0. ESM 전용이고 `addon-essentials`가 없다(core에 통합). 프레임워크는 `@storybook/web-components-vite` | 확인 |
| 공식 로컬 미리보기 | Spring '26에 **Live Preview**로 이름이 바뀌었다(`sf lightning dev app / site / component`). 단일 컴포넌트 미리보기에서 LDS wire adapter, `@salesforce` scoped module, Apex를 쓸 수 있다(Winter '26~). HMR 지원 | 확인 |
| 한 org에 테마 여러 개 | 커스텀 테마는 최대 300개, 활성은 1개 (공식 문서). Storybook에 여러 브랜드를 띄우는 것은 Phase 4에서 확인 | 확인 |
| SLDS 2 테마의 헤더 배경색 | SLDS 2 테마에서는 배경색·배경 이미지·글로벌 헤더 색을 쓸 수 없다(접근성). API의 `HEADER_BACKGROUND_COLOR`는 저장만 된 값일 수 있다 | 확인 |
| 브랜드 단위 | org 단위인지 Lightning 앱 단위인지. 앱 브랜딩은 내장 테마는 항상 덮어쓰지만, 커스텀 테마를 덮으려면 App Manager의 override 옵션이 필요하다 | 미정 |

---

## 4. 진행 계획

앞 단계가 실패하면 뒤 단계가 무의미해지도록 순서를 정했다. 기간은 **예상치**다.

```
Phase 0  학습 ───────────────────────────────────── (병행)
Phase 1  기반 셋업 (pnpm, husky, Storybook) ─────── 0.5일
Phase 2  ★ 분기점: lightning-* 렌더 검증 ────────── 1.5일
           ├─ 성공 → Phase 3
           └─ 실패 → LWC Garden 검증(3일) → org 내 문서 앱
Phase 3  스타일 계층 + milvusButton 구현 ──────── 2일
Phase 4  테마 동기화: 색 + 로고 (pnpm sync:theme) ─── 1.5일
Phase 5  파일럿 컴포넌트 ─────────────────────────── 2일
Phase 6  ★ 프로젝트 시작 워크플로 (Claude Code 런북) ─ 3일
Phase 7  보조 실습: Storybook vs Live Preview ────── 0.5일
Phase 8  발굴·린트 ───────────────────────────────── 0.5일
Phase 9  발표 준비 ───────────────────────────────── 마지막
```

### Phase 0 — 학습 (계속 병행)

`Learn/` 폴더의 자료를 Phase 순서에 맞춰 읽는다. [7. 학습 자료](#7-학습-자료-learn) 참고.

### Phase 1 — 기반 셋업

**목표:** 이 저장소를 pnpm 기반 SFDX + Storybook 프로젝트로 만든다.

- [ ] **pnpm 버전 결정 (미정):** 11부터 설정 위치(`.npmrc` → `pnpm-workspace.yaml`)와 빌드 스크립트 승인 방식(`allowBuilds`)이 바뀌었다. 정한 버전을 `package.json`에 고정한다 ([07 pnpm](<Learn/07-pnpm.html>))
- [ ] 스크립트의 `npm run`을 `pnpm`으로 교체 (`package.json`, `.husky/pre-commit`)
- [ ] `pnpm install` → `pnpm-lock.yaml` 커밋, `package-lock.json`은 `.gitignore`에 추가
- [ ] **husky 설치 경로 수정:** git 루트가 상위 `learndoshare/`라서 지금은 hook이 설치되지 않는다. `prepare`를 `cd .. && husky learndoshare_1/.husky`로 바꾸고, `pre-commit`은 `cd learndoshare_1 && pnpm exec lint-staged`, `commit-msg`는 [커밋 규칙](../CONTRIBUTING.md) 형식 검사로 둔다
- [ ] 의존성 추가: `lwc`, `@lwc/rollup-plugin`, `@lwc/synthetic-shadow`, `lightning-base-components`(`-E`로 고정), `@salesforce-ux/design-system-2`(SLDS 2), `rollup`, `@rollup/plugin-node-resolve`, `@rollup/plugin-replace`, `lit`
- [ ] `pnpm create storybook@latest --type web_components`로 초기화. docs와 a11y는 별도 애드온이다

- [ ] Claude Code hook H1(pnpm 강제), H2(sf 명령·개인정보 차단), H3(커밋 검사), H6(세션 컨텍스트)를 `.claude/settings.local.json`에서 검증 후 `.claude/settings.json`으로 이동 ([11. Claude Code 자동화](#11-claude-code-자동화--hook--skill))

**완료 기준:** `pnpm storybook`으로 기본 예제가 뜨고, 규칙에 맞지 않는 커밋 메시지는 거부된다. Claude가 `npm`이나 `sf project deploy`를 실행하려 하면 hook이 막는다.
**hoisting 문제가 생기면:** `publicHoistPattern`에 `*storybook*`을 추가한다. `shamefullyHoist`는 최후 수단이다.

### Phase 2 — ★ 분기점: `lightning-*`이 Storybook에서 렌더되는가

**프로젝트 전체의 성패를 가른다.** digitalflask PoC 방식을 따르고, 그 글이 풀지 못한 부분을 채운다.

| 단계 | 내용 |
| --- | --- |
| 1 | `rollup.lwc.config.js`: `lightning-base-components`는 `{ npm }` 레코드로, SFDX 컴포넌트는 `dir` 레코드에 네임스페이스 옵션이 없으므로 **컴포넌트마다 alias 레코드**(`{ name: "c/milvusBadge", path: "force-app/main/default/lwc/milvusBadge/milvusBadge.js" }`)로 등록한다. alias 목록은 폴더를 읽어 자동 생성한다. 다중 entry를 **한 번의 빌드**로 묶어 LWC 엔진 중복을 막는다 |
| 2 | `milvusBadge`(내부에 `<lightning-badge>`)와 버튼 확인용 스토리(`<lightning-button>` 변형들)를 작성한다 |
| 3 | `.storybook/preview.js`: `@lwc/synthetic-shadow`를 **가장 먼저** import하고 SLDS CSS를 전역으로 로드한다 |
| 4 | 스토리에서 `dist/` 결과물을 import하고, `CustomElementConstructor`로 등록한 뒤 lit `html`로 렌더한다 |
| 5 | 같은 컴포넌트를 org에 배포해 **Storybook과 org 화면을 나란히 캡처해 비교**한다 (배포 전 확인) |

**완료 기준:** `lightning-badge`와 `lightning-button`이 SLDS 스타일로 렌더되고, org 화면과 눈에 띄는 차이가 없다. `rollup -w`와 병행하면 저장 후 몇 초 안에 반영된다.

**실패 시:** 에러를 분류한다(pnpm 모듈 해석 / LWC 컴파일 / 런타임 shadow·SLDS). 해결되지 않으면 LWC Garden을 3일간 검증하고, 그것도 안 되면 org 내 문서 앱으로 간다.

### Phase 3 — 스타일 계층: 브랜드 decorator + root style

**목표:** 컴포넌트 코드를 바꾸지 않고 Storybook 툴바에서 브랜드를 바꾸고, 브랜드별 버튼 모양이 root에서 바뀌는 것을 증명한다.

- [ ] `brands/<브랜드>/` 폴더 구조 확정 (`theme.json`, `root.css`, `logo.*`)
- [ ] `.storybook/preview.js`에 `globalTypes`로 브랜드 툴바, decorator로 브랜드 스코프(래퍼 요소)에 L1 색과 L3 root style 적용
- [ ] **`--milvus-*` 허용 목록** 초안 작성 (타이포, 버튼 반경·굵기·패딩 등)
- [ ] `milvusButton` 구현: SLDS 버튼 블루프린트(`slds-button`) 마크업 + `--milvus-button-*` 변수 + SLDS 기본값 fallback. `lightning-button`과 같은 `@api`(label, variant, icon-name, disabled, type)를 우선 지원한다. 변수가 없는 브랜드에서 `lightning-button`과 똑같이 보이는지 나란히 비교한다
- [ ] `override.css` 실험: `--slds-g-*` 반경·폰트 재정의가 `lightning-button`에 반영되는 범위를 실측하고, 별도 허용 목록을 만든다
- [ ] org 반영 방식(정적 리소스 `loadStyle` / 컨테이너 `:host` 선언)을 비교한다

**완료 기준:** 하드코딩한 브랜드 2개를 툴바에서 바꾸면 색은 `lightning-button`까지 함께 바뀌고, 버튼 모양(둥근 / 각진)은 `milvusButton`에서 바뀐다. `override.css`를 켠 브랜드에서는 `lightning-button`의 모양도 바뀌는지 기록한다.
**주의:** Storybook의 브랜드 전환은 **시뮬레이션**이다. 실제 org에서 색은 관리자가 Setup에서 바꾼다.

### Phase 4 — 테마 동기화: 색 + 로고 `pnpm sync:theme`

**목표:** 명령 한 번으로 org의 테마를 전부 읽어 Storybook의 메인 컬러 시스템과 로고를 구성한다.

```
pnpm sync:theme
  → sf CLI (Tooling API)
      LightningExperienceTheme: DeveloperName, MasterLabel, DefaultBrandingSetId
      BrandingSetProperty:      BrandingSetId, PropertyName, PropertyValue
  → BrandingSetId로 테마와 속성 연결
  → BRAND_COLOR → accent 계열 hook 값 생성         → brands/<테마>/theme.json
  → BRAND_IMAGE → ContentAsset → ContentVersion 파일 → brands/<테마>/logo.<확장자>
  → Storybook: 툴바 브랜드 목록, 사이드바 로고(manager 테마), 컬러 시스템 문서 페이지에 반영
```

- [ ] `scripts/sync-theme.mjs` 작성 (테마 레코드를 **전부 순회**)
- [ ] 로고 다운로드 구현 ([로고 받는 방법](#로고-받는-방법-확인됨)대로)
- [ ] 컬러 시스템 문서 페이지: 브랜드 색과 파생 색 견본을 보여 주는 스토리
- [ ] Setup에서 두 번째 테마를 만들고 `pnpm sync:theme` 한 번으로 추가되는지 확인
- [ ] 산출물에 토큰이나 인증 정보가 섞이지 않는지 점검

**한계 (발표에서 밝힐 것):** API로는 원본 색 하나만 읽힌다. 파생 색은 Setup 화면을 실측해 역산한 규칙으로 계산한다. 화면에 보이는 7단계는 실측과 눈으로 구분되지 않는 수준(평균 ΔE 0.07)으로 맞지만, 정확한 식은 비공개라 나머지 10단계는 추정값이다.

#### 로고 받는 방법 (확인됨)

`BRAND_IMAGE` 값은 `/file-asset/X20250411104726_milvus_logo_1?v=1` 같은 org 내부 경로다. 이 경로는 브라우저 세션용이라 CLI 토큰으로는 받을 수 없다. 아래 순서로 받는다.

| 단계 | 호출 | 얻는 것 |
| --- | --- | --- |
| 1 | Tooling `BrandingSetProperty` (`PropertyName = 'BRAND_IMAGE'`) | `/file-asset/<이름>?v=1` → `<이름>` 추출 |
| 2 | SOQL `SELECT ContentDocumentId FROM ContentAsset WHERE DeveloperName = '<이름>'` | 문서 Id |
| 3 | SOQL `SELECT Id, FileExtension FROM ContentVersion WHERE ContentDocumentId = '<문서 Id>' AND IsLatest = true` | 버전 Id, 확장자 |
| 4 | REST `GET /services/data/v67.0/sobjects/ContentVersion/<버전 Id>/VersionData` (`Authorization: Bearer`) | 파일 원본 → `brands/<테마>/logo.<확장자>` |

**script · skill · hook에 넣는 방식**

- **script (`scripts/sync-theme.mjs`):** 1~4단계를 모두 script 안에서 처리한다. 토큰은 `sf org display --json` 결과를 **메모리에서만** 쓰고, 출력하거나 파일로 남기지 않는다. 받지 못하면 경고를 출력하고 종료 코드 0으로 끝낸다 (색 동기화는 막지 않는다)
- **skill (`milvus-init` ②단계):** Claude는 로고를 직접 받지 않고 `pnpm sync:theme`만 실행한다. 결과로 `logo.*`가 생겼는지 확인하고, 없으면 "Setup > Themes and Branding에서 로고를 올렸는지" 확인하도록 사용자에게 안내한다
- **hook**
  - H2(`guard-sf`): `sf org display`는 토큰을 출력하므로 **Bash로 직접 실행하는 것을 차단**한다. script 안에서 호출하는 것만 허용된다(hook은 Claude의 도구 호출만 검사하므로 script 내부 호출은 영향받지 않는다)
  - H3(`guard-commit`): 커밋 diff에 `00D…!` 형태의 액세스 토큰 패턴이 있으면 차단한다
  - H5(`guard-generated`): `logo.*`는 script만 만든다. 직접 편집하거나 다른 이미지로 교체하는 것을 막는다
- **로고는 커밋한다** (2026-09-26 결정). Pages 배포본에 로고가 들어가야 하기 때문이다. 공개 저장소이므로 로고 외의 org 파일은 받지 않는다


### Phase 5 — 파일럿 컴포넌트

| 순서 | 대상 | 증명하는 것 |
| --- | --- | --- |
| 1 | **색상/토큰 레이어** | L1~L3 계층, global hook + `var()` fallback 규칙 |
| 2 | **의미색 뱃지** (`milvusBadge`) | `lightning-badge`에 없는 성공·경고·위험 변형. 의미색은 브랜드색과 별개 계층이다 |
| 3 | **브랜드 버튼** (`milvusButton`) | Phase 3에서 구현. 여기서는 스토리 3종, 사용 기준 문서(언제 `lightning-button` 대신 쓰는가), Jest를 마무리한다 |
| 4 | **multi 검색** (`milvusMultiSelect`) | `lightning-combobox`는 다중 선택을 지원하지 않는다. 다중 선택 기본 컴포넌트는 `lightning-dual-listbox`와 `lightning-select`(`multiple`, 네이티브 목록 상자)뿐이고, 검색 가능한 다중 선택 콤보박스는 없다 **(컷 1순위)** |

각 컴포넌트마다 표현 컴포넌트로 작성, 스토리(기본 / 변형 / 브랜드별), 사용 기준 문서(언제 쓰는지, 언제 쓰면 안 되는지), Jest 테스트를 갖춘다. 컴포넌트마다 **메타데이터(이름, 설명, 의존 컴포넌트)**를 두어 Phase 6의 선택 목록에 쓴다.

### Phase 6 — ★ 프로젝트 시작 워크플로 (Claude Code 런북)

**목표:** [1.2 핵심 시나리오](#12-핵심-시나리오--새-프로젝트-시작-중점-실습)의 4단계를 새 프로젝트에서 처음부터 끝까지 재현한다. **발표의 중점 실습이다.**

- [ ] **런북:** 밀버스 저장소에 Claude Code용 런북 작성 (`CLAUDE.md` + `.claude/skills/milvus-init/`). 4단계 절차, root style 규칙(2.2), 금지 사항을 담는다
- [ ] **③ root style 조정:** 자연어 브랜드 요구 → `brands/<브랜드>/root.css` 수정. 허용 목록 밖의 변경은 거부하고 이유를 설명하게 한다
- [ ] **④ 전용 Storybook 생성:** `scripts/create-project.mjs --brand <테마> --components badge,button --out <경로>`
  - 선택한 컴포넌트와 의존 컴포넌트, 해당 스토리, 브랜드 폴더, Storybook 설정을 대상 프로젝트로 복사
  - 대상 프로젝트는 SFDX 구조를 유지하므로 그대로 org에 배포할 수 있다
- [ ] **`milvus.config.json`:** `create-project.mjs`가 디자인 시스템 버전, 브랜드, 선택한 컴포넌트와 checksum을 기록한다 ([11.3](#113-최종-목표--밀버스-플러그인으로-프로젝트-세팅-체계화))
- [ ] **리허설:** 상위 저장소에 `learndoshare_2`를 "새 프로젝트"로 만들어 ①~④를 처음부터 끝까지 실행해 본다

**완료 기준:** 빈 SFDX 프로젝트에서 Claude Code에 "밀버스 디자인 시스템으로 시작해줘"라고 요청하면 ①(안내) → ② → ③ → ④가 진행되고, 해당 브랜드의 전용 Storybook이 뜬다.

### Phase 7 — 보조 실습: Storybook과 `sf lightning dev component` 비교

**목표:** 두 도구의 역할 분담을 같은 컴포넌트로 확인한다. 발표에서는 2분 분량의 보조 실습으로 쓴다.

| 실험 | 대상 | 확인할 것 |
| --- | --- | --- |
| B-1 | 표현 컴포넌트 `milvusBadge` | 두 도구 모두에서 렌더되는가, 수정 반영 속도 |
| B-2 | 컨테이너 컴포넌트 (`@wire(getRecord)` → `milvusBadge`) | Live Preview에서 실제 org 데이터로 뜨는 것(Winter '26부터 LDS·Apex 지원)과, Storybook은 목 없이 안 뜨는 것을 확인 |

**예상 결론 (가설):** 개발 중 데이터가 붙은 확인은 `sf lightning dev`, 카탈로그·변형·브랜드·공유는 Storybook. 둘 다 쓰려면 표현/컨테이너 분리가 전제다.
> Live Preview는 처음 실행할 때 org에서 기능 활성화를 요청하고, View Setup과 Customize Application 권한이 필요하다. wire나 `@api`를 바꾸면 수동 새로고침이 필요하다.

### Phase 8 — 발굴·린트

- [ ] 발굴 쿼리로 "SLDS로 안 돼서 직접 만든 흔적"을 센다 (백로그에만 넣는다)
- [ ] SLDS Linter를 lint-staged에 배치한다 (hex 하드코딩, `--slds-c-*`, 선택자 안 hook 재할당 차단)
- [ ] 컴포넌트 추가 기준을 문서화한다

| 조건 | 판단 |
| --- | --- |
| 2개 이상 프로젝트나 화면에서 실제로 필요했다 | 공용으로 만든다 |
| 1곳뿐이다 | 그 프로젝트 안에 둔다 |
| SLDS base component 조합이나 root style로 된다 | 만들지 않는다 |
| SLDS 블루프린트는 있는데 LWC가 없다 | 우선순위 높음 |

### Phase 9 — 발표 준비

[5. 10/23 발표 준비 계획](#5-1023금-발표-준비-계획) 참고.

---

## 5. 10/23(금) 발표 준비 계획

> 관련 이슈: [a40418a/learndoshare#1](https://github.com/a40418a/learndoshare/issues/1) (계획, 완료) · 구현: [#3](https://github.com/a40418a/learndoshare/issues/3) Storybook 기반·배포 → [#4](https://github.com/a40418a/learndoshare/issues/4) `milvusButton`·root style → [#5](https://github.com/a40418a/learndoshare/issues/5) 브랜드 입력 skill → [#6](https://github.com/a40418a/learndoshare/issues/6) 컴포넌트 활성화 선택
> 남은 기간: 9/28(월)부터 약 4주, 실제 작업일 18일 (10/9 한글날 제외)

### 5.1 주차별 일정

| 주차 | 날짜 | 작업 | 학습 자료 | 완료 기준 |
| --- | --- | --- | --- | --- |
| **W1** 분기점 | 9/28(월) | Phase 1 기반 셋업 | 01 SLDS, 07 pnpm | `pnpm storybook` 기본 화면, 커밋 규칙 hook 동작 |
| | 9/29(화)~9/30(수) | Phase 2 `lightning-badge`, `lightning-button` 렌더 검증 | 02 LWC, 04 통합 | SLDS 스타일로 렌더 |
| | 10/1(목) | org에 배포해 화면 비교 (배포 전 확인) | — | Storybook/org 비교 캡처 |
| | **10/2(금)** | **★ go/no-go 판단** | — | 성공이면 W2, 실패면 LWC Garden |
| **W2** 브랜드 | 10/5(월)~10/6(화) | Phase 3 스타일 계층, **`milvusButton` 구현**, `--milvus-*` 허용 목록, `override.css` 실험 | 03 스토리북 | 브랜드 2개에서 `milvusButton` 모양 전환, `override.css` 반영 범위 기록 |
| | 10/7(수)~10/8(목) 오전 | Phase 4 `pnpm sync:theme` (색 + 로고), 두 번째 테마 생성 | 05 테마 동기화 | 명령 1번으로 org 테마 2개가 색·로고째 Storybook에 뜸 |
| | 10/8(목) 오후 | **발표 재료**: 실제 사례 캡처, 발굴 수치 | — | 캡처 2장, 수치 표 |
| | 10/9(금) | 한글날 휴일 | | |
| **W3** 워크플로 | 10/12(월) | Phase 5 `milvusBadge` 완성 + 컴포넌트 메타데이터 | — | 스토리 3종, Jest |
| | 10/13(화) | Phase 6 런북(`CLAUDE.md`, skill) + ③ root style 조정 | 08 Claude Code 런북 | 자연어 요구 → `root.css` 변경, 허용 목록 밖은 거부 |
| | 10/14(수) | Phase 6 ④ `create-project.mjs` (컴포넌트 선택 → 전용 Storybook) | — | 선택한 컴포넌트만 담긴 Storybook 생성 |
| | 10/15(목) | Phase 6 리허설: `learndoshare_2`로 ①~④ 전체 실행, `milvusMultiSelect`는 여유 있을 때만 | — | 처음부터 끝까지 막힘 없이 진행 |
| | **10/16(금)** | Phase 7 보조 실습(오전, 컷 5순위), **★ 내용 동결**, 슬라이드 뼈대 | 06 도구 비교 | 비교 기록표. 이후 기능 추가 없음 |
| **W4** 발표 | 10/19(월) | 시연 녹화: 실습 A 프로젝트 시작(2~3분), 실습 B 도구 비교(30초) | — | 녹화 파일 2개 |
| | 10/20(화) | PPT, runbook 최종본 생성 | — | 자리표시자 0개 |
| | 10/21(수) | 리허설 1 (동료 1~2명), 피드백 반영 | — | 시간 안에 끝남 |
| | 10/22(목) | 리허설 2, 장비와 데모 환경 점검, 버퍼 | — | 녹화 재생 확인 |
| | **10/23(금)** | **발표** | | |

### 5.2 판단 시점과 컷 라인

**10/2 go/no-go에서 실패해도 발표는 성립한다.** "업계 PoC도 못 푼 부분을 검증했더니 이렇게 안 됐다. 그래서 대안으로 간다"는 그 자체로 제안의 근거다. 이 경우 W2 초반을 LWC Garden 검증으로 대체하고, 실습 A의 ④는 Garden 기반으로 바꾼다.

일정이 밀리면 아래 순서로 뺀다.

| 순서 | 뺄 것 | 대체 |
| --- | --- | --- |
| 1 | `milvusMultiSelect` 구현 | 선택 목록에 "설계 중"으로만 표시, 다음 단계 슬라이드 |
| 2 | 로고 자동 동기화 | 로고 파일을 수동으로 두고, 색만 자동 동기화 |
| 3 | Claude Code 플러그인(skill) 배포 형태 | 프로젝트 `CLAUDE.md`가 밀버스 런북을 참조하는 방식으로 시연 |
| 4 | SLDS Linter 적용 | 규칙 목록만 제시 |
| 5 | 보조 실습 B (도구 비교) | 비교표 1장으로 대체 |

**절대 빼지 않는 것:** 분기점 결과(성공이든 실패든), **실습 A 프로젝트 시작 4단계**, 결정 요청.

### 5.3 발표 구성

발표 시간은 **미정**이다 (아래는 25분 발표 + Q&A 5분 기준).

| # | 섹션 | 시간 | 핵심 메시지 | 필요 재료 | 확보일 |
| --- | --- | --- | --- | --- | --- |
| 1 | 실제로 있었던 일 | 3분 | 같은 SLDS인데 페이지마다 다르다 | 사례 화면 캡처 2장 | 10/8 |
| 2 | 왜 생기는가 | 2분 | 코드 속에만 있는 컴포넌트는 아무도 못 본다 | 발굴 수치 | 10/8 |
| 3 | React는 풀린 문제인데 왜 어려운가 | 3분 | LWC(Rollup) vs Storybook(Vite), Apex. Storybook 설명은 여기서 끝낸다 | 구조도, 공개 PoC도 `lightning-*`과 LDS 목킹을 못 풀었다는 사실. "Salesforce가 공식 문서를 Storybook으로 만든다"는 **사실이 아니므로 쓰지 않는다** (SLDS 2 공식 문서는 lightningdesignsystem.com) | 10/2 |
| 4 | 밀버스 방향 | 4분 | SLDS를 최대한 쓰되 브랜드 차이는 root에서. 스타일 계층 L1~L4. SLDS 2의 제약(`--slds-c-*` 미지원, global hook 읽기 전용)과 그래서 택한 방식 | 원칙 1장, 계층도 1장 | 10/16 |
| 5 | **실습 A: 새 프로젝트 시작** | 7분 | org 테마 → 색·로고 → Claude로 root style → 컴포넌트 선택 → 전용 Storybook | 녹화 (라이브는 여유 있을 때) | 10/19 |
| 6 | 실습 B: 도구 역할 분담 | 2분 | `sf lightning dev`와 Storybook은 경쟁이 아니라 역할이 다르다 | 비교표, 녹화 | 10/19 |
| 7 | 필요한 결정 | 3분 | 네임스페이스, 오너와 시간, 브랜드 단위, 배포 형태 | 결정 요청 목록 | 10/16 |
| — | Q&A | 5분 | | 예상 질문 답변 | 10/21 |

"디자인 시스템의 중요성"으로 시작하지 않는다. 개발팀은 첫 3분에 흥미를 잃는다.

### 5.4 예상 질문과 답변 준비

| 질문 | 답변 방향 |
| --- | --- |
| 토큰(테마)만 하면 되는 거 아닌가? | 브랜드 전환은 토큰과 root style로 풀린다. 컴포넌트를 만드는 이유는 중복 구현과 일관성이다 |
| 브랜드마다 버튼 디자인이 다르면? | 색은 org 테마로 `lightning-button`까지 바뀐다. 모양은 SLDS 2에 운영에서 쓸 공식 경로가 없다. 컴포넌트 hook(`--slds-c-*`)은 SLDS 2에서 Developer Preview(Winter '27, 운영 금지)이고 global hook은 읽기 전용이다. 그래서 요청이 있을 때만 util.css의 hook → 브리지 변수 → opt-in `milvusOverride.css`(마지막 수단, 공식 권고 밖) 순으로 바꾸고, 릴리스마다 재확인한다. 모양만 바꾸려고 밀버스 컴포넌트를 새로 만들지 않는다(기능이 없을 때만 만든다). `milvusButton`은 "새로 만드는 방식"의 비교 예시로 보여 준다(2026-10-09 갱신, [Learn 09](<Learn/09-override와 공식 권고.html>)) |
| Claude가 만든 스타일을 믿을 수 있나? | 수정 파일은 `root.css` 하나, 허용 목록 밖은 거부, 린트, Storybook 시각 확인, PR 리뷰를 거친다 |
| Storybook에서 브랜드를 바꾸면 org도 바뀌나? | 아니다. 시뮬레이션이다. 색은 관리자가 Setup에서, root style은 배포로 반영한다 |
| 공식 도구가 있는데 왜 Storybook까지? | 실습 B 결과. 개발 중 확인은 공식 도구, 카탈로그·브랜드·공유·프로젝트 시작은 Storybook |
| 폰트도 org에서 바꿀 수 있나? | 없다. Themes and Branding은 색·로고·이미지만 다룬다. 그래서 L3 root style이 있다 |
| SLDS 2로 가면 깨지지 않나? | global hook만 쓰고 `--slds-c-*`는 쓰지 않으므로 막히지 않는다 |
| 유지보수는 누가 하나? | 결정 요청 항목이다. 오너 1명, 주 4시간 이상을 제안한다 |

### 5.5 발표 당일 체크리스트

- [ ] 녹화 파일 2개를 발표 PC 로컬에 저장 (네트워크에 의존하지 않는다)
- [ ] 라이브 데모를 한다면 `pnpm storybook`을 미리 띄워 두고 org에 로그인해 둔다
- [ ] 결정 요청 슬라이드를 띄워 둔 채로 Q&A를 진행한다

---

## 6. 결정이 필요한 것 (미정)

- [ ] **네임스페이스 사용 여부.** 없으면 `c-milvus-badge`, 있으면 `milvus-badge`다. Dev Hub에 등록하면 변경·삭제가 불가능하다. 조직 차원에서 결정한다
- [ ] **배포 형태.** 최종 목표는 밀버스 플러그인([11.3](#113-최종-목표--밀버스-플러그인으로-프로젝트-세팅-체계화))이다. 컴포넌트는 복사 + checksum 관리로 시작할지, 처음부터 패키지로 설치할지 정한다
- [ ] **root style의 org 반영 방식.** 정적 리소스 `loadStyle` / 컨테이너 상속
- [ ] **브랜드 단위.** org 단위인가, Lightning 앱 단위인가
- [ ] **pnpm 버전.** 10(로컬 설치) / 12(최신)
- [ ] **테마 메타데이터 커밋 여부.** `force-app/main/default/lightningExperienceThemes/`
- [ ] **디자인 시스템 오너와 주당 확보 시간.** 최소 주 4시간 제안

---

## 7. 학습 자료 (`Learn/`)

각 Phase에 들어가기 전에 해당 자료를 브라우저로 열어 읽는다. 각 문서 끝에 **스스로 점검** 질문이 있다.

| 순서 | 자료 | 핵심 내용 | 선행 Phase | 예상 시간 |
| --- | --- | --- | --- | --- |
| 0 | [디자인 시스템과 Salesforce](<Learn/00-디자인 시스템과 Salesforce.html>) | 디자인 시스템 개념, SLDS 1과 2, styling hook(r → g → s → c), 브랜드(BrandingSet), shadow DOM과 스타일 범위, LEX와 Visualforce, 전 컴포넌트 분석, 밀버스의 층과 명령, 용어집 | 전체 | 1시간 |
| 1 | [세일즈포스 디자인 시스템](<Learn/01-세일즈포스 디자인 시스템.html>) | SLDS 1과 2, styling hook(global / component / 레거시 토큰), 블루프린트와 base component, 브랜드 모양과 milvusButton | 전체 | 1.5시간 |
| 2 | [LWC 기초](<Learn/02-LWC 기초.html>) | 컴포넌트 구조, `@api`/`@wire`, shadow DOM(synthetic / native / light), CSS 변수 상속, 표현/컨테이너 분리 | 2, 5 | 2시간 |
| 3 | [스토리북](<Learn/03-스토리북.html>) | CSF3, args·controls, decorator·globals(툴바), 로고·manager 테마, autodocs, 정적 빌드 | 1, 3 | 1.5시간 |
| 4 | [LWC와 스토리북 통합](<Learn/04-LWC와 스토리북 통합.html>) | Rollup과 Vite가 왜 충돌하는가, digitalflask 방식 해부, 미해결 과제와 해결 경로 | 2 | 2시간 |
| 5 | [테마와 브랜딩 동기화](<Learn/05-테마와 브랜딩 동기화.html>) | Theme → BrandingSet → Property 구조, Tooling API 조회, sync 스크립트 설계 | 4 | 1시간 |
| 6 | [로컬 개발 도구 비교](<Learn/06-로컬 개발 도구 비교.html>) | `sf lightning dev`, LWC Garden, Storybook, org 내 문서 앱 비교와 역할 분담 | 7 | 1시간 |
| 7 | [pnpm](<Learn/07-pnpm.html>) | strict node_modules, 버전별 차이(10 / 11+), 빌드 스크립트 승인, hoisting, husky | 1 | 1시간 |
| 8 | [Claude Code 런북](<Learn/08-Claude Code 런북.html>) | `CLAUDE.md`, skill, 프로젝트 시작 워크플로를 Claude Code가 수행하게 만드는 법 | 6 | 1시간 |
| 9 | [override와 공식 권고](<Learn/09-override와 공식 권고.html>) | 새 컴포넌트 vs 덮어쓰기, SLDS 1·2 커스터마이즈 범위, Salesforce가 권하지 않는 이유, 실험 A~C(세 방식 비교, synthetic·native 라이브 데모, 업데이트 위험), opt-in `milvusOverride.css` | 9 (발표) | 1시간 |

**추천 순서:** 0 → 1 → 7 → 2 → 3 → 4 → 5 → 8 → 6 → 9. 0(개념)으로 전체 그림을 잡고, 1(SLDS)과 7(pnpm)을 읽으면 Phase 1을 바로 시작할 수 있다. 9는 발표에서 override를 설명하기 전에 읽는다.

---

## 8. 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| `lightning-*`이 Storybook에서 렌더되지 않는다 | Storybook 방식 전체 무산 | Phase 2를 먼저 하고, 실패하면 LWC Garden → org 내 문서 앱 |
| SLDS 2에서 `lightning-button` 모양을 브랜드별로 바꿀 운영용 공식 경로가 없다 (확인됨. `--slds-c-*`는 Winter '27 Developer Preview, 운영 금지) | 버튼 모양 요청을 공식 수단만으로는 들어줄 수 없다 | 요청이 있을 때만 util.css의 hook → 브리지 변수 → opt-in `milvusOverride.css`(마지막 수단, 공식 권고 밖) 순으로 쓴다. 모양만 바꾸려고 밀버스 컴포넌트를 만들지 않고, `milvusButton`은 비교 예시로 둔다. 컴포넌트 hook이 GA가 되면 재검토한다(2026-10-09 갱신, [Learn 09](<Learn/09-override와 공식 권고.html>)) |
| `override.css`(global hook 재정의)가 Salesforce 릴리스 후 깨진다 | 해당 고객사 화면의 버튼 레이아웃이 틀어진다 | opt-in 브랜드에만 적용, 별도 허용 목록, 릴리스(연 3회)마다 Storybook·org 재확인, `milvus.config.json`에 사용 여부 기록 |
| root style을 org에 반영하는 방식이 정해지지 않았다 | Storybook에서만 되는 스타일이 된다 | Phase 3에서 `loadStyle` / `:host` 선언을 비교하고, 결정 요청 항목으로 올린다 |
| synthetic/native shadow 차이로 Storybook과 org 화면이 다르다 | 문서를 신뢰할 수 없다 | synthetic-shadow를 로드하고 org 화면과 나란히 비교한다 |
| Claude가 규칙 밖의 스타일을 만든다 | 브랜드 간 구조가 갈라진다 | 수정 파일 1개, 허용 목록, 린트, PR 리뷰 |
| API로 원본 색 하나만 읽힌다 | Storybook 파생 색이 org와 다를 수 있다 | 시뮬레이션임을 밝히고 핵심 색은 org 화면으로 교차 확인한다 |
| 로고를 받는 경로(ContentAsset → ContentVersion)가 org 설정이나 권한에 따라 막힌다 | ②단계 자동화가 불완전하다 | 받지 못하면 경고만 내고 색은 계속 동기화한다. 로고는 수동 배치 (컷 라인 2) |
| HMR이 없다 | "빠른 확인" 목표 일부 미달 | `rollup -w` 병렬 실행. 개발 중 확인은 `sf lightning dev`와 역할을 나눈다 |
| `lightning-base-components`가 alpha 태그로 배포된다 | 버전 변동 위험 | `-E`로 고정하고 업그레이드는 명시적으로만 한다 |

---

## 9. 목표 디렉터리 구조

```
learndoshare_1/                     # 밀버스 디자인 시스템 (공용)
├── force-app/main/default/lwc/
│   ├── milvusBadge/
│   └── milvusMultiSelect/
├── brands/                         # 브랜드별 스타일 계층
│   └── Milvus_DesignSystem/
│       ├── theme.json              # L1 색 (pnpm sync:theme 산출물)
│       ├── logo.png                # L2 로고 (pnpm sync:theme 산출물)
│       └── root.css                # L3 root style (Claude가 수정)
├── .storybook/
│   ├── main.js
│   ├── manager.js                  # 사이드바 로고
│   └── preview.js                  # synthetic-shadow, SLDS CSS, 브랜드 decorator
├── stories/
├── scripts/
│   ├── sync-theme.mjs              # ② 테마 가져오기
│   └── create-project.mjs          # ④ 전용 Storybook 생성
├── .claude/
│   ├── settings.json               # hook 등록 (팀 공유)
│   ├── hooks/                      # guard-pm, guard-sf, guard-commit, lint-style …
│   └── skills/                     # milvus-init, milvus-brand-style, milvus-new-component, milvus-issue
├── CLAUDE.md
├── rollup.lwc.config.js
├── Learn/                          # 학습 자료
└── package.json
```

---

## 10. 작업 규칙

- **이슈 · 브랜치 · 커밋 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 따른다.** 형식: `[태그] 요약 (#이슈번호)`, 브랜치 `<태그>/<이슈번호>-<설명>`
- **pnpm만 사용한다.** `npm`, `yarn`, `npx`는 쓰지 않는다
- **코드 작성 시 Ponytail 스킬을 켠다.** 구현 전에 "필요한가 → 이미 있나 → 플랫폼(SLDS·LWC·브라우저)이 제공하나 → 설치된 의존성으로 되나" 순서로 따진다. "SLDS를 최대한 쓴다"는 원칙과 같은 방향이다. 단, 검증·에러 처리·보안·접근성은 줄이지 않는다
- **`.sfdx`와 `.sf`는 절대 커밋하지 않는다** (org 인증 정보가 들어 있다)
- `sf` 배포·삭제 명령은 실행 전에 확인한다. 조회는 자유롭게 한다
- 컴포넌트 CSS 규칙
  - hex 하드코딩 금지, 브랜드 값 금지 (브랜드 값은 `brands/`에만)
  - `--slds-c-*` 사용 금지 (SLDS 2로 못 간다)
  - 컴포넌트 선택자 안에서 global hook 재할당 금지
  - `var()` fallback 유지: `var(--slds-g-color-surface-container-1, var(--lwc-colorBackgroundAlt))`

## 11. Claude Code 자동화 — hook · skill

참고: 사내 발표 "Claude Code를 내 규칙대로 움직이게 하기 — hook · script · lint" (2026-09-18).
**문서(CLAUDE.md)에 적은 규칙은 부탁이고, hook은 실행되는 코드다.** 위 [10. 작업 규칙](#10-작업-규칙)은 지금 전부 문서에만 있다. 어기면 대가가 있는 규칙만 hook으로 옮기고, 절차는 skill로 만든다.

### 11.1 hook — 지켜야 하는 규칙

| # | 이벤트 · matcher | script | 막는 것 | 판정 | 도입 시점 |
| --- | --- | --- | --- | --- | --- |
| H1 | PreToolUse · `Bash` | `guard-pm.mjs` | `npm` · `npx` · `yarn` 명령 | exit 2 + 대응하는 pnpm 명령을 stderr로 안내 → Claude가 스스로 고쳐 다시 실행 | Phase 1 |
| H2 | PreToolUse · `Bash\|mcp__salesforce-dx__.*` | `guard-sf.mjs` | 1층: `sf project deploy`, `sf data create/update/delete`, `sf apex run` 등 되돌릴 수 없는 명령 (조회·retrieve·describe·`lightning dev`는 통과). 2층: 통과한 조회에 개인정보 필드(`Phone`, `Email`, `MailingStreet` 등)나 `FIELDS(ALL)`가 있으면 차단. 3층: 토큰을 출력하는 `sf org display`와 `sf org auth` 계열은 Bash 직접 실행 차단 | 명령을 `&&` `;` `\|`로 쪼개 조각마다 검사. Bash와 MCP 두 경로를 같은 script가 판정 | Phase 1 |
| H3 | PreToolUse · `Bash` (`git commit`) | `guard-commit.mjs` | 스테이징된 `.sfdx/` · `.sf/` · `.env` · `package-lock.json`, 시크릿 패턴(`sk-`, `AKIA`, `ghp_`, `-----BEGIN PRIVATE KEY-----`), 커밋 메시지 형식(`[태그] 요약 (#N)`) 위반 | 정규식만 (0.1초). 감지한 값은 앞 6자만 출력 | Phase 1 |
| H4 | PostToolUse · `Edit\|Write` | `lint-style.mjs` | 컴포넌트 CSS: hex 색, `--slds-c-*`, `--slds-g-*` 재정의, fallback 없는 `var(--slds-*)`. `brands/*/root.css`: 허용 목록 밖의 변수, `--slds-*` 정의. `brands/*/override.css`: 별도 허용 목록 밖의 재정의는 차단, 목록 안은 경고 | exit 2 + 고치는 법을 stderr로 → 자가 수정 루프 | Phase 3 |
| H5 | PreToolUse · `Edit\|Write` | `guard-generated.mjs` | `brands/*/theme.json`, `logo.*` 직접 편집 (org에서 `pnpm sync:theme`으로만 생성) | exit 2 + "`pnpm sync:theme`을 실행하라" 안내 | Phase 4 |
| H6 | SessionStart | `session-context.mjs` | — (차단 아님) | 현재 Phase, 다음 판단 날짜(go/no-go 10/2, 동결 10/16), 금지 사항 5줄을 주입 | Phase 1 |

**운영 원칙 (발표에서 배운 점):**
- 편집마다 도는 PostToolUse(H4)에는 **0.2초 안에 끝나는 정규식**만 건다. SLDS Linter처럼 무거운 검사는 husky `pre-commit`(lint-staged)과 CI에서 돌린다
- stderr는 사람이 아니라 Claude가 읽는다. 위반마다 **고치는 법**을 함께 적는다
- `.claude/settings.local.json`에서 검증한 뒤 `.claude/settings.json`으로 옮겨 커밋한다
- 사람이 직접 하는 커밋은 husky `commit-msg`가, Claude가 하는 커밋은 H3가 막는다. 규칙은 같은 정규식 하나를 공유한다
- H2는 이 DE org에서는 과해 보여도 넣는다. 밀버스 런북을 가져가는 **실제 프로젝트는 운영 org에 붙는다**

### 11.2 skill — 반복되는 절차

| skill | 하는 일 | 연결 |
| --- | --- | --- |
| `milvus-init` | 새 프로젝트 시작 4단계(①~④)를 순서대로 진행. ①은 Setup 안내, ②는 `pnpm sync:theme`, ③은 `milvus-brand-style` 호출, ④는 컴포넌트 선택 후 `create-project.mjs` | 중점 실습 |
| `milvus-brand-style` | 자연어 브랜드 요구 → `brands/<브랜드>/root.css` 수정. 허용 목록 밖이면 거부하고 대안(`milvusButton` 등) 제시 | H4가 결과를 검사 |
| `milvus-new-component` | "만들기 전 확인"(SLDS로 되는가 → root style로 되는가 → 이미 있나)을 거친 뒤 컴포넌트, 스토리 3종, 사용 기준 문서, Jest 뼈대 생성 | Ponytail 사다리와 같은 방향 |
| `milvus-issue` | CONTRIBUTING 규칙대로 이슈 생성(YAML 폼 항목), 브랜치 생성, 커밋 메시지 작성 | H3가 형식 검사 |
| Ponytail (외부) | 구현 전 과잉 설계 억제. PR 전 `/ponytail-review` | [08 Claude Code 런북](<Learn/08-Claude Code 런북.html>) |

### 11.3 최종 목표 — 밀버스 플러그인으로 프로젝트 세팅 체계화

**목표 상태:** 새 프로젝트에서 밀버스 플러그인을 설치하고 `/milvus-init` 한 번을 실행하면, 사전 점검부터 첫 커밋까지 정해진 순서로 세팅이 끝난다. 사람마다, 프로젝트마다 세팅이 달라지지 않는다.

#### 구성

hook(지켜야 하는 규칙), skill(따라야 하는 절차), script(결정적으로 실행돼야 하는 작업)를 **밀버스 디자인 시스템 저장소 하나**에 플러그인으로 묶는다.

| 구분 | 이름 | 역할 |
| --- | --- | --- |
| skill | `milvus-init` | 새 프로젝트 세팅 전체 진행 (아래 흐름) |
| skill | `milvus-brand-style` | 브랜드 요구 → `root.css` (허용 목록 안에서만) |
| skill | `milvus-add-component` | 세팅 이후 컴포넌트 추가 선택 |
| skill | `milvus-update` | 디자인 시스템의 새 버전을 프로젝트에 반영 (변경 목록을 보여 주고 승인 후 적용) |
| skill | `milvus-doctor` | 프로젝트 상태 점검: 도구 버전, hook 설치, org 인증, 테마 동기화 시점, 컴포넌트 버전 차이 |
| skill | `milvus-new-component`, `milvus-issue` | 디자인 시스템 저장소 쪽 작업용 |
| hook | H1~H6 | 11.1과 같다. 플러그인을 설치하면 프로젝트에 함께 적용된다 |
| hook | **H7** PreToolUse · `Edit\|Write` | 밀버스가 관리하는 컴포넌트 파일을 프로젝트 안에서 직접 고치지 못하게 막는다 → "디자인 시스템 저장소에 이슈를 올리거나 `milvus-update`를 쓰라"고 안내 |
| hook | **H8** SessionStart | `milvus.config.json`이 없으면 "`/milvus-init`로 세팅하라"를 안내하고, 디자인 시스템 버전이 뒤처져 있으면 `/milvus-update`를 안내 |
| script | `sync-theme.mjs`, `create-project.mjs`, `doctor.mjs` | skill이 호출하는 결정적 작업. Claude의 판단이 필요 없는 부분은 script가 맡는다 |

#### 프로젝트 상태 파일 `milvus.config.json`

세팅 결과를 파일 하나에 기록한다. 이 파일 덕분에 단계를 다시 실행해도 결과가 같고(멱등), 복사한 컴포넌트가 프로젝트에서 갈라지는 것을 감지할 수 있다 (앞서 지적한 "복사하면 다시 갈라진다" 문제의 대책).

```json
{
  "designSystem": { "version": "0.1.0" },
  "org": { "alias": "project_dev" },
  "brand": { "theme": "Project_Theme", "syncedAt": "2026-10-15" },
  "components": [
    { "name": "milvusBadge", "version": "0.1.0", "checksum": "sha256-…" }
  ]
}
```

#### `/milvus-init` 흐름

| 단계 | 내용 | 수행 | 통과 기준 |
| --- | --- | --- | --- |
| 0 사전 점검 | Node, pnpm 버전, sf CLI, org 인증 별칭, git 작업 트리 상태 | `doctor.mjs` | 전부 통과해야 다음으로 |
| 1 org 테마 | 테마가 없으면 Setup 경로를 안내하고, 만들었는지 Tooling API로 확인 | Claude + sf 조회 | 커스텀 테마 1개 이상 |
| 2 테마 가져오기 | 색 + 로고 → `brands/<테마>/` | `sync-theme.mjs` | `theme.json` 생성 |
| 3 브랜드 root style | 자연어 요구 → `root.css`. 규칙 밖 요구는 거절하고 대안 제시 | `milvus-brand-style` + H4 | lint 통과, Storybook 확인 |
| 4 컴포넌트 선택 | 카탈로그(컴포넌트 메타데이터)에서 선택 → 복사 + `milvus.config.json` 기록 | `create-project.mjs` | 선택한 것만 존재 |
| 5 규칙 설치 | hook 설정, husky, lint-staged, `CONTRIBUTING.md` | script | 금지 명령 시험 시 차단됨 |
| 6 검증 | `pnpm build:lwc`, `storybook build`, lint, Jest | script | 전부 통과 |
| 7 첫 커밋 | 커밋 규칙에 맞는 메시지 제안. 커밋은 사용자 확인 후 | Claude | H3 통과 |

#### 단계별 로드맵

| 시점 | 형태 | 범위 |
| --- | --- | --- |
| **10/23 발표** | 이 저장소의 `.claude/` (hook + skill) | `milvus-init` 1~4단계와 H1~H4. `learndoshare_2`에 적용해 시연 |
| 발표 후 1단계 | 플러그인으로 패키징 (`.claude-plugin/`) | skill 전체, H1~H8, `milvus.config.json`, `milvus-doctor` |
| 발표 후 2단계 | 실제 프로젝트 1곳에 파일럿 | `milvus-update`로 버전 반영 흐름 검증. 발굴 수치로 효과 측정 |
| 두 번째 프로젝트 합류 시 | 컴포넌트 배포 방식 재결정 | 복사 + checksum을 유지할지, unlocked package로 갈지 |

> Claude Code 플러그인의 구성 요소(skill, hook, command를 함께 배포할 수 있는지)와 marketplace 형식은 [08 Claude Code 런북](<Learn/08-Claude Code 런북.html>)에서 공식 문서로 확인한 내용을 따른다.

## 12. 참고

- digitalflask PoC: <https://www.digitalflask.com/blog/optimizing-salesforce-front-end-with-lightning-web-components-design-systems>
- LWC Garden: <https://github.com/lukethacoder/lwc-garden>
- Salesforce SDS Storybook (목표 모습 참고): <https://sds-site-docs-1fea39e7763a.herokuapp.com>
- SLDS: <https://www.lightningdesignsystem.com>
