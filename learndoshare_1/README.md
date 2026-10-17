# 밀버스 디자인 시스템 — 진행 계획

밀버스 프로젝트들이 공유할 LWC 디자인 시스템을 이 저장소(`learndoshare_1`)에서 검증하고 구축한다.
이 문서는 **완료 보고가 아니라 실행 계획**이다.

> 표기 규칙: **확정**은 결정되었거나 실제로 확인한 것, **미확인**은 확인이 필요한 것, **미정**은 결정이 필요한 것이다.

> **2026-10-08부터 원본은 [패키지·CLI 설계](docs/specs/2026-10-08-milvus-package-design.md)와 [구현 계획](docs/plans/2026-10-08-milvus-package-plan.md)이다.** 밀버스는 패키지 `@a40418a/milvus-design-system` 하나(버전 0.1.0, 10/16 발행 예정)로 배포하고, 고객 프로젝트에서는 `pnpm milvus` CLI로 세팅한다. 이 README의 1·2·4·7·11장은 설계 첫머리 "이 문서가 대체하는 것" 표대로 고쳤다(2026-10-14). 5장은 발표에 쓰는 5.3·5.4·5.5와 6장 결정 목록만 지금 흐름으로 고쳤고, 5.1·5.2와 8·9장은 패키지 설계 이전 기록이다. 일정과 빼는 순서는 설계 12장, 남은 미정 항목은 설계 15장을 본다.
>
> | 이전 계획 | 지금 |
> | --- | --- |
> | `brands/<브랜드>/root.css`, `override.css` | util.css 하나(이 저장소 `brands/<브랜드>/util.css`, 고객 프로젝트 `staticresources/milvusBrand.css`). hook으로 안 되는 모양은 opt-in `staticresources/milvusOverride.css`(10/9 결정) |
> | `scripts/create-project.mjs` | `pnpm milvus init` |
> | `pnpm sync:theme` (org → 저장소) | 고객 프로젝트는 `pnpm milvus init --from-org`. 이 저장소의 데모 브랜드에는 계속 쓴다 |
> | hook H2 (sf 데이터 변경·`apex run` 차단) | 고객 프로젝트 `permissions.ask` |
> | hook H7 (관리 파일 직접 수정 차단) | 고객 프로젝트 `permissions.deny` |
> | hook H8 (세션 시작 안내) | 두지 않는다. `CLAUDE.md`가 불러오는 `milvus-design.md`가 같은 안내를 한다 |
> | hook H4 (스타일 린트, 편집마다) | 고객 프로젝트 hook 1개(`.claude/hooks/milvus-check.mjs`)가 `check --style`을 실행한다 |

---

## 1. 목표와 핵심 시나리오

### 1.1 목표

| 목표 | 핵심 문제 | 해결 수단 |
| --- | --- | --- |
| **브랜드 전환** | 프로젝트(브랜드)마다 색, 로고, 타이포, 버튼 모양이 다르다 | org 테마 `BrandingSet`(색·로고) + 요청이 있을 때만 util.css(`milvusBrand.css`)의 styling hook과 브리지 변수 + 마지막 수단 `milvusOverride.css` (설계 5장) |
| **컴포넌트 재사용** | 같은 SLDS를 쓰는데도 페이지마다 동작과 디자인이 미세하게 다르다. SLDS에 없는 컴포넌트는 각자 만든다 | 공용 컴포넌트 + 카탈로그(Storybook) + 린트 |
| **프로젝트 시작 표준화** | 새 프로젝트마다 디자인 기반을 처음부터 다시 잡는다 | 패키지 하나를 `pnpm add`로 설치하고 `pnpm milvus init`으로 세팅한다. Storybook은 패키지 안의 설정으로 띄우고(`pnpm milvus storybook`), Claude Code 규칙은 `milvus-design.md`·`milvus-brand` skill·permissions로 함께 들어간다 (설계 3·7장) |

브랜드 전환과 컴포넌트 재사용은 정당화 논리가 다르다. 브랜드 전환은 컴포넌트를 만들지 않아도 풀린다. 컴포넌트 재사용의 근거는 브랜드가 아니라 **중복 구현과 일관성 결여**다.

### 1.2 핵심 시나리오 — 새 프로젝트 시작 (중점 실습)

밀버스 디자인 시스템은 GitHub Packages의 패키지 `@a40418a/milvus-design-system` 하나로 배포한다(설계 0·2장). 새 SFDX 프로젝트에서 아래 순서로 세팅한다.

```
0. 설치 전 준비 (개발자마다 한 번)
   GitHub read:packages classic 토큰 → 셸 환경 변수 NODE_AUTH_TOKEN, .npmrc 두 줄 (Learn 07)
1. pnpm add -D @a40418a/milvus-design-system
2. pnpm milvus init --target-org <별칭> --brand <이름>     (또는 --from-org, VF를 안 쓰면 --no-vf)
3. pnpm milvus storybook        → "시작하기 / 브랜드 명세" 페이지에 요청 입력 → 저장 (milvus-brand-request.md)
4. Claude Code: "브랜드 요청 반영해줘" → 브랜드 명세 표 제안 → 승인 → 파일 작성 → check → 화면 갱신
5. pnpm milvus deploy           → 배포 계획 확인 → 채팅 승인 → pnpm milvus deploy --yes
6. org에서 사람이 직접 (메타데이터로 할 수 없음)
   - 앱 전체 브랜드: App Manager에서 앱마다 유틸리티 바에 milvusBrandLoader 추가, "앱이 열릴 때 백그라운드로 로드" 체크
   - VF를 쓰면: Setup → User Interface → Visualforce Settings의 VF SLDS 2 설정 켜기
```

| 단계 | 누가 | 결과물 | 수단 |
| --- | --- | --- | --- |
| 2 | 개발자 | 밀버스 관리 파일(LWC, `milvusBridge.css`, `milvus-design.md`, skill, hook), 브랜드 파일(`BrandingSet`, 테마, 빈 `milvusBrand.css`, 설명 주석만 있는 `milvusOverride.css`), `milvus.config.json` | `pnpm milvus init` (설계 3장, 4.1) |
| 3 | 개발자 | `milvus-brand-request.md` | 브랜드 명세 페이지 (설계 6.1) |
| 4 | Claude Code | `BrandingSet`의 색·로고, `milvusBrand.css`의 hook·브리지 변수 | `milvus-brand` skill + hook의 `check --style` (설계 6.2, 7.2) |
| 5 | 개발자가 승인, CLI가 실행 | org의 밀버스 메타데이터와 활성 테마 | `pnpm milvus deploy` (설계 4.4) |

- 새 버전이 나오면 `pnpm milvus update`로 밀버스 관리 파일을 갱신한다(설계 4.5)
- 이전 계획(9/26)의 ② `pnpm sync:theme`, ③ `root.css`, ④ 컴포넌트 선택과 `create-project.mjs`는 위 흐름으로 대체했다. `init`은 컴포넌트를 고르지 않고 밀버스 LWC를 모두 복사한다. `pnpm sync:theme`은 이 저장소의 데모 브랜드(`brands/`)용으로 남았다
- **배포 형태 (확정, 2026-10-08):** GitHub Packages에 패키지 하나로 발행한다. 프로젝트 `CLAUDE.md`에는 `@milvus-design.md` 한 줄만 더한다. Claude Code 플러그인 마켓플레이스는 범위 밖이다(설계 0장)

### 1.3 원칙

