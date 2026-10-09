// lwc-build 테스트용: 문법 오류(foo의 닫는 괄호 누락)가 있는 TS 컴포넌트. 빌드가 실패해야 한다
import { LightningElement } from "lwc";

export default class Broken extends LightningElement {
  foo( { return 1; }
}
