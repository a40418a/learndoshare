# SLDS 2에서 CSS 커스터마이즈가 줄어든 이유: 공식 자료 조사 (2026-10-09)

[Learn 09 "override와 공식 권고"](../../Learn/09-override와%20공식%20권고.html)의 근거 자료다. 2026-10-09에 조사자 3명이 공식 자료를 나눠 읽고, 그 주장을 원문과 다시 대조해 종합했다. 이 문서는 그 종합과 조사 기록을 옮긴 것이다.

- 확인일: 2026-10-09 (모든 항목 공통)
- 확인 방법: **[B]** 내장 브라우저의 전용 탭에서 본문 추출(SLDS 2 사이트와 help.salesforce.com은 SPA라 WebFetch로 본문이 나오지 않음), **[G]** `gh api`로 GitHub 소스 열람, **[L]** 이 저장소에 설치된 패키지를 grep
- 조사자 3명(부록의 조사 기록 A·B·C)이 낸 주장 중 아래 항목만 원문을 다시 열어 확인했다. 다시 열지 못한 주장은 이 문서에서 뺐다.
- 인용 원칙: 원문은 한국어로 풀어 썼다. 영어 원문은 짧은 구절만 따옴표로 옮겼다. 원문 전체는 각 URL에서 읽는다.
- 옮기지 않은 것: npm 메타데이터 JSON, 패키지 사본, 조사자 기록의 원문 인용문. 필요하면 아래 URL과 패키지에서 다시 얻는다.
- **2026-10-09 정정 (Task 29):** (c)표의 "`.slds-*` 클래스 override는 SLDS 2에서 무시된다" 행을 원문 문맥대로 고쳤다. 근거는 (h)에 있다.

---

## (a) 한 줄 결론

공식 자료에 "줄였다"는 말은 없다. 공식 문서는 오히려 "구조와 시각 스타일을 분리해 더 깊은 커스터마이즈와 테마를 준다"고 쓴다. 바뀐 것은 커스터마이즈가 이루어지는 자리다. **컴포넌트 하나하나를 CSS로 고치던 자유는 줄었고, 시스템 전체를 테마로 바꾸는 자유가 늘었다.** 줄어든 지점마다 공식 자료가 밝힌 이유는 세 가지다.

1. global hook 값은 테마, 다크 모드, 밀도에 따라 바뀌는 자리라서 Salesforce와 테마 도구가 소유한다.
2. Salesforce는 성능, 기능, 접근성 때문에 컴포넌트 내부를 계속 바꾼다. 그래서 문서화된 hook 외의 override는 업그레이드할 때 안전하지 않다.
3. 관리자 테마의 일부 색 옵션은 접근성 때문에 뺐다.

컴포넌트 hook(`--slds-c-*`)이 SLDS 2 출시 때 빠졌다가 Developer Preview로 돌아온 이유와, `--slds-s-*`를 private로 둔 이유는 공식 문서에 나와 있지 않다.

---

## (b) 공식적으로 밝힌 이유

