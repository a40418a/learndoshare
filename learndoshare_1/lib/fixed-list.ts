// "Salesforce 고정" 목록 (설계 9.4, 2026-10-08 사용자 합의. 2026-10-12 남은 빈틈 묶음 ①~⑯, 2026-10-14 LEX 컨트롤 높이 사용자 합의로 더함). 모든 방법을 써도 바꿀 수 없어 명세 페이지와 발표에 "바꿀 수 없음"으로 적는다.
// 새 항목을 넣으려면 사용자 합의가 필요하다(설계 9.6의 4)
// 브라우저(Storybook 명세 페이지)에서도 import하므로 Node 모듈을 쓰지 않는다

/**
 * - mode: both는 지금(synthetic)과 native 모두, native는 기본 컴포넌트가 native shadow로 바뀐 뒤에만 고정이다(native 판정에서만 맞춘다)
 * - match: 정적 반영 검사(Task 14)가 빈틈 선언을 이 항목으로 볼 조건. 주어진 조건을 모두 만족하면 맞는다. 여러 개면 그중 하나라도 맞으면 맞는다
 *   - selector: `<컴포넌트 이름> <선택자>`에 맞춘다. 기본 컴포넌트의 native CSS 선택자에는 클래스가 없는 경우가 많다([part='input'])
 *   - property: 속성 이름이 같거나 그 longhand다(transition → transition-duration, background → background-color). 여러 개면 그중 하나
 *   - value: 값(공백을 하나로 줄인 것)이 맞는다
 *   - source: 값이 있는 곳. 기본은 css. js는 JS 상수라 CSS 선언과 맞추지 않고 보여 주기만 한다
 */
export type FixedMatch = { selector?: RegExp; property?: string | string[]; value?: RegExp; source?: "css" | "js" };
export type FixedItem = {
  id: string;
  label: string;
  mode: "both" | "native";
  match: FixedMatch | FixedMatch[];
};

