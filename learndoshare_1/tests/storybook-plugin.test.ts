import { after, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request, createServer as createHttpServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { writeBrandingSet } from "../lib/branding.ts";
import { brandPalette } from "../lib/palette.ts";
import { brandsFromProject, brandsFromRepo, isLocal, milvusStorybookPlugin } from "../lib/storybook-plugin.ts";

const repo = fileURLToPath(new URL("..", import.meta.url));
const FA = "force-app/main/default";
const RES = `${FA}/staticresources`;
const config = { version: "0.0.1", targetOrg: "dev", brand: "Acme", vf: true, managed: {} };
const temps: string[] = [];
// 테스트가 중간에 실패해도 서버가 남아 프로세스가 끝나지 않는 일이 없게, 연 서버를 모두 여기서 한 번 더 닫는다
const servers = new Set<() => Promise<void>>();
after(async () => {
  for (const close of servers) await close();
  temps.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

// 경로에 공백과 한글을 넣는다(리뷰 중점 5). 로고는 --from-org처럼 자산 이름이 <브랜드>Logo가 아니다(R26)
function project(o: { util?: string; brandingSet?: boolean; logo?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "milvus sb 프로젝트-"));
  temps.push(dir);
  const file = (rel: string, content: string | Buffer) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  };
  file("milvus.config.json", JSON.stringify(config));
  file(`${RES}/milvusBrand.css`, o.util ?? ":root {\n  --slds-g-radius-border-2: 0;\n}\n");
  file(`${RES}/milvusBridge.css`, "/* 브리지 */");
  file(`${RES}/milvusOverride.css`, "/* override */");
  if (o.brandingSet !== false) {
    const xml = writeBrandingSet({ name: "Acme", brandColor: "#2E7D32", logo: o.logo });
    file(`${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`, xml.replace("/file-asset/AcmeLogo?v=1", "/file-asset/Org_logo_7?v=3"));
  }
  if (o.logo) {
    file(`${FA}/contentassets/Org_logo_7.asset`, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    file(`${FA}/contentassets/Org_logo_7.asset-meta.xml`, "<ContentAsset><versions><version><number>3</number><pathOnClient>회사 로고.png</pathOnClient></version></versions></ContentAsset>");
  }
  return dir;
}

// 실제 Vite 개발 서버(middlewareMode)에 플러그인을 걸고 HTTP로 부른다. Host·Origin 헤더를 직접 정한다.
// allowedHosts: true는 Storybook이 --host 0.0.0.0일 때 쓰는 값이다. Vite의 Host 검사를 끄고 플러그인의 검사만 확인한다.
// ws: false는 middlewareMode의 HMR 웹소켓 서버(기본 24678번 포트)를 만들지 않게 한다. 감시자는 watch: null로 끈다
async function serve(o: Parameters<typeof milvusStorybookPlugin>[0]) {
  const cacheDir = mkdtempSync(join(tmpdir(), "milvus-sb-vite-"));
  temps.push(cacheDir);
  const vite = await createServer({
    configFile: false,
    root: o.projectDir ?? repo,
    cacheDir,
    logLevel: "silent",
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null, allowedHosts: true },
    plugins: [milvusStorybookPlugin(o)],
  });
  const http = createHttpServer(vite.middlewares).listen(0, "127.0.0.1");
  await new Promise((done) => http.once("listening", done));
  const { port } = http.address() as AddressInfo;
  const call = (method: string, headers: Record<string, string> = {}, body?: string) =>
    new Promise<{ status: number; json: Record<string, unknown> }>((done, fail) => {
      const req = request({ host: "127.0.0.1", port, agent: false, method, path: "/__milvus/brand-request", headers: { host: `localhost:${port}`, ...headers } }, (res) => {
        let text = "";
        res.on("data", (d) => (text += d));
        res.on("end", () => {
          try {
            done({ status: res.statusCode!, json: JSON.parse(text) });
          } catch {
            fail(new Error(`JSON이 아닌 응답 ${res.statusCode}: ${text}`));
          }
        });
      });
      req.on("error", fail);
      req.end(body);
    });
  const close = async () => {
    if (!servers.delete(close)) return;
    http.closeAllConnections();
    await new Promise((done) => http.close(done));
    await vite.close();
  };
  servers.add(close);
  return { vite, call, close, port };
}

test("프로젝트 BrandingSet의 BRAND_COLOR로 팔레트를 계산하고 로고가 있으면 logoUrl을 준다", () => {
  const dir = project({ logo: true });
  const [brand, slds] = brandsFromProject(dir, config);
  assert.equal(brand.name, "Acme");
  assert.equal(brand.source, "project");
  assert.deepEqual(brand.palette, brandPalette("#2E7D32"));
  assert.equal(brand.brandColor, "#2E7D32");
  assert.equal(brand.utilCss, readFileSync(join(dir, RES, "milvusBrand.css"), "utf8"));
  assert.equal(brand.bridgeCss, "/* 브리지 */");
  assert.equal(brand.overrideCss, "/* override */");
  // 자산 이름은 BRAND_IMAGE에서 읽고, 형식은 메타의 pathOnClient 확장자로 정한다
  assert.equal(brand.logoUrl, `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64")}`);
  assert.equal(brand.error, undefined);
  assert.deepEqual(slds, { name: "slds-default", label: "SLDS 기본", source: "slds", palette: {}, utilCss: "", bridgeCss: "", overrideCss: "" });

  assert.equal(brandsFromProject(project(), config)[0].logoUrl, undefined);
});

test("BrandingSet이 없거나 util.css가 규칙을 어기면 slds 브랜드에 error를 담는다", () => {
  const missing = brandsFromProject(project({ brandingSet: false }), config);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].source, "slds");
  assert.match(missing[0].error!, /brandingSets\/LEXTHEMINGAcme\.brandingSet-meta\.xml/);

  const broken = brandsFromProject(project({ util: ".slds-button { border-radius: 0; }\n" }), config);
  assert.equal(broken.length, 1);
  assert.equal(broken[0].source, "slds");
  assert.equal(broken[0].utilCss, "");
  assert.match(broken[0].error!, /milvusBrand\.css/);
  assert.match(broken[0].error!, /\.slds-button/);
});