| # | 이유 (한국어 요약) | 출처 (페이지 제목, URL) | 방법 |
| --- | --- | --- | --- |
| B1 | **global hook 값은 SLDS가 정하고, Salesforce가 언제든 바꾸고 릴리스 노트로 알린다.** 개발자는 값을 읽기만 한다. 값을 할당하는 것은 테마 도구의 몫이다: "value assignment is reserved for theming tools" | Global Styling Hooks · LDS 2, https://www.lightningdesignsystem.com/2e1ef8501/p/777f5a-global-styling-hooks / Develop · LDS 2, https://www.lightningdesignsystem.com/2e1ef8501/p/547b38-develop | B |
| B2 | **테마는 hook 값을 바꾸는 방식으로 동작한다.** 활성 테마에 따라 `--slds-g-*` 값이 바뀌고, `--slds-c-*`가 그 값을 참조한다. 그래서 컴포넌트 코드를 바꾸지 않아도 테마가 반영된다. Themes & Branding도 특정 hook 값을 덮어써서 브랜드를 입힌다 | Styling API · LDS 2, https://www.lightningdesignsystem.com/2e1ef8501/p/7708aa-styling-api | B |
| B3 | **고객 커스터마이즈에서 global hook 값을 재정의하는 것은 지원하지 않는다.** 이 문장에는 범위 제한이 없다. hook마다 Light Mode 값과 Dark Mode 값이 따로 있다(표 머리글로 확인) | Styling Hook Index · LDS 2, https://www.lightningdesignsystem.com/2e1ef8501/p/98b493-styling-hook-index | B |
| B4 | **컴포넌트 안에서 global hook을 재할당하는 것은 금지다.** 이유는 테스트 실패와 향후 호환성 깨짐이다. SLDS 1 문서도 같은 금지를 적고, SLDS 2에서 사이트 전체가 깨질 수 있다고 경고한다 | Global Styling Hooks · LDS 2(위 URL) / SLDS Development Best Practices, https://v1.lightningdesignsystem.com/dev-guidelines/best-practices/ | B |
| B5 | **하드코딩 값은 자동 테마 변경, 다크 모드 설정, 접근성 개선을 따라가지 못한다.** global hook을 재할당하면 SLDS 2에서 레이아웃이 깨질 수 있다. SLDS 2로 옮겨야 하는 이유로는 다크 모드, 고급 기업 테마, 에이전트 기능에 대비하는 기반과 접근성 기본 내장을 든다 | Transition to SLDS 2 · LDS 2, https://www.lightningdesignsystem.com/2e1ef8501/p/8184ad-transition-to-slds-2 | B |
| B6 | **Salesforce는 성능, 기능, 접근성을 높이려고 컴포넌트 내부를 다시 설계할 자유가 필요하다.** 그래서 base component의 스타일 override는 문서화된 styling hook을 쓸 때만 지원한다. SLDS 클래스와 내부 구현은 앞으로 바뀔 수 있으므로 override도 지원하지 않는다 | Anti-Patterns for Component Styling, https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-antipatterns.html / SLDS Styling Hooks, https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-custom-properties.html | B |
| B7 | **Salesforce는 HTML, CSS, DOM의 하위 호환을 보장한 적이 없다.** 지원되지 않는 커스터마이즈를 하면 Salesforce UI 개선을 받아들이기 어렵거나 불가능해진다. Summer '24에도 앞으로의 UI 변경을 위해 내부 구현, SLDS 스타일, custom property를 바꾼다고 예고했다 | Salesforce Component Internals Are Protected (KB 001395244), https://help.salesforce.com/s/articleView?id=001395244&type=1 / Confirm Your Components Use Supported Design System Customizations (Summer '24 RN), https://help.salesforce.com/s/articleView?id=release-notes.rn_lc_design_system_updates.htm&release=250&type=5 | B |
| B8 | **접근성 때문에 관리자 테마 옵션 일부를 뺐다.** 배경색, 배경 이미지, 글로벌 헤더 색은 SLDS 2 테마에서 쓸 수 없다. accent 색은 브랜드 색에서 WCAG 대비에 맞게 자동으로 만들어지며, Salesforce는 이 색을 재정의하지 말 것을 강하게 권한다. "Override accessibility brand color" 체크박스는 SLDS 1 custom 테마에만 있고, 접근성 문제를 일으킬 수 있다고 경고한다 | Considerations for Themes and Branding, https://help.salesforce.com/s/articleView?id=xcloud.lex_themes_and_branding_considerations.htm&type=5 / Manage Custom Configurations for Themes, https://help.salesforce.com/s/articleView?id=xcloud.brand_custom_configurations.htm&type=5 | B |
| B9 | **global color hook을 쓰면 org의 Themes and Branding 브랜드 색을 따라가고 WCAG 2.1 대비 기준에 맞출 수 있다.** SLDS 2 테마에는 design token이 없고, 그 자리를 global hook이 대신한다 | SLDS Design Tokens, https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-design-tokens.html | B |
| B10 | **구조와 시각 스타일을 분리해서 커스터마이즈와 테마를 주고, 다크 모드와 에이전트 기능의 길을 연다.** SLDS 2는 SLDS 1과 하위 호환된다고도 쓴다. admin 블로그는 hook이 UI를 정적에서 동적으로 바꿔 다크 모드 같은 실시간 개인화를 가능하게 하고, 하드코딩한 컴포넌트에서는 시각 회귀가 생길 수 있다고 쓴다 | Bring Your Org to Life with SLDS 2 (GA) (Winter '26 RN), https://help.salesforce.com/s/articleView?id=release-notes.rn_slds2_ga.htm&release=258&type=5 / Get Started · LDS 2, https://www.lightningdesignsystem.com/2e1ef8501/p/76969d-get-started / The Admin Guide to Preparing Your Org for Dark Mode With SLDS 2, https://admin.salesforce.com/blog/2025/the-admin-guide-to-preparing-your-org-for-dark-mode | B |
| B11 | **native shadow DOM에서는 페이지 전역 CSS가 컴포넌트 안으로 들어가지 못한다.** 예외는 상속 속성과 custom property다. 그래서 SLDS를 쓴다면 `slds-*` 클래스 대신 styling hook으로 옮기라고 권한다. base component는 성능과 Web Components 표준을 위해 native shadow로 옮겨 가는 중이며, 그 과정에서 내부 DOM이 바뀐다 | Get Your LWC Components Ready for Native Shadow DOM in Spring '24, https://developer.salesforce.com/blogs/2024/01/get-your-lwc-components-ready-native-shadow-dom / Internal DOM Structure Is Changing for Lightning Base Components (Summer '25 RN), https://help.salesforce.com/s/articleView?id=release-notes.rn_lc_native_shadow_dom.htm&release=256&type=5 | B |
| B12 | **컴포넌트 hook을 다시 연 이유**: 특정 컴포넌트를 업그레이드에 안전한 방식으로 테마에 맞게 조정하려는 것이다. 이 hook은 Shadow DOM 경계를 넘어 상속되므로 LWC에서도 동작한다. 범주(spacing, radius, color)와 modifier 패턴으로 다시 설계했다 | Customize Components with the SLDS 2 Styling API and Component-Level Hooks (Developer Preview) (Winter '27 RN), https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_c_level_hooks.htm&release=264&type=5 | B |
| B13 | (Flow 맥락의 설계 관점) 내부 Lightning 화면은 일관성과 생산성에 맞춰져 있어 세밀한 시각 조정이 덜 필요하다. 테마가 일관성, 재사용, 장기 유지보수의 기반이고, override는 테마가 못 메우는 예외에만 쓴다 | Spring '26: Design Screen Flows With Intent Using Styling Overrides, https://admin.salesforce.com/blog/2026/spring-26-design-screen-flows-with-intent-using-styling-overrides | B |

**허용 목록 밖 (salesforce.com 자사 블로그, 참고만 하고 근거로 쓰지 않음)**
- What is Salesforce Lightning Design System 2 (SLDS 2 Beta)? https://www.salesforce.com/blog/what-is-slds-2/ : 고객의 더 깊은 커스터마이즈 요구와 생성형 AI 때문에 시스템을 넓혀야 했다고 쓴다. 컴포넌트를 하나씩 고치는 대신 한 곳에서 값을 바꿔 전체에 반영하는 방식을 장점으로 든다. [B]
- What Are Styling Hooks and How Do You Use Them with SLDS? https://www.salesforce.com/blog/what-are-styling-hooks/ : 다크 모드로 전환할 때 "우리가" global hook을 재할당한다고 쓴다. 주어가 Salesforce라면 B1, B2와 같은 구조를 설명하는 문장이다. [B]

### 조사자 사이의 모순과 판정 (원문 기준)

| 쟁점 | 조사자 주장 | 판정 |
| --- | --- | --- |
| SLDS 2의 `--slds-c-*` 상태 | B 담당: "아직 미지원, Developer Preview 문구 없음" / A·C 담당: "Developer Preview" | **시점 차이다. 현재 상태는 Developer Preview(프로덕션 금지)다.** Spring '25 RN은 "아직 미지원"이라고 썼다. Winter '27 RN과 SLDS 2 사이트의 Component-Level Styling Hooks 페이지(https://www.lightningdesignsystem.com/2e1ef8501/p/0213f9-component-level-styling-hooks)는 Developer Preview라고 쓰고, 케이스를 열어 신청하라고 안내한다. LWC Guide의 Compare SLDS Versions(https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds1-slds2.html)와 SLDS Styling Hooks 페이지는 2026-10-09에도 "현재 미지원"이라는 예전 표기를 유지한다 [B] |
| global hook 재정의 금지가 `:root`에도 적용되는가 | C 담당: Transition 페이지는 "컴포넌트 CSS 선택자 안"만 다룬다 | **`:root`도 지원 범위 밖이다.** Styling Hook Index(B3)는 범위를 제한하지 않고 "고객 커스터마이즈에서" 재정의를 지원하지 않는다고 쓴다 |
| developer.salesforce.com에 재정의 금지 문구가 있는가 | B 담당: 없음. 2023 블로그는 `:host { --slds-g-color-border-base-4: red; }` 예시를 보여 준다 | **그 도메인 범위에서는 사실이다.** 2023 블로그(https://developer.salesforce.com/blogs/2023/06/preparing-your-app-for-the-lightning-design-system-color-update)는 SLDS 1 시기에 `--lwc-*` override를 대체하는 맥락의 글이다. 현재 SLDS 2 문서(B1, B3, B4)가 우선한다 [B] |
| "global hook을 바꿔라"는 문장 | Styling API 페이지는 global hook으로 앱 전체 테마를 세우라고 쓴다. Winter '27 RN은 c-hook이 참조하는 global hook을 바꿀 수 있다고 쓴다 | **미확인.** 같은 사이트의 금지 문장(B1, B3, B4)과 표현이 충돌한다. 두 문장을 잇는 단서는 Develop 페이지의 "값 할당은 테마 도구 몫"이라는 문장뿐이다. 두 표현을 정리한 공식 문장은 찾지 못했다 |
| `--slds-s-*`가 private인가 | B 담당: 공식 문서로는 미확인 / A·C 담당: 린터가 private로 분류 | **확인됨.** 공식 린터 README와 rule-messages.yml에 "--_slds-와 --slds-s- 접두사는 Salesforce 내부용"이라고 적혀 있다(github.com/salesforce-ux). 다만 현재 규칙 코드(`no-slds-private-var.ts`)는 `--_slds-`로 시작하는 속성만 검사한다 [G] |

---

## (c) SLDS 1 → SLDS 2에서 실제로 바뀐 것

| 항목 | SLDS 1 | SLDS 2 (2026-10-09 기준) | 변화 | 근거 |
| --- | --- | --- | --- | --- |
| 컴포넌트 hook `--slds-c-*` | 2.17.0(Spring '22)부터 GA. 버튼만 바꾸는 식의 조정이 공식 수단이었다. v1 Buttons 페이지는 `--slds-c-button-radius-border` 기본값을 0.25rem으로 적는다 | Spring '25~Summer '25에는 미지원("아직"). Winter '27부터 **Developer Preview**: 프로덕션 금지, 케이스로 신청 | **줄어듦** (GA에서 DP로) | v1 Styling Hooks(https://v1.lightningdesignsystem.com/platforms/lightning/styling-hooks/), v1 Buttons(https://v1.lightningdesignsystem.com/components/buttons/), Spring '25 RN(https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_slds2.htm&release=254&type=5), B12 |
| global hook `--slds-g-*` 재할당 | SLDS 1 문서도 재할당을 금지했다(B4) | 금지. 값은 SLDS와 테마 도구가 소유한다(B1, B3) | **변화 없음** (원래 공식 수단이 아니었다) | B1, B3, B4 |
| shared hook `--slds-s-*` | 문서에 없음 | 공식 린터가 private(내부용)로 분류한다. Salesforce가 릴리스에서 매핑을 바꾼다(Winter '27: `--slds-s-table-color`) | 원래 공개 API가 아니었다 | (b) 판정 표, Winter '27 Blueprints Updates(https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_updates.htm&release=264&type=5) |
| `.slds-*` 클래스 override, 직접 CSS override | 지원하지 않았지만 실제로는 동작했다 | 지원하지 않는다. **"SLDS 2에서 무시된다"는 이 행의 근거가 아니다** (2026-10-09 정정). v1 Best Practices의 그 문장은 styling hook 절 안에 있고, 남의 선택자에 다시 할당한 hook 값이 SLDS 2에서 효과가 없다는 뜻이다((h)). 클래스 규칙이 실제로 닿는지는 지원 여부가 아니라 shadow 모드가 정한다 | **지원 범위 밖** (SLDS 1과 같음). native 전환과 내부 변경 때 깨질 위험이 커진다 | v1 Best Practices, B6, B7, B11, (h) |
| `--lwc-*` design token 설정과 참조 | 동작 | SLDS 2에서는 설정을 지원하지 않고, 다시 할당한 값은 무시된다. 설치된 2.264.2 CSS는 `--lwc-*`를 3곳(브랜드 이미지)에서만 읽는다 [L] | **줄어듦** | v1 Best Practices, B9, (h) |
| 관리자 테마 색 옵션 | 배경색, 배경 이미지, 글로벌 헤더 색, "Override accessibility brand color" | 모두 SLDS 2 테마에서는 쓸 수 없다(접근성 이유) | **줄어듦** | B8 |
| 관리자 테마의 새 기능 | 없음 | 브랜드 색에서 WCAG accent 자동 생성, advanced accent(재정의는 강하게 비권장), 다크 모드(Winter '27 GA, 2026-09부터), 다크 모드용 로고 | **늘어남** | B8, Admins · LDS 2(https://www.lightningdesignsystem.com/2e1ef8501/p/771012-admins), Dark Mode GA RN(https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode_ga.htm&release=264&type=5) |
| global hook 값의 성격 | 고정값 중심 | hook마다 Light/Dark 값이 있다. 밀도에 따라 바뀌는 간격 hook이 있다. 릴리스마다 값이 바뀌거나 폐기된다(Winter '26: `--slds-g-font-family` → `--slds-g-font-family-base` 등) | 값이 **동적**이 됨 | B3, Global Styling Hooks · LDS 2, Winter '26 Component Design Updates(https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_updates.htm&release=258&type=5) |
| 권장 계층 | base component → 블루프린트 → c-hook | base component → (가능하면 피하는) 블루프린트 → 커스텀 컴포넌트(g-hook 읽기, c-hook은 DP). base component의 커스터마이즈는 "제한적"이라고 표에 명시되어 있다 | 블루프린트의 지위가 내려감 | Components · LDS 2(https://www.lightningdesignsystem.com/2e1ef8501/p/755aff-components), Develop · LDS 2 |

---

## (d) SLDS 2에서 공식적으로 허용되는 커스터마이즈 수단

| 누가 | 어디서 | 무엇을 | 상태 | 근거 |
| --- | --- | --- | --- | --- |
| 관리자 | Setup > Themes and Branding | 테마 선택(Salesforce Cosmos, Lightning Blue, custom SLDS 2 테마). 활성화하면 org 전체에 적용된다 | GA | Admins · LDS 2, Styling API · LDS 2 |
| 관리자 | 같은 곳 | 브랜드 색과 브랜드 이미지(로고, 배너, 아바타). 보완 팔레트와 WCAG accent가 자동으로 만들어진다 | GA | Admins · LDS 2, Manage Custom Configurations |
| 관리자 | 같은 곳 > Advanced Configuration | accent 색 조정. custom SLDS 2 테마에만 있고, 재정의는 강하게 비권장한다 | GA | Manage Custom Configurations |
| 관리자 | 같은 곳 > Dark Mode | 사용자가 다크 모드를 켤 수 있게 허용 | Winter '27 GA (2026-09부터) | Dark Mode GA RN |
| 사용자 | 표시 설정 | color mode(light, dark, system), 표시 밀도 | 관리자가 허용한 뒤 / GA | Admins · LDS 2, Global Styling Hooks · LDS 2 |
| 관리자 | Flow Builder | 화면과 컴포넌트 단위 override(배경, 글자, 테두리 색, 테두리 두께, 반경). Flow 화면에만 적용된다 | Spring '26 | B13 |
| 개발자 | 마크업 | base component의 속성(`variant`, `type` 등)과 SLDS utility class(정렬, 여백, 타이포그래피) | GA, 1순위 | Style with Lightning Design System(https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds.html), Develop · LDS 2 |
| 개발자 | 컴포넌트 CSS | `var(--slds-g-*, SLDS 1 fallback)`로 **읽기만**. 밀도 hook 포함 | GA | Style with Lightning Design System, B1 |
| 개발자 | 컴포넌트 CSS | SLDS 클래스를 덮어쓰지 않고 자기 클래스를 만든다. 자기 namespace의 custom hook을 쓴다(`--slds`, `--sds` 접두사 금지) | GA, 린터 규칙 `no-slds-namespace-for-custom-hooks` | Style with Lightning Design System, rule-messages.yml(https://github.com/salesforce-ux/slds-linter/blob/main/packages/eslint-plugin-slds/src/config/rule-messages.yml) [G] |
| 개발자 | 커스텀 컴포넌트 | SLDS 블루프린트 마크업. base component가 없을 때만 쓰고, 플랫폼 개선과 보호를 받지 못하는 대가를 진다 | 허용, 가능하면 피함 | Components · LDS 2 |
| 개발자 | 컴포넌트 CSS | `--slds-c-*` 설정 | **Developer Preview**: 프로덕션 금지, 케이스로 신청 | B12 |

**금지 또는 미지원**: `--slds-g-*` 재정의(B1, B3, B4), `--slds-s-*`와 `--_slds-*` 사용(린터), `.slds-*` 클래스와 base component 내부 DOM 타기팅(B6, B7), `--lwc-*` 설정(v1 Best Practices), 하드코딩 값(B5, 강제 아님, 권장 위반).
**마이그레이션 도구**: SLDS Linter. SLDS 2 기준으로 코드를 분석하며, admin 블로그도 회귀를 찾는 수단으로 안내한다(B10의 admin 블로그).

---

## (e) 공식 문서가 이유를 밝히지 않은 부분

1. **`--slds-c-*`가 SLDS 2 출시 때 빠진 이유**: 공식 문서에 이유가 명시되지 않음. Spring '25 RN은 "아직 지원하지 않는다"고만 쓰고, LWC Guide는 "작업 중"이라고만 쓴다.
   - 사실: Winter '27에 범주와 modifier 패턴을 갖춘 "full Styling API"로 다시 나왔다(B12). SLDS 1 FAQ는 global 기능을 나중에 넣더라도 기존 component hook 사용을 깨지 않는 추가 기능이 될 것이라고 약속했었다(v1 Styling Hooks).
   - **추정**: c-hook의 이름 체계와 구조를 SLDS 2 테마(g-hook 참조) 위에서 다시 설계하는 동안 비워 두었다.
2. **`--slds-s-*`가 private인 이유**: 공식 문서에 이유가 명시되지 않음. 린터는 "내부용"이라는 분류만 적는다. 린터 소스 주석은 shared hook을 "private/undocumented API"라고 부른다(`no-slds-namespace-for-custom-hooks.ts` 13행, [G]). 린터 메시지는 "private CSS" 페이지를 보라고 안내하지만 그 페이지는 찾지 못했다(**미확인**).
   - 사실: Winter '27 RN에서 Salesforce가 `--slds-s-table-color` 매핑을 접근성 이유로 바꿨다.
   - **추정**: 컴포넌트 사이에 공유하는 내부 배선 값이라 릴리스마다 매핑을 바꿀 수 있게 공개 계약에서 뺐다.
3. **global hook 재정의를 막는 설계 의도 전체**: 공식 문서가 밝힌 것은 소유권("테마 도구 몫")과 결과(테스트 실패, 레이아웃 깨짐)까지다.
   - 사실: hook마다 Light/Dark 값이 다르다. 밀도에 따라 바뀌는 hook이 있다. 릴리스에서 값을 바꾸거나 폐기한다.
   - **추정**: 고객이 `:root`에 값을 고정하면 모드 전환, 밀도 전환, 접근성 조정이 그 hook에서 멈춘다. 그래서 값을 Salesforce 쪽에 두었다.
4. **native shadow DOM과 c-hook 축소의 관계**: 공식 문서가 둘을 직접 연결하지 않는다. 공식 문서가 연결하는 것은 "native shadow에서는 클래스 override 대신 hook을 써라"(B11)와 "c-hook은 Shadow DOM 경계를 넘는다"(B12)뿐이다.
   - **추정**: native shadow 전환이 클래스 override를 막는 방향을 굳혔고, hook을 유일한 공식 통로로 만든 배경이다.
5. **"커스터마이즈가 줄었다"는 인식에 대한 공식 답변**: 찾지 못했다. 공식 메시지는 일관되게 "더 깊은/진짜 커스터마이즈"다(B10). 다만 Winter '26 다크 모드 RN이 다크 모드를 "더 풍부한 테마와 base component 커스터마이즈의 토대"라고 부르므로, Salesforce는 이 범위를 앞으로 넓힐 계획이라고 말하는 셈이다(https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode.htm&release=258&type=5, [B]).

---

## (f) 밀버스에 주는 시사점

- 공식 방향은 "브랜드는 관리자 테마로, 개발자는 hook을 읽기만"이다. 밀버스의 "기본 우선"(BrandingSet 색·로고만 바꾸고 util.css는 요청이 있을 때만 쓴다)은 이 방향과 맞는다.
- util.css의 `:root` g-hook 재정의는 Styling Hook Index의 "지원하지 않음"에 해당한다. 색 계열 hook은 Light/Dark 값이 달라 다크 모드(Winter '27 GA)와 충돌할 수 있다. 그러니 쓰더라도 반경, 글꼴, 간격으로 한정하고, 폐기된 이름(`--slds-g-font-family` 등)은 쓰지 않는다.
- 버튼만 바꾸는 `--slds-c-*`는 아직 Developer Preview(프로덕션 금지)다. c-hook이 GA가 되면 다시 검토한다.
- (2026-10-09 이후 결정) 조사 당시에는 "그래서 `milvusButton`을 택한 결정이 유효하다"고 적었다. 같은 날 사용자 결정으로, 모양만 바꾸려고 새 컴포넌트를 만들지 않고 hook → 브리지 → opt-in `milvusOverride.css` 순으로 쓰기로 했다. `milvusButton`은 비교 예시로 남는다(설계 1장, 5.1).

---

## (g) 출처 목록 (모두 2026-10-09 확인)

**lightningdesignsystem.com** [B]
- Global Styling Hooks · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/777f5a-global-styling-hooks
- Develop · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/547b38-develop
- Styling API · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/7708aa-styling-api
- Component-Level Styling Hooks · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/0213f9-component-level-styling-hooks
- Styling Hook Index · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/98b493-styling-hook-index
- Transition to SLDS 2 · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/8184ad-transition-to-slds-2
- Get Started · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/76969d-get-started
- Admins · LDS 2: https://www.lightningdesignsystem.com/2e1ef8501/p/771012-admins
- Components · LDS 2 (Architecture, Blueprints 탭): https://www.lightningdesignsystem.com/2e1ef8501/p/755aff-components/b/31438b , https://www.lightningdesignsystem.com/2e1ef8501/p/755aff-components/b/459d9d
- SLDS Development Best Practices (v1): https://v1.lightningdesignsystem.com/dev-guidelines/best-practices/
- Styling Hooks (v1): https://v1.lightningdesignsystem.com/platforms/lightning/styling-hooks/
- Buttons (v1, Styling Hooks 표): https://v1.lightningdesignsystem.com/components/buttons/

**developer.salesforce.com** [B]
- Anti-Patterns for Component Styling: https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-antipatterns.html
- Compare SLDS Versions: https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds1-slds2.html
- SLDS Styling Hooks: https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-custom-properties.html
- SLDS Design Tokens: https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-design-tokens.html
- Style with Lightning Design System: https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds.html
- Get Your LWC Components Ready for Native Shadow DOM in Spring '24: https://developer.salesforce.com/blogs/2024/01/get-your-lwc-components-ready-native-shadow-dom
- Preparing your App for the Lightning Design System Color Update (2023): https://developer.salesforce.com/blogs/2023/06/preparing-your-app-for-the-lightning-design-system-color-update

**help.salesforce.com** [B]
- Customize Components with the SLDS 2 Styling API and Component-Level Hooks (Developer Preview), Winter '27: https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_c_level_hooks.htm&release=264&type=5
- Introducing SLDS 2 (Beta), Spring '25: https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_slds2.htm&release=254&type=5
- Bring Your Org to Life with SLDS 2 (GA), Winter '26: https://help.salesforce.com/s/articleView?id=release-notes.rn_slds2_ga.htm&release=258&type=5
- SLDS Component Design Updates (Beta), Winter '26: https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_updates.htm&release=258&type=5
- Lightning Design System Component Blueprints Updates, Winter '27: https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_updates.htm&release=264&type=5
- Customize Your Themes with Dark Mode (Beta), Winter '26: https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode.htm&release=258&type=5
- Give Your Users the Option of Dark Mode (GA), Winter '27: https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode_ga.htm&release=264&type=5
- Considerations for Themes and Branding: https://help.salesforce.com/s/articleView?id=xcloud.lex_themes_and_branding_considerations.htm&type=5
- Manage Custom Configurations for Themes: https://help.salesforce.com/s/articleView?id=xcloud.brand_custom_configurations.htm&type=5
- Salesforce Component Internals Are Protected (KB 001395244): https://help.salesforce.com/s/articleView?id=001395244&type=1
- Confirm Your Components Use Supported Design System Customizations, Summer '24: https://help.salesforce.com/s/articleView?id=release-notes.rn_lc_design_system_updates.htm&release=250&type=5
- Internal DOM Structure Is Changing for Lightning Base Components, Summer '25: https://help.salesforce.com/s/articleView?id=release-notes.rn_lc_native_shadow_dom.htm&release=256&type=5

**admin.salesforce.com** [B]
- The Admin Guide to Preparing Your Org for Dark Mode With SLDS 2: https://admin.salesforce.com/blog/2025/the-admin-guide-to-preparing-your-org-for-dark-mode
- Spring '26: Design Screen Flows With Intent Using Styling Overrides: https://admin.salesforce.com/blog/2026/spring-26-design-screen-flows-with-intent-using-styling-overrides

**github.com/salesforce-ux** [G] (main 브랜치 커밋 3cc020f, 2026-06-02)
- eslint-plugin-slds README: https://github.com/salesforce-ux/slds-linter/blob/main/packages/eslint-plugin-slds/README.md
- rule-messages.yml: https://github.com/salesforce-ux/slds-linter/blob/main/packages/eslint-plugin-slds/src/config/rule-messages.yml
- no-slds-private-var.ts: https://github.com/salesforce-ux/slds-linter/blob/main/packages/eslint-plugin-slds/src/rules/v9/no-slds-private-var.ts
- no-slds-namespace-for-custom-hooks.ts: https://github.com/salesforce-ux/slds-linter/blob/main/packages/eslint-plugin-slds/src/rules/v9/no-slds-namespace-for-custom-hooks.ts

**허용 목록 밖, 참고만** [B]
- https://www.salesforce.com/blog/what-is-slds-2/
- https://www.salesforce.com/blog/what-are-styling-hooks/

**조사자가 냈지만 다시 열지 않아 뺀 주장**: Lightning Out 2.0의 c-hook 예시, Flow 화면 LWC의 `<stylingHook>`, KB 004633525, `no-unsupported-hooks-slds2`의 c-card 예시, npm 패키지 CSS 집계, v1 New Global Styling Hook Guidance 페이지(같은 내용을 v1 Best Practices로 확인함)

---

## (h) 2026-10-09 정정: "SLDS 2에서는 무시된다"가 가리키는 것

(c)표의 옛 행은 "`.slds-*` 클래스 override, 직접 CSS override: 미지원이고, SLDS 2에서는 무시된다"였다. 그런데 2026-10-08 org 프로브는 `loadStyle`로 넣은 CSS가 synthetic org에서 `lightning-*` 안까지 닿았다고 기록한다([org 프로브](2026-10-08/org-probe.md)). 둘이 모순인지 원문을 다시 열어 확인했다.

**원문의 위치 (v1 Best Practices, [B] 2026-10-09)**

- 페이지 구조: "Update Your SLDS Styles" → "Update Styling Hooks" → "--slds-* Namespace Hooks" → "Replace a Styling Hook as a Value for a Selector that You Don't Own"
- 이 소절의 본문은 세 문장뿐이다. ① 컴포넌트에 대한 직접 CSS 커스터마이즈는 SLDS 2에서 지원하지 않는다. ② CSS를 지웠을 때 문제가 생기면 아직 바꾸지 말라. ③ "The reassigned value will continue to work in legacy SLDS, but will be ignored in SLDS 2."
- 같은 페이지의 "Aura Design Tokens and --lwc-* Namespace Hooks" → "Replace a Custom Property in a Selector that You Don't Own"도 같은 꼴이다. `--lwc-*` 설정은 SLDS 2에서 지원하지 않고, 다시 할당한 값은 SLDS 2에서 무시된다.
- 클래스 덮어쓰기는 다음 절 "Update Other Styling Solutions" → "SLDS Classes in Custom Markup"에서 따로 다룬다. 그 절은 "무시된다"고 쓰지 않고, 블루프린트에서 벗어난 마크업은 SLDS 2 전환 때 깨질 수 있다고 쓴다.

**읽는 법**

1. "무시된다"의 주어는 **남의 선택자에 다시 할당한 styling hook 값**이다. `.slds-button { border-radius: 0; }` 같은 클래스 규칙의 속성 값이 아니다.
2. "지원하지 않는다"(①)는 지원 정책이다. Salesforce가 동작을 보장하지 않는다는 뜻이지, 플랫폼이 그 CSS를 걸러 낸다는 뜻이 아니다. LWC Anti-Patterns 페이지도 SLDS 클래스 덮어쓰기를 "지원하지 않는다"고 쓰고, 이유로 앞으로의 SLDS 변경이 예상하지 못한 결과를 낼 수 있다는 점을 든다(B6).
3. 다시 할당한 hook 값이 "무시되는" 이유는 공식 문서에 없다. 설치된 패키지에서 확인한 사실은 이렇다 [L]:
   - `@salesforce-ux/design-system-2` 2.264.2의 `slds2.cosmos.css`가 `var(--lwc-*)`로 읽는 곳은 3곳(브랜드 밴드·전역 헤더 이미지)뿐이다. 그래서 `--lwc-*`를 다시 할당해도 SLDS 2 CSS의 거의 모든 규칙은 그 값을 읽지 않는다. 문서의 "무시된다"와 맞는다.
   - 반면 같은 파일은 `--slds-c-*` 이름 199개를 `var()`로 읽는다(예: `.slds-button`의 `border-radius`가 `--slds-c-button-radius-border`를 먼저 읽는다). 그러니 "무시된다"를 모든 hook에 일반화할 수 없다. 읽는 곳이 있는 이름은 지금 효과가 있지만 지원되지 않는다(SLDS 2에서 c-hook은 Developer Preview).
   - **추정**: 이 소절의 "무시된다"는 SLDS 2 CSS가 더는 읽지 않는 옛 hook 이름(폐기된 `--lwc-*`, 일부 `--slds-*`)을 다시 할당한 경우를 말한다.
4. 우리 실측과의 관계: 2026-10-08 org 프로브가 `loadStyle`로 넣은 것은 `:root`의 custom property 두 개(`--slds-g-radius-border-pill: 0`, `--slds-s-input-radius-border: 0`)였다. 둘 다 SLDS 2 CSS가 읽는 이름이라 닿았다. **클래스 규칙은 그 프로브에 들어 있지 않았다.** "지금 org에서 클래스 규칙이 닿는다"는 ① 2026-10-07 실측(LEX가 기본 컴포넌트를 synthetic으로 그림, README 3장)과 ② LWC 개발자 가이드 Mixed Shadow Mode 페이지의 설명(synthetic에서는 문서 맨 위의 공유 스타일시트가 페이지의 모든 컴포넌트를 꾸밀 수 있다, https://developer.salesforce.com/docs/platform/lwc/guide/create-mixed-shadow.html [B])에서 나온 결론이다. org에서 클래스 규칙을 직접 잰 기록은 없다(**미확인**).

**결론**

- 정책과 실제 도달로 나눠 보면 공식 문장과 우리 실측은 모순이 아니다. 공식 문장의 "지원하지 않는다"는 정책이다. 우리 실측은 "지금 org(synthetic)에서는 `:root`에 넣은 hook 값이 컴포넌트 안까지 닿았다"를 말한다.
- 다만 "무시된다"가 어떤 값을 가리키는지는 공식 설명이 없다(**미확인**). "SLDS 2가 더는 읽지 않는 옛 hook 이름을 말한다"는 위 3의 **추정**이다. `--lwc-*`(3곳에서만 읽음)와는 맞지만, 같은 CSS가 `--slds-c-*` 이름 199개를 지금도 읽는다는 사실과는 맞지 않는다. 발표에서는 이유를 단정하지 않는다(2026-10-09 리뷰 반영).
- 다만 클래스 규칙의 도달은 직접 재지 않았다. 10/12 org 프로브(Task 9)에서 `milvusBrand` 옆에 클래스 규칙 하나(예: `.slds-button { letter-spacing: 0.2em; }`처럼 기본값과 확실히 다른 값)를 함께 넣어 `lightning-button` 안에 닿는지 잰다.

---

## (i) 로컬 실측: 같은 요구를 hook과 클래스 규칙으로 (2026-10-09, Task 29)

Learn 09 실험 A·C의 근거다. org가 아니라 로컬 브라우저에서 잰 것이다.

- 방법: 설치된 `@salesforce-ux/design-system-2` 2.264.2의 `dist/css/bundled/slds2.cosmos.css`를 저장소 밖 임시 폴더로 복사하고, 그 CSS만 싣는 HTML에 단독 버튼 1개와 `.slds-button-group` 안의 버튼 3개(모두 `slds-button slds-button_neutral`)를 둔다. 내장 브라우저(Chromium)에서 `127.0.0.1`의 정적 서버로 열고, SLDS 2 CSS 뒤에 오는 `<style>` 하나의 내용을 바꿔 가며 `getComputedStyle`로 `border-top-left-radius`, `border-top-right-radius`, `font-weight`를 읽었다. 이 페이지는 shadow DOM이 없어 synthetic org처럼 문서 CSS가 모든 요소에 닿는다
- 결과 (왼쪽 위 / 오른쪽 위 / 굵기)

| 덧붙인 CSS | 단독 | 그룹 첫째 | 그룹 가운데 | 그룹 끝 |
| --- | --- | --- | --- | --- |
| 없음 | 240px / 240px / 600 | 240px / 0px / 600 | 0px / 0px / 600 | 0px / 240px / 600 |
| `.slds-button { border-radius: 0; font-weight: 700; }` | 0px / 0px / 700 | **240px** / 0px / 700 | 0px / 0px / 700 | 0px / **240px** / 700 |
| `:root { --slds-s-button-radius-border: 0; }` | 0px / 0px / 600 | 0px / 0px / 600 | 0px / 0px / 600 | 0px / 0px / 600 |
| `:root { --slds-g-font-weight-6: 700; }` | 굵기 700 | | | |
| `:root { --slds-c-button-font-weight: 700; }` | 굵기 700 | | | |
| `:root { --slds-s-button-font-weight: 700; }` | 굵기 600 (변화 없음) | | | |

- 읽는 법
  - 240px는 `--slds-g-radius-border-pill`(15rem)이다. 클래스 규칙 한 줄은 단독 버튼만 각지게 했다. 그룹의 첫째·끝 버튼 바깥 모서리는 SLDS 2 CSS의 더 구체적인 선택자(`.slds-button-group .slds-button:first-child` 등, 명시도 0,3,0)가 `--slds-s-button-radius-border`를 직접 읽어 이겼다
  - s hook 하나는 SLDS 2 CSS에서 그 이름을 읽는 30줄(`grep -c "var(--slds-s-button-radius-border"`)에 함께 반영되어 그룹까지 바뀌었다
  - 버튼 굵기는 SLDS 2 CSS가 `@layer component`의 `:where(html)`에 `--slds-c-button-font-weight: var(--slds-g-font-weight-6)`을 두고, `.slds-button`이 그 c hook을 읽어 정해진다. 그래서 c hook(Developer Preview, util.css 금지)이나 전역 g hook(`--slds-g-font-weight-6`을 읽는 줄 18개)으로만 바뀐다. `--slds-s-button-font-weight`는 이 CSS가 읽지 않는다(기본 컴포넌트의 native CSS가 읽는 이름이다, [전 컴포넌트 분석 종합](2026-10-08/synthesis.md) 2.8)
- 한계: Chromium 한 곳, Cosmos 테마 파일 하나로 잰 결과다. org에서 같은 규칙을 잰 것은 아니다

---

## 부록. 조사 기록 (2026-10-09)

조사자 세 명이 담당 도메인을 나눠 읽은 기록이다. 원래 기록에는 영어 원문 인용이 많아 여기에는 범위, 방법, 열어 본 URL만 옮겼다. 주장별 판정은 위 (b)·(c)·(e)가 최종이다. 릴리스 번호는 254=Spring '25, 256=Summer '25, 258=Winter '26, 260=Spring '26, 262=Summer '26, 264=Winter '27이다(각 페이지 제목에서 확인).

### 조사 기록 A: SLDS 공식 사이트

- 담당 범위: www.lightningdesignsystem.com (SLDS 2), v1.lightningdesignsystem.com (SLDS 1). SLDS 사이트가 직접 링크한 공식 자료 일부(개발자 문서·블로그, GitHub `salesforce-ux/slds-linter`)도 이유를 확인하려고 함께 읽었다
- 방법: [B] 브라우저 탭에서 `get_page_text`나 `document.body.innerText`로 읽었다(SLDS 2 사이트는 zeroheight 기반 SPA라 WebFetch로는 제목만 나온다). [W] WebFetch, [G] `gh`
- 주요 발견: SLDS 1의 c-hook은 2.17.0(Spring '22)부터 GA였다. v1 Buttons 페이지 HTML에 `--slds-c-button-*` 고유 이름이 약 95개 있다(브라우저에서 정규식으로 센 근사치). SLDS 2 Component-Level Styling Hooks 페이지는 Developer Preview와 "운영에 쓰지 말 것"을 적는다. SLDS 2 사이트에는 `--slds-s-*` 접두사 설명이 없다
- 미확인으로 남긴 것: SLDS 2 Button Specifications 탭의 c-hook 목록(텍스트로 추출되지 않음), 린터 메시지가 가리키는 "private CSS" 페이지
- 표기: v1 사이트 하단 "Last Updated on September 6th 2026", SLDS 2 홈 "Fall '26 v3.4.1"
- 열어 본 URL
  - https://v1.lightningdesignsystem.com/dev-guidelines/best-practices/
  - https://v1.lightningdesignsystem.com/platforms/lightning/styling-hooks/
  - https://v1.lightningdesignsystem.com/platforms/lightning/new-global-styling-hooks-guidance/
  - https://v1.lightningdesignsystem.com/components/buttons/#Styling-Hooks-Overview
  - https://www.lightningdesignsystem.com/2e1ef8501/p/0213f9-component-level-styling-hooks
  - https://www.lightningdesignsystem.com/2e1ef8501/p/012d73-slds-linter
  - https://www.lightningdesignsystem.com/2e1ef8501/p/547b38-develop
  - https://www.lightningdesignsystem.com/2e1ef8501/p/63cfc2-resources
  - https://www.lightningdesignsystem.com/2e1ef8501/p/655b28-color
  - https://www.lightningdesignsystem.com/2e1ef8501/p/755aff-components/b/31438b
  - https://www.lightningdesignsystem.com/2e1ef8501/p/755aff-components/b/459d9d
  - https://www.lightningdesignsystem.com/2e1ef8501/p/76969d-get-started
  - https://www.lightningdesignsystem.com/2e1ef8501/p/7708aa-styling-api
  - https://www.lightningdesignsystem.com/2e1ef8501/p/771012-admins
  - https://www.lightningdesignsystem.com/2e1ef8501/p/7733f8-button/b/02ad1e
  - https://www.lightningdesignsystem.com/2e1ef8501/p/777f5a-global-styling-hooks
  - https://www.lightningdesignsystem.com/2e1ef8501/p/8184ad-transition-to-slds-2
  - https://www.lightningdesignsystem.com/2e1ef8501/p/81aa72-glossary
  - https://www.lightningdesignsystem.com/2e1ef8501/p/98b493-styling-hook-index
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-antipatterns.html
  - https://developer.salesforce.com/docs/platform/slds-linter/guide/reference-rules.html
  - https://developer.salesforce.com/blogs/2024/06/lightning-ui-enhancements-in-summer-24
  - https://help.salesforce.com/s/articleView?id=001622574&type=1 (2026-10-09에 SLDS 2 Transition 페이지로 리다이렉트)
  - https://help.salesforce.com/s/articleView?id=001622575&type=1 (2026-10-09에 LWC Anti-Patterns 페이지로 리다이렉트)
  - https://github.com/salesforce-ux/slds-linter/blob/main/packages/eslint-plugin-slds/src/config/rule-messages.yml
  - https://www.salesforce.com/blog/what-is-slds-2/ (허용 목록 밖, 참고만)
  - https://www.salesforce.com/blog/what-are-styling-hooks/ (허용 목록 밖, 참고만)

### 조사 기록 B: developer.salesforce.com

- 담당 범위: LWC Developer Guide, Lightning Component Reference, SLDS Linter/Validator Guide, Salesforce Developers Blog
- 방법: WebFetch는 docs 페이지에서 403이었다. 모든 본문을 내장 브라우저(전용 탭)로 읽었다. WebSearch는 페이지를 찾는 데만 썼다
- 주의: `create-components-css-slds.html`, `create-components-css-design-tokens.html`에 "Release Preview" 배너가 떠 있었다. 다음 릴리스 미리보기 본문일 수 있다
- 주요 발견: 이 도메인의 문서는 c-hook을 "아직 지원하지 않음, 작업 중"으로 적고 Developer Preview 문구가 없다((b) 판정 표: 시점 차이). 이 도메인에서는 global hook 재정의 금지 문구를 찾지 못했다
- 열어 본 URL
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds1-slds2.html
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds.html
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-slds-blueprint.html
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-custom-properties.html
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-design-tokens.html
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-antipatterns.html
  - https://developer.salesforce.com/docs/platform/lwc/guide/create-mixed-shadow.html
  - https://developer.salesforce.com/docs/platform/lwc/guide/lightning-out-component-properties.html
  - https://developer.salesforce.com/docs/platform/multiframework/guide/mfw-styling.html
  - https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-button.html?type=Develop
  - https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-card.html?type=Develop
  - https://developer.salesforce.com/docs/platform/slds-linter/guide/get-started-intro.html
  - https://developer.salesforce.com/docs/platform/slds-linter/guide/get-started-release-notes.html
  - https://developer.salesforce.com/docs/platform/slds-linter/guide/reference-rules.html
  - https://developer.salesforce.com/blogs/2023/06/preparing-your-app-for-the-lightning-design-system-color-update
  - https://developer.salesforce.com/blogs/2024/01/get-your-lwc-components-ready-native-shadow-dom
  - https://developer.salesforce.com/blogs/2025/01/spring25-developers
  - https://developer.salesforce.com/blogs/2025/09/winter26-developers
  - https://developer.salesforce.com/blogs/2026/01/developers-guide-to-the-spring-26-release
  - https://developer.salesforce.com/blogs/2026/06/the-salesforce-developers-guide-to-the-summer-26-release
  - https://developer.salesforce.com/blogs/2026/10/developers-guide-to-the-winter-27-release
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_slds2.htm&release=254&type=5
  - https://help.salesforce.com/s/articleView?id=xcloud.customize_ui_enhancedlex.htm&type=5
  - https://www.lightningdesignsystem.com/2e1ef8501/p/313db3-faqs/b/70dcc7
  - https://www.lightningdesignsystem.com/2e1ef8501/p/319e5f-styling-hooks/b/607020 (담당 밖이라 열지 않음)
  - https://www.lightningdesignsystem.com/2e1ef8501/p/547b38-developers
  - https://www.lightningdesignsystem.com/2e1ef8501/p/591960-global-styling-hooks/b/768d36

### 조사 기록 C: help.salesforce.com, admin.salesforce.com, GitHub

- 담당 범위: help.salesforce.com(문서, KB, 릴리스 노트), admin.salesforce.com, github.com/salesforce-ux, npm `@salesforce-ux/*` README
- 방법: help.salesforce.com과 admin.salesforce.com은 WebFetch가 실패해서(403 또는 빈 셸) 브라우저 탭으로 본문을 읽었다. GitHub은 `gh api`로, npm은 레지스트리 JSON으로 읽었다
- 주요 발견: KB 001395244(내부 구조 보호), Summer '24·Summer '25 릴리스 노트(내부 DOM 변경 예고), Winter '27 c-hook Developer Preview, 관리자 테마 옵션의 접근성 제한, 린터의 `--slds-s-*` private 분류
- 열어 본 URL
  - https://help.salesforce.com/s/articleView?id=001395244&type=1
  - https://help.salesforce.com/s/articleView?id=001622574&type=1
  - https://help.salesforce.com/s/articleView?id=004633525&type=1 (다시 열지 않아 종합에서 뺐다)
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_lc_design_system_updates.htm&release=250&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_general_slds_themes_beta.htm&release=254&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_slds2.htm&release=254&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_lc_native_shadow_dom.htm&release=256&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds2_ga.htm&release=258&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_updates.htm&release=258&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode.htm&release=258&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_density_hooks.htm&release=258&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode_beta.htm&release=260&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode_beta.htm&release=262&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_automate_flow_screens_styling_hooks.htm&release=262&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_lwc_release_manager_private_methods.htm&release=262&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_c_level_hooks.htm&release=264&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_dark_mode_ga.htm&release=264&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_updates.htm&release=264&type=5
  - https://help.salesforce.com/s/articleView?id=release-notes.rn_change_log.htm&release=264&type=5
  - https://help.salesforce.com/s/articleView?id=xcloud.brand_create_custom_theme.htm&type=5
  - https://help.salesforce.com/s/articleView?id=xcloud.brand_custom_configurations.htm&type=5
  - https://help.salesforce.com/s/articleView?id=xcloud.customize_ui_enhancedlex.htm&type=5
  - https://help.salesforce.com/s/articleView?id=xcloud.lex_themes_and_branding_considerations.htm&type=5
  - https://admin.salesforce.com/blog/2025/the-admin-guide-to-preparing-your-org-for-dark-mode
  - https://admin.salesforce.com/blog/2026/jens-top-winter-27-release-features-for-admins
  - https://admin.salesforce.com/blog/2026/spring-26-design-screen-flows-with-intent-using-styling-overrides
  - https://developer.salesforce.com/docs/platform/slds-linter/guide/reference-rules.html#no-slds-private-var
  - https://www.lightningdesignsystem.com/2e1ef8501/p/0213f9-component-level-styling-hooks
  - https://www.lightningdesignsystem.com/2e1ef8501/p/319e5f-styling-hooks
  - https://www.lightningdesignsystem.com/2e1ef8501/p/8184ad-transition-to-slds-2
  - https://github.com/salesforce-ux/slds-linter/blob/3cc020f5f908f8f289188f41b5a7feb4491534f1/packages/eslint-plugin-slds/README.md
  - https://github.com/salesforce-ux/slds-linter/blob/3cc020f5f908f8f289188f41b5a7feb4491534f1/packages/eslint-plugin-slds/src/config/rule-messages.yml
  - https://github.com/salesforce-ux/slds-linter/blob/3cc020f5f908f8f289188f41b5a7feb4491534f1/packages/eslint-plugin-slds/src/rules/v9/no-slds-namespace-for-custom-hooks.ts
  - https://github.com/salesforce-ux/slds-linter/blob/3cc020f5f908f8f289188f41b5a7feb4491534f1/packages/eslint-plugin-slds/src/rules/v9/no-slds-private-var.ts
  - https://github.com/salesforce-ux/slds-linter/blob/3cc020f5f908f8f289188f41b5a7feb4491534f1/packages/eslint-plugin-slds/src/rules/v9/no-unsupported-hooks-slds2.ts
  - https://github.com/salesforce-ux/slds-linter/releases/tag/0.3.0
  - https://www.npmjs.com/package/@salesforce-ux/eslint-plugin-slds
  - https://www.salesforce.com/blog/what-are-styling-hooks/ (허용 목록 밖, 참고만)

### Task 29에서 다시 연 것 (2026-10-09, [B])

v1 Best Practices(정정 근거, (h)), v1 Buttons(`--slds-c-button-radius-border` 0.25rem), v1 Styling Hooks(2.17.0 GA), Component-Level Styling Hooks(Developer Preview), Styling Hook Index(재정의 미지원), Develop(값 할당은 테마 도구 몫), LWC Anti-Patterns, LWC Shadow DOM·Mixed Shadow Mode(synthetic에서 문서 스타일시트가 모든 컴포넌트를 꾸밈), KB 001395244, Summer '24·Summer '25 릴리스 노트, Winter '26 SLDS 2 GA·Component Design Updates, Winter '27 c-hook·Blueprints Updates·Dark Mode GA 릴리스 노트, MDN `attachShadow`.