- **SLDS가 제공하는 것을 최대한 쓴다.** 버튼은 `lightning-button`을 그대로 쓴다. SLDS를 대체하는 자체 디자인 시스템을 만들지 않는다. **(확정)**
- **브랜드 차이는 org 테마와 util.css에서만 흡수한다.** 브랜드마다 버튼 모양이나 타이포가 달라도 컴포넌트 코드는 바꾸지 않는다. 기본은 Salesforce 기본 모양에 브랜드 색·로고(`BrandingSet`)만 바꾼 것이다(기본 우선, 2026-10-09). 모양은 요청이 있을 때만 util.css(`:root` 블록 하나)의 styling hook과 **밀버스 변수(`--milvus-*`)**로 바꾼다. global hook 재정의는 공식 권고 밖임을 알고 택했다 ([2. 스타일 계층](#2-스타일-계층--root-style)). org에는 정적 리소스 + `loadStyle`로 싣는다(설계 5.5). **(확정)**
- **표현 컴포넌트와 데이터 컴포넌트를 분리한다.** 표현 컴포넌트는 `@api`로 데이터를 받고 이벤트로 결과를 올린다. `@wire`, Apex, LDS는 컨테이너 컴포넌트만 쓴다. Storybook에서 org 없이 렌더되지 않으면 표현 컴포넌트가 아니다. **(확정)**
- **파일럿은 토큰 레이어 + 컴포넌트 3개(`milvusBadge`, `milvusButton`, `milvusMultiSelect`)로 제한한다.** 검증 대상은 컴포넌트 개수가 아니라 구조다. **(확정)**

---

## 2. 스타일 계층 — root style

> **최신 결정 (2026-10-07, #11): 브랜드 스타일은 util.css 파일 하나로 관리한다.** 이 저장소에서는 `brands/<브랜드>/util.css`, 고객 프로젝트에서는 정적 리소스 `staticresources/milvusBrand.css`다(설계 3장). 이 파일만 고치면 `lightning-*`를 포함한 모든 컴포넌트가 바뀐다.
>
> - **실측 (org, 2026-10-07):** Lightning Experience는 기본 컴포넌트(`lightning-button`·`-input`·`-combobox` 등)를 synthetic shadow로 그린다. 그래서 지금은 global hook, 컴포넌트 hook(`--slds-s-*` 등), `.slds-*` 클래스 규칙이 모두 닿는다. Storybook도 org와 같게 전부 synthetic으로 그린다. (2026-10-09 갱신: org에서 직접 잰 것은 hook이고, 클래스 규칙은 synthetic 실측에서 나온 결론이다. 클래스 규칙도 10/9 org 프로브에서 `lightning-button` 안 버튼과 표준 헤더 버튼에 닿는 것을 확인했다(설계 13장), [Learn 09](<Learn/09-override와 공식 권고.html>) 2절)
>   - 다만 npm 패키지는 기본 컴포넌트 156개를 native shadow 지원으로 지정해 두었다(`package.json`의 `lwc.nativeShadowEnabledComponents`). Salesforce가 이 컴포넌트들을 native로 바꾸면 클래스 규칙은 그 컴포넌트 안에 닿지 않는다. custom property는 g·s 구분 없이 shadow 경계를 넘어 상속되지만, native에서는 SLDS 전역 CSS 안의 읽기 지점이 사라지고 **기본 컴포넌트의 native CSS가 읽는 이름에만 효과가 있다**(전환 시점은 미확인).
>   - **2026-10-09 정정:** 처음에는 "컴포넌트 hook은 닿지 않고 상속되는 global hook(`--slds-g-*`)만 닿는다"고 적었다. 전 컴포넌트 분석([`synthesis.md`](docs/research/2026-10-08/synthesis.md) 0장 5번 전제 수정)과 맞지 않아 고쳤다. native에서 s hook이 실제로 효과가 있는지는 실측이 필요하다(설계 14장).
>   - 경과: #11은 빌드 버그 때문에 모든 LWC가 native로 그려진 Storybook에서 측정했다. #14는 패키지 목록대로 혼합 모드로 그렸다. org 실측(#16)으로 둘 다 바로잡았다.
> - **util.css에는 global hook과 컴포넌트 hook을 쓴다(#18).** global hook(`--slds-g-*`)은 같은 hook을 쓰는 컴포넌트 묶음을 함께 바꾸고(예: 버튼 `radius-border-pill`, 입력창 `radius-border-2`, 카드 `radius-border-4`), 컴포넌트 hook(`--slds-s-*`)은 그 컴포넌트만 바꾼다(예: `--slds-s-button-radius-border`). 컴포넌트 hook은 native 전환 때 효과가 사라질 수 있다는 것을 알고 허용했다(2026-10-07 결정). 색 컴포넌트 hook은 브랜드 색에 이어진 것이 많아 막고, hover·선택 바탕 6개만 중립 g hook을 참조할 때 허용한다(2026-10-09). 영향 지도는 Storybook "Foundations / 브랜드 스타일 (util.css)"에 SLDS CSS에서 자동으로 나온다.
> - native 전환에도 유지해야 하거나 hook이 없는 모양은 밀버스 컴포넌트로 만들고, 그 컴포넌트가 읽는 `--milvus-*` 변수를 util.css에 넣는다. 예: `milvusButton`(#4)은 util.css에 `--milvus-button-custom: on`이 있으면 SLDS 버튼 블루프린트에 `--milvus-button-*`를 적용하고, 없으면 `lightning-button`을 그대로 그린다. `--slds-s-*`와 `--milvus-*`는 실제로 읽는 곳이 있는 이름만 쓸 수 있다(`pnpm test`가 검사).
>   - **2026-10-09 갱신:** 모양만 바꾸려고 밀버스 컴포넌트를 새로 만들지 않는다. hook·브리지로 안 되는 모양은 프로젝트 소유 opt-in `milvusOverride.css`의 클래스 규칙으로 바꾼다(공식 권고 밖, 마지막 수단). 밀버스 컴포넌트는 기능이 없을 때만 만들고, `milvusButton`은 비교 예시로 남는다(설계 1장, [Learn 09](<Learn/09-override와 공식 권고.html>)).
> - 브랜드 색은 util.css에서 바꾸지 않는다(org가 원본). `pnpm test`(`scripts/check-brands.ts`, 규칙은 `lib/rules.ts`)가 규칙을 검사한다.
> - **util.css 규칙 (2026-10-09, [설계](docs/specs/2026-10-08-milvus-package-design.md) 5.2·5.3으로 통합):** `:root` 블록 하나에 아래만 쓴다. 클래스 규칙과 `@font-face`는 쓰지 않는다.
>   - 허용: 이름에 color가 없는 `--slds-g-*`(글꼴 `--slds-g-font-family*` 제외. `--slds-g-shadow-4`를 바꾸면 포커스에 쓰이는 `-5`·`-6`을 기본값으로 따로 적는다), 포커스 그림자(값의 색은 `var(--slds-g-color-brand-base-15)`·`var(--slds-g-color-neutral-base-100)`만), 중립 색(`surface*`, `on-surface*`, `border-1/2`, `neutral-base-*`, `disabled*`, `on-disabled*`, `border-disabled*`, `*inverse*`, `palette-neutral-*`, `palette-yellow-80/90`. 값은 `light-dark()`, 글자·면 4.5:1 이상), 기본 컴포넌트 CSS만 읽는 g 이름 5개, 피드백 색(설계 5.3 표의 이름만. 글자색은 배경 위와 흰색 위 4.5:1 이상, 미달이면 같은 색조 40단계를 제안), SLDS 2 CSS나 기본 컴포넌트 CSS가 `var()`로 읽는 `--slds-s-*`, 색 s hook 6개(모달 배경막 `--slds-s-backdrop-color-background`는 값이 `var(--slds-g-color-neutral-10-opacity-50)`만이고 그 g를 `light-dark()`로 함께 쓴다. `backdrop-pair` 규칙), 밀버스 컴포넌트나 `milvusBridge.css`가 읽는 `--milvus-*`(움직임 시간 `--milvus-motion-duration-*`은 단위를 붙인다. `motion-unit` 규칙), 상속 속성 `letter-spacing`
>   - 금지: 브랜드 색 계열(`accent`·`on-accent`·`border-accent`·`brand-base`·`--slds-r-color-brand*`), 그 밖의 색 hook, `--slds-c-*`·`--sds-c-*`, 읽는 곳이 없는 이름(오타), 2026-10-14에 뺀 브리지 변수(`lib/rules.ts`의 `REMOVED_BRIDGE_VARS`, 설계 5.6), 다른 일반 속성
>   - 이전 검사 스크립트(`check-brands.mjs`), CLAUDE.md 3장, 설계 5.2가 서로 달랐던 것을 이 규칙 하나로 맞췄다([`synthesis.md`](docs/research/2026-10-08/synthesis.md) 2.1)
> - 공식 권고(global hook 재정의 금지) 밖이라는 것을 알고 택한 방식이다. org에서는 정적 리소스 + `loadStyle`로 문서에 넣고, 같은 화면의 표준 UI에도 적용된다.
>
> root.css는 util.css로 합쳤다. override.css는 만들지 않고, hook·브리지로 안 되는 모양은 프로젝트 소유 opt-in `staticresources/milvusOverride.css`로 바꾼다(2026-10-09 결정). 아래 2.1~2.4는 이 결정 이전의 설계(root.css, override.css)이며 기록으로 남긴다.

브랜드에 따라 바뀌는 모든 것은 아래 계층 중 한 곳에만 있다. **컴포넌트 CSS에는 브랜드 값이 없다.** 고객 프로젝트 기준이다(설계 5.1).

| 계층 | 원본 | org에 적용되는 방식 |
| --- | --- | --- |
| 브랜드 색, 로고 | `BrandingSet` (`BRAND_COLOR`, `BRAND_IMAGE`) | 테마 배포 + 활성화(`pnpm milvus deploy`). VF에는 팔레트 CSS `milvusVf`를 더한다 |
| 모양, 피드백 색, 밀버스 변수 값 | `milvusBrand.css` (util.css) | LEX: 밀버스 컴포넌트가 `loadStyle`로 문서에 넣는다. 앱 전체는 유틸리티 바의 `milvusBrandLoader`. VF: `milvusHead` |
| hook이 없는 항목(움직임 등) | `milvusBridge.css` (패키지 제공, `--milvus-*`를 읽음) | `milvusBrand`와 같은 경로로 함께 넣는다 |
| hook·브리지로 안 되는 모양 (opt-in) | `milvusOverride.css` (프로젝트 소유, 처음엔 비어 있음) | `milvusBrand` 다음, 마지막에 넣는다 |
| 밀버스 컴포넌트 | `lwc/milvus*` | 배포. 기능이 없을 때만 만든다 |

이 저장소의 데모 브랜드는 `brands/<브랜드>/`에 있다. `theme.json`·`logo.*`는 `pnpm sync:theme`이 만들고, `util.css`는 사람이 고친다. 9/26 계획의 L1~L4(`theme.json`, `logo.*`, `root.css`, 컴포넌트)는 위 표로 바뀌었다.

### 2.1 (기록, 2026-09-26) 제약: `lightning-button`의 모양은 SLDS 2에서 브랜드별로 바꿀 공식 경로가 없다

조사 결과(2026-09-26, 공식 문서 확인) 아래 세 가지가 동시에 성립한다.

| 사실 | 출처 |
| --- | --- |
| 컴포넌트 hook(`--slds-c-*`)은 **SLDS 1에서만** 지원된다. SLDS 2에서는 아직 지원하지 않는다 | LWC 개발자 가이드, `lightning-badge` 레퍼런스 |
| global hook(`--slds-g-*`)은 **재정의하지 말고 읽기 전용으로 쓰라** ("Redefining them can break the UI") | SLDS 2 Color Modes 가이드 |
| 커스텀 변수에 `--slds` 접두사를 쓰면 안 된다. 자체 접두사(예: `--milvus-*`)를 쓴다 | SLDS Linter 규칙 `no-slds-namespace-for-custom-hooks` |

즉 **"root에서 global hook을 바꿔 `lightning-button` 모양을 브랜드별로 바꾼다"는 방식은 공식 권고에 어긋난다.** 우리 org는 SLDS 2(`SLDS_v2`)다.

### 2.2 (기록) 그래서 브랜드별 버튼은 이렇게 커버한다

**확정 (2026-09-26): 기능 하나에 컴포넌트 하나, root에 따라 자동 전환.** 프로젝트 코드는 항상 `<c-milvus-button>` 하나만 쓴다. 브랜드 root에 버튼 custom 값(신호 변수 `--milvus-button-custom`)이 없으면 내부에서 `lightning-button`을 그대로 렌더하고, 있으면 블루프린트 + `--milvus-button-*`로 렌더한다. Storybook에도 "Button" 항목 하나만 두고 현재 브랜드의 모드(SLDS 기본 / 밀버스 커스텀)를 표시한다. 다른 SLDS 기반 컴포넌트도 같은 방식을 따른다.


root에서 커버한다는 원칙은 유지한다. 다만 root가 바꾸는 대상은 **밀버스 변수(`--milvus-*`)**이고, 그 변수를 읽는 것은 밀버스 컴포넌트다.

| 순서 | 방법 | 적용 범위 | 비고 |
| --- | --- | --- | --- |
| 1 | L1 org 테마 색 | `lightning-button` 포함 전체 | 공식 경로. 코드 변경 없음 |
| 2 | **기본은 `lightning-button` 그대로** | — | 추구미(SLDS 최대 활용). 브랜드 차이가 색뿐이면 여기서 끝 |
| 3 | L3 root style에 `--milvus-button-*` 정의 + **`milvusButton`**(SLDS 버튼 블루프린트 `slds-button` 마크업 기반) | 브랜드 고유 버튼이 필요한 프로젝트 | 모양(반경, 굵기, 패딩)을 브랜드별로 바꾼다. 변수가 없으면 SLDS 기본값으로 떨어지게 `var()` fallback을 둔다 |
| 4 | **opt-in 확장 계층** `brands/<브랜드>/override.css`에서 `--slds-g-*` 재정의 | `lightning-button` 포함 전체 | **공식 권고 밖.** 고객사가 `lightning-button` 자체의 모양까지 요구할 때만 켠다. 아래 2.3 조건을 지킨다 |

**결정 (2026-09-26):** 공식 권고는 아니지만 **고객사별 니즈가 다양하므로 `milvusButton`을 파일럿으로 구현한다.** "SLDS 블루프린트는 있는데 브랜드 대응 LWC가 없다"에 해당하므로 추가 기준에도 맞는다. 변수를 정의하지 않은 브랜드에서는 `lightning-button`과 똑같이 보여야 한다. 그래서 SLDS를 기본으로 쓰는 원칙과 브랜드 고유 버튼이 함께 성립한다.

#### opt-in 확장 계층 (`override.css`) 조건 (기록. 만들지 않았다. 지금은 `milvusOverride.css`)

- 기본은 꺼져 있다. `milvus.config.json`의 `"overrides": true`로 켠 브랜드에만 로드한다
- 재정의할 수 있는 `--slds-g-*`는 **별도 허용 목록**으로 제한한다. 모양 관련만 넣는다. 후보는 반경 `--slds-g-radius-border-1..4`·`-pill`·`-circle`, 폰트 굵기 `--slds-g-font-weight-*`이며, 이름과 값은 SLDS 2 패키지 `@salesforce-ux/design-system-2` 2.264.2 Cosmos CSS에서 확인했다 (`radius-border-1..4` = 0.25 / 0.5 / 0.75 / 1.25rem, `pill` = 15rem). 색(accent 계열)은 org 테마가 원본이므로 재정의하지 않는다
- H4 lint는 이 파일에서 차단 대신 **경고**를 내고, 그 외 파일에서의 재정의는 계속 차단한다
- SLDS 버전 업데이트나 Salesforce 릴리스(연 3회) 때마다 해당 브랜드를 Storybook과 org에서 다시 확인한다
- Salesforce가 SLDS 2 컴포넌트 hook을 지원하면 이 계층을 그쪽으로 옮긴다

### 2.3 (기록) root style 규칙 (Claude가 ③단계에서 지켜야 할 것). 지금 규칙은 위 util.css 규칙과 설계 5.2

- 수정 대상은 `brands/<브랜드>/root.css` **한 파일**뿐이다. 컴포넌트 CSS는 건드리지 않는다
- `root.css`에서 정의할 수 있는 것은 **밀버스 변수(`--milvus-*`) 허용 목록**뿐이다 (타이포, 버튼 모양, 반경 등). 허용 목록은 Phase 3에서 만든다
- `--slds-g-*` 재정의는 `override.css`(opt-in)에서만, 별도 허용 목록 안에서만 한다
- `root.css`와 컴포넌트 CSS에서 `--slds-g-*`는 **읽기만** 한다
- `--slds-c-*`는 쓰지 않는다. SLDS 2에서 지원되지 않는다
- L1 색(브랜드 색)은 root style에서 덮어쓰지 않는다. 색은 org가 원본이다
- "`lightning-button`을 둥글게" 같은 요구는 먼저 `milvusButton`을 제안한다. 사용자가 `lightning-button` 자체를 원하면 `override.css`의 위험(공식 권고 밖, 릴리스마다 재확인)을 설명하고 **확인을 받은 뒤에** 켠다
- 결과는 Storybook에서 눈으로 확인하고, 린트를 통과한 뒤 PR로 리뷰한다

### 2.4 (기록) org에는 root style을 어떻게 반영하나. 결론: 정적 리소스 + `loadStyle`(설계 5.5, 10/8·10/9 org 측정)

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
| SLDS 전체 컴포넌트 카탈로그 | npm `lightning-base-components`의 공식 예제(`__examples__`)를 그대로 컴파일해 Storybook "컴포넌트/기본" 섹션을 자동 생성한다(`scripts/generate-slds-catalog.ts`). **73개 컴포넌트, 예제 249개 전수 렌더 확인(오류 0).** `primitive*`·`*Private`는 내부용이라 제외. npm에 없는 것(org 데이터 필요): record form 계열, `input-field`, `record-picker`, `file-upload`, `map`, `input-rich-text` → Live Preview로 확인 | 확인 (#9, 2026-10-07) |
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

> **2026-10-08부터 실행은 [구현 계획](docs/plans/2026-10-08-milvus-package-plan.md)의 마일스톤 M0~M7을 따른다.** 아래 Phase 0~9는 9/26 계획이며 기록으로 남긴다. Phase 1~5의 기반(Storybook, `lightning-*` 렌더, SLDS 카탈로그, util.css, `milvusButton`, `pnpm sync:theme`)은 M0 이전 PR #7, #8, #10, #13, #15, #17, #19(이슈 #3, #4, #9, #11, #14, #16, #18)에서 만들었다. Phase 6(프로젝트 시작 워크플로)은 패키지와 `pnpm milvus` CLI로 대체했다. 대체한 항목은 각 Phase에 "(대체)"로 적었다.
>
> | 마일스톤 | 내용 | PR |
> | --- | --- | --- |
> | M0 | 학습 자료 기초(Learn 00·09), 패키지 설계·계획 | #23 |
> | M1 | 설치 경로 스파이크(패키지 메타데이터, CLI 뼈대, 발행 workflow, `v0.0.1`) | #25 |
> | M2 | TypeScript 전환과 util.css 규칙 통합 | #27 |
> | M3 | `init`·`check`, LWC JS 복귀와 `milvusBrandLoader` | #29 |
> | M4 | 정적 반영 검사와 `milvusBridge.css` | #32 |
> | M5 | 브랜드 명세 페이지, Storybook 두 모드, `milvus-brand` skill | #33 |
> | M6 | `deploy`, 설치본 리허설, VF 팔레트 | #35 |
> | M7 | `update`, 동적 반영 검사, 문서 정리, 0.1.0 발행 | 진행 중 (이슈 #36) |

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

- [ ] Claude Code hook H1(pnpm 강제), H2(sf 명령·개인정보 차단), H3(커밋 검사), H6(세션 컨텍스트)를 `.claude/settings.local.json`에서 검증 후 `.claude/settings.json`으로 이동 ([11. Claude Code 자동화](#11-claude-code-자동화--permissions--hook--skill))
  - (대체) 이 저장소에는 hook을 커밋하지 않았다. 고객 프로젝트에는 `pnpm milvus init`이 패키지 템플릿의 `permissions.deny/ask`와 hook 하나를 넣는다(11장)

**완료 기준:** `pnpm storybook`으로 기본 예제가 뜨고, 규칙에 맞지 않는 커밋 메시지는 거부된다. Claude가 `npm`이나 `sf project deploy`를 실행하려 하면 hook이 막는다. (대체) 커밋 메시지 검사와 `npm` 차단은 만들지 않았다. 고객 프로젝트에서 `sf project deploy`는 `permissions.ask`가 실행 전에 묻는다.
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

- [ ] `brands/<브랜드>/` 폴더 구조 확정 (`theme.json`, `root.css`, `logo.*`). (대체) `root.css`는 `util.css`로 합쳤다(2장)
- [ ] `.storybook/preview.js`에 `globalTypes`로 브랜드 툴바, decorator로 브랜드 스코프(래퍼 요소)에 L1 색과 L3 root style 적용. (대체) L3은 `util.css`다
- [ ] **`--milvus-*` 허용 목록** 초안 작성 (타이포, 버튼 반경·굵기·패딩 등)
- [ ] `milvusButton` 구현: SLDS 버튼 블루프린트(`slds-button`) 마크업 + `--milvus-button-*` 변수 + SLDS 기본값 fallback. `lightning-button`과 같은 `@api`(label, variant, icon-name, disabled, type)를 우선 지원한다. 변수가 없는 브랜드에서 `lightning-button`과 똑같이 보이는지 나란히 비교한다
- [ ] `override.css` 실험: `--slds-g-*` 반경·폰트 재정의가 `lightning-button`에 반영되는 범위를 실측하고, 별도 허용 목록을 만든다. (대체) `override.css`는 만들지 않았다. hook 재정의는 util.css에서 하고, hook·브리지로 안 되는 모양은 opt-in `milvusOverride.css`로 바꾼다(2장)
- [ ] org 반영 방식(정적 리소스 `loadStyle` / 컨테이너 `:host` 선언)을 비교한다. (결과) 정적 리소스 + `loadStyle`(설계 5.5)

**완료 기준:** 하드코딩한 브랜드 2개를 툴바에서 바꾸면 색은 `lightning-button`까지 함께 바뀌고, 버튼 모양(둥근 / 각진)은 `milvusButton`에서 바뀐다. `override.css`를 켠 브랜드에서는 `lightning-button`의 모양도 바뀌는지 기록한다. (대체) util.css의 hook으로 `lightning-button` 모양이 바뀌는 것을 확인했다(2장, #11·#19).
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
- **skill (`milvus-init` ②단계, 만들지 않음):** Claude는 로고를 직접 받지 않고 `pnpm sync:theme`만 실행한다. 결과로 `logo.*`가 생겼는지 확인하고, 없으면 "Setup > Themes and Branding에서 로고를 올렸는지" 확인하도록 사용자에게 안내한다
- **hook (계획만, 커밋하지 않음)**
  - H2(`guard-sf`): `sf org display`는 토큰을 출력하므로 **Bash로 직접 실행하는 것을 차단**한다. script 안에서 호출하는 것만 허용된다(hook은 Claude의 도구 호출만 검사하므로 script 내부 호출은 영향받지 않는다). (대체) 고객 프로젝트에서는 `sf org display`, `sf org open --url-only`, `sf org list --json`을 `permissions.deny`로 막는다(설계 7.2). 이 저장소에서는 CLAUDE.md 5장의 규칙이다
  - H3(`guard-commit`): 커밋 diff에 `00D…!` 형태의 액세스 토큰 패턴이 있으면 차단한다. (대체) 만들지 않았다
  - H5(`guard-generated`): `logo.*`는 script만 만든다. 직접 편집하거나 다른 이미지로 교체하는 것을 막는다. (대체) 만들지 않았다. 고객 프로젝트에서는 [관리]·[생성] 파일을 `permissions.deny`의 `Edit(...)`로 막는다
- **로고는 커밋한다** (2026-09-26 결정). Pages 배포본에 로고가 들어가야 하기 때문이다. 공개 저장소이므로 로고 외의 org 파일은 받지 않는다


### Phase 5 — 파일럿 컴포넌트

| 순서 | 대상 | 증명하는 것 |
| --- | --- | --- |
| 1 | **색상/토큰 레이어** | L1~L3 계층, global hook + `var()` fallback 규칙 |
| 2 | **의미색 뱃지** (`milvusBadge`) | `lightning-badge`에 없는 성공·경고·위험 변형. 의미색은 브랜드색과 별개 계층이다 |
| 3 | **브랜드 버튼** (`milvusButton`) | Phase 3에서 구현. 여기서는 스토리 3종, 사용 기준 문서(언제 `lightning-button` 대신 쓰는가), Jest를 마무리한다 |
| 4 | **multi 검색** (`milvusMultiSelect`) | `lightning-combobox`는 다중 선택을 지원하지 않는다. 다중 선택 기본 컴포넌트는 `lightning-dual-listbox`와 `lightning-select`(`multiple`, 네이티브 목록 상자)뿐이고, 검색 가능한 다중 선택 콤보박스는 없다 **(컷 1순위)** |

각 컴포넌트마다 표현 컴포넌트로 작성, 스토리(기본 / 변형 / 브랜드별), 사용 기준 문서(언제 쓰는지, 언제 쓰면 안 되는지), Jest 테스트를 갖춘다. 컴포넌트마다 **메타데이터(이름, 설명, 의존 컴포넌트)**를 두어 Phase 6의 선택 목록에 쓴다. (대체) 선택 목록은 만들지 않았다. `init`은 밀버스 LWC를 모두 복사한다.

### Phase 6 — ★ 프로젝트 시작 워크플로 (대체: 패키지와 `pnpm milvus` CLI, M3~M7)

**목표:** [1.2 핵심 시나리오](#12-핵심-시나리오--새-프로젝트-시작-중점-실습)의 흐름을 새 프로젝트에서 처음부터 끝까지 재현한다. **발표의 중점 실습이다.**

9/26 계획(런북 skill `milvus-init`, `root.css`, `create-project.mjs`로 컴포넌트 선택)은 아래로 바뀌었다.

- [x] **런북:** 고객 프로젝트 루트에 `milvus-design.md`([관리], 세팅 안내서이자 Claude 규칙)를 두고, 프로젝트 `CLAUDE.md`에 `@milvus-design.md` 한 줄을 더한다(설계 7.1). skill은 `milvus-brand` 하나다(11.2)
- [x] **브랜드 요청 반영:** 브랜드 명세 페이지나 채팅 → `milvus-brand` skill → `BrandingSet`과 `milvusBrand.css`. 규칙 밖 값은 hook의 `check --style`이 잡아 고칠 값을 Claude에게 돌려준다(설계 6장, 7.2)
- [x] **세팅:** `pnpm milvus init --target-org <별칭> (--brand <이름> | --from-org) [--no-vf]`. 컴포넌트를 고르지 않고 밀버스 LWC를 모두 복사한다. Storybook 설정은 복사하지 않고 패키지 안의 것으로 띄운다(`pnpm milvus storybook`, 설계 3장, 4.2)
- [x] **`milvus.config.json`:** `init`이 패키지 버전, 대상 org 별칭, 브랜드, VF 사용 여부, 밀버스 관리 파일 목록과 sha256을 기록한다. `check`가 sha256으로 직접 수정을 잡고, `update`가 새 버전의 관리 파일을 반영한다([11.3](#113-패키지로-프로젝트-세팅-체계화))
- [x] **배포:** `pnpm milvus deploy`가 계획을 보여 주고, `--yes`일 때 밀버스 메타데이터를 배포한 뒤 활성 테마를 바꾼다(설계 4.4)
- [x] **리허설:** 설치본(tgz)으로 `init` → 명세 페이지 저장 → 반영 → hook 검사 → Storybook → `deploy --yes`가 이어지는 것을 2026-10-14에 확인했다(설계 13장)
- [ ] **`update`:** 구현과 단위 테스트(`tests/update.test.ts`)는 커밋했다(이슈 #36). 설치본의 버전을 올려 실제로 갱신해 본 기록은 없다 **(미확인)**

**완료 기준:** 새 SFDX 프로젝트에서 1.2의 흐름이 막힘 없이 org 화면(LEX)까지 이어지고, 브랜드 값이 정적 반영 검사에서 모든 컴포넌트에 반영된다(설계 0장 성공 기준).

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
>
> **2026-10-14 갱신:** 5.1·5.2는 9/26 계획 기록이다. 실제 진행은 4장 마일스톤 표, 일정과 빼는 순서는 [설계](docs/specs/2026-10-08-milvus-package-design.md) 12장을 따른다. #6(컴포넌트 활성화 선택)은 하지 않았다(`init`이 밀버스 LWC를 모두 복사한다). 5.3~5.5는 지금 패키지 흐름으로 고쳤다.

### 5.1 주차별 일정 (기록, 9/26 계획)

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

### 5.2 판단 시점과 컷 라인 (기록. 지금 빼는 순서는 설계 12장)

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
| 4 | 밀버스 방향 | 4분 | SLDS를 최대한 쓰고 브랜드는 공식 기능부터. 기본은 Salesforce 기본 모양 + 브랜드 색·로고(`BrandingSet`)이고, 모양은 요청이 있을 때만 util.css(`milvusBrand.css`)의 hook → 브리지 변수 → opt-in `milvusOverride.css` 순으로 바꾼다(설계 5.1). SLDS 2의 제약(`--slds-c-*`는 Developer Preview·운영 금지, global hook 재정의는 공식 권고 밖)과 그래서 택한 방식. 어떤 방법으로도 바꿀 수 없는 "Salesforce 고정" 목록(설계 9.4) | 원칙 1장, 계층도 1장(2장 표), 고정 목록 1장 | 10/16 |
| 5 | **실습 A: 새 프로젝트 시작** | 7분 | `pnpm add` → `pnpm milvus init` → `pnpm milvus storybook`의 브랜드 명세 페이지에 요청 입력 → Claude Code "브랜드 요청 반영해줘" → 브랜드 명세 표 승인 → `check` → Storybook 갱신 → `pnpm milvus deploy` 계획 확인·승인 → LEX 화면 (1.2) | 녹화 (라이브는 여유 있을 때) | 10/19 |
| 6 | 실습 B: 도구 역할 분담 | 2분 | `sf lightning dev`와 Storybook은 경쟁이 아니라 역할이 다르다 | 비교표, 녹화 | 10/19 |
| 7 | 필요한 결정 | 3분 | 네임스페이스, 오너와 시간, 앱마다 다른 브랜드가 필요한가, 두 번째 프로젝트의 컴포넌트 배포 방식 (6장, 설계 15장) | 결정 요청 목록 | 10/16 |
| — | Q&A | 5분 | | 예상 질문 답변 | 10/21 |

"디자인 시스템의 중요성"으로 시작하지 않는다. 개발팀은 첫 3분에 흥미를 잃는다.

### 5.4 예상 질문과 답변 준비

| 질문 | 답변 방향 |
| --- | --- |
| 토큰(테마)만 하면 되는 거 아닌가? | 브랜드 전환은 org 테마(`BrandingSet`)와, 요청이 있을 때만 쓰는 util.css로 풀린다(기본 우선). 컴포넌트를 만드는 이유는 브랜드가 아니라 중복 구현과 일관성이다 |
| 브랜드마다 버튼 디자인이 다르면? | 색은 org 테마로 `lightning-button`까지 바뀐다. 모양은 SLDS 2에 운영에서 쓸 공식 경로가 없다. 컴포넌트 hook(`--slds-c-*`)은 SLDS 2에서 Developer Preview(Winter '27, 운영 금지)이고 global hook은 읽기 전용이다. 그래서 요청이 있을 때만 util.css의 hook → 브리지 변수 → opt-in `milvusOverride.css`(마지막 수단, 공식 권고 밖) 순으로 바꾸고, 릴리스마다 재확인한다. 모양만 바꾸려고 밀버스 컴포넌트를 새로 만들지 않는다(기능이 없을 때만 만든다). `milvusButton`은 "새로 만드는 방식"의 비교 예시로 보여 준다(2026-10-09 갱신, [Learn 09](<Learn/09-override와 공식 권고.html>)) |
| Claude가 만든 스타일을 믿을 수 있나? | Claude가 고치는 것은 프로젝트 소유 파일(`milvusBrand.css`, `BrandingSet`)이다. 고칠 때마다 hook이 `check --style`로 util.css 규칙(설계 5.2)과 대비 4.5:1을 검사한다. 어기면 hook이 2로 끝나 고칠 값을 Claude에게 돌려주고, Claude가 그 값으로 다시 고친다(편집 자체를 되돌리지는 않는다). 밀버스 관리 파일은 `permissions.deny`로 막도록 설정했다(실제 동작 **미확인**, 설계 14장). 그 앞뒤로 브랜드 명세 표 승인, Storybook 확인, `deploy` 계획 승인을 거친다 |
| Storybook에서 브랜드를 바꾸면 org도 바뀌나? | 아니다. Storybook은 프로젝트의 `BrandingSet`과 `milvusBrand.css`로 그린 미리보기다(팔레트는 실측으로 역산한 규칙, 3장). org에는 `pnpm milvus deploy`가 색·로고(`BrandingSet`)와 util.css를 함께 배포하고 활성 테마를 바꾼다. 활성 테마는 org 전체 사용자에게 적용되고, LEX 색은 새로고침 뒤 반영된다(설계 4.4) |
| 공식 도구가 있는데 왜 Storybook까지? | 실습 B 결과. 개발 중 확인은 공식 도구, 카탈로그·브랜드·공유·프로젝트 시작은 Storybook |
| 폰트도 org에서 바꿀 수 있나? | 없다. Themes and Branding은 색·로고·이미지만 다룬다. 밀버스도 글꼴은 바꾸지 않는다. 브랜드 글꼴은 범위 밖이고(설계 0장), util.css에서 `--slds-g-font-family*`와 `@font-face`는 금지다(설계 5.2). 발표 뒤 검토 항목이다(설계 15장) |
| Salesforce 업데이트나 native shadow 전환 때 깨지지 않나? | 깨질 수 있는 부분이 있다. 공식 경로는 `BrandingSet`(색·로고)이다. util.css의 hook 재정의, 브리지(클래스 규칙), `milvusOverride.css`는 공식 권고 밖이다. 기본 컴포넌트가 native shadow로 바뀌면 그 안에는 클래스 규칙이 닿지 않고, hook은 native CSS가 읽는 이름에만 효과가 있다(2장, 설계 5.6). 그래서 정적 반영 검사(`pnpm audit:brand`)가 SLDS·기본 컴포넌트 CSS의 hook·native 지원 목록·브리지 선택자 변화를 기준 파일과 비교하고, 브리지 항목은 명세 페이지에 "native 전환 시 잃음"으로 표시한다 |
| 정말 모든 컴포넌트에 반영되나? | 정적 반영 검사가 SLDS 2·기본 컴포넌트 CSS 선언을 명세 항목별로 반영 / 브리지 / 고정 / 빈틈으로 판정하고, 빈틈 0을 `pnpm test`에서 지킨다. 어떤 방법으로도 바꿀 수 없는 것은 "Salesforce 고정"으로 합의해 그대로 밝힌다. 예: 토스트 표시 시간, 아이콘 모양, LEX 전역 헤더, LEX 컨트롤 높이 1.875rem(설계 9.4) |
| 유지보수는 누가 하나? | 결정 요청 항목이다. 오너 1명, 주 4시간 이상을 제안한다 |

### 5.5 발표 당일 체크리스트

- [ ] 녹화 파일 2개를 발표 PC 로컬에 저장 (네트워크에 의존하지 않는다)
- [ ] 라이브 데모를 한다면 고객 프로젝트에서 `pnpm milvus storybook`(`init`이 더한 `pnpm storybook`도 된다)을 미리 띄워 두고 org에 로그인해 둔다
- [ ] 결정 요청 슬라이드를 띄워 둔 채로 Q&A를 진행한다

---

## 6. 결정이 필요한 것 (미정)

2026-10-14 갱신. 정해진 항목은 체크하고 결론을 적었다. 설계 15장의 미정 항목(회사 GitHub 조직으로 옮기기, `BrandingSet`의 SLDS 2 전용 색 속성, `--slds-s-*` 허용 유지, 브랜드 글꼴, c hook)도 함께 본다.

- [ ] **네임스페이스 사용 여부.** 없으면 `c-milvus-badge`, 있으면 `milvus-badge`다. Dev Hub에 등록하면 변경·삭제가 불가능하다. 조직 차원에서 결정한다
- [x] **배포 형태 (확정, 2026-10-08).** GitHub Packages 패키지 하나로 배포하고 `pnpm milvus` CLI로 세팅한다(1.2, 설계 1·2장). Claude Code 플러그인 마켓플레이스는 범위 밖이다(설계 0장)
- [ ] **두 번째 프로젝트의 컴포넌트 배포 방식.** 패키지 + sha256 관리(`milvus.config.json`)를 유지할지, unlocked package로 갈지 두 번째 프로젝트가 합류할 때 정한다([11.3](#113-패키지로-프로젝트-세팅-체계화) 로드맵)
- [x] **util.css의 org 반영 방식 (확정).** 정적 리소스 + `loadStyle`. 밀버스 컴포넌트와 앱 유틸리티 바의 `milvusBrandLoader`가 넣고, VF는 `milvusHead`가 넣는다(2.4, 설계 5.5)
- [ ] **앱마다 다른 브랜드가 필요한가.** 활성 테마(브랜드 색·로고)는 org에 하나이고 `deploy`가 바꾸면 org 전체에 적용된다(설계 4.4). 밀버스는 이 org 단위를 기준으로 한다. 앱별 브랜드가 필요한지는 미정이다(App Manager의 앱 브랜딩은 3장)
- [ ] **pnpm 버전.** 10(로컬 설치) / 12(최신)
- [x] **테마 메타데이터 (사실상 정해짐).** 고객 프로젝트에서는 `init`이 `brandingSets/`·`lightningExperienceThemes/`를 프로젝트 소유 파일로 만들고, `deploy`가 그 파일로 배포한다. 색의 원본이 이 파일이다(설계 3장, 4.4). 커밋한다고 문서에 명시한 곳은 없다 **(미확인)**
- [ ] **디자인 시스템 오너와 주당 확보 시간.** 최소 주 4시간 제안

---

## 7. 학습 자료 (`Learn/`)

각 Phase에 들어가기 전에 해당 자료를 브라우저로 열어 읽는다. 각 문서 끝에 **스스로 점검** 질문이 있다. 2026-10-14 기준으로 패키지 설계와 마일스톤 결과를 반영했다. 모든 절 끝에 공식 문서나 프로젝트 기록 출처가 있고, `pnpm test`의 `test:learn`(`scripts/check-learn.ts`)이 출처와 폐기한 설계(`root.css`·`override.css`) 표기를 검사한다.

| 순서 | 자료 | 핵심 내용 | 선행 Phase | 예상 시간 |
| --- | --- | --- | --- | --- |
| 0 | [디자인 시스템과 Salesforce](<Learn/00-디자인 시스템과 Salesforce.html>) | 디자인 시스템 개념, SLDS 1과 2, styling hook(r → g → s → c), 브랜드(BrandingSet), shadow DOM과 스타일 범위, LEX와 Visualforce, 전 컴포넌트 분석, 밀버스의 층과 명령, 용어집 | 전체 | 1시간 |
| 1 | [세일즈포스 디자인 시스템](<Learn/01-세일즈포스 디자인 시스템.html>) | SLDS 1과 2, styling hook(global / component / 레거시 토큰), 블루프린트와 base component, 브랜드 모양과 milvusButton, 브리지(hook이 없는 항목) | 전체 | 1.5시간 |
| 2 | [LWC 기초](<Learn/02-LWC 기초.html>) | 컴포넌트 구조, `@api`/`@wire`, shadow DOM(synthetic / native / light), CSS 변수 상속, 표현/컨테이너 분리 | 2, 5 | 2시간 |
| 3 | [스토리북](<Learn/03-스토리북.html>) | CSF3, args·controls, decorator·globals(툴바), 로고·manager 테마, autodocs, 정적 빌드, 두 모드(저장소·프로젝트)와 Vite 플러그인, 브랜드 명세 페이지 | 1, 3 | 1.5시간 |
| 4 | [LWC와 스토리북 통합](<Learn/04-LWC와 스토리북 통합.html>) | Rollup과 Vite가 왜 충돌하는가, digitalflask 방식 해부, 미해결 과제와 해결 경로 | 2 | 2시간 |
| 5 | [테마와 브랜딩 동기화](<Learn/05-테마와 브랜딩 동기화.html>) | Theme → BrandingSet → Property 구조, Tooling API 조회, sync 스크립트(저장소 데모용), `deploy`로 테마 적용, 접근성 색, Visualforce에 브랜드 걸기 | 4 | 1시간 |
| 6 | [로컬 개발 도구 비교](<Learn/06-로컬 개발 도구 비교.html>) | `sf lightning dev`, LWC Garden, Storybook, org 내 문서 앱 비교와 역할 분담 | 7 | 1시간 |
| 7 | [pnpm](<Learn/07-pnpm.html>) | strict node_modules, 버전별 차이(10 / 11+), 빌드 스크립트 승인, hoisting, husky, GitHub Packages 설치, `pnpm milvus` 명령과 `update` | 1 | 1시간 |
| 8 | [Claude Code 런북](<Learn/08-Claude Code 런북.html>) | `CLAUDE.md`, skill, plugin, hook과 permissions, `init`이 만드는 것, 브랜드 요청 → 반영 흐름 | 6 | 1시간 |
| 9 | [override와 공식 권고](<Learn/09-override와 공식 권고.html>) | 새 컴포넌트 vs 덮어쓰기, SLDS 1·2 커스터마이즈 범위, Salesforce가 권하지 않는 이유, 실험 A~C(세 방식 비교, synthetic·native 라이브 데모, 업데이트 위험), opt-in `milvusOverride.css` | 9 (발표) | 1시간 |

**추천 순서:** 0 → 1 → 7 → 2 → 3 → 4 → 5 → 8 → 6 → 9. 0(개념)으로 전체 그림을 잡고, 1(SLDS)과 7(pnpm)을 읽으면 Phase 1을 바로 시작할 수 있다. 9는 발표에서 override를 설명하기 전에 읽는다.

---

## 8. 리스크와 대응

> 패키지 설계(2026-10-08) 이전 기록이다(`override.css`, root style 반영 방식 등). 지금 흐름과 위험은 [패키지·CLI 설계](docs/specs/2026-10-08-milvus-package-design.md)를 따른다(5.6 브리지 위험, 10장 오류 처리, 14장 미확인).

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

> 패키지 설계(2026-10-08) 이전 기록이다(`root.css`, `create-project.mjs`, 저장소 `.claude/`는 없다). 지금 구조는 [패키지·CLI 설계](docs/specs/2026-10-08-milvus-package-design.md) 2장(패키지에 넣는 것)·3장(고객 프로젝트 파일)과 [구현 계획](docs/plans/2026-10-08-milvus-package-plan.md)의 "파일 지도"를 따른다.

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

## 11. Claude Code 자동화 — permissions · hook · skill

참고: 사내 발표 "Claude Code를 내 규칙대로 움직이게 하기 — hook · script · lint" (2026-09-18).
**문서(CLAUDE.md)에 적은 규칙은 부탁이고, permissions와 hook은 실행되는 설정이다.** 어기면 대가가 있는 규칙만 강제하고, 절차는 skill로 만든다.

> **2026-10-14 현재 이 저장소에는 Claude Code hook이 커밋되어 있지 않다.** `git ls-files`에 `.claude/` 설정이 없고, 커밋된 git hook은 `learndoshare_1/.husky/pre-commit` 하나다. 9/26에 계획한 H1~H8(아래 두 번째 표)은 만들지 않았다. 패키지 설계(7장)에서 강제 수단을 **고객 프로젝트**로 옮겼다. `pnpm milvus init`(과 `update`)이 패키지 템플릿 `templates/claude/`의 내용을 고객 프로젝트 `.claude/`에 넣는다. 이 저장소에서는 [10. 작업 규칙](#10-작업-규칙), `CLAUDE.md`, `pnpm test`가 규칙이다.

### 11.1 고객 프로젝트에 넣는 것 — permissions · hook

원본은 `templates/claude/settings.json`과 `templates/claude/hooks/milvus-check.mjs`다. `init`은 고객 프로젝트에 `.claude/settings.json`이 있으면 병합하고, hook 파일은 [관리] 파일로 복사한다(설계 3장, 7.2).

| 종류 | 규칙 | 하는 일 | 대체한 계획 |
| --- | --- | --- | --- |
| `permissions.deny` | `Bash(sf org display)`, `Bash(sf org display *)`, `sf org open --url-only`(`-r`)·`--json`, `sf org list --json`·`sf auth list --json` 계열(옵션이 어디에 와도 걸리게 규칙을 여러 개 둔다. 정확한 목록은 템플릿 파일) | 액세스 토큰을 출력하는 명령을 막는다 | H2 3층 |
| `permissions.deny` | `Edit(...)`: `lwc/milvus*/**`, `classes/utils/design/**`, `milvusHead.component*`, `staticresources/milvusVf.*`·`milvusBridge.*`, `milvus-design.md`, `milvus.config.json`, `.claude/skills/milvus-brand/**`, `.claude/hooks/milvus-check.mjs` | 밀버스 [관리]·[생성] 파일을 Claude의 파일 도구로 고치지 못하게 한다. 다른 경로로 바뀐 것은 `check`의 sha256 비교가 잡는다 | H7 |
| `permissions.ask` | `pnpm milvus deploy`(`pnpm exec milvus`, `milvus`, `./node_modules/.bin/milvus`를 포함한 네 형태), `sf project deploy`, `sf data create/delete/update/upsert`, `sf apex run` | 실행 전에 묻는다. auto 모드에서도 묻는다 | H2 1층 |
| hook `PostToolUse` · `Edit\|Write` | `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/milvus-check.mjs` | `milvusBrand.css`·`milvusOverride.css`·`brandingSets/`를 고쳤을 때만 패키지 CLI의 `check --style`을 node로 직접 실행한다(pnpm을 거치지 않음). 위반이면 2로 끝나 Claude가 stderr의 고칠 값을 본다. override 경고는 stdout JSON의 `additionalContext`로 넘긴다 | H4 |
| 안내 문서 | `milvus-design.md`([관리]. 프로젝트 `CLAUDE.md`의 `@milvus-design.md` 한 줄이 불러온다) | 세팅 순서, 디자인 규칙, pnpm만 쓰기, 개인정보 필드·`FIELDS(ALL)` 조회 금지, 배포 안전장치 | H8. H1과 H2 2층은 명령 패턴으로 막지 않고 이 문서의 문장으로 둔다 |

- 실제 Claude Code에서 잰 것(2026-10-17, `learndoshare_2` 세션): 토큰 출력 sf 명령 6개 deny, 인자 없는 `pnpm milvus deploy`의 ask, `milvusBridge.css` Edit deny가 모두 의도대로 걸린다(설계 13장). `--json` 없는 `sf org list`는 막지 않는다
- 커밋된 설정의 hook은 팀원에게 따로 동의를 받지 않고 실행된다. 그래서 hook은 하나만 두고 `milvus-design.md`에 적는다(설계 7.2)

**처음 계획한 hook (2026-09-26, 커밋하지 않음)**

| # | 막으려던 것 | 지금 |
| --- | --- | --- |
| H1 | `npm`·`npx`·`yarn` 명령 | 만들지 않았다. CLAUDE.md 5장과 `milvus-design.md`의 문장 |
| H2 | 되돌릴 수 없는 sf 명령(1층), 개인정보 필드·`FIELDS(ALL)` 조회(2층), 토큰을 출력하는 명령(3층) | 1층 → `permissions.ask`, 3층 → `permissions.deny`, 2층 → `milvus-design.md`의 문장 |
| H3 | 스테이징된 `.sfdx/`·`.sf/`·`.env`, 시크릿 패턴, 커밋 메시지 형식 | 만들지 않았다. 커밋 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md), 커밋하지 않는 파일은 CLAUDE.md 5장 |
| H4 | 스타일 린트(편집마다) | 고객 프로젝트 hook `milvus-check.mjs`(`check --style`). 이 저장소에서는 `pnpm test:brands` |
| H5 | `theme.json`·`logo.*` 직접 편집 | 만들지 않았다. 고객 프로젝트의 [관리]·[생성] 파일은 `Edit(...)` deny |
| H6 | 세션 시작 컨텍스트(Phase, 날짜, 금지 사항) | 만들지 않았다. CLAUDE.md 7장 |
| H7 | 밀버스 관리 파일 직접 수정 | `permissions.deny`의 `Edit(...)` |
| H8 | 세션 시작 안내(`/milvus-init`, `/milvus-update`) | 두지 않았다. `milvus-design.md`가 같은 안내를 한다 |

**운영 원칙 (발표에서 배운 점, 설계 7.2에 반영):**
- 편집마다 도는 PostToolUse에는 **0.2초 안에 끝나는 검사**만 건다. `check --style`은 postcss로 파싱하고 패키지에 미리 넣은 hook 색인(`dist/hooks-index.json`)을 읽어 원본 CSS를 다시 읽지 않는다(`lib/rules.ts`, `lib/hooks-index.ts`). 검사 자체는 0.2초 안이고(설계 첫머리 표), hook은 pnpm 기동(약 0.3초)을 피하려고 node로 직접 실행한다
- stderr는 사람이 아니라 Claude가 읽는다. 위반마다 **고칠 값**을 함께 적는다. PostToolUse가 0으로 끝나면 stderr가 Claude에게 가지 않으므로 경고는 stdout JSON으로 넘긴다
- 인자를 제한하는 Bash 규칙은 깨지기 쉽다(공식 문서 경고). `SF_CONTENT_TYPE=JSON sf org list`(환경 변수로 JSON 출력), `sf org:list --json`, `sfdx force:org:list --json`, `sh -c` 안의 명령은 deny에 걸리지 않는다(설계 7.2)
- 실제 프로젝트는 운영 org에 붙는다. 그래서 고객 프로젝트에서는 배포·데이터 변경을 `ask`로, 토큰 출력을 `deny`로 둔다
- husky: `pre-commit`(`pnpm precommit` → lint-staged)만 있고 `commit-msg`는 없다. git 루트가 상위 폴더라 husky가 설치되지 않는 문제는 남아 있다(**미정**, [07 pnpm](<Learn/07-pnpm.html>) husky 절)

### 11.2 skill — 반복되는 절차

실제로 있는 skill은 패키지 템플릿 `templates/claude/skills/`의 하나뿐이다. `init`이 고객 프로젝트 `.claude/skills/`에 [관리] 파일로 복사한다.

| skill | 하는 일 | 연결 |
| --- | --- | --- |
| `milvus-brand` | 브랜드 요청(`milvus-brand-request.md`나 채팅)을 `BrandingSet`(색·로고), `milvusBrand.css`, 브리지 변수에 반영한다. 입력 형식 5종(자연어, 디자인 토큰 JSON, Figma, PDF·이미지, URL)을 받는다. 브랜드 명세 표를 제안하고 승인받은 뒤 파일을 쓴다 | hook의 `check --style`이 결과를 검사한다(설계 6장) |
| Ponytail (외부) | 구현 전 과잉 설계 억제. PR 전 `/ponytail-review` | [08 Claude Code 런북](<Learn/08-Claude Code 런북.html>) |

9/26에 계획한 `milvus-init`, `milvus-brand-style`, `milvus-new-component`, `milvus-issue`는 만들지 않았다. `milvus-init`은 CLI `pnpm milvus init`으로, `milvus-brand-style`은 `milvus-brand`로 바뀌었다. 저장소 작업용이던 `milvus-new-component`·`milvus-issue` 대신 CLAUDE.md 1·2장과 CONTRIBUTING.md의 절차를 따른다.

### 11.3 패키지로 프로젝트 세팅 체계화

**목표 상태:** 새 SFDX 프로젝트에서 `pnpm add -D @a40418a/milvus-design-system`과 `pnpm milvus init`으로 세팅이 끝난다. 사람마다, 프로젝트마다 세팅이 달라지지 않는다. 9/26에 계획한 Claude Code 플러그인(`/milvus-init`)과 마켓플레이스는 범위 밖으로 두고(설계 0장), CLI·템플릿·LWC·Storybook을 GitHub Packages 패키지 하나에 담았다(설계 1·2장). 흐름은 [1.2](#12-핵심-시나리오--새-프로젝트-시작-중점-실습)에 있다.

#### 구성

| 구분 | 이름 | 역할 |
| --- | --- | --- |
| CLI | `pnpm milvus init --target-org <별칭> (--brand <이름> \| --from-org) [--no-vf]` | 사전 점검 뒤 프로젝트에 밀버스 파일을 만들고 `milvus.config.json`을 기록한다. 다시 실행해도 결과가 같다(설계 4.1) |
| CLI | `pnpm milvus check [--style]` | util.css 규칙, 피드백 색 대비, `BRAND_COLOR` 형식. 전체 실행은 `milvusVf.css`를 다시 만들고 관리 파일 sha256을 비교한다(설계 4.3) |
| CLI | `pnpm milvus storybook [build]` | 패키지 안의 설정으로 프로젝트 모드 Storybook을 띄운다. 브랜드 명세 페이지가 있다(설계 4.2) |
| CLI | `pnpm milvus deploy [--target-org <별칭>] [--yes]` | 계획 출력 → 승인 뒤 밀버스 메타데이터 배포 → 성공하면 활성 테마 변경(설계 4.4) |
| CLI | `pnpm milvus update [--force]` | 새 버전의 관리 파일을 전부 반영하거나 아무것도 바꾸지 않는다(설계 4.5) |
| skill | `milvus-brand` | 11.2 |
| permissions·hook | deny·ask, `milvus-check.mjs` | 11.1 |
| 안내 | `milvus-design.md` | 세팅 순서와 Claude 규칙(설계 7.1) |

#### 프로젝트 상태 파일 `milvus.config.json`

`init`이 만들고 `update`가 갱신하는 [생성] 파일이다. 직접 고치지 않는다. 형식은 `cli/context.ts`의 `MilvusConfig`다. 아래 값은 예다.

```json
{
  "version": "0.1.0",
  "targetOrg": "project_dev",
  "brand": "Project_Theme",
  "vf": true,
  "managed": {
    "force-app/main/default/lwc/milvusBadge/milvusBadge.js": "<패키지 원본의 sha256 hex>"
  }
}
```

- `managed`는 밀버스 관리 파일의 경로와 패키지 원본의 sha256이다. `check`가 이 값으로 직접 수정을 잡고, `update`가 로컬 수정이 있는지 판단한다(설계 4.3, 4.5)
- 9/26 계획의 컴포넌트 선택 목록(`components`)과 `syncedAt`은 없다. `init`은 밀버스 LWC를 모두 복사한다

#### 단계별 로드맵

| 시점 | 형태 | 범위 |
| --- | --- | --- |
| **10/16 동결** | 패키지 0.1.0 (GitHub Packages, 발행 예정) | `init`·`check`·`storybook`·`deploy`·`update`, `milvus-brand` skill, permissions와 hook 하나 |
| **10/23 발표** | 같은 패키지 | 1.2의 흐름을 시연한다(5.3 실습 A) |
| 발표 뒤 | 검토 항목 | SLDS 1 테마 org 지원(#22), Storybook native 빌드(설계 9.2), 브랜드 글꼴, 회사 GitHub 조직으로 옮기기(설계 15장) |
| 두 번째 프로젝트 합류 시 | 컴포넌트 배포 방식 재결정 | 패키지 + sha256 관리를 유지할지, unlocked package로 갈지 |

> Claude Code 플러그인·marketplace와 패키지 방식의 비교는 [08 Claude Code 런북](<Learn/08-Claude Code 런북.html>)의 "배포 형태 비교" 절에 있다.

## 12. 참고

- digitalflask PoC: <https://www.digitalflask.com/blog/optimizing-salesforce-front-end-with-lightning-web-components-design-systems>
- LWC Garden: <https://github.com/lukethacoder/lwc-garden>
- Salesforce SDS Storybook (목표 모습 참고): <https://sds-site-docs-1fea39e7763a.herokuapp.com>
- SLDS: <https://www.lightningdesignsystem.com>
