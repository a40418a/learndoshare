// 브리지 변수 (설계 5.6). hook이 없는 항목을 milvusBridge.css가 이 변수로 잇는다.
// 브랜드는 milvusBrand.css의 :root에 값만 정한다. 정하지 않으면 브리지 규칙의 기본값(Salesforce 원래 값)이 쓰인다
// 키는 브리지 항목 id, 값은 변수 이름이다. 2026-10-14 사용자 결정으로 컨트롤 높이와 브리지 10종을 뺐다(lib/fixed-list.ts의 고정 항목)

export const BRIDGE_VARS: Record<string, string> = {
  // 움직임. 기본값은 규칙마다 원래 값이다: fast는 0.1s 이하, medium은 0.15~0.2s, slow는 0.25~0.4s인 규칙
  "motion-duration-fast": "--milvus-motion-duration-fast",
  "motion-duration-medium": "--milvus-motion-duration-medium",
  "motion-duration-slow": "--milvus-motion-duration-slow",
  "motion-easing": "--milvus-motion-easing",
  // 모양
  "input-border-width": "--milvus-input-border-width",
  // 모달 너비: base는 크기 클래스가 없는 모달, 나머지는 slds-modal_<크기>(lightning-modal size). min-width는 모든 크기의 최소 너비
  "modal-width-base": "--milvus-modal-width-base",
  "modal-width-small": "--milvus-modal-width-small",
  "modal-width-medium": "--milvus-modal-width-medium",
  "modal-width-large": "--milvus-modal-width-large",
  "modal-width-full": "--milvus-modal-width-full",
  "modal-min-width": "--milvus-modal-min-width",
  // 글자
  "caps-transform": "--milvus-caps-transform",
  "caps-letter-spacing": "--milvus-caps-letter-spacing",
  // 색: 세로 내비 선택 바탕(SLDS 2 리터럴 rgb(21, 137, 238, 0.1), hook 없음)
  "nav-selected-background": "--milvus-nav-selected-background",
};
