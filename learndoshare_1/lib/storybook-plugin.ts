// Storybook 두 모드(설계 4.2, 6.1)의 브랜드 데이터와 Vite 플러그인
// - 저장소 모드: brands/<브랜드>/(theme.json, util.css, 로고)와 templates의 milvusBridge.css·milvusOverride.css
// - 프로젝트 모드(MILVUS_PROJECT_DIR): milvus.config.json 브랜드의 BrandingSet(BRAND_COLOR → 팔레트, BRAND_IMAGE → 로고)과
//   staticresources의 milvusBrand.css(util.css)·milvusBridge.css·milvusOverride.css. 비교용 "SLDS 기본"도 함께 준다
// 가상 모듈 virtual:milvus-brands가 mode와 brands를 내보내고, /__milvus/brand-request가 명세 페이지의 요청 파일을 읽고 쓴다
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { readConfig, type MilvusConfig } from "../cli/context.ts";
import { logoAsset, readBranding } from "./branding.ts";
import { loadRuleContext } from "./hooks-index.ts";
import { brandPalette } from "./palette.ts";
import { checkUtilCss } from "./rules.ts";

export type BrandData = {
  name: string;
  label: string;
  source: "org" | "sample" | "project" | "slds";
  palette: Record<number, string>;
  utilCss: string;
  bridgeCss: string;
  overrideCss: string;
  logoUrl?: string;
  error?: string;
};
export type PluginOptions = { mode: "repo" | "project"; repoDir: string; projectDir?: string };

const FA = "force-app/main/default";
const RES = `${FA}/staticresources`;
const REQUEST_FILE = "milvus-brand-request.md";
const ENDPOINT = "/__milvus/brand-request";
const VIRTUAL = "virtual:milvus-brands";
const RESOLVED = `\0${VIRTUAL}`;
const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAX_BODY = 1_000_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// 이름에 -가 있어 브랜드 이름(^[A-Za-z][A-Za-z0-9_]*$)과 겹치지 않는다. 팔레트가 비면 SLDS 2 Cosmos 기본 팔레트 그대로다
const SLDS: BrandData = { name: "slds-default", label: "SLDS 기본", source: "slds", palette: {}, utilCss: "", bridgeCss: "", overrideCss: "" };

const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : "");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

// ponytail: 로고를 data URL로 넣는다(개발 서버·정적 빌드·사이드바가 같은 값을 쓴다). 큰 로고면 번들이 그만큼 커진다
function dataUrl(file: string, fileName: string): string | undefined {
  const type = MIME[extname(fileName).toLowerCase()];
  return type && existsSync(file) ? `data:${type};base64,${readFileSync(file).toString("base64")}` : undefined;
}

/** 저장소 Storybook의 다중 브랜드 데모(brands/, 설계 2장). 팔레트는 pnpm sync:theme이 theme.json에 저장한 값이다 */
export function brandsFromRepo(repoDir: string): BrandData[] {
  const res = join(repoDir, "templates", RES);
  const bridgeCss = read(join(res, "milvusBridge.css"));
  const overrideCss = read(join(res, "milvusOverride.css"));
  // ponytail: 브랜드마다 bridgeCss(약 358KB) 사본이 가상 모듈에 들어간다(저장소 2개 → 약 700KB). 브랜드가 늘면 공유 문자열로 뺀다
  // theme.json이 있는 폴더만 브랜드다(.DS_Store 같은 파일은 건너뛴다)
  return readdirSync(join(repoDir, "brands"))
    .filter((dir) => existsSync(join(repoDir, "brands", dir, "theme.json")))
    .sort()
    .map((dir) => {
      const base = join(repoDir, "brands", dir);
      const theme = JSON.parse(readFileSync(join(base, "theme.json"), "utf8"));
      const logoUrl = theme.logo ? dataUrl(join(base, theme.logo), theme.logo) : undefined;
      const brand: BrandData = { name: theme.name, label: theme.label, source: theme.source, palette: theme.palette, utilCss: read(join(base, "util.css")), bridgeCss, overrideCss };
      return logoUrl ? { ...brand, logoUrl } : brand;
    });
}

