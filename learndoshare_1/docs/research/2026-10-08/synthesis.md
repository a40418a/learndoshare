# 모든 컴포넌트에 브랜드 적용하기: 8개 항목 감사 종합 (2026-10-08)

- 근거: `@salesforce-ux/design-system-2` 2.264.2 번들 CSS와 `lightning-base-components`(LBC) 1.28.19-alpha 소스다. 숫자는 8개 항목별 감사의 집계를 그대로 옮겼다
- 항목마다 모집단(분모)이 다르다. 비율은 같은 항목 안에서만 비교한다
- 소스를 분석한 결과이고, org에서 native shadow를 실측한 결과는 아니다. 추정은 **(추정)**, 확인하지 못한 것은 **(미확인)** 으로 표시했다
- "지금"은 org가 실제로 쓰는 경로(synthetic, SLDS 2 번들 CSS)다. "native"는 전환 뒤 경로(LBC `*.slds.css`)다
- 이 문서에 쓴 hook 이름 150개는 모두 SLDS 2 번들이나 LBC 소스에 있는 것을 확인했다 ([`hookcheck.cjs`](hookcheck.cjs))

## 0. 결론

1. **hook만으로는 "모든 컴포넌트"를 채울 수 없다.**
   - 움직임은 시간과 곡선을 hook으로 바꿀 수 있는 컴포넌트가 91개 중 0개다.
   - 자간, 대소문자, 커서, z-index도 hook이 0개다.
   - 개체 아이콘 배경색은 SLDS 2 CSS 973곳과 LBC JS 966곳에 값이 박혀 있다.
2. **지금 org(synthetic)에서는 hook과 `milvusBridge.css`(명세 5.6)로 거의 모든 컴포넌트에 닿는다.** 문서 스타일이 컴포넌트 안까지 들어가기 때문이다.
3. **native로 바뀌면 브리지 규칙은 모두 사라지고, hook으로 되는 비율도 떨어진다.**
   - 모양: 73% → 32%
   - 포커스 링 모양: 69% → 8%
   - 아이콘: 71% → 29%
   - 움직임: 일부 되던 5개 → 0개
4. 그래서 "예외 없이"를 지키려면 세 가지를 함께 해야 한다.
   - 지금은 hook과 브리지로 모두 덮는다.
   - native 전환을 자동으로 감지한다.
   - 끝까지 바꿀 수 없는 항목은 "Salesforce 고정" 목록으로 사용자와 합의한다.
5. **전제 수정:** "native에서는 `--slds-s-*`가 닿지 않는다"(README, `check-brands.mjs` 주석)는 지나친 서술이다.
   - LBC 소스 211개 폴더 어디에도 `--slds-s-*`를 다시 정의하는 곳이 없다(grep 0건).
   - custom property는 shadow 경계를 넘어 상속된다. 따라서 **LBC native CSS가 직접 읽는 s 이름에는 닿을 가능성이 높다 (추정, 실측 필요).**
   - 정확한 서술은 이렇다: native에서는 SLDS 전역 CSS(`.slds-*`) 안의 읽기 지점이 사라지고, LBC native CSS가 읽는 s 이름에만 닿는다.
6. **화면 범위에도 빈틈이 있다.** util.css는 밀버스 컴포넌트가 `loadStyle`을 부른 페이지에만 들어간다(명세 5.5). 밀버스 컴포넌트가 없는 표준 화면에는 org 테마 색만 적용된다 (2.9).

---

## 1. 한눈에 보는 표

- 비율의 뜻: 그 항목의 선언이 있는 컴포넌트 가운데, **모든 선언이 hook으로 정해지는** 컴포넌트의 비율이다.
- 규칙 표기는 다음과 같다.
  - **[스크립트]**: 지금의 `scripts/check-brands.mjs`
  - **[5.2]**: 명세 5.2 (10/12에 스크립트에 반영 예정)
  - **[브리지]**: 명세 5.6의 `milvusBridge.css`

