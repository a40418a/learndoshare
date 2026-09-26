// synthetic shadow는 LWC 엔진보다 먼저 로드해야 한다 (Salesforce 플랫폼과 같은 shadow 모드)
import "@lwc/synthetic-shadow";

export { createElement } from "lwc";

// SLDS 기반 (Salesforce 제공)
export { default as LightningBadge } from "lightning/badge";
export { default as LightningButton } from "lightning/button";
export { default as LightningCombobox } from "lightning/combobox";
export { default as LightningDualListbox } from "lightning/dualListbox";

// 밀버스 추가
export { default as MilvusBadge } from "c/milvusBadge";
export { default as MilvusMultiSelect } from "c/milvusMultiSelect";
