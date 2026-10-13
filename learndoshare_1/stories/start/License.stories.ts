// Salesforce 이용 약관 전문 (설계 9.5). 컴포넌트 페이지의 "원본과 hook" 스토리가 Salesforce 원본 파일을 보여 주는 근거다.
// 전문은 설치된 lightning-base-components·@salesforce-ux/design-system-2의 LICENSE.txt를 빌드할 때 읽는다(stories/salesforce-source.js)
import { licenseBlock, NOTICE } from "../salesforce-source.js";

export default {
  title: "시작하기/Salesforce 이용 약관",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "컴포넌트 페이지(컴포넌트/기본)의 **원본과 hook** 스토리는 Salesforce 기본 컴포넌트(`lightning-base-components`)와 SLDS 2(`@salesforce-ux/design-system-2`)의 원본 파일을 보여 준다. " +
          `아래는 두 패키지에 들어 있는 이용 약관 전문이다.\n\n> ${NOTICE}`,
      },
    },
  },
};

export const Terms = {
  name: "이용 약관 전문",
  render: () => licenseBlock(),
  parameters: { docs: { codePanel: false, canvas: { sourceState: "none" } } },
};