/**
 * 프로젝트 브랜드와 "SLDS 기본". BrandingSet이 없거나 틀렸거나 milvusBrand.css가 util.css 규칙(설계 5.2)을 어기면
 * 프로젝트 브랜드 대신 error를 담은 SLDS 기본 하나만 준다(설계 4.2, 10장). 화면은 preview.ts가 오류 배너로 알린다
 */
export function brandsFromProject(projectDir: string, config: MilvusConfig): BrandData[] {
  const fail = (error: string): BrandData[] => [{ ...SLDS, error }];
  const brandingFile = `${FA}/brandingSets/LEXTHEMING${config.brand}.brandingSet-meta.xml`;
  if (!existsSync(join(projectDir, brandingFile))) {
    return fail(`브랜드 메타데이터가 없습니다: ${brandingFile}. pnpm milvus init을 다시 실행하거나 파일을 복구하세요`);
  }
  let branding;
  try {
    branding = readBranding(readFileSync(join(projectDir, brandingFile), "utf8"));
  } catch (e) {
    return fail(`${brandingFile}: ${(e as Error).message}`);
  }

  const utilFile = `${RES}/milvusBrand.css`;
  const utilCss = read(join(projectDir, utilFile));
  const issues = checkUtilCss(utilCss, utilFile, loadRuleContext({ pkgRoot: PKG_ROOT, projectRoot: projectDir }));
  if (issues.length) {
    return fail(`${utilFile}가 규칙을 어깁니다. pnpm milvus check --style로 고칠 값을 확인하세요\n${issues.map((i) => `${i.file}  ${i.message}`).join("\n")}`);
  }

  const asset = branding.brandImage ? logoAsset(branding.brandImage) : undefined;
  const assets = join(projectDir, FA, "contentassets");
  // 형식은 메타의 pathOnClient(원래 파일 이름) 확장자로 정한다. 자산 파일 자체는 확장자가 .asset이다
  const fileName = asset ? (/<pathOnClient>([^<]*)<\/pathOnClient>/.exec(read(join(assets, `${asset}.asset-meta.xml`)))?.[1] ?? "") : "";
  const logoUrl = asset ? dataUrl(join(assets, `${asset}.asset`), fileName) : undefined;
  const brand: BrandData = {
    name: config.brand,
    label: config.brand,
    source: "project",
    palette: brandPalette(branding.brandColor),
    utilCss,
    bridgeCss: read(join(projectDir, RES, "milvusBridge.css")),
    overrideCss: read(join(projectDir, RES, "milvusOverride.css")),
  };
  return [logoUrl ? { ...brand, logoUrl } : brand, SLDS];
}

/** 모드에 맞는 브랜드 목록. 첫 브랜드가 기본 브랜드다 */
export function loadBrands(o: PluginOptions): BrandData[] {
  if (o.mode === "repo") return brandsFromRepo(o.repoDir);
  let config;
  try {
    config = readConfig(o.projectDir!);
  } catch (e) {
    return [{ ...SLDS, error: (e as Error).message }];
  }
  if (!config) return [{ ...SLDS, error: "milvus.config.json이 없습니다. pnpm milvus init을 먼저 실행하세요" }];
  return brandsFromProject(o.projectDir!, config);
}

const parseUrl = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

/**
 * 같은 PC의 같은 서버에서 온 요청인가. 다른 PC(소켓 주소), DNS rebinding(Host), 다른 사이트·다른 포트의 페이지(Origin)를 막는다.
 * 소켓 주소를 먼저 보는 것은 Storybook을 --host 0.0.0.0으로 띄우면 Vite의 Host 검사가 꺼지고, 헤더는 클라이언트가 정하기 때문이다
 */
