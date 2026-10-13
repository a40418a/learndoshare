---
name: milvus-brand
description: 밀버스 디자인 시스템의 브랜드 요청(milvus-brand-request.md나 채팅)을 org 테마(BrandingSet)·milvusBrand.css·브리지 변수에 반영한다. 입력 형식 5종(자연어, 디자인 토큰 JSON, Figma, PDF·이미지, URL)을 받는다. "브랜드 요청 반영해줘", "버튼을 더 둥글게", "회색을 쿨그레이로", "이 Figma 토큰 적용해줘" 같은 요청에 쓴다
---

# 브랜드 요청 반영 (milvus-brand)

- 브랜드 이름(`<이름>`)과 대상 org는 `milvus.config.json`에서 읽는다. 아래의 `FA`는 `force-app/main/default`다
- 명령은 프로젝트 루트에서 실행한다. 패키지 함수는 `node_modules/@a40418a/milvus-design-system/dist/lib/`에 있다
- 사용자에게 보이는 글은 한국어로 쓴다

## 1. 흐름 (7단계)

1. **입력.** 프로젝트 루트의 `milvus-brand-request.md`를 읽는다. 없으면 채팅의 브랜드 설명을 쓴다. 자연어가 아니면 7장대로 값을 뽑는다
   - 파일 형식: `# 브랜드 요청`, `저장: …`, 항목마다 `## <항목>` 아래 `지금: …`(명세 페이지가 적은 당시 값)과 `요청: …`
2. **브랜드 명세 표를 채팅으로 제안한다.** 파일은 아직 고치지 않는다. 칸: 항목 | 적용 값 | 쓰는 곳(hook·브리지 변수·파일) | 출처(요청 문장, 토큰 이름) | 확정/추정 | 반영하지 못하는 요구와 대안
   - 추정(이미지에서 읽은 색, 프리셋에서 고른 값)은 추정이라고 적는다
   - 2장 순서의 뒤 단계(브리지 변수, override)를 쓰는 행에는 그 한계를 함께 적는다
3. **사용자 승인을 받는다.** 승인 전에는 파일을 쓰지 않는다. 고칠 점을 들으면 표를 다시 낸다
4. **작성한다.** 2장 순서로 고른 파일에만 쓴다
   - 브랜드 색·로고: `FA/brandingSets/LEXTHEMING<이름>.brandingSet-meta.xml` (5장, 6장)
   - 모양·중립 색·피드백 색·밀버스 변수 값: `FA/staticresources/milvusBrand.css`의 `:root` 블록 하나 (3장)
   - hook·브리지로 안 되는 모양만 `FA/staticresources/milvusOverride.css`. 그 항목은 "공식 권고 밖"이라고 알린다
   - `milvusBrand.css`·`milvusOverride.css`·BrandingSet을 고칠 때마다 hook이 `milvus check --style`을 실행한다. 막히면 출력에 적힌 고칠 값대로 바로 고친다
5. **검사한다.** `pnpm milvus check`. 통과하면 Storybook(`pnpm milvus storybook`)이 저절로 갱신된다. 브랜드 명세 페이지에서 화면을 확인해 달라고 안내한다
6. **반영 표시.** 요청 파일의 제목 줄(`# 브랜드 요청`) 바로 아래에 `반영: YYYY-MM-DD`(오늘 날짜)를 적는다. 이미 있으면 날짜만 바꾼다. 다른 줄, 빈 줄, 알 수 없는 절은 지우거나 순서를 바꾸지 않는다. 명세 페이지가 다음에 저장할 때 이 줄을 지운다
7. **배포는 사용자가 따로 요청했을 때만 한다.** 먼저 `pnpm milvus deploy`로 계획(대상 org, 지금 활성 테마 → 새 활성 테마, 배포 목록, 경고)을 보여 준다
   - 채팅에서 사용자가 그 계획을 승인한 뒤에만 `pnpm milvus deploy --yes`를 실행한다. 이 명령은 `permissions.ask`가 한 번 더 묻는다
   - 활성 테마는 org 전체 사용자 화면에 적용되고, 테마 색은 새로고침 뒤에 보인다
   - 배포가 끝나면 사람이 org에서 할 일 두 가지(`milvus-design.md` 3절)를 알린다: VF 설정 켜기, App Manager에서 `milvusBrandLoader` 붙이기

