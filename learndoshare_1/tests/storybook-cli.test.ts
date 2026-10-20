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
function makePkg(o: { light?: boolean; broken?: boolean } = {}): string {
  const pkg = dir("패키지");
  mkdirSync(join(pkg, ".storybook"), { recursive: true });
  mkdirSync(join(pkg, "stories/slds-catalog"), { recursive: true });
  // broken: 없는 파일을 import해 LWC 빌드가 실패한다
  const entry = o.broken ? 'import "./없는 파일.js";\n' : o.light ? "export {};\n" : readFileSync(join(repo, "stories/lwc-entry.js"));
  writeFileSync(join(pkg, "stories/lwc-entry.js"), entry);
  // 진입 파일이 상대 경로로 import하는 스토리 전용 예시 컴포넌트(패키지에는 stories 폴더째 들어간다)
  if (!o.light && !o.broken) cpSync(join(repo, "stories/lwc"), join(pkg, "stories/lwc"), { recursive: true });
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

// 가짜 spawn: 호출을 기록하고 end대로 끝난다. hold면 신호를 받을 때까지 끝나지 않는다(kill하면 그 신호로 끝난 것처럼 close한다)
type End = { code?: number | null; signal?: NodeJS.Signals | null; error?: Error; hold?: boolean };
function fakeSpawn(end: End = { code: 0 }) {
  const calls: { command: string; args: string[]; options: { cwd?: string; env?: Record<string, string>; stdio?: unknown } }[] = [];
  const children: (EventEmitter & { signals: string[] })[] = [];
  const fn = ((command: string, args: string[], options: object) => {
    calls.push({ command, args, options });
    const child = Object.assign(new EventEmitter(), {
      signals: [] as string[],
      kill(this: EventEmitter & { signals: string[] }, signal: string) {
        this.signals.push(signal);
        this.emit("close", null, signal);
        return true;
      }
    });
    children.push(child);
    if (end.error) setImmediate(() => child.emit("error", end.error));
    else if (!end.hold) setImmediate(() => child.emit("close", end.code ?? null, end.signal ?? null));
    return child;
  }) as unknown as typeof spawn;
  return Object.assign(fn, { calls, children });
}

const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
// 신호 핸들러가 빠지면 가짜 자식이 영영 끝나지 않으므로 기한을 둔다
const within = <T>(run: Promise<T>, ms = 5000) => Promise.race([run, delay(ms).then(() => Promise.reject(new Error(`${ms}ms 안에 끝나지 않았다`)))]);
async function untilSpawned(spawnFn: { calls: unknown[] }) {
  while (spawnFn.calls.length === 0) await delay(10);
}
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
const listeners = () => SIGNALS.map((signal) => process.listenerCount(signal));

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
  // dev 서버는 localhost에만 연다(인자가 없으면 모든 인터페이스에 열려 같은 네트워크에서 /@fs/로 고객 소스를 읽는다)
  assert.deepEqual(dev.args.slice(1), ["dev", "-c", realpathSync(join(pkgRoot, ".storybook")), "--host", "localhost"]);
  assert.deepEqual(dev.env, { MILVUS_PROJECT_DIR: realpathSync(root) });
  assert.match(dev.args[3], /패키지 \d+/);

  const build = planStorybook({ root, pkgRoot, build: ".milvus/storybook-static" });
  assert.deepEqual(build.args.slice(1), ["build", "-c", realpathSync(join(pkgRoot, ".storybook")), "-o", join(root, ".milvus/storybook-static")]);
  assert.match(build.args[5], /고객 프로젝트 \d+/);
  assert.ok(!build.args.includes("--host"), "정적 빌드에는 서버가 없다");
});

