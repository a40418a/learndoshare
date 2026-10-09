// org가 실행 시점에 주는 모듈이라 npm 패키지가 없다. 밀버스 LWC가 쓰는 것만 타입을 선언한다
// (Jest는 sfdx-lwc-jest stub, Storybook은 lib/lwc-build.ts의 대체 모듈이 실제 값을 준다)
declare module "lightning/platformResourceLoader" {
  import type { LightningElement } from "lwc";
  export function loadStyle(self: LightningElement, fileUrl: string): Promise<void>;
}

declare module "@salesforce/resourceUrl/*" {
  const url: string;
  export default url;
}