## 2. 반영 순서 (설계 5.1)

앞 단계로 되는 요구를 뒤 단계로 풀지 않는다.

| 순서 | 수단 | 파일 | 범위와 위험 |
| --- | --- | --- | --- |
| 1 | org 테마: `BRAND_COLOR`, `BRAND_IMAGE` | BrandingSet | 공식 기능. 브랜드 색의 원본 |
| 2 | global hook `--slds-g-*` | `milvusBrand.css` | 전체 모양 |
| 3 | 컴포넌트 hook `--slds-s-*` | `milvusBrand.css` | 특정 컴포넌트. native shadow 전환 때 효과가 사라질 수 있다 |
| 4 | 브리지 변수 `--milvus-*` | `milvusBrand.css` | hook이 없는 항목. 패키지의 `milvusBridge.css`가 읽는다. native 전환 시 잃는다 |
| 5 | 클래스 규칙 | `milvusOverride.css` | 마지막 수단. 공식 권고 밖 |

- **override를 쓸 때** 사용자에게 알린다: "Salesforce 공식 권고 밖이다. 기본 컴포넌트가 native shadow로 바뀌거나 Salesforce가 마크업·클래스를 바꾸면 깨질 수 있다." 이유와 실험은 Learn 09 "override와 공식 권고"(https://github.com/a40418a/learndoshare/blob/main/learndoshare_1/Learn/09-override와%20공식%20권고.html)를 안내한다
  - `.slds-*` 클래스 선택자만 쓴다. hex 색, `!important`, 브랜드 색 hook은 check가 경고한다. `@font-face`, `@import`는 막는다
- **모양만 바꾸려고 밀버스 컴포넌트(`lwc/milvus*`)를 새로 만들지 않는다.** 밀버스 컴포넌트는 SLDS에 기능이 없을 때만 만든다
- 밀버스 관리 파일(`lwc/milvus*`, `milvusBridge.css`, `milvusVf.css`, `milvusHead`, `milvus-design.md`, 이 skill)은 고치지 않는다
- **Salesforce 고정(설계 9.4)** 은 요청이 와도 바꿀 수 없다고 답하고 목록을 보여 준다. override로도 우회하지 않는다. 예: 토스트 표시 시간, z-index, 아이콘 모양, 스피너, LEX 전역 헤더(org 테마가 원본). 글꼴도 바꾸지 않는다. 목록 전체:
  ```bash
  node --input-type=module -e 'import { FIXED_ITEMS } from "@a40418a/milvus-design-system/dist/lib/fixed-list.js"; for (const i of FIXED_ITEMS) console.log(i.mode === "both" ? "지금도 native에서도" : "native 전환 뒤", "-", i.label)'
  ```

## 3. util.css 규칙 (설계 5.2, `check --style`이 검사)

`milvusBrand.css`에는 `:root` 블록 하나만 둔다. 클래스 규칙, `@font-face`, `@import`는 쓰지 않는다.

- **허용**
  - 이름에 `color`가 없는 `--slds-g-*`: 반경, 간격, 크기, 테두리 두께, 글자 크기·굵기·줄 간격, 그림자 `-1`~`-4`와 방향형
  - `--slds-g-shadow-4`를 바꾸면 `--slds-g-shadow-5`·`-6`(포커스 표시)에 SLDS 2 기본 shadow-4 값을 따로 적는다: `0px 0px 10px 0px light-dark(#0000001f, #0000003d), 0px 7px 7px 0px light-dark(#0000001f, #0000003d), 0px -1px 3px 0px light-dark(#00000012, #00000024)`
  - 포커스 링 그림자(이름에 `focus`): 값 안의 색은 `var(--slds-g-color-brand-base-15)`와 `var(--slds-g-color-neutral-base-100)`만 쓴다
  - 중립 색(바탕·글자·테두리·비활성·어두운 면·회색 단계): 값은 `light-dark(라이트, 다크)`. 다크 값은 SLDS 기본값을 그대로 옮긴다(다크 모드는 바꾸지 않는다). 의미 hook과 같은 색의 `neutral-base` 단계를 함께 정한다(지금 org는 의미 hook, native는 단계를 읽는다). 글자·면 대비 4.5:1 이상
  - `neutral-base`는 SLDS 2와 기본 컴포넌트가 읽는 13단계만 쓴다: 0, 10, 20, 30, 40, 50, 60, 65, 70, 80, 90, 95, 100. 15·45·55단계는 읽는 곳이 없어 check가 막는다
  - 피드백 색: 4장 표의 이름만
  - `--slds-s-*` 중 이름에 `color`가 없는 것: SLDS 2 CSS나 기본 컴포넌트 CSS가 읽는 이름만
  - 색 s hook 6개(배경막과 hover·선택 바탕): 값은 중립 g hook 하나(`var(--slds-g-color-…)`)만
  - `--milvus-*`: 밀버스 컴포넌트나 `milvusBridge.css`가 읽는 이름만
  - 일반 속성은 `letter-spacing` 하나
- **금지:** 브랜드 색 계열 `--slds-g-color-accent*`, `--slds-g-color-on-accent*`, `--slds-g-color-border-accent*`, `--slds-g-color-brand-base*`, `--slds-r-color-brand*`(색의 원본은 org 테마), 그 밖의 색 hook, `--slds-c-*`·`--sds-c-*`, 글꼴 `--slds-g-font-family*`, 읽는 곳이 없는 이름(오타)

## 4. 항목별로 쓰는 곳 (설계 9.3, SPEC_ITEMS)

"브리지"는 hook이 없어 `--milvus-*` 변수로 잇는 것이고 native 전환 때 잃는다. 항목 하나의 전체 이름 목록은 다음 명령으로 본다(`<id>`는 표의 괄호).

```bash
node --input-type=module -e 'import { SPEC_ITEMS } from "@a40418a/milvus-design-system/dist/lib/spec-items.js"; console.log(JSON.stringify(SPEC_ITEMS.find((i) => i.id === process.argv[1]), null, 2))' surface
```

| 항목 (id) | 쓰는 곳 | 주의 |
| --- | --- | --- |
| 브랜드 색 (`brand-color`) | BrandingSet `BRAND_COLOR` | 5장 |
| 로고 (`logo`) | `BRAND_IMAGE`, `FA/contentassets/` | 6장 |
| 모서리 (`radius`) | `--slds-g-radius-border-1`~`-4`, `--slds-g-radius-border-pill`, 브리지 `--milvus-path-end-radius`(Path 양 끝) | |
| 밀도 (`density`) | `--slds-g-spacing-1`~`-12`, `--slds-s-button-spacing-inline`, `--slds-s-button-spacing-block`, `--slds-s-input-spacing`, `--slds-s-label-spacing-gap` | |
| 글자 (`typography`) | `--slds-g-font-scale-neg-2`~`--slds-g-font-scale-7`(기본 `--slds-g-font-scale-base`), `--slds-s-container-heading-font-weight`, `--slds-s-pageheader-title-font-weight`, `--slds-s-label-font-weight`, 브리지 `--milvus-choice-label-weight`(라디오·체크박스 라벨) | 글꼴은 바꾸지 않는다 |
| 피드백 색 (`feedback`) | 4장 표 | |
| 컴포넌트별 조정 (`component`) | `--slds-s-button-radius-border`, `--slds-s-input-radius-border`, `--slds-s-container-radius-border`, `--slds-s-button-shadow`, `--slds-s-input-shadow`, `--slds-s-container-shadow`, 모달 너비 브리지 `--milvus-modal-width-base`·`--milvus-modal-width-small`·`--milvus-modal-width-medium`·`--milvus-modal-width-large`·`--milvus-modal-width-full`, `--milvus-modal-min-width` | 카드 그림자는 native `lightning-card`에 닿지 않는다. 모달 너비는 아래 |
| 밀버스 컴포넌트 (`milvus-component`) | 그 컴포넌트가 읽는 `--milvus-*` | 새로 만들지 않는다 |
| 바탕·면 (`surface`) | `--slds-g-color-surface-1`~`-3`(`--slds-g-color-surface-2`가 앱 바탕), `--slds-g-color-surface-container-1`~`-3`, native용 `--slds-g-color-neutral-base-100`·`-95`·`-90` | `--slds-g-color-neutral-base-100`은 색 위 흰 글자로도 쓰여 흰색 가까이에서만 바꾼다 |
| 글자색 (`text-color`) | `--slds-g-color-on-surface-3`(제목·본문), `--slds-g-color-on-surface-2`(입력값·라벨), `--slds-g-color-on-surface-1`(보조·placeholder) | 보조 아이콘도 `--slds-g-color-on-surface-1`을 쓴다 |
| 테두리 (`border-color`) | `--slds-g-color-border-1`(구분선·카드), `--slds-g-color-border-2`(입력·버튼), native용 `--slds-g-color-border-base-1`·`--slds-g-color-border-base-4` | |
| 회색 온도 (`neutral-tone`) | `--slds-g-color-neutral-base-0`~`--slds-g-color-neutral-base-100` 13단계와 의미 hook | 5장의 회색 단계표 |
| 비활성 (`disabled`) | `--slds-g-color-disabled-container-1`·`-2`, `--slds-g-color-on-disabled-1`·`-2`, `--slds-g-color-border-disabled-1`·`-2`, `--slds-g-color-disabled-1`·`-2` | |
| 어두운 면 (`inverse`) | `--slds-g-color-surface-inverse-1`·`-2`, `--slds-g-color-surface-container-inverse-1`·`-2`, `--slds-g-color-on-surface-inverse-1`·`-2`, `--slds-g-color-border-inverse-1`·`-2` | native 툴팁은 고정 |
| 모달 배경막 (`backdrop`) | 지금 `--slds-s-backdrop-color-background`, native `--slds-g-color-neutral-10-opacity-50`에 같은 색 | s hook 값은 중립 g hook 하나만 받는다. 반투명 값을 그대로 넣을 수 없으면 표에 한계로 적고 사용자와 정한다 |
| 검색어 강조 (`highlight`) | `--slds-g-color-palette-yellow-90`·`--slds-g-color-palette-yellow-80` | native 일부 고정 |
| hover·선택 바탕 (`hover-selected`) | `--slds-g-color-surface-container-2`·`-3`, `--slds-s-menu-item-color-background-active`, `--slds-s-table-row-color-background-selected`, `--slds-s-navigation-color-background-hover`, `--slds-s-pill-color-background-hover`, `--slds-s-button-color-background-hover`, 브리지 `--milvus-nav-selected-background`(세로 내비 선택 바탕) | 색 s hook 값은 `var(중립 g hook)` 하나. native에서는 2개만 닿는다 |
| 다크 모드 (`dark-mode`) | 모든 색을 `light-dark()`로 | 다크 값은 기본값 |
| 테두리 두께 (`border-width`) | `--slds-g-sizing-border-1`(1px), `--slds-g-sizing-border-2`(2px), native 버튼 `--slds-s-button-sizing-border`, 브리지 `--milvus-input-border-width`(입력창) | |
| 아바타·아이콘 모양 (`avatar-icon-shape`) | `--slds-s-avatar-radius-border`, `--slds-s-icon-radius-border` | |
| 탭·헤더 모양 (`tab-header-shape`) | `--slds-s-navigation-sizing-border-active`, `--slds-s-navigation-sizing-border-hover`, `--slds-s-navigation-radius-border`, `--slds-s-pageheader-radius-border`, `--slds-s-pageheader-sizing-border` | native tabBar는 고정 |
| 컨트롤 높이 (`control-height`) | 버튼 `--slds-s-button-spacing-block`, 브리지 `--milvus-control-height`(입력·선택·콤보), native용 `--slds-s-input-sizing-height` | 버튼만 키우면 폼에서 높이가 어긋난다. 셋을 함께 정한다 |
| 탭·헤더 높이 (`tab-header-height`) | `--slds-s-navigation-sizing-height`, `--slds-s-navigation-font-lineheight`, `--slds-s-header-sizing-height` | |
| 아이콘 크기 (`icon-size`) | `--slds-s-icon-sizing`, `--slds-s-icon-spacing`, 브리지 `--milvus-control-icon-size`(버튼·입력창 안, 원래 0.875rem), `--milvus-sort-icon-size`(정렬, 원래 0.75rem) | |
| 줄 간격 (`line-height`) | `--slds-g-font-line-height-base`(본문 1.5), `--slds-g-font-line-height-2`, `--slds-g-font-line-height-1` | 컨트롤 안 줄 간격은 고정 |
| 자간 (`letter-spacing`) | `:root`의 `letter-spacing`과 브리지 `--milvus-letter-spacing`(button·input·select·textarea)에 같은 값 | |
| 대소문자 (`text-case`) | 브리지 `--milvus-caps-transform`(대문자로 쓰지 않으려면 `none`), `--milvus-caps-letter-spacing` | |
| 그림자 (`shadow`) | `--slds-g-shadow-1`~`-4`, 방향형 `--slds-g-shadow-block-start-1`~`-4`·`block-end`·`inline-start`·`inline-end`, 브리지 `--milvus-nubbin-shadow`(팝오버 꼬리) | 3장의 `-5`·`-6` 규칙. native 드롭다운·팝오버·툴팁은 고정 |
| hover·눌림 (`hover-press`) | `--slds-s-button-brand-transform-hover`, `--slds-s-button-bordered-transform-hover`, `--slds-s-button-brand-shadow-hover`, `--slds-s-button-bordered-shadow-hover`, `--slds-s-button-shadow-hover`, `--slds-s-button-shadow-active`, `--slds-s-mark-shadow-checked` | native에는 떠오름이 없다 |
| 속도 (`motion-speed`) | 브리지 `--milvus-motion-duration-fast`(원래 0.1s 이하인 규칙), `--milvus-motion-duration-medium`(0.15~0.2s), `--milvus-motion-duration-slow`(0.25~0.4s) | 아래 움직임 주의 |
| 곡선 (`motion-easing`) | 브리지 `--milvus-motion-easing` | 스피너 제외 |
| 줄인 움직임 (`reduced-motion`) | "동작 줄이기를 켠 사람만": 할 일 없음(브리지가 항상 처리한다). "모두 최소화": 세 시간 변수를 `0.01ms`로(속도 요청보다 우선) | |
| 포커스 링 (`focus-ring`) | `--slds-g-shadow-outline-focus-1`, `--slds-g-shadow-outset-focus-1`, `--slds-g-shadow-inset-focus-1`, `--slds-g-shadow-inset-inverse-focus-1`, native용 `--slds-s-button-shadow-focus`, `--slds-s-input-shadow-focus`, `--slds-s-mark-shadow-focus` | 링 색은 브랜드 색을 따른다(3장 색 제한) |
| 커서·밑줄 (`cursor-underline`) | 브리지 `--milvus-cursor-disabled`, `--milvus-link-decoration-hover`(밑줄 없이: `none`) | |
| 개체 아이콘 색 (`object-icon-color`) | 전체 `--milvus-icon-color-all`, 하나씩 `--milvus-icon-<종류>-<이름>` | 아래 |
| Salesforce 고정 (`fixed`) | 없음 | 2장 목록을 보여 준다 |

- **움직임:** 값에는 단위를 붙인다(`0.2s`, `150ms`). 브리지는 시간을 `max(var(--milvus-motion-duration-fast, 0.1s), 0.01ms)`처럼 감싸는데, 단위 없는 `0`은 `max()`를 무효로 만들어 모달·토스트가 닫히지 않을 수 있다(check가 막는다). 가장 짧은 값은 `0.01ms`다. 스피너는 시간을 바꾸지 않는다
- **모달 너비:** 변수 하나가 그 크기의 `width`와 `max-width`를 함께 정한다(화면 48em 이상에서만). 큰 고정값은 좁은 화면에서 넘칠 수 있으니 `min(60rem, 90%)`처럼 쓴다. 원래 값: 기본 50%·최대 40rem, small 60%·52.0625rem, medium 70%·75rem, large 90%·제한 없음, full 90%. `--milvus-modal-min-width` 하나가 모든 크기의 최소 너비(원래 20rem, 크기 클래스는 40rem)를 바꾼다
- **개체 아이콘:** 이름은 `lightning-icon`의 `icon-name`에서 `:`와 `_`를 `-`로 바꾼다. 예: `standard:account` → `--milvus-icon-standard-account`, `standard:user_role` → `--milvus-icon-standard-user-role`, `custom:custom110` → `--milvus-icon-custom-custom110`. 별칭 클래스 이름(`slds-icon-custom-110`)으로 만든 변수는 읽는 곳이 없다(check가 '읽는 곳 없음'으로 막는다). 개체를 색으로 구분하던 단서가 사라질 수 있다고 알린다

## 5. 색 계산

- **브랜드 색 (설계 5.4).** `BRAND_COLOR`에 `#RRGGBB`로 넣는다. Salesforce는 입력한 색 대신 접근성 색(50단계: 색상각 유지, 명도 L* 49)을 버튼에 쓰고 링크는 40단계를 쓴다. 50단계의 흰 글자 대비는 어느 색이든 4.62~4.68:1이라 막지 않고 설명한다. 표에 입력 색, 실제 버튼 색(50), 링크 색(40)과 흰색 대비를 함께 보여 준다. "접근성 색 무시" 설정은 없다
  ```bash
  node --input-type=module -e 'import { brandPalette } from "@a40418a/milvus-design-system/dist/lib/palette.js"; import { contrastRatio } from "@a40418a/milvus-design-system/dist/lib/contrast.js"; const c = process.argv[1], p = brandPalette(c); for (const [k, v] of [["입력", c], ["버튼(50)", p[50]], ["링크(40)", p[40]]]) console.log(k, v, "흰색 대비 " + contrastRatio(v, "#ffffff").toFixed(2) + ":1")' '#2E7D32'
  ```
- **한 단계 진한 색 (hover·active).** `darkerStep(색)`
  ```bash
  node --input-type=module -e 'import { darkerStep } from "@a40418a/milvus-design-system/dist/lib/contrast.js"; for (const c of process.argv.slice(1)) console.log(c, "→", darkerStep(c))' '#E8F5E9' '#1B5E20'
  ```
- **회색 단계표 (회색 온도).** 기준 회색(예: 쿨그레이 `#5A6270`)의 `brandPalette` 10~95단계는 명도가 SLDS 2 `neutral-base` 같은 번호 단계의 라이트 값과 거의 같다(무채색 `#777777`을 넣으면 기본 회색이 거의 그대로 나온다). 0과 100은 검정·흰색 그대로 둔다. 의미 hook은 기본 라이트 값과 같은 단계의 새 색으로 바꾼다. 예: `--slds-g-color-surface-2` = 95, `--slds-g-color-border-1` = 80, `--slds-g-color-border-2`와 `--slds-g-color-on-surface-1` = 40, `--slds-g-color-on-surface-2` = 20
  ```bash
  node --input-type=module -e 'import { brandPalette } from "@a40418a/milvus-design-system/dist/lib/palette.js"; const p = brandPalette(process.argv[1]); for (const s of [10, 20, 30, 40, 50, 60, 65, 70, 80, 90, 95]) console.log(s, p[s])' '#5A6270'
  ```
- **SLDS 2 기본값 보기.** 다크 값, 비교할 원래 값을 볼 때 쓴다. 이름 앞에 `--`를 한 번 더 둔다
  ```bash
  node --input-type=module -e 'import { createRequire } from "node:module"; import { readFileSync, realpathSync } from "node:fs"; import { dirname, join } from "node:path"; const pkg = realpathSync("node_modules/@a40418a/milvus-design-system"); const slds = dirname(createRequire(join(pkg, "package.json")).resolve("@salesforce-ux/design-system-2/package.json")); const css = readFileSync(join(slds, "dist/css/bundled/slds2.cosmos.css"), "utf8"); for (const n of process.argv.slice(1)) console.log(n, css.match(new RegExp(n + "\\s*:([^;]+);"))?.[1] ?? "(정의 없음)")' -- --slds-g-color-surface-2 --slds-g-color-success-1
  ```

### 피드백 색 (설계 5.3)

입력한 글자색과 배경색을 그대로 넣는다. 다크 값은 기본값을 옮겨 `light-dark(입력 색, 기본 다크 값)`로 쓴다.

| 종류 | 글자 | 배경 위 글자 | 배경 | 테두리 | hover·active |
| --- | --- | --- | --- | --- | --- |
| 성공 | `--slds-g-color-success-1` | `--slds-g-color-on-success-1` | `--slds-g-color-success-container-1` | `--slds-g-color-border-success-1` | `--slds-g-color-success-container-2` |
| 경고 | `--slds-g-color-warning-1` | `--slds-g-color-on-warning-1` | `--slds-g-color-warning-container-1` | 없음 | 없음 |
| 오류 | `--slds-g-color-error-1` | `--slds-g-color-on-error-1` | `--slds-g-color-error-container-1` | `--slds-g-color-border-error-1` | `--slds-g-color-error-container-2`, `--slds-g-color-border-error-2` |
| 정보 | 없음 | `--slds-g-color-on-info-1` | `--slds-g-color-info-container-1` | 없음 | 없음 |

- 글자색은 "글자"와 "배경 위 글자"에 같은 값을 넣는다(정보는 "배경 위 글자"만)
- 테두리는 따로 요청하지 않으면 글자색을 쓴다(성공·오류만. 경고·정보는 읽는 테두리 hook이 없다)
- hover·active: 배경 hook(`-container-2`)은 `darkerStep(배경색)`, `--slds-g-color-border-error-2`는 `darkerStep(테두리색)`
- 대비: 글자색이 배경 위와 흰색 위에서 모두 4.5:1 이상이어야 한다. 모자라면 check가 막고 같은 색조에서 기준을 넘는 색(40단계)을 제안한다. 그 색을 표에 대안으로 내고 승인받는다

## 6. 로고

로고는 사용자가 준 파일만 쓴다(URL에서 내려받지 않는다). 요청 파일의 형식은 `요청: assets/logo.png`(프로젝트 루트 기준 경로)다.

1. 파일을 `FA/contentassets/<이름>Logo.asset`으로 복사한다(`cp`)
2. 메타를 쓴다. `pathOnClient`는 `<이름>Logo<원래 확장자>`가 된다
   ```bash
   node --input-type=module -e 'import { writeContentAssetMeta } from "@a40418a/milvus-design-system/dist/lib/branding.js"; process.stdout.write(writeContentAssetMeta(process.argv[1], process.argv[2]))' '<이름>' '<사용자가 준 파일 경로>' > 'force-app/main/default/contentassets/<이름>Logo.asset-meta.xml'
   ```
3. BrandingSet에 `BRAND_IMAGE` 속성을 `/file-asset/<이름>Logo?v=1`로 둔다. 있으면 값만 바꾸고, 없으면 `BRAND_COLOR`와 같은 모양의 `<brandingSetProperty>`를 더한다. 다른 속성은 그대로 둔다

## 7. 입력 형식 5종 (설계 6.4)

- **자연어:** 아래 프리셋으로 바꾼다. 값은 SLDS 2 기본값 기준의 제안이며 표에서 승인받는다

  | 표현 | 쓰는 이름 | 제안 |
  | --- | --- | --- |
  | 각진 / 기본 / 둥근 | `--slds-g-radius-border-1`~`-4`, `--slds-g-radius-border-pill` | 기본 0.25·0.5·0.75·1.25rem, pill 15rem. 각진은 절반 이하(0·0.125·0.25·0.5rem), 둥근은 1.5배 |
  | 기본 / 촘촘 | `--slds-s-button-spacing-inline`(기본 1rem), `--slds-s-button-spacing-block`, `--slds-s-input-spacing`(기본 0.5rem), `--slds-s-label-spacing-gap`(기본 0.25rem) | 촘촘은 4분의 3 정도로 줄인다. 컨트롤 높이와 함께 본다 |
  | 보통 / 굵게 (제목·라벨) | `--slds-s-container-heading-font-weight`, `--slds-s-pageheader-title-font-weight`, `--slds-s-label-font-weight` | 보통 400, 굵게 700 |
  | 그림자 없이 / 기본 / 깊게 | `--slds-g-shadow-1`~`-4`와 방향형, 카드는 `--slds-s-container-shadow`(기본 none) | 없이는 `none`. 이때도 `--slds-g-shadow-5`·`-6`은 기본값을 적는다 |
  | 빠르게 / 기본 / 차분하게 (움직임) | `--milvus-motion-duration-fast`, `--milvus-motion-duration-medium`, `--milvus-motion-duration-slow`, `--milvus-motion-easing` | 빠르게 0.05s·0.1s·0.2s, 차분하게 0.15s·0.3s·0.5s, 부드러운 감속 `cubic-bezier(0, 0, 0.2, 1)` |

- **디자인 토큰 JSON:** 색·크기만 뽑는다. 형식 4종(DTCG 2025.10 색 객체, 이전 hex 문자열, Figma export, Figma API 0~1 값)을 다음 한 줄로 `경로 값`으로 바꾼다. `{color.brand}` 같은 참조는 가리키는 토큰의 값을 쓴다
  ```bash
  node --input-type=module -e 'import { readFileSync } from "node:fs"; const h = (x) => Math.round(x * 255).toString(16).padStart(2, "0"); const val = (v) => typeof v !== "object" || v === null ? v : "unit" in v ? v.value + v.unit : v.hex || v.components || "r" in v ? (v.hex ?? "#" + (v.components ?? [v.r, v.g, v.b]).slice(0, 3).map(h).join("")) + ((v.alpha ?? v.a ?? 1) < 1 ? " 투명도 " + (v.alpha ?? v.a) : "") : undefined; const walk = (o, p) => { if (typeof o === "number") return console.log(p, o); if (o === null || typeof o !== "object") return; const v = val(o.$value ?? o.value ?? ("r" in o ? o : undefined)); if (v !== undefined) return console.log(p, v); for (const k in o) if (!k.startsWith("$")) walk(o[k], typeof o.name === "string" ? o.name : p ? p + "." + k : k); }; walk(JSON.parse(readFileSync(process.argv[1], "utf8")), "")' tokens.json
  ```
- **Figma:** 1순위는 사용자가 Figma에서 받은 "Export modes" JSON(위 명령으로 바꾼다), 2순위는 Figma MCP(사용자가 고른 영역). REST API는 Enterprise 플랜 전용이라 쓰지 않는다
- **PDF·이미지:** PDF에 적힌 hex는 텍스트로 정확히 뽑는다. 이미지에서 읽은 색은 "추정"으로 표시하고 확인을 받는다
- **URL:** `curl`로 HTML과 CSS를 `.milvus/`에 받아 CSS 변수와 색 빈도를 찾는다(WebFetch는 CSS가 빠진다). 로고는 내려받지 않고 사용자에게 파일을 받는다
  ```bash
  curl -sL '<URL>' -o .milvus/site.html && grep -oE 'href="[^"]+\.css[^"]*"' .milvus/site.html
  curl -sL '<CSS URL>' | grep -oiE '#[0-9a-f]{6}|#[0-9a-f]{3}|rgba?\([^)]*\)|--[a-z0-9-]+:[^;}]+' | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn | head -40
  ```
