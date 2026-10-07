// synthetic shadow는 LWC 엔진보다 먼저 로드해야 한다 (Salesforce 플랫폼과 같은 shadow 모드)
import "@lwc/synthetic-shadow";

export { createElement } from "lwc";

// 밀버스 추가. Salesforce 기본 컴포넌트는 공식 예제 카탈로그(catalog.js)에서 렌더한다
export { default as MilvusBadge } from "c/milvusBadge";
export { default as MilvusMultiSelect } from "c/milvusMultiSelect";
