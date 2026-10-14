// 반영 검사 페이지(설계 9.6의 2). 그리는 코드는 reflect-check-page.ts에 있다
import { renderReflectCheck } from "./reflect-check-page.ts";

export default {
  title: "시작하기/반영 검사",
  // 버튼으로 돌리는 검사 화면이라 문서 탭에 한 번 더 그리지 않는다
  tags: ["!autodocs"],
  parameters: { controls: { disable: true } },
};

export const 반영_검사 = {
  name: "반영 검사",
  render: () => renderReflectCheck(),
};
