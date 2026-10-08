// Learn/*.html 검사
// - 폐기한 설계(root.css, override.css)는 <aside class="legacy"> 안에서만 말한다
// - 모든 <section>에 p.sources가 있고, 링크는 공식 도메인이나 ../docs/research/ 아래만, "확인 YYYY-MM-DD"가 있다
// 실행: node scripts/check-learn.ts → 문제를 "파일:줄 절id 내용"으로 출력하고, 하나라도 있으면 1로 끝난다
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 새 도메인은 공식 자료일 때만 더한다. 경로가 붙은 항목(github.com/salesforce)은 그 조직 아래만 허용한다
export const SOURCE_DOMAINS = [
  "developer.salesforce.com",
  "help.salesforce.com",
  "www.lightningdesignsystem.com",
  "v1.lightningdesignsystem.com",
  "lwc.dev",
  "github.com/salesforce",
  "github.com/salesforce-ux",
  "www.npmjs.com",
  "nodejs.org",
  "www.typescriptlang.org",
  "storybook.js.org",
  "vite.dev",
  "rollupjs.org",
  "pnpm.io",
  "docs.github.com",
  "code.claude.com",
  "docs.anthropic.com",
  "www.w3.org",
  "developer.mozilla.org",
];

export type Problem = { line: number; section: string; message: string };

export function isAllowedSource(href: string): boolean {
  if (href.startsWith("https://")) {
    const rest = href.slice("https://".length);
    // 경계까지 맞아야 한다: developer.salesforce.com.example.org, github.com/salesforcefan은 거부
    return SOURCE_DOMAINS.some((d) => rest.startsWith(d) && /^([/?#]|$)/.test(rest.slice(d.length)));
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return false;
  // 상대 링크는 Learn/ 기준으로 풀어서 docs/research/ 아래에 남는지 본다 (../로 빠져나가는 것 거부)
  return new URL(href, "https://repo.invalid/root/Learn/").pathname.startsWith("/root/docs/research/");
}

const classRe = (tag: string, cls: string) =>
  new RegExp(`<${tag}\\b[^>]*\\bclass="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"[^>]*>[\\s\\S]*?</${tag}>`, "g");

// ponytail: 정규식으로 자른다. <section>·<aside class="legacy"> 중첩은 처리하지 않는다. 중첩이 생기면 HTML 파서로 바꾼다.
export function checkLearnHtml(html: string): Problem[] {
  const problems: Problem[] = [];
  const sections = [...html.matchAll(/<section\b([^>]*)>[\s\S]*?<\/section>/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    body: m[0],
    id: /\bid="([^"]*)"/.exec(m[1])?.[1] ?? "(id 없음)",
  }));
  const add = (i: number, message: string) =>
    problems.push({
      line: html.slice(0, i).split("\n").length,
      section: sections.find((s) => s.start <= i && i < s.end)?.id ?? "(절 밖)",
      message,
    });

  const legacy = [...html.matchAll(classRe("aside", "legacy"))].map((m) => [m.index, m.index + m[0].length]);
  for (const m of html.matchAll(/root\.css|override\.css/g))
    if (!legacy.some(([a, b]) => a <= m.index && m.index < b)) add(m.index, `${m[0]}가 aside.legacy 밖에 있다`);

  for (const s of sections) {
    const sources = [...s.body.matchAll(classRe("p", "sources"))];
    if (!sources.length) add(s.start, "p.sources가 없다");
    for (const p of sources) {
      const at = s.start + p.index;
      const links = [...p[0].matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)];
      if (!links.length) add(at, "p.sources에 링크가 없다");
      for (const a of links) if (!isAllowedSource(a[1])) add(at + a.index, `허용되지 않은 출처: ${a[1]}`);
      if (!/확인 \d{4}-\d{2}-\d{2}/.test(p[0])) add(at, "p.sources에 '확인 YYYY-MM-DD'가 없다");
    }
  }
  return problems.sort((a, b) => a.line - b.line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = fileURLToPath(new URL("../Learn/", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".html")).sort();
  let count = 0;
  for (const f of files)
    for (const p of checkLearnHtml(readFileSync(join(dir, f), "utf8"))) {
      console.log(`Learn/${f}:${p.line} ${p.section} ${p.message}`);
      count++;
    }
  console.log(count ? `문제 ${count}개 (파일 ${files.length}개)` : `통과 (파일 ${files.length}개)`);
  process.exitCode = count ? 1 : 0;
}