const SPACING = ["padding", "margin", "gap", "column-gap", "row-gap"];
const RADIUS = ["border-radius", "border-start-start-radius", "border-start-end-radius", "border-end-start-radius", "border-end-end-radius"];
// 움직임 시간 묶음(≤0.1s, 0.15~0.2s, 0.25~0.4s, scripts/bridge/targets.ts) 밖의 지속 시간. shorthand는 이름 하나 뒤 첫 시간만 본다(뒤의 지연은 보지 않는다).
// calc() 시간과 계단 곡선 steps()도 맞는다
// ponytail: 소수가 붙은 ms(100.5ms)와 여러 항목 shorthand의 둘째 항목부터는 보지 않는다
const OUT_OF_BAND =
  /^([^\s\d.]\S* )?(calc\(|((0?\.[12](?=\d*[1-9])[0-4]\d*|0?\.4(?=\d*[1-9])\d+|0?\.[5-9]\d*|[1-9]\d*(\.\d+)?)s|([12](0[1-9]|[1-4]\d)|4(0[1-9]|[1-9]\d)|[5-9]\d\d|[1-9]\d{3,})(\.\d+)?ms)(?![\w.]))|steps\(/;
// 0.125rem(2px) 이하만 쓴 간격
const FINE = /^(0|0?\.125rem|0?\.0625rem|[12]px)( (0|0?\.125rem|0?\.0625rem|[12]px))*$/;

// 매처는 9.4 문장을 SLDS 2·기본 컴포넌트 CSS의 이름으로 옮긴 것이다(2026-10-12 Task 14가 실제 선언과 맞춰 좁힘).
// 넓게 잡으면 같은 선택자 아래 새 하드코딩이 빈틈으로 드러나지 않으므로, 9.4 문장이 가리키는 속성만 맞춘다
export const FIXED_ITEMS: FixedItem[] = [
  // 두 모드 모두 고정
  {
    id: "icon-glyph",
    label: "아이콘 SVG·애니메이션 아이콘 모양과 개체 아이콘 글리프의 흰색",
    mode: "both",
    match: [
      { selector: /\.slds-icon(?![\w-])/, property: "fill" },
      // 애니메이션·특수 아이콘 부품의 크기(2026-10-12 합의 ⑤). 변수 하나로 바꾸면 모양이 깨진다
      { selector: /\.slds-icon-(ellie|eq|waffle|typing|score|strength|trend|help)/, property: ["width", "height"] },
    ],
  },
  { id: "z-index", label: "z-index 층", mode: "both", match: { property: "z-index" } },
  { id: "opacity", label: "0·1이 아닌 투명도", mode: "both", match: { property: "opacity", value: /^(0?\.\d+|\d{1,2}(\.\d+)?%)$/ } },
  {
    id: "toast-duration",
    label: "토스트 표시·등장 시간(JS 상수 4800·9600ms, 등장 0.4s)",
    mode: "both",
    // 등장 0.4s는 기본 컴포넌트 합성 CSS(toast.lbc.synthetic.css)라 브리지 생성기 입력 밖이다(2026-10-12 합의 ③)
    match: [{ source: "js" }, { selector: /^toast .*fix-notify_toast_animation/, property: "animation-duration", value: /^0?\.4s$/ }],
  },
  // 점의 크기·위치·움직임과 컨테이너의 나타남. 스피너 색은 hook을 읽는다
  { id: "spinner", label: "스피너 모양", mode: "both", match: { selector: /spinner/i, property: ["animation", "transition", "transform", "inset", "width", "height", "margin"] } },
  { id: "color-picker-hue", label: "색 선택기 색상환", mode: "both", match: { selector: /hue/i, property: "background" } },
  { id: "agentforce", label: "Agentforce 영역", mode: "both", match: { selector: /\.slds-subtheme-agentic/, property: ["background", "border", "transition", "transform", "padding"] } },
  // scrim(제목 뒤 그라데이션)과 overlay·hover 때 이미지를 덮는 반투명 막. 값은 색이나 그라데이션만(같은 선택자의 아이콘 url은 아니다)
  { id: "image-scrim", label: "이미지 위 어둡게 처리", mode: "both", match: { selector: /_scrim|--scrim|(image|file)(_|--)overlay|file__figure:hover/, property: "background", value: /^(rgba?|linear-gradient)\(/ } },
  { id: "destructive-success-text", label: "파괴·성공 버튼의 흰 글자", mode: "both", match: { selector: /button(_|--)(destructive|success)/, property: "color" } },
  { id: "global-header", label: "LEX 전역 헤더(org 테마가 원본)", mode: "both", match: { selector: /\.slds-global-header/, property: "background" } },

  // 2026-10-12 사용자 합의(남은 빈틈 묶음, m4-gap-decisions.md). 묶음 선언만 흡수하도록 선택자 + 속성(+ 값)으로 좁힌다
  // ① 아이콘·알림 애니메이션(ellie·eq·trend·typing, 전역 액션, 알림 배지, 내비 탭 상태 깜빡임)과 kx 브레드크럼 calc()
  {
    id: "motion-out-of-band",
    label: "시간 묶음 밖 움직임(아이콘·알림 애니메이션)과 프레임 애니메이션",
    mode: "both",
    match: {
      selector: /\.slds-icon-(ellie|eq|trend|typing)|\.slds-global-actions|\.slds-notification-badge|\.slds-context-bar__item|\.slds-sub-tabs__item|breadcrumbs-item/,
      property: ["animation", "transition"],
      value: OUT_OF_BAND,
    },
  },
  // ④ 0.125rem 이하는 어디서나, 그보다 큰 값은 특수 영역에서 흡수한 선택자·속성만(블루프린트 전체가 아니다)
  {
    id: "spacing-fine",
    label: "미세 간격(0.125rem 이하)과 특수 영역 간격",
    mode: "both",
    match: [
      { property: SPACING, value: FINE },
      { selector: /\.slds-color-picker__summary-button(?![\w-])/, property: "padding-block" },
      { selector: /\.slds-listbox_selection-group,/, property: "padding-inline-end" },
      { selector: /\.slds-context-bar__dropdown-trigger \.slds-dropdown(?![\w-])/, property: "margin-top" },
      { selector: /\.slds-tabs_path__link(?![\w-])/, property: "padding-inline-start" },
      { selector: /\.slds-path_has-coaching \.slds-path__action(?![\w-])/, property: "padding-inline-start" },
      { selector: /\.slds-path__item(:first-child|:last-child)?(,|$)/, property: ["margin-inline", "padding-inline"] },
      { selector: /\.slds-rich-text-editor__(textarea|output) dd(,|$)/, property: "margin-inline-start" },
      { selector: /\.slds-markdown (ul|ol|li:has\(> input\[type='checkbox'\]\)|blockquote)(,|$)/, property: ["margin-inline", "padding-inline-start"] },
      { selector: /\.slds-table_header-fixed_container,/, property: "padding-block-start" },
      { selector: /\.slds-welcome-mat__tile_complete \.slds-icon-action-check,/, property: "padding" },
      { selector: /\.slds-setup-assistant__step-detail$/, property: "padding-inline-start" },
      // 페이지 템플릿 간격 private 변수
      { selector: /\.slds-template/, property: "padding", value: /^var\(--_slds-c-template[\w-]*-sizing-gap\)/ },
    ],
  },
  // ⑥ datepicker 날짜, 조건식 라벨, Path 코칭 제목, markdown, 섹션 제목
  { id: "line-height-special", label: "특수 영역 줄 간격", mode: "both", match: { selector: /\.slds-(datepicker|expression__row|path__coach-title|markdown|section__title)/, property: "line-height" } },
  // ⑧ SLDS 2 CSS가 아닌 기본 컴포넌트 자체 CSS(*.lbc.synthetic.css, <컴포넌트>.css). 컴포넌트 이름과 그 파일의 선택자로 맞춘다
  {
    id: "lbc-internal",
    label: "기본 컴포넌트 내부 값",
    mode: "both",
    match: {
      selector:
        /^(baseCombobox|buttonIconStateful|buttonMenu|dialog|interactiveDialogBase|modalBase|multiColumnSortingModal|toast) (\.fix-|\.slds-inline-logo|button:disabled|\.slds-button_icon:not|\.slds-modal_prompt|\.slds-modal__container__reflow_resize|\[part='columnadder'\])/,
      property: ["margin", "padding", "cursor", "line-height", "height", "border-radius", "font-size"],
    },
  },
  // ⑨ 드롭다운·목록·조회 항목의 포커스 6px, 읽기 전용 textarea(textarea.lbc.readonly.css)
  {
    id: "focus-readonly-radius",
    label: "목록 머리글 포커스 모서리·읽기 전용 입력 모서리",
    mode: "both",
    match: {
      selector: /\.slds-(dropdown__header|dropdown__item|listbox__option|lookup__item-action)[^,]*(:focus-visible|\.slds-has-focus)|\.slds-textarea[^,]*\[readonly\]/,
      property: "border-radius",
    },
  },
  // ⑩ c hook(--slds-c-button-*-shadow-hover)이라 util.css로 못 바꾼다
  { id: "button-hover-shadow", label: "파괴·성공·인버스 버튼 hover 그림자", mode: "both", match: { selector: /\.slds-button_(destructive|text-destructive|success|inverse|icon-border-inverse):hover/, property: "box-shadow" } },
  { id: "misc-shadow", label: "색 선택기·패널 편집·아바타 이니셜 그림자", mode: "both", match: { selector: /\.slds-(color-picker__range-indicator|panel\.slds-is-editing|avatar__initials)/, property: ["box-shadow", "text-shadow"] } },
  // ⑩ 결정 2(2026-10-12): 규칙 ⑩을 :hover로 좁혀 돌아온 kx 브레드크럼 눌림 축소 한 선언
  {
    id: "breadcrumb-press",
    label: "브레드크럼 눌림 축소",
    mode: "both",
    match: { selector: /\[kx-scope='breadcrumbs-item'\]\[kx-type='underline'\] > a:active$/, property: "transform", value: /^scale\(0\.95\)$/ },
  },
  // ⑪
  { id: "image-focus-shadow", label: "이미지 포커스 그림자", mode: "both", match: { selector: /\.slds-(image|file):focus/, property: "box-shadow" } },
  // ⑬
  { id: "weight-special", label: "표 편집 셀·전역 내비 굵기", mode: "both", match: { selector: /\.slds-cell-edit\.slds-(is-edited|has-error)|\.slds-context-bar__label-action/, property: "font-weight" } },
  // ⑭
  {
    id: "popover-accent-width",
    label: "팝오버 강조선 두께",
    mode: "both",
    match: { selector: /\.slds-popover_brand-(top|left|bottom|right)/, property: ["border-block-start-width", "border-block-end-width", "border-inline-start-width", "border-inline-end-width"] },
  },
  // ⑮ timeline 개체 색, 테마 배경 위 링크의 흰 반투명 글자, 표 hover 글자 자름 페이드·색 선택기 범위. 세로 내비 선택 바탕은 브리지로 잇는다(--milvus-nav-selected-background)
  { id: "timeline-color", label: "timeline 항목 색", mode: "both", match: { selector: /\.slds-timeline__item_(call|email|event|task)::before/, property: "background" } },
  {
    id: "theme-translucent-text",
    label: "테마 배경 위 반투명 글자",
    mode: "both",
    match: { selector: /\.slds-theme_[\w-]+ a:not\(\.slds-button_neutral\)/, property: "color", value: /^rgb\(255, 255, 255, 0?\.\d+\)$/ },
  },
  { id: "fade-gradient", label: "글자 자름 페이드·색 선택기 그라데이션", mode: "both", match: { selector: /\.slds-truncate::after|\.slds-color-picker__custom-range::before/, property: "background", value: /linear-gradient\(/ } },

  // 2026-10-14 사용자 합의: 컨트롤 높이 브리지를 뺐다. LEX 목록·헤더 툴바가 32px 아이콘 버튼과 텍스트 버튼을 섞어 두어
  // 높이를 바꾸면 어긋난다(리허설 실측). 브리지가 잇던 SLDS 2 선택자 목록 전체와 그 값에만 맞춘다
  {
    id: "lex-control-height",
    label: "LEX 컨트롤 높이(텍스트 버튼·입력 1.875rem)",
    mode: "both",
    match: [
      {
        selector:
          /^\S+ \.slds-(button(_icon(-container)?-more,\s*\.slds-button--icon(-container)?-more)?|input(_faux,\s*\.slds-input--faux)?|radio_button,\s*\.slds-radio--button|checkbox_button,\s*\.slds-checkbox--button)$/,
        property: "line-height",
        value: /^1\.875rem$/,
      },
      { selector: /^\S+ \.slds-select(\[size\],\s*\.slds-select\[multiple\])?$/, property: ["height", "min-height"], value: /^calc\(1\.875rem \+ \(1px \* 2\)\)$/ },
    ],
  },

  // native 전환 뒤 생기는 고정 (9.2의 c hook을 열면 일부 메울 수 있음)
  // nubbin은 팝오버·드롭다운의 꼬리다
  { id: "popup-shadow", label: "드롭다운·팝오버·툴팁 그림자(꼬리 포함)", mode: "native", match: { selector: /dropdown|popover|tooltip|bubble|nubbin/i, property: "box-shadow" } },
  { id: "tooltip-background", label: "툴팁 배경", mode: "native", match: { selector: /tooltip|bubble/i, property: "background" } },
  { id: "tooltip-font-size", label: "툴팁 글자 크기", mode: "native", match: { selector: /tooltip|bubble/i, property: "font-size" } },
  { id: "card-shadow", label: "native lightning-card 그림자", mode: "native", match: { selector: /card/i, property: "box-shadow" } },
  { id: "modal-radius", label: "모달 반경", mode: "native", match: { selector: /modal/i, property: "border-radius" } },
  { id: "badge-toggle-radius", label: "배지·토글 15rem", mode: "native", match: { selector: /badge|toggle/i, property: "border-radius" } },
  { id: "input-border-width", label: "입력창 두께", mode: "native", match: { selector: /input|textarea/i, property: "border-width" } },
  // 콤보박스, 날짜·라디오 그룹 버튼 1.875rem, range 입력 min-height (2026-10-12 합의 ⑥으로 넓힘)
  {
    id: "combobox-height",
    label: "native 컨트롤 높이(콤보박스·버튼·range 입력)",
    mode: "native",
    match: { selector: /combobox|\.slds-button(?![\w-])|\[part='input'\]\[type='range'\]/i, property: ["line-height", "min-height"] },
  },
  // :focus box-shadow 글로우, Firefox :-moz-focusring 점선, F6 영역 3px 윤곽 (2026-10-12 합의 ⑪로 넓힘)
  {
    id: "focus-glow",
    label: "native 포커스 표시(:focus 위주, 3px 글로우, Firefox 링·F6 강조)",
    mode: "native",
    match: { selector: /:focus(?![\w-])|:-moz-focusring|f6-highlight/, property: ["box-shadow", "outline"] },
  },
  { id: "button-lift", label: "버튼 떠오름", mode: "native", match: { selector: /button/i, property: "transform" } },
  { id: "table-header-hover", label: "표 머리글·hover 회색", mode: "native", match: { selector: /table|\bth\b/i, property: "background" } },
  { id: "search-mark", label: "검색 강조 #ff0", mode: "native", match: { selector: /(^|\s)mark(?![\w-])/, property: "background" } },
  { id: "motion-transition", label: "모든 움직임(transition)", mode: "native", match: { property: "transition" } },
  { id: "motion-animation", label: "모든 움직임(animation)", mode: "native", match: { property: "animation" } },

  // 2026-10-12 사용자 합의(남은 빈틈 묶음, native). 라벨이 native 전체를 가리키면 속성(+ 값)만, 대상이 정해져 있으면 선택자도 맞춘다
  { id: "native-spacing", label: "native 간격", mode: "native", match: { property: SPACING } },
  { id: "native-tab-line-height", label: "native 탭 줄 간격", mode: "native", match: { selector: /\[role='tab'\]|tab-overflow/, property: "line-height" } },
  // 입력 안 아이콘과 진행 링 안 상태 아이콘 (2026-10-12 결정으로 진행 링 넓힘)
  {
    id: "native-control-icon-size",
    label: "native 컨트롤·진행 링 안 아이콘 크기",
    mode: "native",
    match: { selector: /\.slds-input__icon|\.slds-progress-ring[\w-]* \.slds-icon/, property: ["width", "height"] },
  },
  { id: "native-modal-width", label: "native 모달 너비", mode: "native", match: { selector: /\.slds-modal__container/, property: ["width", "max-width", "min-width"] } },
  // 반경 자리에서 두께(sizing-border)·간격(spacing) hook을 읽어 모서리 설정이 닿지 않는다. 리터럴은 툴팁(꼬리 포함)과 진행 링 원만 (2026-10-12 결정으로 넓힘)
  {
    id: "native-radius",
    label: "native 반경(두께·간격 hook이나 리터럴, 툴팁·진행 링 포함)",
    mode: "native",
    match: [
      { property: RADIUS, value: /var\(\s*--slds-g-(sizing-border|spacing)-/ },
      { selector: /tooltip|bubble|\.slds-progress-ring/i, property: RADIUS },
    ],
  },
  { id: "native-shadow", label: "native 그림자", mode: "native", match: { property: ["box-shadow", "text-shadow"] } },
  { id: "native-cursor-underline", label: "native 커서·링크 밑줄", mode: "native", match: { property: ["cursor", "text-decoration"], value: /^(default|not-allowed)$|underline/ } },
  // 목록 옵션 머리글 700, 쌓인 표의 머리글(th::before) 대문자·자간, 모달 제목 크기(c hook --slds-c-modalheader-heading-font-size, 2026-10-12 결정으로 넓힘)
  {
    id: "native-typography",
    label: "native 글자(목록·표 머리글 굵기·대문자·자간, 모달 제목 크기)",
    mode: "native",
    match: [
      { selector: /listbox__option-header|table_stacked[\w-]* t[hd]::before/, property: ["font-weight", "text-transform", "letter-spacing"] },
      { selector: /\.slds-modal__title/, property: "font-size" },
    ],
  },
  // --slds-c-pill-sizing-border는 설계 9.2 c hook 후보
  { id: "native-pill-border", label: "native pill 두께", mode: "native", match: { selector: /\.slds-pill/, property: "border-width" } },
  // 동적 아이콘 색, 라디오 그룹(표 체크박스) 테두리·비활성 바탕, 색 선택기 패널, 알림 무늬, 표 머리글 글자, 툴팁 글자, mark 글자
  {
    id: "native-lbc-color",
    label: "native 기본 컴포넌트 색(동적 아이콘·표 체크박스 등)",
    mode: "native",
    match: { property: ["color", "background", "border", "fill", "stroke"], value: /#[0-9a-f]{3,8}\b|rgba?\(|\b(white|grey|gray|black)\b/i },
  },
];
