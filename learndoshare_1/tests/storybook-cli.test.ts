import { after, test } from "node:test";
import assert from "node:assert/strict";
import type { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLwc, lightningBaseComponentsDir } from "../lib/lwc-build.ts";
import { planStorybook, runStorybook } from "../cli/storybook.ts";

const repo = fileURLToPath(new URL("..", import.meta.url));
// 폴더 이름에 공백과 한글을 넣는다(리뷰 중점 5). 결과물은 임시 폴더에만 쓴다
const tmp = mkdtempSync(join(tmpdir(), "밀버스 storybook 테스트-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

let n = 0;
const dir = (name: string) => join(tmp, `${name} ${++n}`);

// 설치된 패키지 흉내. 카탈로그(stories/slds-catalog)는 생성물이라 저장소에 없을 수 있으므로 예제 하나짜리를 직접 둔다.
// light면 진입 파일이 비어 있어 번들이 바로 끝난다. 아니면 저장소의 lwc-entry.js와 accordion 예제를 컴파일한다.
// Rollup이 @lwc/*를 찾도록 node_modules는 저장소 것을 잇는다
function makePkg(o: { light?: boolean } = {}): string {
  const pkg = dir("패키지");
  mkdirSync(join(pkg, ".storybook"), { recursive: true });
  mkdirSync(join(pkg, "stories/slds-catalog"), { recursive: true });
  writeFileSync(join(pkg, "stories/lwc-entry.js"), o.light ? "export {};\n" : readFileSync(join(repo, "stories/lwc-entry.js")));
  writeFileSync(join(pkg, "stories/slds-catalog/entry.js"), o.light ? "export {};\n" : 'export { default as accordionBasic } from "accordion/basic";\n');
  writeFileSync(join(pkg, "stories/slds-catalog/examples.json"), JSON.stringify([{ name: "accordion/basic", rel: "accordion/__examples__/basic/basic.js" }]));
  // @lwc/module-resolver가 진입 파일에서 위로 package.json을 찾는다
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "fake-milvus-pkg", type: "module" }));
  symlinkSync(join(repo, "node_modules"), join(pkg, "node_modules"), "junction");
  return pkg;
}

// milvus init을 마친 고객 프로젝트 흉내: 밀버스 LWC가 force-app에 있고 milvus.config.json이 있다
function makeProject(o: { config?: boolean } = {}): string {
  const root = dir("고객 프로젝트");
  const lwc = join(root, "force-app/main/default/lwc");
  mkdirSync(lwc, { recursive: true });
  cpSync(join(repo, "force-app/main/default/lwc"), lwc, { recursive: true, filter: (p) => /lwc$|milvus/.test(p) && !p.includes("__tests__") });
  writeFileSync(join(root, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }] }));
  // SFDX 프로젝트는 package.json이 있다(init이 scripts.storybook을 더한다). @lwc/module-resolver가 LWC 파일에서 위로 이 파일을 찾는다
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "customer-app", scripts: {} }));
  if (o.config !== false) {
    writeFileSync(join(root, "milvus.config.json"), JSON.stringify({ version: "0.0.1", targetOrg: "dev", brand: "Acme", vf: true, managed: {} }));
  }
  return root;
}

// 가짜 spawn: 호출을 기록하고 바로 code로 끝난다
function fakeSpawn(code: number | null) {
  const calls: { command: string; args: string[]; options: { cwd?: string; env?: Record<string, string>; stdio?: unknown } }[] = [];
  const fn = ((command: string, args: string[], options: object) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    setImmediate(() => child.emit("close", code, null));
    return child;
  }) as unknown as typeof spawn;
  return Object.assign(fn, { calls });
}

async function capture<T>(run: () => Promise<T>) {
  const out = { stdout: "", stderr: "" };
  const { stdout, stderr } = process;
  const originals = [stdout.write, stderr.write] as const;
  // 러너는 Buffer로 테스트 이벤트를 stdout에 쓴다. 빌드처럼 오래 걸리는 동안 삼키지 않도록 문자열만 가로챈다
  const grab = (key: "stdout" | "stderr", original: typeof stdout.write) =>
    ((chunk: string | Uint8Array, ...rest: unknown[]) =>
      typeof chunk === "string" ? ((out[key] += chunk), true) : (original as Function).call(process[key], chunk, ...rest)) as typeof stdout.write;
  stdout.write = grab("stdout", originals[0]);
  stderr.write = grab("stderr", originals[1]);
  try {
    return { result: await run(), ...out };
  } finally {
    [stdout.write, stderr.write] = originals;
  }
}

test("공백·한글 경로가 args에 하나의 원소로 들어간다", () => {
  const pkgRoot = makePkg();
  const root = makeProject();
  const dev = planStorybook({ root, pkgRoot });
  assert.equal(dev.command, process.execPath);
  assert.ok(existsSync(dev.args[0]), `storybook bin이 있어야 한다: ${dev.args[0]}`);
  assert.deepEqual(dev.args.slice(1), ["dev", "-c", realpathSync(join(pkgRoot, ".storybook"))]);
  assert.deepEqual(dev.env, { MILVUS_PROJECT_DIR: root });
  assert.match(dev.args[3], /패키지 \d+/);

  const build = planStorybook({ root, pkgRoot, build: ".milvus/storybook-static" });
  assert.deepEqual(build.args.slice(1), ["build", "-c", realpathSync(join(pkgRoot, ".storybook")), "-o", join(root, ".milvus/storybook-static")]);
  assert.match(build.args[5], /고객 프로젝트 \d+/);
});

