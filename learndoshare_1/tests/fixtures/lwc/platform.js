// 엔진 없이 따로 빌드해 Node에서 실행하고 대체 모듈의 값을 확인한다.
// lightning-base-components는 이 게이트를 열어 둔다(external/gateStub.js)
export { default as gate } from "@salesforce/gate/bc.260.enableComboboxElementInternals";
export { default as resourceUrl } from "@salesforce/resourceUrl/x";
export { loadStyle, loadScript } from "lightning/platformResourceLoader";
