/**
 * force-app의 밀버스 화면 컴포넌트를 Storybook에 등록한다(설계 docs/specs/2026-10-26-milvus-story-sync-design.md).
 *
 * 만드는 것 (출력 폴더, 저장소에서는 stories/milvus-generated/, 커밋하지 않음):
 *   entry.js           컴포넌트마다 export 한 줄. stories/lwc-entry.js가 다시 내보낸다
 *   <이름>.stories.js  손으로 쓴 stories/components/milvus/<이름>.stories.(js|ts)가 없는 컴포넌트의 기본 스토리
 *
 * 사용: pnpm build:lwc 가 먼저 실행하고, prepack이 패키지에 넣을 생성물을 만든다.
 *   node scripts/generate-milvus-stories.ts [출력 폴더]   (기본 stories/milvus-generated)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  entrySource,
  findMilvusComponents,
  GENERATED_MARK,
  GenerateError,
  hasHandStory,
  loadComponent,
  storySource,
} from "../lib/milvus-stories.ts";

// 출력 폴더를 지워도 되는 경우만 통과시킨다. 없거나, 비었거나, entry.js 첫 줄이 표시 주석이어야 한다.
// 카탈로그 폴더에도 entry.js가 있어서 파일 이름이 아니라 첫 줄로 구별한다(카탈로그 생성기의 assertErasable과 같은 보호)
function assertErasable(dir: string): void {
  if (!existsSync(dir)) return;
  if (statSync(dir).isDirectory()) {
    const files = readdirSync(dir);
    if (files.length === 0) return;
    if (files.includes("entry.js") && readFileSync(join(dir, "entry.js"), "utf8").split(/\r?\n/)[0] === GENERATED_MARK) return;
  }
  throw new GenerateError(`출력 위치가 비어 있지 않고 밀버스 스토리 생성기가 만든 폴더도 아니다. 지우지 않는다: ${dir}`);
}

export function generateMilvusStories(o: { lwcDir: string; handStoriesDir: string; out: string }): { components: number; stories: number } {
  const components = findMilvusComponents(o.lwcDir);
  const handFiles = existsSync(o.handStoriesDir) ? readdirSync(o.handStoriesDir) : [];
  assertErasable(o.out);
  rmSync(o.out, { recursive: true, force: true });
  mkdirSync(o.out, { recursive: true });
  writeFileSync(join(o.out, "entry.js"), entrySource(components));
  let stories = 0;
  for (const names of components) {
    if (hasHandStory(handFiles, names.storyName)) continue;
    writeFileSync(join(o.out, `${names.storyName}.stories.js`), storySource(loadComponent(o.lwcDir, names)));
    stories++;
  }
  return { components: components.length, stories };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] ?? "stories/milvus-generated";
  try {
    const { components, stories } = generateMilvusStories({
      lwcDir: resolve("force-app/main/default/lwc"),
      handStoriesDir: resolve("stories/components/milvus"),
      out: resolve(out),
    });
    console.log(`✓ 밀버스 스토리: 컴포넌트 ${components}개, 기본 스토리 ${stories}개 → ${out}/`);
  } catch (e) {
    // 이름 규칙 위반과 지우기 거부만 한국어 오류로 끝낸다. 그 밖의 오류는 스택과 함께 그대로 낸다
    if (!(e instanceof GenerateError)) throw e;
    console.error(e.message);
    process.exitCode = 1;
  }
}