| 항목 | hook으로 바꿀 수 있는 정도 (컴포넌트 기준) | 빈틈(하드코딩) 규모 | 빈틈을 메우는 방법 | 지금 규칙으로 가능? |
| --- | --- | --- | --- | --- |
| **색** (중립 바탕·글자·테두리·비활성·반전) | 84% (210/249). 지금 88% (131/149), native 79% (79/100). 전혀 안 되는 것 2개(native dynamicIcon, primitiveBubble) | 하드코딩은 SLDS 2 38 + 혼합 15, LBC 39 + 혼합 13이다. 별도로 개체 아이콘 배경이 CSS 973 + JS 966이다. 의미 hook(surface, on-surface, border)은 neutral-base 램프를 참조하지 않는다. 그래서 의미 hook만 바꾸면 램프만 읽는 SLDS 2 150규칙(32그룹)과 LBC 140규칙(54개)이 그대로 남는다 | 의미 hook과 neutral-base 램프를 함께 정의한다(약 50값, `light-dark()`). LBC에만 있는 g 이름 5개를 미리 정의한다. 브랜드 틴트 hover는 색 s hook 화이트리스트로 바꾼다. 개체 아이콘은 브리지로 메우거나 고정으로 둔다 | [스크립트] 예 (accent 계열만 막음) / [5.2] **아니오**: 피드백 색 외의 `--slds-g-color-*`를 금지한다. 색 s hook은 둘 다 금지 |
| **모양** (반경, 테두리 두께) | 지금 73% (72/99), native 32% (25/78). LBC 전용 s hook까지 쓰면 native 54% (42/78) | SLDS 2는 반경 11 + 두께 43이다. LBC native는 반경 22 + 두께 74이고, 반경 자리에 간격 hook을 읽는 선언이 40개 있다(native 모달·필·탭·`.slds-box`). native 배지와 토글은 15rem로 고정 | g 반경·두께 hook과 비색 s hook(button, input, container, icon, avatar, pageheader, navigation)을 쓴다. 입력창 두께와 Path 양 끝 2rem은 브리지로 메운다. native 배지·토글·필·모달은 c hook을 쓰거나 고정으로 둔다 | [스크립트] g만 / [5.2] g + SLDS 2가 읽는 비색 s. 입력창 두께는 둘 다 **불가** (브리지 대상) |
| **간격·밀도·크기** | 45% (85/188, 자체 CSS가 없는 43개 제외). 선언 기준 hook 비율은 SLDS 2 76%, LBC 88% | 브랜드에 의미 있는 하드코딩이 SLDS 2 489, LBC 400이다. 눈에 띄는 것은 컨트롤 높이 1.875rem(버튼·입력·콤보·선택·버튼형 라디오/체크박스), 모달 너비 40 / 52.0625 / 75rem, 표 머리글 2rem, 필 1.5rem이다 | `--slds-g-spacing-1~12`를 배율로 조정한다. 버튼·입력·라벨은 s hook을 쓴다. 컨트롤 높이와 모달 너비는 브리지로 메운다. 그 밖의 폭은 고정으로 둔다 | [스크립트] g만 / [5.2] g + 버튼·입력·라벨·탭·헤더 s hook. 입력창 높이는 둘 다 **불가** (버튼만 키울 수 있음) |
| **글자** (크기, 굵기, 줄 간격, 자간, 대소문자) | 80% (291/364, 상속만 받는 192개 포함). 지금 90% (223/248), native 59% (68/116). **자간과 대소문자는 0%** (hook 0개) | 일부만 되는 65개 가운데 크기·굵기·자간·대소문자를 하드코딩한 것은 24개다. 나머지 41개는 컨트롤 줄 간격(1, 1.875rem)만 고정이다. native에서는 툴팁 0.75rem, 모달 제목 1.25rem, 옵션 머리글 700이 리터럴이 된다 | g 크기·굵기·줄 간격 hook을 쓴다. s hook은 label·helptext·container-heading·pageheader·navigation을 쓴다. 자간은 `:root` 상속 속성과 브리지(button·input·select·textarea)로 메운다. 영문 대문자 제목은 브리지로 메운다 | [스크립트] 예 (글꼴 포함) / [5.2] 크기·굵기·줄 간격은 예, 글꼴은 금지. 자간·대소문자는 둘 다 **불가** |
| **그림자·깊이** (그림자, 배경막, z-index, 투명도) | 68% (56/82). 지금 77% (27/35), native 62% (29/47). native의 대부분은 버튼 상태 그림자라 눈에 띄는 정도는 더 낮다 (추정). z-index와 opacity는 0% | LBC native 하드코딩은 66이다. 드롭다운·팝오버·툴팁 9개 컴포넌트가 `rgba(0, 0, 0, 16%)`를 쓴다. native `lightning-card`는 그림자 식이 무효다. 모달 footer도 리터럴이다. z-index 리터럴은 SLDS 2 26그룹, LBC 31개다. 0/1이 아닌 opacity 리터럴은 4개다 | g 그림자 1~4와 방향형 4개를 쓴다. s hook은 container·pageheader·button·mark 그림자를 쓴다. 배경막은 s 색 hook과 LBC g 이름에 같은 값을 넣는다. 팝오버 꼬리는 브리지로 메운다. z-index와 opacity는 고정으로 둔다 | [스크립트] g만 / [5.2] g 그림자(포커스 제외) + 비색 s. 배경막 s hook은 이름에 color가 있어 **금지** |
| **움직임** (transition, animation, transform) | **0% (0/91).** 일부 되는 5개(SLDS 2 버튼 계열)도 떠오르는 거리만 hook이다. native 0% | transition·animation 리터럴이 SLDS 2 217, LBC 161이다. `@keyframes`는 32 / 26개다. `--slds-g-duration-*` 8개는 정의만 있고 읽는 곳이 0이다. 줄인 움직임 처리는 SLDS 2 CSS 1곳, LBC CSS 0곳뿐이다 | 브리지(`--milvus-motion-*` 변수, 기본값은 Salesforce 값)로 메운다. 줄인 움직임도 브리지 규칙으로 넣는다. 밀버스 컴포넌트는 `--slds-g-duration-*`를 직접 읽는다. native에서는 방법이 없다 | [스크립트]·[5.2] **불가** ([5.2]는 떠오름 거리 s hook 2개만 가능). [브리지]로만 가능 |
| **포커스·상호작용** (포커스 링, hover, active, disabled, 커서) | 52% (68/130, org 테마 색 포함). 포커스 링 모양만 보면 지금 69% (35/51), native 8% (5/59), s hook을 포함하면 34% (20/59). 커서와 링크 밑줄은 0% | LBC 33개 컴포넌트에 `0 0 3px` 글로우 리터럴이 있다. native datatable에 `#014486`과 `palette-blue` 11곳이 있다. 정의되지 않은 `--slds-g-color-accent-4`를 읽는 곳이 13개다. cursor 리터럴은 SLDS 2 78, LBC 59이고, 밑줄은 14, 12다. LBC native는 `:focus` 127규칙이고 `:focus-visible`은 7규칙뿐이다 | 색은 org 테마로 바꾼다. 링 모양은 g 포커스 그림자 4종으로 바꾼다(값 안의 색은 `var(--slds-g-color-brand-base-15)`). native는 s `*-shadow-focus`를 쓴다. 커서와 밑줄은 브리지로 메운다. native 글로우와 `:focus`는 고정으로 둔다 | [스크립트] g 포커스 그림자 예 / [5.2] `--slds-g-shadow-*focus*`를 금지해서 **불가**. 색은 둘 다 org 테마로 가능 |
| **아이콘** (크기, 색, 모양, 아바타) | 50% (55/110, 대부분 공유 척도 hook). 지금 71% (39/55), native 29% (16/55). **개체 아이콘 배경색과 글리프 색은 0%** | 개체 아이콘 배경이 CSS 973 + JS 966이고, 글리프는 `#fff`다. 버튼 안 아이콘은 0.875rem(SLDS 2 + LBC native 23개)이다. 입력창 아이콘도 0.875rem(LBC 11개)이다. SVG 모양도 고정이다 | s hook은 icon-sizing·icon-spacing·icon-radius-border·avatar-radius-border를 쓴다. 보조 아이콘 색은 g on-surface-1을 쓴다(보조 글자와 공유). 개체 아이콘 색과 컨트롤 안 아이콘 크기는 브리지로 메운다. SVG 모양은 고정으로 둔다 | [스크립트] **불가** (s hook을 모두 거부) / [5.2] 비색 s는 예. 색과 컨트롤 안 아이콘 크기는 **불가** |

---

## 2. "모든 컴포넌트" 조건을 지키기 위한 결정 사항

### 2.1 규칙 출처를 하나로 맞춘다 (10/12 스크립트 갱신 때)

지금 세 곳의 규칙이 서로 다르다.

| 대상 | `check-brands.mjs` | CLAUDE.md 3장 | 명세 5.2 |
| --- | --- | --- | --- |
| 비색 `--slds-s-*` | 거부 | 허용 | SLDS 2가 읽는 이름만 허용 |
| 중립색 `--slds-g-color-*` | 허용 (accent 계열만 막음) | 허용 (accent 재정의만 금지) | 금지 (피드백 색만 허용) |
| 글꼴 `--slds-g-font-family*` | 허용 | 허용 (예시에 "글꼴"이 있음) | 금지 |
| 포커스 그림자 `--slds-g-shadow-*focus*` | 허용 | 허용 | 금지 |
| `:root`의 일반 상속 속성(`letter-spacing` 등) | 검사하지 않음 (`--`로 시작하는 이름만 봄) | 언급 없음 | 금지. 그런데 9.2 ②는 이것을 빈틈을 메우는 방법으로 둔다 |

**결정:** 명세 5.2를 기준으로 삼고 2.2~2.5를 반영해 고친다. 셋 중 하나만 고치면 같은 hook이 PR마다 다르게 통과한다.

