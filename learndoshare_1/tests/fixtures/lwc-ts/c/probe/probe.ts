// lwc-build 테스트용 TS 컴포넌트. npm에 없는 플랫폼 모듈을 import한다
import { LightningElement, api } from "lwc";
import { loadStyle } from "lightning/platformResourceLoader";
import probeCss from "@salesforce/resourceUrl/x";

export default class Probe extends LightningElement {
  @api label: string = "";

  connectedCallback(): void {
    void loadStyle(this, probeCss);
  }
}
