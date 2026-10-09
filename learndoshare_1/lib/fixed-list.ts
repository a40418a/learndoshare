// "Salesforce 고정" 목록 (설계 9.4, 2026-10-08 사용자 합의). 모든 방법을 써도 바꿀 수 없어 명세 페이지와 발표에 "바꿀 수 없음"으로 적는다.
// 새 항목을 넣으려면 사용자 합의가 필요하다(설계 9.6의 4)
// 브라우저(Storybook 명세 페이지)에서도 import하므로 Node 모듈을 쓰지 않는다

/**
 * - mode: both는 지금(synthetic)과 native 모두, native는 기본 컴포넌트가 native shadow로 바뀐 뒤에만 고정이다
 * - match: 정적 반영 검사(Task 14)가 빈틈 선언을 이 항목으로 볼 조건. 주어진 조건을 모두 만족하면 맞는다
 *   - selector: `<컴포넌트 이름> <선택자>`에 맞춘다. 기본 컴포넌트의 native CSS 선택자에는 클래스가 없는 경우가 많다([part='input'])
 *   - property: 속성 이름이 같거나 그 longhand다(transition → transition-duration, background → background-color)
 *   - source: 값이 있는 곳. 기본은 css. js는 JS 상수라 CSS 선언과 맞추지 않고 보여 주기만 한다
 */
export type FixedItem = {
  id: string;
  label: string;
  mode: "both" | "native";
  match: { selector?: RegExp; property?: string; source?: "css" | "js" };
};

// ponytail: 선택자는 9.4 문장을 SLDS 2·기본 컴포넌트 CSS의 이름으로 옮긴 1차 매처다. Task 14가 실제 빈틈과 맞춰 좁힌다
export const FIXED_ITEMS: FixedItem[] = [
  // 두 모드 모두 고정
  { id: "icon-glyph", label: "아이콘 SVG 모양과 개체 아이콘 글리프의 흰색", mode: "both", match: { selector: /\.slds-icon(?![\w-])/, property: "fill" } },
  { id: "z-index", label: "z-index 층", mode: "both", match: { property: "z-index" } },
  { id: "opacity", label: "0·1이 아닌 투명도", mode: "both", match: { property: "opacity" } },
  { id: "toast-duration", label: "토스트 표시 시간(JS 상수 4800·9600ms)", mode: "both", match: { source: "js" } },
  { id: "spinner", label: "스피너 모양", mode: "both", match: { selector: /spinner/i } },
  { id: "color-picker-hue", label: "색 선택기 색상환", mode: "both", match: { selector: /hue/i } },
  { id: "agentforce", label: "Agentforce 영역", mode: "both", match: { selector: /\.slds-subtheme-agentic/ } },
  { id: "image-scrim", label: "이미지 위 어둡게 처리", mode: "both", match: { selector: /_scrim|--scrim/ } },
  { id: "destructive-success-text", label: "파괴·성공 버튼의 흰 글자", mode: "both", match: { selector: /button(_|--)(destructive|success)/, property: "color" } },
  { id: "global-header", label: "LEX 전역 헤더(org 테마가 원본)", mode: "both", match: { selector: /\.slds-global-header/ } },

  // native 전환 뒤 생기는 고정 (9.2의 c hook을 열면 일부 메울 수 있음)
  { id: "popup-shadow", label: "드롭다운·팝오버·툴팁 그림자", mode: "native", match: { selector: /dropdown|popover|tooltip|bubble/i, property: "box-shadow" } },
  { id: "tooltip-background", label: "툴팁 배경", mode: "native", match: { selector: /tooltip|bubble/i, property: "background" } },
  { id: "tooltip-font-size", label: "툴팁 글자 크기", mode: "native", match: { selector: /tooltip|bubble/i, property: "font-size" } },
  { id: "card-shadow", label: "native lightning-card 그림자", mode: "native", match: { selector: /card/i, property: "box-shadow" } },
  { id: "modal-radius", label: "모달 반경", mode: "native", match: { selector: /modal/i, property: "border-radius" } },
  { id: "badge-toggle-radius", label: "배지·토글 15rem", mode: "native", match: { selector: /badge|toggle/i, property: "border-radius" } },
  { id: "input-border-width", label: "입력창 두께", mode: "native", match: { selector: /input|textarea/i, property: "border-width" } },
  { id: "combobox-height", label: "콤보박스 높이", mode: "native", match: { selector: /combobox/i, property: "line-height" } },
  { id: "focus-glow", label: ":focus 위주 포커스 표시와 3px 글로우", mode: "native", match: { selector: /:focus(?![\w-])/, property: "box-shadow" } },
  { id: "button-lift", label: "버튼 떠오름", mode: "native", match: { selector: /button/i, property: "transform" } },
  { id: "table-header-hover", label: "표 머리글·hover 회색", mode: "native", match: { selector: /table|\bth\b/i, property: "background" } },
  { id: "search-mark", label: "검색 강조 #ff0", mode: "native", match: { selector: /(^|\s)mark(?![\w-])/, property: "background" } },
  { id: "motion-transition", label: "모든 움직임(transition)", mode: "native", match: { property: "transition" } },
  { id: "motion-animation", label: "모든 움직임(animation)", mode: "native", match: { property: "animation" } },
];