test("-c와 MILVUS_PROJECT_DIR는 심볼릭 링크를 풀어 준 실경로다", () => {
  const pkgRoot = makePkg();
  const root = makeProject();
  const pkgLink = dir("패키지 링크");
  const rootLink = dir("프로젝트 링크");
  symlinkSync(pkgRoot, pkgLink, "junction");
  symlinkSync(root, rootLink, "junction");
  const { args, env } = planStorybook({ root: rootLink, pkgRoot: pkgLink });
  assert.equal(args[3], realpathSync(join(pkgRoot, ".storybook")));
  assert.notEqual(args[3], join(pkgLink, ".storybook"));
  assert.equal(env.MILVUS_PROJECT_DIR, realpathSync(root));
  assert.notEqual(env.MILVUS_PROJECT_DIR, rootLink);
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

const baseline = listeners();

test("runStorybook은 LWC를 빌드한 뒤 프로젝트 루트에서 storybook dev를 실행하고 종료 코드를 그대로 돌려준다", async () => {
  const root = makeProject();
  const spawnFn = fakeSpawn({ code: 3 });
  const { result, stdout } = await capture(() => runStorybook([], { spawn: spawnFn, cwd: join(root, "force-app"), pkgRoot: makePkg({ light: true }) }));
  assert.equal(result, 3);
  assert.ok(existsSync(join(root, ".milvus/lwc/index.js")), "spawn 전에 LWC 번들이 있어야 한다");
  assert.equal(spawnFn.calls.length, 1);
  const [{ command, args, options }] = spawnFn.calls;
  assert.equal(command, process.execPath);
  assert.equal(args[1], "dev");
  assert.equal(options.cwd, root);
  assert.equal(options.env?.MILVUS_PROJECT_DIR, realpathSync(root));
  assert.equal(options.stdio, "inherit");
  assert.match(stdout, /LWC 빌드/);
  assert.deepEqual(listeners(), baseline, "끝나면 신호 핸들러를 풀어야 한다");
});

test("build는 정적 빌드 출력을 프로젝트의 .milvus/storybook-static으로 보낸다", async () => {
  const root = makeProject();
  const spawnFn = fakeSpawn();
  const pkgRoot = makePkg({ light: true });
  for (const argv of [["build"], ["--build"]]) {
    spawnFn.calls.length = 0;
    const { result, stderr } = await capture(() => runStorybook(argv, { spawn: spawnFn, cwd: root, pkgRoot }));
    assert.equal(result, 0, stderr);
    const { args } = spawnFn.calls[0];
    assert.deepEqual([args[1], ...args.slice(-2)], ["build", "-o", join(root, ".milvus/storybook-static")]);
  }
});

test("LWC 빌드가 실패하면 Storybook을 실행하지 않고 1을 돌려준다", async () => {
  const spawnFn = fakeSpawn();
  const { result, stderr } = await capture(() => runStorybook([], { spawn: spawnFn, cwd: makeProject(), pkgRoot: makePkg({ broken: true }) }));
  assert.equal(result, 1);
  assert.match(stderr, /milvus storybook 실패.*없는 파일\.js/s);
  assert.equal(spawnFn.calls.length, 0);
});

test("spawn error는 한국어 오류와 1, close의 code가 null이고 신호도 없으면 1", async () => {
  const [root, pkgRoot] = [makeProject(), makePkg({ light: true })];
  const failed = await capture(() => runStorybook([], { spawn: fakeSpawn({ error: new Error("spawn ENOENT") }), cwd: root, pkgRoot }));
  assert.equal(failed.result, 1);
  assert.match(failed.stderr, /Storybook을 실행하지 못했습니다: spawn ENOENT/);
  assert.equal((await capture(() => runStorybook([], { spawn: fakeSpawn({ code: null }), cwd: root, pkgRoot }))).result, 1);
  assert.deepEqual(listeners(), baseline, "error 뒤에도 신호 핸들러를 풀어야 한다");
});

test("SIGTERM·SIGHUP은 자식에게 넘기고 128+번호로 끝난다. 끝나면 핸들러를 푼다", async () => {
  const [root, pkgRoot] = [makeProject(), makePkg({ light: true })];
  for (const [signal, code] of [["SIGTERM", 143], ["SIGHUP", 129]] as const) {
    const spawnFn = fakeSpawn({ hold: true });
    const running = capture(() => runStorybook([], { spawn: spawnFn, cwd: root, pkgRoot }));
    await within(untilSpawned(spawnFn));
    process.emit(signal);
    assert.equal((await within(running)).result, code);
    assert.deepEqual(spawnFn.children[0].signals, [signal]);
    assert.deepEqual(listeners(), baseline);
  }
});

test("SIGINT는 자식에게 다시 보내지 않고(터미널이 이미 보냈다) 부모는 자식이 끝날 때까지 산다", async () => {
  const spawnFn = fakeSpawn({ hold: true });
  let settled = false;
  const running = capture(() => runStorybook([], { spawn: spawnFn, cwd: makeProject(), pkgRoot: makePkg({ light: true }) }));
  void running.then(() => (settled = true));
  await within(untilSpawned(spawnFn));
  process.emit("SIGINT");
  await delay(30);
  assert.equal(settled, false);
  assert.deepEqual(spawnFn.children[0].signals, []);
  spawnFn.children[0].emit("close", null, "SIGINT"); // 터미널의 SIGINT로 자식이 끝났다
  assert.equal((await within(running)).result, 130);
  assert.deepEqual(listeners(), baseline);
});

test("프로젝트가 없거나 milvus.config.json이 없으면 한국어 오류와 init 안내를 내고 실행하지 않는다", async () => {
  const spawnFn = fakeSpawn();
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
  const out = await capture(() => runStorybook(["--nope"], { spawn: fakeSpawn() }));
  assert.equal(out.result, 1);
  assert.match(out.stderr, /사용법: pnpm milvus storybook/);
});
