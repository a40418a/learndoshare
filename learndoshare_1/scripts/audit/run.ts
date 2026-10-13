// 정적 반영 검사 (설계 9.6의 1·4). 사용: node scripts/audit/run.ts --write | --check (pnpm audit:brand = --check)
//   --write  audit/report.json(컴포넌트·명세 항목별 반영 상태, 패키지에 들어감)과 audit/baseline.json(비교 기준)을 쓴다
//   --check  다음이면 1로 끝난다
//            1. FIXED_ITEMS에 없는 빈틈이 있다(기준 파일과 상관없음)
//            2. 기준 대비 새 하드코딩(고정 항목이 흡수하면 그 라벨을 붙인다), hook 변화, native 지원 목록 변화가 있거나 브리지 선택자가 원본에서 사라졌다
// 결과에는 개발자 PC의 경로를 넣지 않는다. 파일은 패키지 기준 상대 경로다
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "postcss";
import { FIXED_ITEMS } from "../../lib/fixed-list.ts";
import { buildHooksIndex } from "../../lib/hooks-index.ts";
import { SPEC_ITEMS } from "../../lib/spec-items.ts";
import { classify, type Decl, type LbcFile } from "./classify.ts";
import { bridgeSelectors, buildReport, fixedItemsOf } from "./report.ts";

export type Sources = { sldsCss: string; lbcFiles: LbcFile[]; bridgeCss: string; nativeList: string[] };
/** hardcoded: hook을 읽지 않는 선언 "출처 컴포넌트 속성: 값"별 개수. 줄 번호·선택자는 넣지 않아 원본의 위치 이동에는 흔들리지 않는다 */
export type Baseline = { hardcoded: Record<string, number>; hooks: string[]; nativeShadowEnabledComponents: string[] };

const root = fileURLToPath(new URL("../..", import.meta.url));
const SHOWN = 20;

/**
 * 설치된 SLDS 2·기본 컴포넌트와 저장소의 milvusBridge.css를 읽는다. 순서를 고정해 OS와 상관없이 같은 결과를 낸다.
 * lbcDir: 기본 컴포넌트의 src/lightning 폴더. 기본은 설치본이고, 카탈로그 생성기는 예제를 읽은 폴더를 넘긴다
 */
export function readSources(lbcDir?: string): Sources {
  const req = createRequire(join(root, "package.json"));
  const pkgDir = (name: string) => dirname(req.resolve(`${name}/package.json`));
  const lbc = lbcDir ?? join(pkgDir("lightning-base-components"), "src/lightning");
  const lbcPkg = join(lbc, "../..");
  // 컴포넌트 폴더 바로 아래 CSS만 읽는다. 더 아래(__examples__)는 문서 예제다
  const lbcFiles = readdirSync(lbc, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .flatMap((comp) =>
      readdirSync(join(lbc, comp))
        .filter((f) => f.endsWith(".css"))
        .sort()
        .map((f) => ({ comp, file: `lightning-base-components/src/lightning/${comp}/${f}`, css: readFileSync(join(lbc, comp, f), "utf8") })),
    );
  return {
    sldsCss: readFileSync(join(pkgDir("@salesforce-ux/design-system-2"), "dist/css/bundled/slds2.cosmos.css"), "utf8"),
    lbcFiles,
    bridgeCss: readFileSync(join(root, "templates/force-app/main/default/staticresources/milvusBridge.css"), "utf8"),
    nativeList: JSON.parse(readFileSync(join(lbcPkg, "package.json"), "utf8")).lwc.nativeShadowEnabledComponents,
  };
}

const hardcodedKey = (d: Decl) => `${d.src} ${d.comp} ${d.prop}: ${d.value}`;
function snapshot(src: Sources, decls: Decl[]): Baseline {
  const hardcoded: Record<string, number> = {};
  for (const d of decls) {
    if (d.kind === "g" || d.kind === "s" || d.kind === "keyword") continue;
    const key = hardcodedKey(d);
    hardcoded[key] = (hardcoded[key] ?? 0) + 1;
  }
  const index = buildHooksIndex({ sldsCss: src.sldsCss, lbcCss: src.lbcFiles.map((f) => f.css) });
  return {
    hardcoded: Object.fromEntries(Object.entries(hardcoded).sort(([a], [b]) => (a < b ? -1 : 1))),
    hooks: [...index.readGHooks, ...index.readSHooks].sort(),
    nativeShadowEnabledComponents: [...src.nativeList].sort(),
  };
}

const shown = (lines: string[]) => (lines.length > SHOWN ? [...lines.slice(0, SHOWN), `  … 외 ${lines.length - SHOWN}개`] : lines);
function setChange(label: string, before: string[], after: string[]): string[] {
  const added = after.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !after.includes(x));
  const parts = [added.length ? `생김 ${added.join(" ")}` : "", removed.length ? `사라짐 ${removed.join(" ")}` : ""].filter(Boolean);
  return parts.length ? [`${label}: ${parts.join(", ")}`] : [];
}

