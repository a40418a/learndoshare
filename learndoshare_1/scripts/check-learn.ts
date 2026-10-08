// Learn/*.html 검사
// - 폐기한 설계(root.css, override.css)는 <aside class="legacy"> 안에서만 말한다
// - 모든 <section>의 마지막 요소가 p.sources이고, 링크는 공식 도메인이나 프로젝트 기록(../docs/research/, ../docs/specs/, ../README.md)만, "확인 YYYY-MM-DD"가 있다
// - HTML 주석 안의 내용은 검사하지 않는다 (화면에 보이지 않으므로 출처로 치지 않는다)
// 실행: node scripts/check-learn.ts [폴더] → 문제를 "파일:줄 절id 내용"으로 출력하고, 하나라도 있으면 1로 끝난다. 폴더 기본값은 Learn/
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 새 도메인은 공식(1차) 자료일 때만 더한다. 경로가 붙은 항목(github.com/salesforce)은 그 조직 아래만 허용한다
export const SOURCE_DOMAINS = [
  "developer.salesforce.com",
  "help.salesforce.com",
  "www.lightningdesignsystem.com",
  "v1.lightningdesignsystem.com",
  "lwc.dev",
  "github.com/salesforce",
  "github.com/salesforce-ux",
  "github.com/forcedotcom",
  "www.npmjs.com",
  "nodejs.org",
  "www.typescriptlang.org",
  "storybook.js.org",
  "github.com/storybookjs",
  "vite.dev",
  "rollupjs.org",
  "pnpm.io",
  "github.com/pnpm",
  "lit.dev",
  "typicode.github.io", // husky 공식 문서
  "docs.github.com",
  "code.claude.com",
  "docs.anthropic.com",
  "www.w3.org",
  "developer.mozilla.org",
  // 문서가 직접 다루는 서드파티 도구의 1차 저장소·사이트. 그 도구에 대한 사실에만 쓴다
  "github.com/DietrichGebert", // Ponytail
  "github.com/lukethacoder", // LWC Garden
  "lwc.garden",
];

// 프로젝트의 결정·실측 기록. 외부 사실의 출처로는 쓰지 않는다 (Learn/ 기준 상대 링크, ../ 뒤의 경로)
const PROJECT_RECORDS = /^(?:docs\/research\/|docs\/specs\/|README\.md(?:[?#]|$))/;
// 브라우저가 원문과 다르게 읽는 표기: 공백·역슬래시, &amp; 밖의 문자 참조(&#46; 등)
const REWRITTEN = /[\s\\]|&#|&(?!amp;)[a-z][a-z0-9]*;/i;
// . 또는 .. 경로 조각 (%2e 포함)
const DOT_SEGMENT = /(?:^|\/)(?:\.|%2e){1,2}(?:[/?#]|$)/i;

export type Problem = { line: number; section: string; message: string };

export function isAllowedSource(href: string): boolean {
  if (REWRITTEN.test(href)) return false;
  if (href.startsWith("https://")) {
    if (DOT_SEGMENT.test(href.slice("https://".length)) || !URL.canParse(href)) return false;
    // 정규화한 host+pathname으로 비교한다. 경계까지 맞아야 한다: developer.salesforce.com.example.org, github.com/salesforcefan은 거부
    const u = new URL(href);
    const rest = (u.host + u.pathname).toLowerCase();
    return SOURCE_DOMAINS.some((d) => rest.startsWith(d.toLowerCase()) && /^(?:\/|$)/.test(rest.slice(d.length)));
  }
  // 상대 링크는 ../로 한 번만 올라가 프로젝트 기록을 가리킨다. 그 뒤에 . 이나 ..가 있으면 거부한다 (Learn/·허용 폴더 밖으로 못 나감)
  // /로 시작하는 절대 경로, //, 다른 scheme은 "../"로 시작하지 않으므로 여기서 거부된다
  const path = href.startsWith("../") ? href.slice(3) : null;
  return path !== null && PROJECT_RECORDS.test(path) && !DOT_SEGMENT.test(path);
}

const classRe = (tag: string, cls: string) =>
  new RegExp(`<${tag}\\b[^>]*\\bclass="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"[^>]*>[\\s\\S]*?</${tag}>`, "g");
const hrefRe = /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

// ponytail: 정규식으로 자른다. <section>·<aside class="legacy"> 중첩은 처리하지 않는다. 중첩이 생기면 HTML 파서로 바꾼다.
export function checkLearnHtml(source: string): Problem[] {
  // 주석은 같은 길이의 공백으로 바꿔 지운다 (줄 번호와 위치가 그대로 남는다). 닫히지 않은 주석은 끝까지 주석이다
  const html = source.replace(/<!--[\s\S]*?(?:-->|$)/g, (c) => c.replace(/[^\n]/g, " "));
  const problems: Problem[] = [];
  const sections = [...html.matchAll(/<section\b([^>]*)>[\s\S]*?<\/section>/g)].map((m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    body: m[0],
    id: /\bid="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "(id 없음)",
  }));
  const add = (i: number, message: string) =>
    problems.push({
      line: html.slice(0, i).split("\n").length,
      section: sections.find((s) => s.start <= i && i < s.end)?.id ?? "(절 밖)",
      message,
    });

  const legacy = [...html.matchAll(classRe("aside", "legacy"))].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
  for (const m of html.matchAll(/root\.css|override\.css/g)) {
    const i = m.index ?? 0;
    if (!legacy.some(([a, b]) => a <= i && i < b)) add(i, `${m[0]}가 aside.legacy 밖에 있다`);
  }

  for (const s of sections) {
    const sources = [...s.body.matchAll(classRe("p", "sources"))];
    const last = sources.at(-1);
    if (!last) add(s.start, "p.sources가 없다");
    else if (s.body.slice((last.index ?? 0) + last[0].length).trim() !== "</section>")
      add(s.start + (last.index ?? 0), "p.sources가 절의 마지막 요소가 아니다");
    for (const p of sources) {
      const at = s.start + (p.index ?? 0);
      const links = [...p[0].matchAll(hrefRe)];
      if (!links.length) add(at, "p.sources에 링크가 없다");
      for (const a of links) {
        const href = a[1] ?? a[2] ?? a[3] ?? "";
        if (!isAllowedSource(href)) add(at + (a.index ?? 0), `허용되지 않은 출처: ${href}`);
      }
      if (!/확인 \d{4}-\d{2}-\d{2}/.test(p[0])) add(at, "p.sources에 '확인 YYYY-MM-DD'가 없다");
    }
  }
  return problems.sort((a, b) => a.line - b.line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL("../Learn/", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".html")).sort();
  let count = 0;
  for (const f of files)
    for (const p of checkLearnHtml(readFileSync(join(dir, f), "utf8"))) {
      console.log(`${relative(process.cwd(), join(dir, f))}:${p.line} ${p.section} ${p.message}`);
      count++;
    }
  // 폴더를 잘못 넘겨 아무것도 검사하지 않은 것을 통과로 보지 않는다
  if (!files.length) console.log(`검사할 .html 파일이 없다: ${dir}`);
  else console.log(count ? `문제 ${count}개 (파일 ${files.length}개)` : `통과 (파일 ${files.length}개)`);
  process.exitCode = count || !files.length ? 1 : 0;
}
