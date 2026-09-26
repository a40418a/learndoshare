import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import lwc from "@lwc/rollup-plugin";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

const LWC_DIR = "force-app/main/default/lwc";

// @lwc/module-resolver의 dir 레코드에는 namespace 옵션이 없다.
// SFDX 경로(lwc/<이름>/<이름>.js)를 c/<이름>으로 쓰려면 컴포넌트마다 alias를 등록해야 한다.
const sfdxModules = readdirSync(LWC_DIR, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(`${LWC_DIR}/${entry.name}/${entry.name}.js`)
  )
  .map((entry) => ({
    name: `c/${entry.name}`,
    path: resolve(LWC_DIR, entry.name, `${entry.name}.js`)
  }));

export default {
  // 모든 컴포넌트를 한 번에 빌드해 LWC 엔진이 한 벌만 들어가게 한다
  input: "stories/lwc-entry.js",
  // lightning-base-components 안의 동적 import 때문에 chunk가 여러 개 생긴다. 엔진은 공통 chunk로 한 벌만 들어간다
  output: {
    dir: "dist/lwc",
    entryFileNames: "index.js",
    format: "esm",
    sourcemap: true
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: { "process.env.NODE_ENV": JSON.stringify("development") }
    }),
    lwc({ modules: [...sfdxModules, { npm: "lightning-base-components" }] }),
    nodeResolve()
  ]
};