export function runAudit(argv: string[], src: Sources, dir: string): { code: number; message: string } {
  const flag = argv.length === 1 ? argv[0] : "";
  if (flag !== "--write" && flag !== "--check") return { code: 1, message: "사용: node scripts/audit/run.ts --write | --check" };
  const decls = classify(src);
  const report = buildReport(decls, SPEC_ITEMS, src.bridgeCss, FIXED_ITEMS);
  const current = snapshot(src, decls);

  if (flag === "--write") {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(dir, "baseline.json"), `${JSON.stringify(current, null, 2)}\n`);
    return { code: 0, message: `report.json, baseline.json을 썼다: 선언 ${decls.length}개, 고정 목록에 없는 빈틈 ${report.gaps.length}개` };
  }

  const gaps = report.gaps.length
    ? [
        `고정 목록에 없는 빈틈 ${report.gaps.length}개 (audit/report.json의 gaps. 브리지로 메우거나, 고칠 수 없으면 사용자 합의 뒤 lib/fixed-list.ts에 넣는다)`,
        ...shown(report.gaps.map((g) => `  ${g.comp} [${g.item}] ${g.selector} { ${g.prop}: ${g.value} }`)),
      ]
    : [];
  const changes: string[] = [];
  const baselineFile = join(dir, "baseline.json");
  if (existsSync(baselineFile)) {
    const before = JSON.parse(readFileSync(baselineFile, "utf8")) as Baseline;
    const added = Object.entries(current.hardcoded).filter(([key, n]) => n > (before.hardcoded[key] ?? 0));
    // 고정 항목이 이미 흡수하는 새 하드코딩은 빈틈으로 안 보인다. --write로 기준에 넣기 전에 사람이 합의 범위인지 보도록 라벨을 붙인다
    const byKey = Map.groupBy(decls, hardcodedKey);
    const fixedNote = (key: string) => {
      const labels = [...new Set((byKey.get(key) ?? []).flatMap((d) => fixedItemsOf(d, FIXED_ITEMS).map((f) => f.label)))];
      return labels.length ? ` (고정: ${labels.join(", ")})` : "";
    };
    changes.push(...shown(added.map(([key]) => `새 하드코딩: ${key}${fixedNote(key)}`)));
    changes.push(...setChange("hook 변화", before.hooks, current.hooks));
    changes.push(...setChange("native 지원 목록 변화", before.nativeShadowEnabledComponents, current.nativeShadowEnabledComponents));
  } else {
    changes.push("기준 파일 audit/baseline.json이 없다");
  }
  // 원본의 모든 규칙의 선택자. custom property만 정의하는 규칙(개체 아이콘 색)도 넣는다. Decl에는 그런 규칙이 없다
  const sourceSelectors = new Set<string>();
  for (const css of [src.sldsCss, ...src.lbcFiles.map((f) => f.css)]) {
    parse(css).walkRules((r) => r.selectors.forEach((s) => sourceSelectors.add(s.replace(/\s+/g, " ").trim())));
  }
  changes.push(...bridgeSelectors(src.bridgeCss).filter((s) => !sourceSelectors.has(s)).map((s) => `브리지 선택자 소실: ${s}`));

  if (!gaps.length && !changes.length) return { code: 0, message: "✓ 정적 반영 검사: 빈틈 0개, 기준과 같음" };
  const hint = changes.length ? ["바뀐 것을 확인한 뒤(패키지 버전 갱신 등) node scripts/audit/run.ts --write로 기준을 다시 만든다"] : [];
  return { code: 1, message: [...gaps, ...changes, ...hint].join("\n") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, message } = runAudit(process.argv.slice(2), readSources(), join(root, "audit"));
  (code ? console.error : console.log)(message);
  process.exitCode = code;
}
