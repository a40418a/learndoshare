import { readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import lwc from "@lwc/rollup-plugin";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replacePlugin from "@rollup/plugin-replace";
import { rollup, type OutputOptions, type Plugin, type RollupOptions } from "rollup";
import ts from "typescript";

type LwcModule = { name: string; path: string };

// 타입 선언이 CommonJS 형식이라 NodeNext에서는 default가 한 번 더 감싸진 것으로 본다. 실행 시점(ESM)에는 함수다
const replace = replacePlugin as unknown as typeof replacePlugin.default;

// org에서의 동작을 대신하는 모듈. LWC 플러그인의 npm 해석보다 먼저 가로챈다
// - 게이트: org는 기본 컴포넌트를 synthetic shadow로 그린다(2026-10-07 실측). Storybook도 전부 synthetic으로 그린다.
//   npm 패키지는 기능 게이트(@salesforce/gate/*)를 모두 열어 둔다(external/gateStub.js). 그중 combobox의
//   ElementInternals 게이트가 열려 있으면 attachInternals()를 불러 synthetic에서 오류가 난다. org에서는 같은 컴포넌트가
//   synthetic으로 동작하므로 닫혀 있다고 보고, 이 게이트만 닫는다
// - npm에 없는 플랫폼 모듈: CSS는 Storybook이 직접 넣으므로 loadStyle은 바로 끝나고, 정적 리소스 주소는 경로 문자열이다
const CLOSED_GATES = new Set(["@salesforce/gate/bc.260.enableComboboxElementInternals"]);
const RESOURCE_URL = "@salesforce/resourceUrl/";
const PREFIX = "\0milvus-platform:";
const platformModule = (id: string) =>
  CLOSED_GATES.has(id)
    ? "export default { isOpen: () => false };"
    : id === "lightning/platformResourceLoader"
      ? "export const loadStyle = () => Promise.resolve(); export const loadScript = loadStyle;"
      : id.startsWith(RESOURCE_URL)
        ? `export default ${JSON.stringify(`/milvus-resource/${id.slice(RESOURCE_URL.length)}`)};`
        : null;
const platformModules: Plugin = {
  name: "milvus-platform-modules",
  resolveId: (id) => (platformModule(id) === null ? null : PREFIX + id),
  load: (id) => (id.startsWith(PREFIX) ? platformModule(id.slice(PREFIX.length)) : null)
};

// LWC 컴파일러는 TS 문법을 읽지 못한다. 타입만 지우고 데코레이터(@api 등)는 그대로 둔다(target ESNext)
const stripTypes: Plugin = {
  name: "milvus-strip-types",
  transform(code, id) {
    if (!id.split("?")[0].endsWith(".ts")) return null;
    const compilerOptions = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, experimentalDecorators: false };
    // ponytail: map을 만들지 않는다. 다음 단계인 LWC 플러그인도 sourcemap을 만들지 않으므로(sourcemap 기본 false)
    // 컴포넌트 줄 위치는 원래도 정확하지 않다. 디버깅에 필요해지면 둘 다 켠다
    return { code: ts.transpileModule(code, { fileName: id, compilerOptions }).outputText, map: null };
  }
};

export function lwcRollupOptions(o: { out: string; entries: Record<string, string>; modules: LwcModule[] }): RollupOptions {
  return {
    // 모든 컴포넌트를 한 번에 빌드해 LWC 엔진이 한 벌만 들어가게 한다
    input: o.entries,
    // lightning-base-components 안의 동적 import 때문에 chunk가 여러 개 생긴다. 엔진은 공통 chunk로 한 벌만 들어간다
    output: {
      dir: o.out,
      entryFileNames: "[name].js",
      format: "esm",
      sourcemap: true,
      // synthetic shadow는 LWC 엔진보다 먼저 실행돼야 한다(엔진이 로드될 때 한 번 확인한다). 진입이 둘이면 엔진이
      // 공통 chunk로 빠져 진입 파일 본문보다 먼저 실행되므로, synthetic shadow도 chunk로 빼서 import 순서로 앞에 둔다
      manualChunks: (id) => (id.includes("@lwc/synthetic-shadow") ? "synthetic-shadow" : undefined)
    },
    // 해석하지 못한 import를 그대로 두면 Storybook에서 파일 전체가 깨진다. 빌드 단계에서 실패시킨다
    onwarn(warning, warn) {
      if (warning.code === "UNRESOLVED_IMPORT") throw new Error(warning.message);
      warn(warning);
    },
    // 대체 모듈과 타입 제거는 LWC 플러그인보다 앞에 둔다
    plugins: [
      platformModules,
      stripTypes,
      replace({ preventAssignment: true, values: { "process.env.NODE_ENV": JSON.stringify("development") } }),
      lwc({
        // npm 모듈(lightning-base-components, @lwc/*)을 찾는 기준 폴더. 지정하지 않으면 첫 진입 파일의 폴더를 쓰고 경고한다
        rootDir: dirname(resolve(Object.values(o.entries)[0])),
        // 일부 공식 컴포넌트(multiColumnSortingModal 등)가 lwc:is 동적 컴포넌트를 쓴다
        enableDynamicComponents: true,
        modules: [...o.modules, { npm: "lightning-base-components" }]
      }),
      nodeResolve()
    ]
  };
}

export async function buildLwc(o: Parameters<typeof lwcRollupOptions>[0]): Promise<void> {
  // Rollup은 출력 폴더를 비우지 않는다. 해시가 붙은 이전 chunk가 쌓이지 않게 먼저 지운다
  rmSync(o.out, { recursive: true, force: true });
  const { output, ...input } = lwcRollupOptions(o);
  const bundle = await rollup(input);
  try {
    await bundle.write(output as OutputOptions);
  } finally {
    await bundle.close();
  }
}

// @lwc/module-resolver의 dir 레코드에는 namespace 옵션이 없다.
// SFDX 경로(lwc/<이름>/<이름>.js)를 c/<이름>으로 쓰려면 컴포넌트마다 alias를 등록해야 한다
export function sfdxLwcModules(projectRoot: string): LwcModule[] {
  const { packageDirectories } = JSON.parse(readFileSync(join(projectRoot, "sfdx-project.json"), "utf8")) as {
    packageDirectories: { path: string }[];
  };
  const found = new Map<string, string>();
  for (const { path } of packageDirectories) {
    const base = resolve(projectRoot, path);
    for (const file of readdirSync(base, { recursive: true, encoding: "utf8" })) {
      const [, name, ext] = /(?:^|[\\/])lwc[\\/]([^\\/]+)[\\/]\1\.(ts|js)$/.exec(file) ?? [];
      // 같은 폴더에 둘 다 있으면 원본인 .ts를 쓴다
      if (name && (ext === "ts" || !found.has(`c/${name}`))) found.set(`c/${name}`, join(base, file));
    }
  }
  return [...found].map(([name, path]) => ({ name, path }));
}

// 카탈로그 examples.json의 상대 경로(lightning-base-components/src/lightning 기준)를 실행 시점의 절대 경로로 바꾼다
export const catalogModules = (examples: { name: string; rel: string }[], lbcDir: string): LwcModule[] =>
  examples.map(({ name, rel }) => ({ name, path: resolve(lbcDir, rel) }));