test("LWC 출력이 <root>/.milvus/lwc이고 modules에 c/milvusBadge와 카탈로그 모듈이 있다", () => {
  const pkgRoot = makePkg();
  const root = makeProject();
  const { lwc } = planStorybook({ root, pkgRoot });
  assert.equal(lwc.out, join(root, ".milvus/lwc"));
  // 고객 프로젝트에서는 npm 모듈을 이름이 아니라 패키지에서 찾은 경로로 해석해야 한다(pnpm은 고객 루트에 두지 않는다)
  assert.equal(lwc.npmFromPackage, true);
  const byName = new Map(lwc.modules.map((m) => [m.name, m.path]));
  assert.equal(byName.get("c/milvusBadge"), join(root, "force-app/main/default/lwc/milvusBadge/milvusBadge.js"));
  assert.equal(byName.get("accordion/basic"), join(lightningBaseComponentsDir(), "accordion/__examples__/basic/basic.js"));
});

test("entries에 index와 catalog가 있다", () => {
  const pkgRoot = makePkg();
  const { lwc } = planStorybook({ root: makeProject(), pkgRoot });
  assert.deepEqual(lwc.entries, { index: join(pkgRoot, "stories/lwc-entry.js"), catalog: join(pkgRoot, "stories/slds-catalog/entry.js") });
});

test("plan 그대로 buildLwc를 하면 프로젝트 LWC와 카탈로그 예제가 .milvus/lwc에 번들된다", async () => {
  const root = makeProject();
  await buildLwc(planStorybook({ root, pkgRoot: makePkg() }).lwc);
  const files = readdirSync(join(root, ".milvus/lwc"));
  assert.ok(files.includes("index.js") && files.includes("catalog.js"), files.join(", "));
  const index = readFileSync(join(root, ".milvus/lwc/index.js"), "utf8");
  assert.match(index, /export \{[^}]*MilvusBadge/);
});

test("runStorybook은 LWC를 빌드한 뒤 프로젝트 루트에서 storybook dev를 실행하고 종료 코드를 그대로 돌려준다", async () => {
  const root = makeProject();
  const spawnFn = fakeSpawn(3);
  const { result, stdout } = await capture(() => runStorybook([], { spawn: spawnFn, cwd: join(root, "force-app"), pkgRoot: makePkg({ light: true }) }));
  assert.equal(result, 3);
  assert.ok(existsSync(join(root, ".milvus/lwc/index.js")), "spawn 전에 LWC 번들이 있어야 한다");
  assert.equal(spawnFn.calls.length, 1);
  const [{ command, args, options }] = spawnFn.calls;
  assert.equal(command, process.execPath);
  assert.equal(args[1], "dev");
  assert.equal(options.cwd, root);
  assert.equal(options.env?.MILVUS_PROJECT_DIR, root);
  assert.equal(options.stdio, "inherit");
  assert.match(stdout, /LWC 빌드/);
});

test("build는 정적 빌드 출력을 프로젝트의 .milvus/storybook-static으로 보낸다", async () => {
  const root = makeProject();
  const spawnFn = fakeSpawn(0);
  const pkgRoot = makePkg({ light: true });
  for (const argv of [["build"], ["--build"]]) {
    spawnFn.calls.length = 0;
    const { result, stderr } = await capture(() => runStorybook(argv, { spawn: spawnFn, cwd: root, pkgRoot }));
    assert.equal(result, 0, stderr);
    const { args } = spawnFn.calls[0];
    assert.deepEqual([args[1], ...args.slice(-2)], ["build", "-o", join(root, ".milvus/storybook-static")]);
  }
});

test("프로젝트가 없거나 milvus.config.json이 없으면 한국어 오류와 init 안내를 내고 실행하지 않는다", async () => {
  const spawnFn = fakeSpawn(0);
  const pkgRoot = makePkg({ light: true });
  const noProject = await capture(() => runStorybook([], { spawn: spawnFn, cwd: dir("빈 폴더"), pkgRoot }));
  const noConfig = await capture(() => runStorybook([], { spawn: spawnFn, cwd: makeProject({ config: false }), pkgRoot }));
  assert.equal(noProject.result, 1);
  assert.match(noProject.stderr, /sfdx-project\.json.*milvus init/s);
  assert.equal(noConfig.result, 1);
  assert.match(noConfig.stderr, /milvus\.config\.json이 없습니다.*milvus init/s);
  assert.equal(spawnFn.calls.length, 0);
});

test("알 수 없는 인자는 사용법과 1", async () => {
  const out = await capture(() => runStorybook(["--nope"], { spawn: fakeSpawn(0) }));
  assert.equal(out.result, 1);
  assert.match(out.stderr, /사용법: pnpm milvus storybook/);
});
