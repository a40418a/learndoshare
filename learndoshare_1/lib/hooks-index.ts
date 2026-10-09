// SLDS 2 CSS와 기본 컴포넌트(lightning-base-components) CSS가 var()로 읽는 hook 이름 색인.
// util.css 규칙(lib/rules.ts)이 "읽는 곳이 있는 이름"을 판정할 때 쓴다(설계 5.2). 정의만 있고 아무도 읽지 않는 이름은 효과가 없다.
// 패키지에는 prepack(scripts/build-hooks-index.ts)이 dist/hooks-index.json으로 미리 넣는다. check --style이 원본 CSS를 읽지 않게 하기 위해서다
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, sep } from "node:path";

export type HooksIndex = { readSHooks: string[]; readGHooks: string[] };
export type RuleContext = { readSHooks: Set<string>; readGHooks: Set<string>; milvusVars: Set<string> };

const COMMENT = /\/\*[\s\S]*?\*\//g;

/** var(--slds-g-*), var(--slds-s-*)로 읽히는 이름만 모은다. fallback 안의 var()도 읽기다. 정의만 있는 이름과 주석은 뺀다 */
export function buildHooksIndex(src: { sldsCss: string; lbcCss: string[] }): HooksIndex {
  const names = new Set<string>();
  for (const css of [src.sldsCss, ...src.lbcCss]) {
    for (const m of css.replace(COMMENT, "").matchAll(/var\(\s*(--slds-[gs]-[\w-]+)/g)) names.add(m[1]);
  }
  const sorted = [...names].sort();
  return {
    readSHooks: sorted.filter((n) => n.startsWith("--slds-s-")),
    readGHooks: sorted.filter((n) => n.startsWith("--slds-g-")),
  };
}

/** pkgRoot에 설치된 SLDS 2(slds2.cosmos.css)와 기본 컴포넌트 원본에서 색인을 계산한다 */
export function hooksIndexFromSource(pkgRoot: string): HooksIndex {
  const req = createRequire(join(pkgRoot, "package.json"));
  const pkgDir = (name: string) => dirname(req.resolve(`${name}/package.json`));
  const lbc = join(pkgDir("lightning-base-components"), "src/lightning");
  // 컴포넌트 폴더 바로 아래 CSS만 읽는다. 더 아래(__examples__)는 문서 예제다
  const lbcCss = readdirSync(lbc, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(lbc, d.name))
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(join(lbc, d.name, f), "utf8")),
    );
  const sldsCss = readFileSync(join(pkgDir("@salesforce-ux/design-system-2"), "dist/css/bundled/slds2.cosmos.css"), "utf8");
  return buildHooksIndex({ sldsCss, lbcCss });
}

const filesUnder = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { recursive: true, encoding: "utf8" }).map((f) => join(dir, f)) : [];

// CSS의 var(--milvus-*)와 TS의 문자열 "--milvus-*"(getPropertyValue 등)
function milvusReads(text: string): string[] {
  return [...text.replace(COMMENT, "").matchAll(/var\(\s*(--milvus-[\w-]+)|["'`](--milvus-[\w-]+)["'`]/g)].map((m) => m[1] ?? m[2]);
}

/**
 * util.css 검사 문맥.
 * - hook 색인: pkgRoot의 dist/hooks-index.json이 있으면(설치된 패키지) 읽고, 없으면(저장소) 원본에서 계산한다
 * - milvusVars: 밀버스 컴포넌트(lwc/milvus*의 .css·.ts, __tests__ 제외)와 milvusBridge.css가 읽는 --milvus-* 이름.
 *   projectRoot가 있으면 프로젝트의 사본을, 없으면 저장소의 lwc와 templates/**\/milvusBridge.css를 본다
 */
export function loadRuleContext(o: { pkgRoot: string; projectRoot?: string }): RuleContext {
  const indexFile = join(o.pkgRoot, "dist/hooks-index.json");
  const index: HooksIndex = existsSync(indexFile)
    ? JSON.parse(readFileSync(indexFile, "utf8"))
    : hooksIndexFromSource(o.pkgRoot);

  const lwc = join(o.projectRoot ?? o.pkgRoot, "force-app/main/default/lwc");
  const components = filesUnder(lwc).filter((f) => {
    const parts = relative(lwc, f).split(sep);
    return parts[0].startsWith("milvus") && !parts.includes("__tests__") && /\.(css|ts)$/.test(f);
  });
  const bridges = o.projectRoot
    ? [join(o.projectRoot, "force-app/main/default/staticresources/milvusBridge.css")].filter((f) => existsSync(f))
    : filesUnder(join(o.pkgRoot, "templates")).filter((f) => basename(f) === "milvusBridge.css");

  return {
    readSHooks: new Set(index.readSHooks),
    readGHooks: new Set(index.readGHooks),
    milvusVars: new Set([...components, ...bridges].flatMap((f) => milvusReads(readFileSync(f, "utf8")))),
  };
}
