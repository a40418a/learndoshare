import { readFileSync } from "node:fs";

// manager(사이드바) 번들러는 JSON import를 지원하지 않는다. 로고와 브랜드 색은 여기서 읽어 전달한다
const brand = JSON.parse(
  readFileSync(
    new URL("../brands/Milvus_DesignSystem/theme.json", import.meta.url),
    "utf8"
  )
);

/** @type { import('@storybook/web-components-vite').StorybookConfig } */
export default {
  framework: { name: "@storybook/web-components-vite", options: {} },
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.js"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  // brands/ (org에서 받은 로고 등)를 static/brands로 내보낸다. brands/ 그대로 쓰면 JSON 모듈 import와 경로가 겹친다. GitHub Pages 하위 경로에서도 동작하도록 상대 경로로 참조한다
  staticDirs: [{ from: "../brands", to: "static/brands" }],
  managerHead: (head) =>
    `${head}<script>window.MILVUS_BRAND = ${JSON.stringify(brand)};</script>`,
  // 배포본 방문자에게 Storybook 온보딩 체크리스트와 새 버전 알림을 보이지 않는다
  features: { sidebarOnboardingChecklist: false },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true }
};
