// 브랜드 명세 페이지(설계 6.1). 그리는 코드는 brand-spec-page.ts에 있다
import { renderBrandSpec } from "./brand-spec-page.ts";

export default {
  title: "시작하기/브랜드 명세",
  // 입력 폼이라 문서 탭에 같은 폼을 한 번 더 그리지 않는다
  tags: ["!autodocs"],
  parameters: { controls: { disable: true } },
};

export const 브랜드_명세 = {
  name: "브랜드 명세",
  render: () => renderBrandSpec(),
};