test("저장소 모드는 brands/의 Milvus_DesignSystem, Sample_Forest", async () => {
  const brands = brandsFromRepo(repo);
  assert.deepEqual(brands.map((b) => [b.name, b.source]), [["Milvus_DesignSystem", "org"], ["Sample_Forest", "sample"]]);
  const bridge = readFileSync(join(repo, "templates", RES, "milvusBridge.css"), "utf8");
  assert.ok(bridge.length > 0);
  for (const b of brands) assert.equal(b.bridgeCss, bridge);
  assert.equal(brands[1].utilCss, readFileSync(join(repo, "brands/Sample_Forest/util.css"), "utf8"));
  assert.match(brands[0].logoUrl!, /^data:image\/jpeg;base64,/);
  assert.equal(brands[1].logoUrl, undefined);
  assert.deepEqual(brands.map((b) => b.brandColor), ["#0176D3", "#2E7D5B"]);

  // brands/의 파일(.DS_Store)과 theme.json 없는 폴더는 건너뛴다
  const fake = mkdtempSync(join(tmpdir(), "milvus-sb-repo-"));
  temps.push(fake);
  mkdirSync(join(fake, "brands/Only_One"), { recursive: true });
  mkdirSync(join(fake, "brands/empty"));
  writeFileSync(join(fake, "brands/.DS_Store"), "");
  writeFileSync(join(fake, "brands/Only_One/theme.json"), JSON.stringify({ name: "Only_One", label: "하나", source: "sample", palette: {} }));
  assert.deepEqual(brandsFromRepo(fake).map((b) => b.name), ["Only_One"]);

  const { vite, close } = await serve({ mode: "repo", repoDir: repo });
  try {
    const m = await vite.ssrLoadModule("virtual:milvus-brands");
    assert.equal(m.mode, "repo");
    assert.deepEqual(m.brands.map((b: { name: string }) => b.name), ["Milvus_DesignSystem", "Sample_Forest"]);
  } finally {
    await close();
  }
});

test("프로젝트 모드 가상 모듈은 원본 파일이 바뀌면 다시 읽는다", async () => {
  const dir = project();
  const { vite, close } = await serve({ mode: "project", repoDir: repo, projectDir: dir });
  try {
    const first = await vite.ssrLoadModule("virtual:milvus-brands");
    assert.equal(first.mode, "project");
    assert.deepEqual(first.brands.map((b: { source: string }) => b.source), ["project", "slds"]);
    const util = join(dir, RES, "milvusBrand.css");
    writeFileSync(util, ":root {\n  --slds-g-radius-border-2: 2px;\n}\n");
    vite.watcher.emit("change", util);
    const second = await vite.ssrLoadModule("virtual:milvus-brands");
    assert.match(second.brands[0].utilCss, /2px/);
  } finally {
    await close();
  }
});

// 반영 검사(Task 26)의 센티널 브랜드. 프로젝트 모드는 프로젝트 milvusBridge.css가 읽는 --milvus-* 변수만 넣는다
test("virtual:milvus-sentinel을 Vite가 해석하고, 프로젝트 milvusBridge.css가 바뀌면 다시 만든다", async () => {
  const dir = project();
  const { vite, close } = await serve({ mode: "project", repoDir: repo, projectDir: dir });
  try {
    const first = await vite.ssrLoadModule("virtual:milvus-sentinel");
    assert.match(first.sentinelCss, /--slds-g-radius-border-1: \d+px;/);
    assert.doesNotMatch(first.sentinelCss, /--milvus-motion-duration-fast/);
    const bridge = join(dir, RES, "milvusBridge.css");
    writeFileSync(bridge, ".slds-button { transition-duration: max(var(--milvus-motion-duration-fast, 0.1s), 0.01ms); }\n");
    vite.watcher.emit("change", bridge);
    const second = await vite.ssrLoadModule("virtual:milvus-sentinel");
    assert.match(second.sentinelCss, /--milvus-motion-duration-fast: 0\.777s;/);
  } finally {
    await close();
  }
});

