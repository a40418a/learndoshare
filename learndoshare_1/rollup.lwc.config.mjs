import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
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

// Rollup은 출력 폴더를 비우지 않는다. 해시가 붙은 이전 chunk가 쌓이지 않게 먼저 지운다
rmSync("dist/lwc", { recursive: true, force: true });

// Salesforce 공식 예제 (scripts/generate-slds-catalog.mjs가 만든 alias 목록)
const catalog = JSON.parse(
  readFileSync("stories/slds-catalog/examples.json", "utf8")
);

// org와 같은 혼합 shadow 모드: 패키지가 지정한 기본 컴포넌트(lwc.nativeShadowEnabledComponents)만 native shadow로,
// 나머지와 밀버스 컴포넌트는 synthetic으로 그린다. combobox 등은 attachInternals를 써서 synthetic에서 동작하지 않는다.
// 패키지 소스에는 이 설정이 없어서(플랫폼이 붙인다) 빌드 때 default export 클래스에 shadowSupportMode = "native"를 붙인다
const NATIVE = new Set(
  JSON.parse(
    readFileSync("node_modules/lightning-base-components/package.json", "utf8")
  ).lwc.nativeShadowEnabledComponents
);
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const nativeShadow = {
  name: "milvus-native-shadow",
  transform(code, id) {
    const [, name] =
      id.match(/lightning-base-components\/src\/lightning\/([^/]+)\/\1\.js$/) ??
      [];
    if (!name || !NATIVE.has(`lightning-${kebab(name)}`)) return null;
    // export default class X ... 또는 export default X; (formattedRichText처럼 클래스를 골라 내보내는 경우)
    const [, cls] =
      code.match(/export default class (\w+)/) ??
      code.match(/export default (\w+);/) ??
      [];
    // datatableKeyboardMixins처럼 목록에 있지만 컴포넌트가 아닌 모듈은 건너뛴다
    if (!cls) return null;
    return {
      code: `${code}\n${cls}.shadowSupportMode = "native";\n`,
      map: null
    };
  }
};

export default {
  // 모든 컴포넌트를 한 번에 빌드해 LWC 엔진이 한 벌만 들어가게 한다
  input: {
    index: "stories/lwc-entry.js",
    catalog: "stories/slds-catalog/entry.js"
  },
  // lightning-base-components 안의 동적 import 때문에 chunk가 여러 개 생긴다. 엔진은 공통 chunk로 한 벌만 들어간다
  output: {
    dir: "dist/lwc",
    entryFileNames: "[name].js",
    format: "esm",
    sourcemap: true,
    // synthetic shadow는 LWC 엔진보다 먼저 실행돼야 한다(엔진이 로드될 때 한 번 확인한다). 진입이 둘이면 엔진이
    // 공통 chunk로 빠져 진입 파일 본문보다 먼저 실행되므로, synthetic shadow도 chunk로 빼서 import 순서로 앞에 둔다
    manualChunks: (id) =>
      id.includes("@lwc/synthetic-shadow") ? "synthetic-shadow" : undefined
  },
  // 해석하지 못한 import를 그대로 두면 Storybook에서 파일 전체가 깨진다. 빌드 단계에서 실패시킨다
  onwarn(warning, warn) {
    if (warning.code === "UNRESOLVED_IMPORT") throw new Error(warning.message);
    warn(warning);
  },
  plugins: [
    nativeShadow,
    replace({
      preventAssignment: true,
      values: { "process.env.NODE_ENV": JSON.stringify("development") }
    }),
    lwc({
      // 일부 공식 컴포넌트(multiColumnSortingModal 등)가 lwc:is 동적 컴포넌트를 쓴다
      enableDynamicComponents: true,
      modules: [
        ...sfdxModules,
        ...catalog,
        { npm: "lightning-base-components" }
      ]
    }),
    nodeResolve()
  ]
};