### 2.2 중립색 g hook을 허용한다 (5.2 개정)

- **이유:** 색 감사의 브랜드 요구는 바탕, 면, 글자, 테두리, 비활성, 반전 면, 배경막, 검색 강조, 회색 온도다. 이것들이 모두 중립 `--slds-g-color-*`다. 5.2대로면 이 요구를 하나도 들어줄 수 없다.
- **조건**
  1. accent 계열(`check-brands.mjs`의 `BRAND_COLOR` 정규식)은 계속 막는다. 브랜드 색의 원본은 org 테마다.
  2. 값은 `light-dark(라이트값, 다크값)`으로 쓴다. 일반 값으로 쓰면 다크 모드 값이 사라진다.
  3. 의미 hook과 neutral-base 램프를 **함께** 정의한다. 예를 들어 표 배경은 지금 `--slds-g-color-surface-container-1/-2`를 읽지만, native datatable은 `--slds-g-color-neutral-base-100/-95`를 읽는다.
  4. 글자 hook과 면 hook 쌍의 대비가 4.5:1 이상인지 자동으로 검사한다.
- **LBC에만 있는 g 이름 5개도 허용한다.**
  - 대상: `--slds-g-color-border-base-1`, `--slds-g-color-border-base-4`, `--slds-g-color-neutral-10-opacity-50`, `--slds-g-color-neutral-100-opacity-10`, `--slds-g-color-neutral-100-opacity-50`
  - 지금은 효과가 없다. native로 바뀌면 `.slds-box`, `.slds-border_*`, `hr`, 배지·카드·탭 테두리, 모달 배경막, 토스트 링크 상태가 이 값을 따른다(감사 집계 23 + 8 + 2 + 4 선언).
  - SLDS 2 CSS에는 정의가 없는 이름이라(`border-base-1`은 fallback으로 1번 참조만 함) LBC 근거를 주석으로 남긴다.
  - org 런타임이 이 이름을 정의하는지는 **미확인**이다.

### 2.3 s hook 허용 범위를 넓힌다

- **허용 범위를 "SLDS 2 CSS 또는 LBC CSS가 `var()`로 읽는 비색 이름"으로 넓힌다.** native에서 버튼과 입력의 두께·글자·높이는 LBC에만 있는 s 이름으로만 바뀌기 때문이다.

  | LBC 전용 s hook | 읽는 컴포넌트 |
  | --- | --- |
  | `--slds-s-button-sizing-border` | 버튼 계열 19개 |
  | `--slds-s-button-font-weight`, `--slds-s-button-font-size`, `--slds-s-button-font-lineheight` | 각 19개 |
  | `--slds-s-input-sizing-height` | 입력 11개 |
  | `--slds-s-label-spacing`, `--slds-s-helptext-spacing` | 11개, 15개 (SLDS 2는 정의만 하고 읽지 않음) |

  LBC `*.slds.css`는 모두 `:host([data-render-mode="shadow"])`로 묶여 있다. 그래서 지금 org에서는 효과가 0이다. 미리 넣어 두면 전환하는 날 그대로 이어진다 (추정, 2.8의 native 빌드로 확인).
- **색 s hook은 값이 중립 g hook만 참조할 때 화이트리스트로만 허용한다.** 검사는 값에 accent·brand 이름이나 hex·rgb 리터럴이 없는지 본다.
  - 배경막: `--slds-s-backdrop-color-background`. synthetic `.slds-backdrop`이 읽는 유일한 hook이다.
  - hover·선택 중립화: `--slds-s-menu-item-color-background-active`, `--slds-s-table-row-color-background-selected`, `--slds-s-navigation-color-background-hover`, `--slds-s-pill-color-background-hover`, `--slds-s-button-color-background-hover`
  - 이유: 기본 hover·선택 배경의 약 40%가 브랜드 틴트(`--slds-g-color-brand-base-90` 등)다(비율은 추정). "hover를 회색으로" 같은 요청을 들어줄 경로가 이것뿐이다.
  - 한계: native에서는 이 중 `--slds-s-menu-item-color-background-active`와 `--slds-s-button-color-background-hover`만 LBC가 읽는다. 배경막, 표 선택, 탭 hover, 필 hover의 s hook은 SLDS 2만 읽어서 native에서는 효과가 없다.

### 2.4 포커스 링 그림자를 조건부로 허용한다

- 5.2가 이것을 금지한 이유는 값에 브랜드 색이 들어가기 때문이다.
- 값 안의 색을 `var(--slds-g-color-brand-base-15)`와 `var(--slds-g-color-neutral-base-100)`으로만 쓰게 하면 색의 원본은 계속 org 테마다. 검사는 값에 hex·rgb 리터럴이 없는지 본다.
- 효과: 지금 링이 있는 SLDS 2 51개 폴더 가운데 35개에는 모두 닿고, 14개에는 일부 닿는다.
- 함께 지킬 것: `--slds-g-shadow-5`와 `--slds-g-shadow-6`은 기본값이 `var(--slds-g-shadow-4)`다. 이 둘은 native의 포커스 표시(calendar, treeItem, progressStep, primitiveInputToggle, tabBar)에 쓰인다. 브랜드가 "그림자 없이"를 골라 `--slds-g-shadow-4`를 `none`으로 두면 포커스 표시까지 사라진다. 이때는 두 값을 Cosmos 기본값으로 따로 적는다 (접근성).

### 2.5 클래스 규칙: util.css는 계속 `:root`만 쓰고, hook이 없는 항목만 `milvusBridge.css`로 (명세 5.6 유지)

- 브리지 대상은 감사에서 hook이 0개이거나 허용된 hook이 없는 것으로 한정한다.

  | 항목 | 대상 (예) | 근거 |
  | --- | --- | --- |
  | 움직임 시간·곡선 | `.slds-button`, `.slds-modal`, `.slds-backdrop`, `.slds-dropdown`, `.slds-popover`, 토글, path | SLDS 2의 transition·animation 217선언이 모두 리터럴 |
  | 줄인 움직임 | `@media (prefers-reduced-motion: reduce)` | SLDS 2 CSS 1곳, LBC CSS 0곳 |
  | 컨트롤 높이 | `.slds-button`, `.slds-input`, `.slds-input_faux`, `.slds-select`, `.slds-radio_button`, `.slds-checkbox_button` | `line-height: 1.875rem` 고정 |
  | 입력창 테두리 두께 | `.slds-input`, `.slds-textarea` | `1px` 고정, 허용된 hook 없음 |
  | Path 양 끝 반경 | `.slds-path__item:first-child`, `:last-child` | `2rem` 고정 |
  | 자간 | `button`, `input`, `select`, `textarea` | 브라우저 기본값으로 다시 초기화되어 상속이 끊긴다 (추정, Chromium 기준) |
  | 영문 대문자 제목 | `.slds-text-title_caps`, `.slds-section-title_divider` | `text-transform: uppercase` 고정 |
  | 선택지 라벨 굵기 | `.slds-radio`, `.slds-checkbox`의 `.slds-form-element__label` | `font-weight: normal` 고정 |
  | 커서, 링크 밑줄 | 비활성 요소, `a:hover` | cursor는 SLDS 2 78선언, 밑줄은 14선언이 리터럴 |
  | 팝오버 꼬리 그림자 | `.slds-nubbin_*::after` | private hook(`--_slds-*`)만 있음 |
  | 개체 아이콘 배경색 | `.slds-icon-standard-*` 등 973개 | 클래스가 호스트에 c hook을 직접 정의함 |
  | 컨트롤 안 아이콘 크기 | `.slds-button__icon`, `.slds-input__icon` | `0.875rem` 고정 |
  | 모달 너비 (사용자가 원할 때만) | `.slds-modal__container` | 40 / 52.0625 / 75rem 고정 |

