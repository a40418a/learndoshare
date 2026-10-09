import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addKeyIfMissing, appendLines, mergeSettings } from "../lib/merge.ts";

type Settings = {
  permissions: { allow: string[]; ask: string[]; deny: string[] };
  hooks: Record<string, { matcher: string; hooks: { type: string; command: string }[] }[]>;
  model?: string;
};

// init이 병합하는 실제 조각(설계 7.2)
const fragment = JSON.parse(readFileSync(new URL("../templates/claude/settings.json", import.meta.url), "utf8"));
const MILVUS_HOOK = fragment.hooks.PostToolUse[0].hooks[0].command;

// 사용자가 이미 쓰던 설정. 밀버스 ask 한 줄이 사용자 순서 가운데에 이미 있다
const userSettings = () => ({
  model: "opus",
  permissions: {
    allow: ["Bash(pnpm test *)", "Read(./**)"],
    ask: ["Bash(git push *)", "Bash(sf apex run *)", "Bash(rm *)"],
  },
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./guard.sh" }] }],
    PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "pnpm exec prettier --write" }] }],
  },
});

test("기존 permissions.allow와 hooks를 지우지 않고 밀버스 항목을 더한다", () => {
  const existing = userSettings();
  const merged = mergeSettings(existing, fragment) as Settings;

  assert.equal(merged.model, "opus");
  assert.deepEqual(merged.permissions.allow, ["Bash(pnpm test *)", "Read(./**)"]);
  // 사용자 순서는 그대로, 이미 있던 "Bash(sf apex run *)"는 다시 넣지 않고, 나머지 밀버스 항목은 뒤에 붙는다
  assert.deepEqual(merged.permissions.ask.slice(0, 3), ["Bash(git push *)", "Bash(sf apex run *)", "Bash(rm *)"]);
  assert.deepEqual(
    merged.permissions.ask.slice(3),
    fragment.permissions.ask.filter((r: string) => r !== "Bash(sf apex run *)"),
  );
  assert.deepEqual(merged.permissions.deny, fragment.permissions.deny);
  assert.deepEqual(merged.hooks.PreToolUse, existing.hooks.PreToolUse);
  assert.deepEqual(merged.hooks.PostToolUse, [existing.hooks.PostToolUse[0], fragment.hooks.PostToolUse[0]]);
  // 입력은 바꾸지 않는다
  assert.deepEqual(existing, userSettings());
});

test("hook은 같은 command가 이미 있으면 matcher가 달라도 넣지 않는다", () => {
  const existing = { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: MILVUS_HOOK }] }] } };
  assert.deepEqual(mergeSettings(existing, fragment).hooks, existing.hooks);
});

test("같은 fragment를 두 번 병합해도 결과가 같다", () => {
  for (const existing of [undefined, userSettings()]) {
    const once = mergeSettings(existing, fragment);
    // 키 순서까지 같아야 파일이 바뀌지 않는다
    assert.equal(JSON.stringify(mergeSettings(once, fragment)), JSON.stringify(once));
  }
  assert.deepEqual(mergeSettings(undefined, fragment), fragment);
});

test("appendLines는 이미 있는 .npmrc 줄을 다시 넣지 않는다", () => {
  const lines = ["@a40418a:registry=https://npm.pkg.github.com", "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}"];
  const npmrc = "auto-install-peers=true\n@a40418a:registry=https://npm.pkg.github.com"; // 끝 줄바꿈 없음

  const once = appendLines(npmrc, lines);
  assert.equal(once, `${npmrc}\n${lines[1]}\n`);
  assert.equal(appendLines(once, lines), once);
  assert.equal(appendLines(undefined, lines), `${lines.join("\n")}\n`);
  // CRLF 파일은 CRLF로 잇는다
  assert.equal(appendLines("a\r\n", ["b"]), "a\r\nb\r\n");
});

test("addKeyIfMissing은 없을 때만 더하고, 점 경로는 안쪽 객체에 더한다", () => {
  const project = { packageDirectories: [{ path: "force-app", default: true }] };
  assert.deepEqual(addKeyIfMissing(project, "defaultLwcLanguage", "typescript"), { ...project, defaultLwcLanguage: "typescript" });
  const js = { ...project, defaultLwcLanguage: "javascript" };
  assert.equal(addKeyIfMissing(js, "defaultLwcLanguage", "typescript"), js);

  const pkg = { name: "p", scripts: { test: "jest" } };
  assert.deepEqual(addKeyIfMissing(pkg, "scripts.storybook", "milvus storybook").scripts, { test: "jest", storybook: "milvus storybook" });
  assert.deepEqual(addKeyIfMissing({ name: "p" }, "scripts.storybook", "milvus storybook"), { name: "p", scripts: { storybook: "milvus storybook" } });
  const mine = { scripts: { storybook: "storybook dev" } };
  assert.equal(addKeyIfMissing(mine, "scripts.storybook", "milvus storybook"), mine);
  assert.deepEqual(pkg, { name: "p", scripts: { test: "jest" } }); // 입력은 바꾸지 않는다
});
