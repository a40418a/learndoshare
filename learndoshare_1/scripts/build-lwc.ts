/**
 * 저장소 Storybook용 LWC 번들을 dist/lwc에 만든다. Storybook은 @milvus/lwc alias로 읽는다.
 * 사용: pnpm build:lwc (카탈로그 생성기가 먼저 stories/slds-catalog/를 만든다)
 */
import { readFileSync } from "node:fs";
import { buildLwc, catalogModules, lightningBaseComponentsDir, sfdxLwcModules } from "../lib/lwc-build.ts";

// generate-slds-catalog.ts가 쓴 폴더와 같다. examples.json의 rel은 이 폴더 기준이다
const lbcDir = lightningBaseComponentsDir();
const examples = JSON.parse(readFileSync("stories/slds-catalog/examples.json", "utf8"));

await buildLwc({
  out: "dist/lwc",
  entries: { index: "stories/lwc-entry.js", catalog: "stories/slds-catalog/entry.js" },
  modules: [...sfdxLwcModules("."), ...catalogModules(examples, lbcDir)]
});
console.log("✓ LWC 빌드: dist/lwc/");
