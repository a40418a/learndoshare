import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "../cli/context.ts";
import { runInit } from "../cli/init.ts";
import { planUpdate, runUpdate } from "../cli/update.ts";
import { sha256 } from "../lib/managed.ts";
import { buildMilvusVfCss } from "../lib/vf.ts";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const FA = "force-app/main/default";
const RES = `${FA}/staticresources`;
const BUTTON = `${FA}/lwc/milvusButton/milvusButton.js`;
const BADGE = `${FA}/lwc/milvusBadge/milvusBadge.js`;
const SETTINGS = ".claude/settings.json";
const NEW = "9.9.9";

// fn이 쓰는 stdout·stderr를 모은다. 바꿔 둔 write는 끝나면 되돌린다
async function capture<T>(fn: () => Promise<T>) {
  const out = { stdout: "", stderr: "" };
  const { stdout, stderr } = process;
  const originals = [stdout.write, stderr.write] as const;
  stdout.write = ((chunk: string | Uint8Array) => ((out.stdout += String(chunk)), true)) as typeof stdout.write;
  stderr.write = ((chunk: string | Uint8Array) => ((out.stderr += String(chunk)), true)) as typeof stderr.write;
  try {
    return { result: await fn(), ...out };
  } finally {
    [stdout.write, stderr.write] = originals;
  }
}

/** 프로젝트의 모든 파일: 상대 경로(/ 구분) → 내용 */
function snapshot(root: string): Record<string, string> {
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
  return Object.fromEntries(files.map((p) => [relative(root, p).split(sep).join("/"), readFileSync(p, "utf8")]).sort());
}

/**
 * init(--brand Acme, vf가 false면 --no-vf)으로 만든 프로젝트와 "새 버전" 패키지(이 저장소의 templates·LWC 사본)를 만들어 fn에 넘긴다.
 * 폴더 이름에 공백과 한글을 넣는다(리뷰 중점 5)
 */
async function withProject(fn: (root: string, pkg: string) => Promise<void>, o: { vf?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "밀버스 update 테스트-"));
  const pkg = mkdtempSync(join(tmpdir(), "밀버스 새 패키지-"));
  const before = process.cwd();
  try {
    writeFileSync(join(root, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }] }));
    process.chdir(root);
    const sf = async () => ({ code: 0, stdout: "{}", stderr: "" }); // 로그인 확인만 부른다
    const argv = ["--target-org", "dev", "--brand", "Acme", ...(o.vf === false ? ["--no-vf"] : [])];
    const init = await capture(() => runInit(argv, { sf, nodeVersion: "22.18.0" }));
    process.chdir(before);
    assert.equal(init.result, 0, init.stderr);
    for (const dir of ["templates", `${FA}/lwc`]) cpSync(join(pkgRoot, dir), join(pkg, dir), { recursive: true });
    await fn(root, pkg);
  } finally {
    process.chdir(before);
    rmSync(root, { recursive: true, force: true });
    rmSync(pkg, { recursive: true, force: true });
  }
}

