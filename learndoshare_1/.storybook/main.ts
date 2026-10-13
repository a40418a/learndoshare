// 두 모드(설계 4.2). MILVUS_PROJECT_DIR가 있으면 프로젝트 모드다(milvus storybook이 넘긴다). 없으면 저장소 모드다.
// 패키지에는 이 폴더를 원본 .ts로 넣는다(Task 3). Storybook 로더가 node_modules 안의 .ts도 변환한다
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/web-components-vite";
import { mergeConfig, searchForWorkspaceRoot } from "vite";
import { loadBrands, milvusStorybookPlugin, type PluginOptions } from "../lib/storybook-plugin.ts";

const repoDir = fileURLToPath(new URL("..", import.meta.url));
const projectDir = process.env.MILVUS_PROJECT_DIR;
const options: PluginOptions = projectDir ? { mode: "project", repoDir, projectDir } : { mode: "repo", repoDir };

const config: StorybookConfig = {
  framework: { name: "@storybook/web-components-vite", options: {} },
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(js|ts)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  // 스토리는 LWC 번들을 @milvus/lwc로 읽는다. 저장소는 pnpm build:lwc가 만든 dist/lwc, 프로젝트는 milvus storybook이 만든 .milvus/lwc다
  viteFinal: (vite) =>
    mergeConfig(vite, {
      plugins: [milvusStorybookPlugin(options)],
      resolve: { alias: { "@milvus/lwc": projectDir ? join(projectDir, ".milvus/lwc") : join(repoDir, "dist/lwc") } },
      // allow를 직접 주면 Vite 기본값(작업 공간 루트)이 빠지므로 함께 넣는다
      ...(projectDir && { server: { fs: { allow: [searchForWorkspaceRoot(vite.root ?? process.cwd()), projectDir] } } }),
    }),
  // manager(사이드바)는 Vite 밖에서 번들되어 가상 모듈을 못 읽는다. 기본 브랜드의 로고와 색만 여기서 넘긴다
  managerHead: (head) => {
    const [brand] = loadBrands(options);
    const data = JSON.stringify({ logoUrl: brand.logoUrl, color: brand.palette[50] }).replace(/</g, "\\u003c");
    return `${head}<script>window.MILVUS_BRAND = ${data};</script>`;
  },
  // 배포본 방문자에게 Storybook 온보딩 체크리스트와 새 버전 알림을 보이지 않는다
  features: { sidebarOnboardingChecklist: false },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
};

export default config;
