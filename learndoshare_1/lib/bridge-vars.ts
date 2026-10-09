// 브리지 변수 (설계 5.6). hook이 없는 항목을 milvusBridge.css가 이 변수로 잇는다.
// 브랜드는 milvusBrand.css의 :root에 값만 정한다. 정하지 않으면 브리지 규칙의 기본값(Salesforce 원래 값)이 쓰인다
// 키는 브리지 항목 id, 값은 변수 이름이다

export const BRIDGE_VARS: Record<string, string> = {
  // 움직임. 기본값은 규칙마다 원래 값이다: fast는 0.1s 이하, medium은 0.15~0.2s, slow는 0.25~0.4s인 규칙
  "motion-duration-fast": "--milvus-motion-duration-fast",
  "motion-duration-medium": "--milvus-motion-duration-medium",
  "motion-duration-slow": "--milvus-motion-duration-slow",
  "motion-easing": "--milvus-motion-easing",
  // 크기·모양
  "control-height": "--milvus-control-height",
  "input-border-width": "--milvus-input-border-width",
  "path-end-radius": "--milvus-path-end-radius",
  "control-icon-size": "--milvus-control-icon-size",
  "modal-width-medium": "--milvus-modal-width-medium",
  "modal-width-large": "--milvus-modal-width-large",
  // 글자
  "letter-spacing": "--milvus-letter-spacing",
  "caps-transform": "--milvus-caps-transform",
  "choice-label-weight": "--milvus-choice-label-weight",
  // 커서·밑줄·그림자
  "cursor-disabled": "--milvus-cursor-disabled",
  "link-decoration-hover": "--milvus-link-decoration-hover",
  "nubbin-shadow": "--milvus-nubbin-shadow",
  // 아이콘
  "icon-color-all": "--milvus-icon-color-all",
};