test("POST는 milvus-brand-request.md 하나에만 쓰고, 저장소 모드는 403, GET의 writable은 거짓", async () => {
  const dir = project();
  const before = readdirSync(dir).sort();
  const file = join(dir, "milvus-brand-request.md");
  const p = await serve({ mode: "project", repoDir: repo, projectDir: dir });
  try {
    assert.deepEqual((await p.call("GET")).json, { text: null, writable: true });
    const text = "# 브랜드 요청\n\n## 브랜드 색\n요청: 딥그린\n";
    assert.equal((await p.call("POST", { "content-type": "application/json" }, JSON.stringify({ text }))).status, 200);
    assert.equal(readFileSync(file, "utf8"), text);
    assert.deepEqual(readdirSync(dir).sort(), [...before, "milvus-brand-request.md"].sort());
    assert.deepEqual((await p.call("GET")).json, { text, writable: true });

    // localhost가 아닌 Host·Origin은 읽기·쓰기 모두 403
    assert.equal((await p.call("GET", { host: "evil.example" })).status, 403);
    assert.equal((await p.call("POST", { host: "evil.example" }, JSON.stringify({ text: "x" }))).status, 403);
    assert.equal((await p.call("POST", { origin: "http://evil.example" }, JSON.stringify({ text: "x" }))).status, 403);
    assert.equal((await p.call("POST", { origin: "null" }, JSON.stringify({ text: "x" }))).status, 403);
    // Origin은 포트까지 이 서버와 같아야 한다(같은 PC의 다른 개발 서버 페이지는 403)
    assert.equal((await p.call("POST", { origin: "http://localhost:3000" }, JSON.stringify({ text: "x" }))).status, 403);
    assert.equal((await p.call("POST", { origin: `http://127.0.0.1:${p.port}` }, JSON.stringify({ text }))).status, 200);
    // 본문이 { text: string }이 아니면 400, 1MB를 넘으면 413(응답이 클라이언트에 닿는다), GET·POST가 아니면 405
    assert.equal((await p.call("POST", {}, "{")).status, 400);
    assert.equal((await p.call("POST", {}, JSON.stringify({ text: 1 }))).status, 400);
    const big = await p.call("POST", {}, JSON.stringify({ text: "가".repeat(400_000) }));
    assert.equal(big.status, 413);
    assert.match(String(big.json.error), /1MB/);
    assert.equal((await p.call("PUT", {}, JSON.stringify({ text: "x" }))).status, 405);
    assert.equal(readFileSync(file, "utf8"), text);
  } finally {
    await p.close();
  }

  const r = await serve({ mode: "repo", repoDir: repo });
  try {
    assert.deepEqual((await r.call("GET")).json, { text: null, writable: false });
    assert.equal((await r.call("POST", {}, JSON.stringify({ text: "x" }))).status, 403);
    assert.ok(!existsSync(join(repo, "milvus-brand-request.md")));
  } finally {
    await r.close();
  }
});

// 다른 PC에서 오는 요청은 HTTP로 흉내 내기 어려워 소켓 주소만 바꾼 요청으로 본다(Host를 localhost로 위조해도 403)
test("isLocal은 루프백 소켓에서 온 localhost 요청만 받는다", () => {
  const req = (remoteAddress: string, headers: Record<string, string>) =>
    ({ socket: { remoteAddress, localPort: 6006 }, headers }) as unknown as IncomingMessage;
  for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) assert.ok(isLocal(req(address, { host: "localhost:6006" })), address);
  assert.ok(isLocal(req("::1", { host: "[::1]:6006", origin: "http://localhost:6006" })));
  assert.ok(!isLocal(req("192.168.0.20", { host: "localhost:6006" })));
  assert.ok(!isLocal(req("192.168.0.20", { host: "localhost:6006", origin: "http://localhost:6006" })));
  assert.ok(!isLocal(req("127.0.0.1", { host: "localhost.evil.example:6006" })));
  assert.ok(!isLocal(req("127.0.0.1", {})));
  assert.ok(!isLocal(req("127.0.0.1", { host: "localhost:6006", origin: "http://localhost" })));
});

test("본문에 경로를 넣어도 고정 경로에만 쓴다", async () => {
  const parent = mkdtempSync(join(tmpdir(), "milvus-sb-parent-"));
  temps.push(parent);
  const dir = join(parent, "프로젝트 폴더");
  mkdirSync(dir);
  writeFileSync(join(dir, "milvus.config.json"), JSON.stringify(config));
  const p = await serve({ mode: "project", repoDir: repo, projectDir: dir });
  try {
    const body = { text: "요청", path: "../escape.md", file: join(parent, "escape.md"), name: "README.md" };
    assert.equal((await p.call("POST", {}, JSON.stringify(body))).status, 200);
    assert.deepEqual(readdirSync(parent), ["프로젝트 폴더"]);
    assert.deepEqual(readdirSync(dir).sort(), ["milvus-brand-request.md", "milvus.config.json"]);
    assert.equal(readFileSync(join(dir, "milvus-brand-request.md"), "utf8"), "요청");
  } finally {
    await p.close();
  }
});
