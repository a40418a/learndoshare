// brands/*/util.css를 util.css 규칙(lib/rules.ts, 설계 5.2·5.3)으로 검사한다. 사용: node scripts/check-brands.ts (pnpm test에 포함)
// 브랜드 색(accent 계열)은 org 테마가 원본이라 막는다. 읽는 곳이 없는 이름은 아무 효과 없이 지나가므로 막는다
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuleContext } from "../lib/hooks-index.ts";
import { checkUtilCss } from "../lib/rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const ctx = loadRuleContext({ pkgRoot: root });
const issues = readdirSync(join(root, "brands"))
  .map((brand) => `brands/${brand}/util.css`)
  .filter((file) => existsSync(join(root, file)))
  .flatMap((file) => checkUtilCss(readFileSync(join(root, file), "utf8"), file, ctx));

if (issues.length) {
  console.error(issues.map((i) => `${i.file}  ${i.message}${i.fix ? ` → 제안: ${i.fix}` : ""}`).join("\n"));
  process.exit(1);
}
console.log("✓ brands 검사: util.css가 설계 5.2·5.3 규칙(:root의 허용된 hook, 읽는 곳이 있는 이름, 대비 4.5:1)을 지킴");