const read = (root: string, rel: string) => readFileSync(join(root, rel), "utf8");
const write = (root: string, rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const tpl = (rel: string) => `templates/${rel}`;
async function update(root: string, pkg: string, argv: string[] = []) {
  const before = process.cwd();
  process.chdir(root);
  try {
    return await capture(() => runUpdate(argv, { pkg: { root: pkg, version: NEW } }));
  } finally {
    process.chdir(before);
  }
}

test("로컬 수정이 있으면 어떤 파일도 바뀌지 않고 1", async () => {
  await withProject(async (root, pkg) => {
    // 새 버전: 관리 파일 두 개와 settings 틀이 바뀌었다
    appendFileSync(join(pkg, BUTTON), "// 새 버전\n");
    appendFileSync(join(pkg, tpl(`${RES}/milvusBridge.css`)), "/* 새 버전 */\n");
    const settings = JSON.parse(read(pkg, tpl("claude/settings.json")));
    settings.permissions.deny.push("Bash(새 규칙)");
    write(pkg, tpl("claude/settings.json"), JSON.stringify(settings));
    // 로컬: 관리 파일 하나를 고치고, 다른 하나는 지웠다. 지운 파일은 지킬 수정이 없어 충돌이 아니다
    appendFileSync(join(root, BUTTON), "// 로컬 수정\n");
    rmSync(join(root, BADGE));

    const config = readConfig(root)!;
    const plan = planUpdate({ root, pkgRoot: pkg, config });
    assert.deepEqual(plan.conflicts.map((c) => c.path), [BUTTON]);
    assert.match(plan.conflicts[0].diff, /로컬: \/\/ 로컬 수정/);
    assert.ok(plan.replace.includes(BADGE) && plan.replace.includes(`${RES}/milvusBridge.css`), plan.replace.join(", "));

    const before = snapshot(root);
    const r = await update(root, pkg);
    assert.equal(r.result, 1, r.stdout);
    assert.ok(r.stderr.includes(BUTTON) && r.stderr.includes("--force"), r.stderr);
    assert.deepEqual(snapshot(root), before);

    // 충돌이 없어도 기존 settings.json이 깨졌으면 어떤 파일도 쓰기 전에 멈춘다
    write(root, BUTTON, read(pkgRoot, BUTTON));
    write(root, SETTINGS, "{ 깨진 JSON");
    const broken = snapshot(root);
    const b = await update(root, pkg);
    assert.equal(b.result, 1, b.stdout);
    assert.match(b.stderr, /settings\.json이 올바른 JSON이 아닙니다/);
    assert.deepEqual(snapshot(root), broken);
  });
});

test("새 버전이 더한 관리 파일 경로에 사용자 파일이 있으면 충돌이다(기록이 없어도 덮어쓰지 않는다)", async () => {
  await withProject(async (root, pkg) => {
    const added = `${FA}/lwc/milvusNew/milvusNew.js`;
    write(pkg, added, "// 패키지 원본\n");
    write(root, added, "// 사용자 파일\n");
    const before = snapshot(root);
    const r = await update(root, pkg);
    assert.equal(r.result, 1, r.stdout);
    assert.ok(r.stderr.includes(added), r.stderr);
    assert.deepEqual(snapshot(root), before);
  });
});

test("쓰는 도중 실패하면 1과 다시 실행 안내, config는 그대로이고 다시 실행하면 마친다", { skip: process.getuid?.() === 0 && "root는 파일 쓰기 권한을 무시한다" }, async () => {
  await withProject(async (root, pkg) => {
    appendFileSync(join(pkg, BADGE), "// 새 버전\n");
    appendFileSync(join(pkg, BUTTON), "// 새 버전\n");
    const config = read(root, "milvus.config.json");
    // 관리 파일은 milvusBadge → milvusButton 순서로 쓴다. 뒤의 것을 읽기 전용으로 두어 앞의 것만 바뀐 상태를 만든다
    chmodSync(join(root, BUTTON), 0o444);
    let r;
    try {
      r = await update(root, pkg);
    } finally {
      chmodSync(join(root, BUTTON), 0o644);
    }
    assert.equal(r.result, 1, r.stdout);
    assert.match(r.stderr, /일부 파일이 이미 바뀌었습니다.*pnpm milvus update를 다시 실행하면/);
    assert.equal(read(root, BADGE), read(pkg, BADGE));
    // config는 마지막에 쓴다. 앞에 쓰면 다시 실행할 때 못 쓴 파일이 "직접 고친 파일"로 거짓 충돌한다
    assert.equal(read(root, "milvus.config.json"), config);

    const again = await update(root, pkg);
    assert.equal(again.result, 0, again.stderr);
    assert.equal(read(root, BUTTON), read(pkg, BUTTON));
    assert.equal(readConfig(root)!.version, NEW);
  });
});

test("--force면 덮어쓰고 sha256 갱신", async () => {
  await withProject(async (root, pkg) => {
    appendFileSync(join(pkg, BUTTON), "// 새 버전\n");
    appendFileSync(join(root, BUTTON), "// 로컬 수정\n");
    rmSync(join(root, BADGE));

    const r = await update(root, pkg, ["--force"]);
    assert.equal(r.result, 0, r.stderr);
    assert.equal(read(root, BUTTON), read(pkg, BUTTON));
    assert.equal(read(root, BADGE), read(pkg, BADGE));
    const config = readConfig(root)!;
    assert.equal(config.version, NEW);
    assert.equal(config.managed[BUTTON], sha256(read(pkg, BUTTON)));
    // 기록한 sha256이 모두 지금 파일과 같다(check의 관리 파일 검사가 통과한다)
    for (const [file, hash] of Object.entries(config.managed)) assert.equal(sha256(readFileSync(join(root, file))), hash, file);
  });
});

test("새 패키지에서 사라진 관리 파일은 managed에서 빠지고 파일은 지우지 않는다", async () => {
  await withProject(async (root, pkg) => {
    rmSync(join(pkg, `${FA}/lwc/milvusBadge`), { recursive: true });
    const r = await update(root, pkg);
    assert.equal(r.result, 0, r.stderr);
    assert.ok(existsSync(join(root, BADGE)));
    assert.ok(!Object.keys(readConfig(root)!.managed).some((f) => f.includes("/milvusBadge/")));
    assert.ok(r.stdout.includes(BADGE), r.stdout);
  });
});

test("settings.json에 새 permissions가 더해진다", async () => {
  await withProject(async (root, pkg) => {
    const mine = JSON.parse(read(root, SETTINGS));
    mine.permissions.deny.unshift("Read(.env)");
    write(root, SETTINGS, JSON.stringify(mine, null, 2));
    const settings = JSON.parse(read(pkg, tpl("claude/settings.json")));
    settings.permissions.ask.push("Bash(새 확인 규칙 *)");
    write(pkg, tpl("claude/settings.json"), JSON.stringify(settings));

    const r = await update(root, pkg);
    assert.equal(r.result, 0, r.stderr);
    const s = JSON.parse(read(root, SETTINGS));
    assert.equal(s.permissions.deny[0], "Read(.env)");
    assert.equal(s.permissions.ask.at(-1), "Bash(새 확인 규칙 *)");
    assert.equal(s.permissions.ask.length, new Set(s.permissions.ask).size);
    assert.equal(s.hooks.PostToolUse.length, 1);
  });
});

test("milvusVf.css(생성 파일)는 템플릿으로 덮어쓰지 않는다", async () => {
  await withProject(async (root, pkg) => {
    // check가 바뀐 BRAND_COLOR로 다시 만든 팔레트
    const palette = buildMilvusVfCss("#2E7D32");
    write(root, `${RES}/milvusVf.css`, palette);
    write(pkg, tpl(`${RES}/milvusVf.css`), "/* 새 틀 */\n");

    const r = await update(root, pkg, ["--force"]);
    assert.equal(r.result, 0, r.stderr);
    assert.equal(read(root, `${RES}/milvusVf.css`), palette);
    assert.ok(!(`${RES}/milvusVf.css` in readConfig(root)!.managed));
  });
});

test("VF 없이 init한 프로젝트에는 update가 milvusHead·milvusVf를 만들지 않는다", async () => {
  await withProject(
    async (root, pkg) => {
      const r = await update(root, pkg, ["--force"]);
      assert.equal(r.result, 0, r.stderr);
      for (const f of [`${FA}/components/milvusHead.component`, `${RES}/milvusVf.css`]) assert.ok(!existsSync(join(root, f)), f);
      assert.deepEqual(Object.keys(readConfig(root)!.managed).filter((f) => /milvusHead|milvusVf/.test(f)), []);
    },
    { vf: false },
  );
});

test("소유 파일은 바뀌지 않는다", async () => {
  await withProject(async (root, pkg) => {
    const owned = [`${RES}/milvusBrand.css`, `${RES}/milvusOverride.css`, `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`];
    for (const f of owned) appendFileSync(join(root, f), "<!-- 로컬 -->\n");
    for (const f of owned.slice(0, 2)) appendFileSync(join(pkg, tpl(f)), "/* 새 틀 */\n");
    const before = Object.fromEntries(owned.map((f) => [f, read(root, f)]));

    const r = await update(root, pkg, ["--force"]);
    assert.equal(r.result, 0, r.stderr);
    assert.deepEqual(Object.fromEntries(owned.map((f) => [f, read(root, f)])), before);
  });
});
