// 10/9 결정 D1: 밀버스 LWC는 JS다(org가 .ts LWC를 타입 검사해 배포를 거부했다). D3: 앱 전체 브랜드용 milvusBrandLoader
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const lwc = join(root, "force-app/main/default/lwc");
const bundles = readdirSync(lwc, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.startsWith("milvus"))
  .map((e) => e.name);
const loader = (file: string) => readFileSync(join(lwc, "milvusBrandLoader", file), "utf8");

test("lwc/milvus* 아래(__tests__ 포함)에 .ts 파일이 없고 번들마다 <이름>.js가 있다", () => {
  const ts = bundles.flatMap((b) =>
    readdirSync(join(lwc, b), { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `${b}/${f}`)
  );
  assert.deepEqual(ts, []);
  assert.deepEqual(bundles.filter((b) => !existsSync(join(lwc, b, `${b}.js`))), []);
  assert.ok(bundles.includes("milvusBrandLoader"), bundles.join(", "));
});

test("milvusBrandLoader: targets는 lightning__UtilityBar 하나, isExposed true, 템플릿은 비어 있다", () => {
  const meta = loader("milvusBrandLoader.js-meta.xml");
  assert.deepEqual([...meta.matchAll(/<target>\s*([^<]*?)\s*<\/target>/g)].map((m) => m[1]), ["lightning__UtilityBar"]);
  assert.match(meta, /<isExposed>\s*true\s*<\/isExposed>/);
  assert.equal(loader("milvusBrandLoader.html").trim(), "<template></template>");
});

test("milvusBrandLoader.js는 c/milvusScript의 loadBrand를 import해 connectedCallback에서 loadBrand(this)를 부른다", () => {
  const js = loader("milvusBrandLoader.js");
  assert.match(js, /import\s*\{\s*loadBrand\s*\}\s*from\s*["']c\/milvusScript["']/);
  assert.match(js, /connectedCallback\s*\(\s*\)\s*\{\s*loadBrand\(this\);?\s*\}/);
});

test("tsconfig.lwc.base.json, lwc-platform.d.ts, lwc/tsconfig.json, templates의 lwc/tsconfig.json이 없다", () => {
  const gone = [
    "tsconfig.lwc.base.json",
    "lwc-platform.d.ts",
    "force-app/main/default/lwc/tsconfig.json",
    "templates/force-app/main/default/lwc/tsconfig.json"
  ];
  assert.deepEqual(gone.filter((f) => existsSync(join(root, f))), []);
});