- 규칙 원칙(5.6 그대로)
  - 규칙은 값을 직접 갖지 않고 `--milvus-*` 변수를 읽는다. fallback은 Salesforce 원래 값이다. 그래서 브랜드가 변수를 정하지 않으면 화면이 바뀌지 않는다.
  - 개체 아이콘은 클래스마다 원래 색이 다르다. 그래서 패키지가 973개 규칙을 각자의 원래 rgb를 fallback으로 하여 생성한다.
- **넣으면 안 되는 값**
  - 모달과 토스트: `modalBase.js`는 배경막의 `transitionend`를 기다려 닫힘을 마무리한다. 토스트는 `toast.html`의 `onanimationend`에서 close가 나간다. 시간을 `0s`나 `none`으로 만들면 닫히지 않을 수 있다. 최솟값은 `0.01ms`다.
  - 스피너: 점별 지연(-83.3333ms ~ 1050ms)이 1000ms를 기준으로 한 리터럴이다. 시간만 바꾸면 점의 순서가 어긋난다. 그래서 스피너는 줄인 움직임 켜기·끄기만 다룬다.
- **한계:** 브리지는 native로 바뀐 컴포넌트 안에는 닿지 않는다. 그래서 브리지 항목은 모두 명세 페이지와 Storybook에 "native 전환 시 잃음"으로 표시하고, 2.8의 방법으로 감시한다.

### 2.6 움직임처럼 hook이 없는 항목

- 사실
  - 시간·곡선 hook을 읽는 컴포넌트는 SLDS 2와 LBC 모두 0개다.
  - `--slds-g-duration-*` 8개(immediately, quickly, promptly, slowly, instantly, paused, toast-short, toast-medium)는 정의만 있다. easing hook은 아예 없다.
  - transition·animation·transform은 상속되지 않는 속성이라 `:root` 상속으로도 닿지 않는다.
- 결정
  1. 브랜드의 속도와 곡선은 브리지로 지금 org에 적용한다.
  2. 밀버스 컴포넌트는 자기 CSS에서 `var(--slds-g-duration-*, fallback)`을 읽는다. 그래서 native 전환과 상관없이 유지된다.
  3. 줄인 움직임은 브랜드가 고르는 값이 아니라, 항상 켜 두는 접근성 규칙으로 브리지에 넣는다.
  4. 토스트 표시 시간(`toast.js`의 JS 상수 4800ms, 9600ms)과 스피너·모달·토스트·팝오버의 등장 모양은 "Salesforce 고정"으로 합의한다. `--slds-g-duration-toast-short`와 `--slds-g-duration-toast-medium`은 밀버스 토스트를 만들 때만 쓴다.
  5. 명세 페이지에 "native 전환 뒤에는 기본 컴포넌트의 움직임이 Salesforce 값으로 돌아간다"고 적는다.
- 버튼 떠오름 거리(`--slds-s-button-brand-transform-hover`, `--slds-s-button-bordered-transform-hover`)는 지금 SLDS 2 규칙 12개에 닿는다. native `lightning-button`에는 떠오름 효과 자체가 없다.

### 2.7 끝까지 바꿀 수 없는 것은 "Salesforce 고정" 목록으로 합의한다

- **두 모드 모두에서 고정**
  - 아이콘 SVG 모양(선 굵기, 채움 세트)과 개체 아이콘 글리프의 흰색
  - z-index 층: 드롭다운 7000, 팝오버 6000, 모달 9000/9001, 스피너 9050
  - 0/1이 아닌 opacity, 토스트 표시 시간, 스피너 모양, 색 선택기 hue
  - Agentforce 영역(`.slds-subtheme-agentic`), 이미지 scrim, 파괴·성공 버튼의 흰 글자
  - LEX 전역 헤더 (org 테마가 원본)
- **native 전환 뒤에 생기는 고정** (2.8의 c hook 없이는 메울 수 없음)
  - 드롭다운·팝오버·툴팁의 그림자, 툴팁 배경과 글자 크기
  - native `lightning-card`의 그림자
  - 모달 반경 (간격 hook을 읽음), 배지·토글 15rem, 입력창 두께, 콤보박스 높이
  - `:focus` 위주의 포커스 표시와 3px 글로우
  - 버튼 hover 떠오름 사라짐
  - 표 머리글과 hover의 회색(`#fafaf9`, `#f3f2f2`), 검색 강조 `#ff0`
  - 모든 움직임
- 이 목록이 사용자의 "예외 없이" 요구와 충돌한다는 점을 명세 페이지와 발표에 그대로 적는다.

### 2.8 native 전환 위험: 감지와 대비

**감지**

1. **org 런타임에서 감지한다.**
   - `shadowBaseClassPrivate.js`는 synthetic이 아닐 때 호스트에 `data-render-mode="shadow"`를 붙인다.
   - LBC에서 123개 폴더가 이 기본 클래스를 쓴다. 그중 114개가 native 지원 목록(`package.json`의 `lwc.nativeShadowEnabledComponents`, 156개) 안에 있다.
   - 밀버스 컴포넌트가 `loadBrand`에서 자기 템플릿 안의 `lightning-*` 호스트에 이 속성이 있는지 확인하고, 있으면 개발 콘솔에 경고한다.
   - synthetic은 `document` 검색에서 shadow 안의 요소를 숨기므로, 문서 전체 검색은 쓰지 않는다 (구현 때 확인).
2. **패키지를 갱신할 때 감지한다.** SLDS 2나 LBC 버전을 올리면 5.1의 정적 검사가 native 지원 목록, 새 하드코딩, hook 이름의 변화를 기준 파일과 비교하고, 차이가 있으면 실패시킨다.
3. **Salesforce 릴리스(연 3회)마다 확인한다.** 릴리스 노트에서 native shadow 전환 항목을 사람이 확인한다.

**대비**