export function isLocal(req: IncomingMessage): boolean {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? "")) return false;
  if (!LOCAL_HOSTS.has(parseUrl(`http://${req.headers.host}`)?.hostname ?? "")) return false;
  if (req.headers.origin === undefined) return true;
  const origin = parseUrl(req.headers.origin);
  if (!origin || !LOCAL_HOSTS.has(origin.hostname)) return false;
  return Number(origin.port || (origin.protocol === "https:" ? 443 : 80)) === req.socket.localPort;
}

// 한도를 넘으면 버퍼에 담지 않고 끝까지 흘려보낸 뒤 undefined. 중간에 끊으면 소켓이 닫혀 413이 클라이언트에 닿지 않는다
async function readBody(req: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size <= MAX_BODY) chunks.push(chunk as Buffer);
  }
  return size > MAX_BODY ? undefined : Buffer.concat(chunks).toString("utf8");
}

// 본문의 경로·파일 이름은 보지 않는다. 쓰는 곳은 프로젝트 루트의 milvus-brand-request.md 하나다(설계 6.1)
async function brandRequest(o: PluginOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };
  try {
    await handleBrandRequest(o, req, send);
  } catch (e) {
    if (res.headersSent) res.end();
    else send(500, { error: `요청 파일을 처리하지 못했습니다: ${(e as Error).message}` });
  }
}

async function handleBrandRequest(o: PluginOptions, req: IncomingMessage, send: (status: number, body: unknown) => void): Promise<void> {
  if (!isLocal(req)) return send(403, { error: "localhost로 연 Storybook에서만 쓸 수 있습니다" });
  const file = o.mode === "project" ? join(o.projectDir!, REQUEST_FILE) : undefined;
  if (req.method === "GET") return send(200, { text: file && existsSync(file) ? readFileSync(file, "utf8") : null, writable: file !== undefined });
  if (req.method !== "POST") return send(405, { error: "GET과 POST만 받습니다" });
  if (!file) return send(403, { error: "저장소 Storybook에서는 저장하지 않습니다. 프로젝트에서 pnpm milvus storybook으로 여세요" });

  const body = await readBody(req);
  if (body === undefined) return send(413, { error: "요청이 너무 큽니다(1MB 이하)" });
  let text: unknown;
  try {
    text = JSON.parse(body)?.text;
  } catch {
    // 아래에서 400
  }
  if (typeof text !== "string") return send(400, { error: '본문은 { "text": "<요청 파일 내용>" } 형식의 JSON이어야 합니다' });
  writeFileSync(file, text);
  send(200, { ok: true });
}

export function milvusStorybookPlugin(o: PluginOptions): Plugin {
  if (o.mode === "project" && !o.projectDir) throw new Error("프로젝트 모드에는 projectDir(MILVUS_PROJECT_DIR)가 필요합니다");
  // 가상 모듈을 다시 만들 원본. 아직 없는 파일(나중에 만든 BrandingSet 등)도 잡도록 폴더를 본다
  const sources =
    o.mode === "repo"
      ? [join(o.repoDir, "brands"), join(o.repoDir, "templates", RES)]
      : ["milvus.config.json", `${FA}/brandingSets`, RES, `${FA}/contentassets`].map((p) => join(o.projectDir!, p));

  return {
    name: "milvus-storybook",
    resolveId: (id) => (id === VIRTUAL ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      return `export const mode = ${JSON.stringify(o.mode)};\nexport const brands = ${JSON.stringify(loadBrands(o))};\n`;
    },
    configureServer(server) {
      server.watcher.add(sources);
      const reload = (file: string) => {
        if (!sources.some((s) => file === s || file.startsWith(s + sep))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      for (const event of ["add", "change", "unlink"]) server.watcher.on(event, reload);

      server.middlewares.use(ENDPOINT, (req, res) => void brandRequest(o, req, res));
    },
  };
}