1. **두 모드의 hook을 함께 정의한다.** 같은 화면이라도 모드에 따라 읽는 hook이 다르다.

   | 대상 | 지금(synthetic)이 읽는 것 | native가 읽는 것 |
   | --- | --- | --- |
   | 표 배경 | `--slds-g-color-surface-container-1`, `-2` | `--slds-g-color-neutral-base-100`, `-95` |
   | 박스·구분선 테두리 | `--slds-g-color-border-1` | `--slds-g-color-border-base-1`, `-4` |
   | 모달 배경막 | `--slds-s-backdrop-color-background` | `--slds-g-color-neutral-10-opacity-50` |
   | 버튼 굵기 | `--slds-g-font-weight-4` | `--slds-s-button-font-weight` |
   | 굵은 글자 | `--slds-g-font-weight-7` | `--slds-g-font-weight-bold` (6개 컴포넌트) |
   | 버튼 테두리 두께 | `--slds-g-sizing-border-1` | `--slds-s-button-sizing-border` |
   | 버튼 높이 | `line-height: 1.875rem` (브리지) | `--slds-s-button-font-lineheight` |
   | 입력창 높이 | `line-height: 1.875rem` (브리지) | `--slds-s-input-sizing-height` |
   | 탭 선택 표시선 | `--slds-s-navigation-sizing-border-active` | `--slds-g-sizing-border-1` + 2px |
   | 버튼 포커스 링 | `--slds-g-shadow-outline-focus-1` | `--slds-s-button-shadow-focus` |

2. **Storybook에 native 빌드를 하나 더 둔다.**
   - #14에서 쓰던 `nativeShadow` 플러그인을 환경 변수로 켜는 두 번째 빌드로 되살린다. 이 플러그인은 native 지원 목록에 있는 컴포넌트에 `shadowSupportMode = "native"`를 붙인다.
   - 5.2의 검사를 두 빌드에서 각각 돌려 "전환 시 잃는 항목"을 PR마다 낸다.
   - 지금 org와 같은 기본 빌드는 synthetic 그대로 둔다.
3. **native에서만 메울 수 있는 c hook 목록을 미리 준비하되, 지금은 금지를 유지한다.**
   - 목록: `--slds-c-card-shadow`, `--slds-c-tooltip-color-background`, `--slds-c-tooltip-text-color`, `--slds-c-tooltip-font-size`, `--slds-c-badge-radius-border`, `--slds-c-checkbox-toggle-radius-border`, `--slds-c-pill-radius-border`, `--slds-c-input-sizing-border`, `--slds-c-modalheader-heading-font-size`, `--slds-c-modalfooter-shadow`
   - 감지가 울리면 이 목록을 열지 사용자가 정한다.
   - 지금 금지하는 이유: SLDS 2에서 c hook을 계속 지원하는지 **미확인**이다. 또 `:root`에 두면 모든 변형의 기본값을 덮는다. 예를 들어 `--slds-c-pill-radius-border`를 두면 pill_container에도 적용된다.

### 2.9 "모든 컴포넌트"에는 "모든 화면"도 들어간다

- util.css와 브리지는 밀버스 컴포넌트가 `loadStyle`을 부른 페이지에만 들어간다. 표준 레코드 페이지만 있는 화면에는 org 테마 색만 적용된다.
- 후보: 앱 유틸리티 바에 화면이 없는 밀버스 컴포넌트를 두고 백그라운드 로드로 설정하면, 앱의 모든 페이지에서 `loadBrand`가 실행될 수 있다 (**미확인**, org 실측 필요). 이 방법이 안 되면 "밀버스 컴포넌트가 있는 페이지만"을 한계로 적는다.

### 2.10 그 밖에 정할 것

- **글꼴**
  - 명세 6.1은 "시스템 글꼴 고정(표시만)"이다.
  - 글꼴은 `html`에서 상속되고 하드코딩이 0개라서, 열면 거의 모든 컴포넌트에 닿는다.
  - 웹폰트는 `@font-face`가 필요해서 5.2와 충돌한다. 연다면 static resource와 브리지 파일에 `@font-face`를 둔다.
  - 지금 결정은 유지하고, 한글 글꼴 요구가 오면 다시 정한다.
- **부수 발견 (고칠 것)**
  - `brands/Sample_Forest/util.css` 주석의 "버튼·뱃지 등 알약형"은 틀렸다. 합성 `.slds-badge`는 `--slds-g-radius-border-1`을 읽는다.
  - 정의되지 않은 hook을 읽는 곳이 있다: `--slds-g-color-accent-4`(LBC 13개, fallback 없음), `--slds-g-info-container-1`, `--slds-s-button-shadow-hover`. org 런타임에 정의되어 있는지는 **미확인**이다.
  - LBC `primitiveColorpickerButton`의 포커스 값이 `0 0 3px var(--slds-s-button-shadow-focus)`라서 무효다. 포커스 링이 안 보일 수 있다 (추정, 접근성 문제).
  - npm 번들의 hook 기본값과 org 런타임의 값이 같은지는 **미확인**이다.

---

## 3. 브랜드 명세 페이지에 추가할 항목

기존 항목(브랜드 색, 로고, 모서리, 밀도, 글자, 피드백 색, 컴포넌트별 조정, 밀버스 컴포넌트, 전체 스타일)과 겹치지 않게 골랐다. 기존 항목은 새로 만들지 않고 범위만 넓힌다.

- **모서리:** `--slds-g-radius-border-1~4`와 `-pill` 전체로 넓힌다. `--slds-g-radius-border-2`를 약 80개 묶음·컴포넌트가 함께 쓴다는 점을 미리보기에 표시한다.
- **밀도:** `--slds-g-spacing-1~12` 배율로 넓힌다. 지금은 버튼·입력·라벨 간격만 다룬다.
- **글자:** 크기 단계(`--slds-g-font-scale-neg-2` ~ `-7`)를 포함한다. 비율 hook(`--slds-g-font-scale-ratio`)은 읽는 곳이 0개라서 단계마다 따로 정한다.
- **브랜드 색:** 포커스 링 색, hover 글자색, 아바타 이니셜 배경이 이 항목을 따른다는 설명을 붙인다.
- **컴포넌트별 조정:** 카드 그림자는 `--slds-s-container-shadow`이고, native `lightning-card`에는 닿지 않는다고 표시한다.

| 묶음 | 라벨 | 자연어 예시 | 매핑 | 닿는 범위와 한계 |
| --- | --- | --- | --- | --- |
| 색 | 바탕·면 색 | "페이지 바탕을 따뜻한 연회색으로", "카드는 순백 말고 아이보리" | `--slds-g-color-surface-1`·`-2`·`-3`(surface-2가 앱 바탕), `--slds-g-color-surface-container-1`·`-2`·`-3`, native용 `--slds-g-color-neutral-base-100`·`-95`·`-90` | neutral-base-100은 색 위의 흰 글자로도 51곳에서 쓰인다. 그래서 흰색에 가까운 범위에서만 바꾼다. LEX 페이지 바탕을 플랫폼이 따로 칠하는지는 **미확인** |
| 색 | 글자색 단계 | "글자를 남색 말고 거의 검정으로", "도움말 글자를 조금 더 진하게" | 제목·본문 `--slds-g-color-on-surface-3`(html color), 입력값·레이블 `--slds-g-color-on-surface-2`, 보조·placeholder `--slds-g-color-on-surface-1`, native 읽기 전용 값 `--slds-g-color-neutral-base-10`, `--slds-g-color-neutral-base-30` | 보조 아이콘 색은 `--slds-g-color-on-surface-1`을 같이 써서 따로 바꿀 수 없다. 대비 4.5:1 검사 |
| 색 | 테두리·구분선 색 | "구분선은 더 옅게", "입력창 테두리는 더 진하게" | `--slds-g-color-border-1`(구분선·카드), `--slds-g-color-border-2`(입력·버튼), `--slds-g-color-neutral-base-80`, native용 `--slds-g-color-border-base-1`·`-4` | native 버튼형 라디오 `#dddbda`와 native 표 머리글 `#babfc7`은 고정 |
| 색 | 회색 온도 | "회색을 전부 쿨그레이로", "웜그레이로 통일" | `--slds-g-color-neutral-base-0` ~ `-100` 16단계 + 이 표의 다른 색 의미 hook | 의미 hook이 램프를 참조하지 않아서 둘 다 정한다. skill이 한 색조로 계산해 채운다 |
| 색 | 비활성 상태 | "비활성 버튼은 더 흐리게", "비활성 입력창 바탕을 바탕색과 구분되게" | `--slds-g-color-disabled-container-1`·`-2`, `--slds-g-color-on-disabled-1`·`-2`, `--slds-g-color-border-disabled-1`·`-2`, `--slds-g-color-disabled-1`·`-2` | `-2` 계열 일부는 LBC native만 읽는다 |
| 색 | 어두운 면 | "툴팁과 코치마크를 남색 말고 차콜로", "어두운 탭 배경을 브랜드 다크톤으로" | `--slds-g-color-surface-inverse-1`·`-2`, `--slds-g-color-surface-container-inverse-1`·`-2`, `--slds-g-color-on-surface-inverse-1`·`-2`, `--slds-g-color-border-inverse-1`·`-2` | native 툴팁(primitiveBubble)은 g hook을 읽지 않아서 `#032d60`으로 고정된다. `--slds-c-tooltip-color-background`만 닿는다 |
| 색 | 모달 배경막 | "모달 뒤 막을 더 연하게", "배경막을 검정 50%로" | `--slds-s-backdrop-color-background`(지금)와 `--slds-g-color-neutral-10-opacity-50`(native `lightning-modal`)에 같은 값 | 2.3의 색 s hook 예외가 필요하다 |
| 색 | 검색어 강조 | "검색어 강조를 형광 노랑 말고 연한 살구색으로" | `--slds-g-color-palette-yellow-90`, `--slds-g-color-palette-yellow-80` | native `sldsCommon`의 `mark`는 `#ff0` 고정 |
| 색 | hover·선택 바탕 | "목록 hover를 파란 틴트 말고 회색으로", "선택된 행을 연회색으로" | 중립 hover는 `--slds-g-color-surface-container-2`·`-3`(바탕과 공유). 브랜드 틴트 hover·선택은 2.3의 s hook 5개 | native에서는 menu-item과 button의 2개만 닿는다. navigation-list-vertical의 활성 배경 `rgb(21, 137, 238, 0.1)`은 브리지 대상이다. native 표 hover `#f3f2f2`는 고정 |
| 색 | 다크 모드 | "다크 모드는 Salesforce 기본값 그대로" | 모든 색 값을 `light-dark(라이트, 다크)`로 쓴다 | 일반 값으로 쓰면 다크 값이 사라진다 |
| 모양 | 테두리 두께 | "전체 테두리를 2px로", "오류 표시 테두리를 더 굵게" | 기본 `--slds-g-sizing-border-1`(296선언), 강조선 `--slds-g-sizing-border-2`(47선언), native 버튼 `--slds-s-button-sizing-border` | 입력창·textarea 1px는 브리지로 메운다. 구분선 약 23곳은 1px 하드코딩이다. `-3`·`-4`는 반경·글로우로도 쓰여서 건드리지 않는다 |
| 모양 | 배지·필·토글 모양 | "배지도 알약형으로", "토글 스위치는 기본 유지" | 지금: 배지 `--slds-g-radius-border-1`, 필·토글 `--slds-g-radius-border-pill` | native에서는 배지·토글이 15rem로 고정되고, 필은 `--slds-g-spacing-1`을 읽어 간격과 함께 바뀐다 |
| 모양 | 아바타·개체 아이콘 모양 | "프로필 사진을 둥근 사각으로", "아이콘 배경은 원형 유지" | `--slds-s-avatar-radius-border`, `--slds-s-icon-radius-border` | native는 둘 다 `--slds-g-radius-border-2`를 읽는다. action 아이콘은 원형 고정이다. `--slds-g-radius-border-circle`은 라디오·스피너까지 바꿔서 쓰지 않는다 |
| 모양 | 탭·페이지 헤더 모양 | "선택된 탭 밑줄을 2px로", "페이지 헤더를 카드처럼 둥글게, 테두리 넣기" | `--slds-s-navigation-sizing-border-active`·`-hover`, `--slds-s-navigation-radius-border`, `--slds-s-pageheader-radius-border`, `--slds-s-pageheader-sizing-border` | SLDS 2만 읽는다. native tabBar는 `--slds-g-sizing-border-1` + 2px를 쓴다 |
| 크기 | 컨트롤 높이 | "버튼과 입력창을 40px로", "모바일에서 누르기 쉽게" | 버튼은 `--slds-s-button-spacing-block` = (목표 높이 - 1.875rem - 2px) / 2 (키우기만 가능). native 대비로 `--slds-s-button-font-lineheight`, `--slds-s-input-sizing-height`. 입력·선택·콤보·버튼형 라디오는 브리지 | 브리지 없이 버튼만 키우면 폼에서 높이가 어긋난다. native 콤보박스와 버튼형 라디오의 1.875rem은 빈틈 |
| 크기 | 탭·헤더 높이 | "탭 바를 낮게", "상단 헤더 높이를 줄여 줘" | `--slds-s-navigation-sizing-height`와 `--slds-s-navigation-font-lineheight`(같은 값), `--slds-s-header-sizing-height` | native tabBar는 내부 변수를 써서 닿지 않는다. LEX 전역 헤더가 이 클래스를 쓰는지는 **미확인** |
| 크기 | 아이콘 크기 | "기본 아이콘을 36px로", "아이콘 배경을 넉넉하게", "버튼 안 아이콘을 16px로" | medium은 `--slds-s-icon-sizing`(기본 `--slds-g-sizing-9`), 배경 여백은 `--slds-s-icon-spacing`, 버튼·입력 안 아이콘은 브리지 | x-small·small·large는 공유 척도(`--slds-g-sizing-5`·`-7`·`-10`)라서 쓰지 않는다. native 버튼 안 아이콘 23개는 빈틈 |
| 글자 | 줄 간격 | "본문 줄 간격을 1.6으로", "제목 줄 간격 1.3" | 본문 `--slds-g-font-line-height-base`, 제목 `--slds-g-font-line-height-2`, 한 줄 요소 `--slds-g-font-line-height-1` | 컨트롤 안의 1.875rem·1과 알림·확인 대화상자 본문의 1.5는 고정 |
| 글자 | 자간 | "한글 자간 -0.02em" | hook 없음. `:root`의 `letter-spacing`(2.1의 상속 속성 결정 필요) + 브리지(button, input, select, textarea) | native 버튼·입력 안은 빈틈이다. `.slds-text-title_caps`처럼 자체 값이 있는 곳은 따로 다룬다 |
| 글자 | 대소문자 | "영문 소제목을 대문자로 쓰지 마" | hook 없음. 브리지(`.slds-text-title_caps`, `.slds-section-title_divider`) | LBC 템플릿은 이 클래스를 쓰지 않는다(grep 0건). 커스텀 마크업과 표준 화면에서만 보인다 (추정) |
| 깊이 | 그림자 깊이 | "그림자 없이 평평하게", "그림자를 더 부드럽고 넓게" | `--slds-g-shadow-1` ~ `-4`(light-dark 쌍), `--slds-g-shadow-block-start-2`·`-3`, `--slds-g-shadow-inline-start-3`, `--slds-g-shadow-inline-end-3`. 평평하게 하더라도 `--slds-g-shadow-5`·`-6`은 기본값 유지(2.4) | 팝오버 꼬리는 브리지로 메운다. native 드롭다운·팝오버·툴팁 9개는 고정이다. 카드 그림자는 기존 "컴포넌트별 조정"에서 다룬다 |
| 깊이 | hover·눌림 효과 | "버튼이 떠오르지 않게 평평하게", "누를 때 들어가는 느낌은 유지", "체크된 버튼에 안쪽 그림자 없이" | `--slds-s-button-brand-transform-hover`, `--slds-s-button-bordered-transform-hover`, `--slds-s-button-brand-shadow-hover`, `--slds-s-button-bordered-shadow-hover`, `--slds-s-button-shadow-hover`, `--slds-s-button-shadow-active`, `--slds-s-mark-shadow-checked` | 떠오름은 SLDS 2의 5개 폴더만 읽는다. native에는 떠오름이 없다. 시간과 곡선은 "움직임 속도"에서 다룬다 |
| 움직임 | 움직임 속도 | "빠르고 경쾌하게", "차분하고 여유 있게" | 브리지의 `--milvus-motion-*` 변수(이름 미정), 기본값은 Salesforce 값(0.1s, 150ms, 0.2s, 0.4s). 밀버스 컴포넌트는 `--slds-g-duration-immediately`·`-quickly`·`-promptly`·`-slowly` | 지금 org에서만 된다. native 전환 뒤 기본 컴포넌트는 원래 값으로 돌아간다. 모달·토스트는 최소 0.01ms. 스피너는 제외 |
| 움직임 | 움직임 곡선 | "부드럽게 감속하며 멈추게", "기계적으로 일정하게" | 브리지의 `--milvus-motion-*` 변수(이름 미정). 예: `cubic-bezier(0, 0.3, 0.15, 1)`(SLDS breadcrumbs), `cubic-bezier(0.75, 0, 0.08, 1)`(SLDS 토글) | 움직임 속도와 같다 |
| 움직임 | 줄인 움직임 | "OS에서 동작 줄이기를 켠 사람에게는 애니메이션 없이", "회사 정책상 항상 최소화" | 기본은 브리지의 `@media (prefers-reduced-motion: reduce)` 규칙(항상 켬). 선택하면 항상 최소화 | `0.01ms`를 쓴다(0이면 모달·토스트가 안 닫힐 수 있음). native 전환 뒤 스피너·토스트·드롭다운은 계속 움직인다 |
| 포커스 | 포커스 링 모양 | "포커스 링을 3px로 굵게", "버튼과 링 사이에 흰 틈 2px", "어두운 헤더 위에서도 잘 보이게" | `--slds-g-shadow-outline-focus-1`, `--slds-g-shadow-outset-focus-1`, `--slds-g-shadow-inset-focus-1`, `--slds-g-shadow-inset-inverse-focus-1`(값 안의 색은 `var(--slds-g-color-brand-base-15)`). native 대비로 `--slds-s-button-shadow-focus`, `--slds-s-mark-shadow-focus` | 2.4의 규칙 개정이 필요하다. 링 색은 "브랜드 색" 항목을 따른다. 버튼형 라디오·체크박스 그룹 2개는 따라오지 않는다. native 글로우 33개와 `:focus` 표시 시점은 고정 |
| 포커스 | 커서·링크 밑줄 | "비활성 요소에는 금지 커서", "링크에 마우스를 올려도 밑줄 없이" | hook 없음. 브리지 | native 전환 뒤 고정 |
| 아이콘 | 개체 아이콘 색 | "Account 아이콘을 브랜드 남색으로", "개체 아이콘을 브랜드 3색 안에서" | hook 없음(`.slds-icon-standard-*`·`custom-*`·`action-*` 973개, LBC `iconColors.js` 966개). 브리지가 클래스마다 `--slds-c-icon-color-background`를 다시 정의한다(패키지가 생성, fallback은 원래 rgb) | 개체를 색으로 구분하던 단서가 사라질 수 있다. `lightning-icon`이 native 부모 안에 있으면 닿지 않는다. 글리프 흰색과 SVG 모양은 고정 |
| 표시만 | Salesforce 고정 | "채팅 위젯을 모달보다 위에", "로딩 표시를 원형 회전으로", "토스트를 10초 동안 보이게" | 입력 없음. 2.7의 목록과 고정 크기(모달 너비, 팝오버·드롭다운 폭, 표 머리글 2rem, 필 1.5rem, 폼 칸 280px)를 보여 준다 | 요청이 오면 이 항목으로 안내한다. 모달 너비는 사용자가 원하면 브리지로 옮긴다 |

---

## 4. Storybook "Salesforce 원본 + 이 컴포넌트가 읽는 hook" 보기 (컴포넌트마다)

데이터는 손으로 쓰지 않는다. 감사와 같은 추출 스크립트로 빌드할 때 만든다. `decls.json`은 값이 80자에서 잘리므로, 생성기는 전체 값을 보관한다.

**머리 요약**

- `lightning-*` 이름과 SLDS 블루프린트 이름
- native 지원 목록(156개)에 있는지, `shadowBaseClassPrivate`를 쓰는지(= org에서 `data-render-mode`가 붙는지)
- 지금 Storybook의 렌더 모드(synthetic / native 빌드)
- 브랜드 명세 항목별 반영 상태. 지금과 native로 나눠 배지로 표시한다: 반영 / 일부 / 안 됨 / 해당 없음 (5.2 검사 결과)

**hook 표** (이 컴포넌트가 읽는 hook)

| 열 | 내용 |
| --- | --- |
| hook | 이름. s hook이면 이어지는 g hook을 함께 보여 준다 (예: `--slds-s-button-radius-border` → `--slds-g-radius-border-pill`) |
| 종류 | g / s / c / private(`--_slds-*`) / LBC 전용 / 정의 없음 |
| 기본값 | 라이트 값과 다크 값 |
| 지금 브랜드 값 | 선택한 브랜드의 util.css 값. 없으면 "기본" |
| 읽는 곳 | 속성과 선택자 수. 지금 경로에서 읽는지, native 경로에서 읽는지 따로 표시 |
| util.css로 바뀌는가 | 2.1의 통합 규칙 기준: 허용 / 금지(이유) / 화이트리스트 |
| 명세 항목 | 3장의 라벨 |

- **정의 없음 경고:** `--slds-g-color-accent-4`처럼 정의가 없는 hook은 fallback 값과 함께 빨간색으로 표시한다.
- **모드 차이 강조:** 같은 속성이 모드에 따라 다른 hook을 읽으면 한 줄에 나란히 보여 준다. 예: 표 머리글 배경은 지금 `--slds-g-color-surface-container-2`, native에서는 `#fafaf9`

**빈틈 표** (하드코딩)

| 열 | 내용 |
| --- | --- |
| 속성, 값 | 예: `line-height: 1.875rem` |
| 위치 | 파일과 행, 선택자 |
| 모드 | 지금만 / native만 / 둘 다 |
| 영향 | 높음 / 중간 / 낮음 (감사의 visibleImpact) |
| 메우는 방법 | 브리지(규칙 있음/없음) / 밀버스 컴포넌트 / c hook 후보 / Salesforce 고정 |

- **JS 하드코딩은 따로 보여 준다.** `toast.js`의 4800/9600ms, `iconColors.js`의 개체 색, `--lwc-zIndexModal`(JS가 읽는 z-index 기준)이 여기에 해당한다. CSS 검사로는 보이지 않기 때문이다.

**원본 탭**

- LBC의 `html`·`js`·`css`, native용 `*.slds.css`, SLDS 2 컴포넌트 CSS를 보여 준다. hook과 하드코딩을 색으로 강조하고, 위 표의 행에서 원본의 해당 행으로 이동할 수 있게 한다.
- Salesforce 이용 약관 전문을 함께 넣는다 (명세 9.4).

**미리보기**

- 기본 브랜드, 프로젝트 브랜드, 센티널 브랜드(5.2)를 나란히 놓는다.
- 모드(synthetic / native 빌드)와 브리지 켜기·끄기를 전환할 수 있게 한다.

---

## 5. 검증 방법: 모든 컴포넌트에 반영됐는지 자동으로 확인하기

### 5.1 정적 검사 (브라우저 없이, CI에 넣을 수 있음)

1. SLDS 2 번들 CSS와 LBC `*.css`를 postcss로 파싱한다. postcss는 vite와 함께 이미 설치되어 있다. 스크립트에서 직접 쓰려면 devDependency로 명시한다 (새로 내려받지 않음).
2. 각 선언의 `var()` 체인을 `:where(html)` 기본값까지 풀어서 "명세 항목 → 닿음 / 브리지 / 빈틈 / 고정"으로 판정한다. 감사 스크립트를 그대로 옮긴다.
3. 결과를 기준 파일(JSON)과 비교한다. 다음이 생기면 실패시킨다.
   - 새 하드코딩
   - 사라지거나 새로 생긴 hook
   - `nativeShadowEnabledComponents` 목록의 변화
   - 브리지 선택자가 원본에서 사라짐
4. 이 결과가 4장 보기의 데이터가 된다.

### 5.2 동적 검사 (Storybook "반영 검사" 페이지)

1. **센티널 브랜드를 만든다.** 허용된 모든 hook과 브리지 변수에 서로 구별되는 값을 넣은 테스트용 util.css를 둔다(예: 반경 7px·9px·11px, hook마다 다른 색상각의 색, 0.777s). 이 파일이 규칙 검사를 통과해야 하므로 규칙 자체의 검사도 겸한다.
2. Storybook `index.json`에 있는 모든 스토리를 기본 브랜드와 센티널 브랜드로 각각 iframe에 그린다. 같은 출처라서 DOM에 접근할 수 있다.
3. 요소마다 `shadowRoot`를 따라 내려가며, `::before`·`::after`까지 명세 항목별 속성의 `getComputedStyle` 값을 모은다.
4. 판정한다. 두 브랜드에서 값이 다르면 "반영", 같으면 "빈틈 후보"다. 구조 값(0, none, 50%, transparent)과 "Salesforce 고정" 목록은 뺀다.
5. 상태별로 잰다. disabled는 스토리 변형으로, focus는 `element.focus()` 뒤에 잰다. hover와 active는 스크립트로 만들 수 없으므로 5.1이 맡는다.
6. 모드별로 돌린다. synthetic 빌드(지금 org)와 native 빌드(2.8)에서 각각 돌리고, 두 결과의 차이를 "native 전환 시 잃는 항목"으로 본다. 브리지를 끄고 한 번 더 돌리면 브리지가 맡는 범위가 나온다.
7. 결과는 컴포넌트 × 명세 항목 표와 빈틈 목록(JSON)이다. 4장 보기의 배지로 쓴다.

- 새 의존성 없이 브라우저 기능만 쓴다. CI에서 자동으로 돌리려면 헤드리스 브라우저(Playwright 등)가 필요한데, 이것은 새 의존성이다. 그래서 처음에는 수동으로 실행하고, 필요해지면 PR에 이유를 적고 추가한다.
- 구현할 때 확인할 것: synthetic shadow에서 `host.shadowRoot`로 내려갈 수 있는지

### 5.3 org 확인

- 읽기만 하는 확인: LEX 페이지에서 `lightning-*` 호스트에 `data-render-mode="shadow"`가 있는지 본다 (2.8 감지 1과 같은 검사).
- 센티널 브랜드를 org에 배포해 대표 화면을 비교하는 것은 배포 승인을 받은 뒤 한 번 한다. 10/12 org 프로브와 합칠 수 있다.

### 5.4 판정 기준

- 명세 항목마다 "반영된 컴포넌트 수 / 해당 컴포넌트 수"를 지금과 native로 나눠 낸다.
- 빈틈이 "Salesforce 고정" 목록에 없으면 실패다. 고정 목록에 넣으려면 사용자 합의가 필요하다.
- 이 검사를 `check`와 CI에 넣을지는 명세 9.5대로 9.3을 확정할 때 정한다.