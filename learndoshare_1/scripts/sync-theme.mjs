#!/usr/bin/env node
/**
 * org의 Themes and Branding을 읽어 brands/<테마>/ 를 만든다.
 *   theme.json  브랜드 색 (L1)
 *   logo.<ext>  브랜드 로고 (L2)
 *
 * 사용: pnpm sync:theme            (기본 org 별칭: learndoshare_1)
 *       SF_ORG=<별칭> pnpm sync:theme
 *
 * 액세스 토큰은 메모리에서만 쓰고 출력하거나 파일로 남기지 않는다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const org = process.env.SF_ORG ?? "learndoshare_1";
const API = "v67.0";

// sf --json 출력에는 가끔 제어 문자가 섞여 JSON.parse가 실패한다
function sf(args) {
  const out = execFileSync("sf", [...args, "-o", org, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(out.replace(/[\u0000-\u001f]/g, " ")).result;
}

const query = (soql, tooling = false) =>
  sf(["data", "query", ...(tooling ? ["--use-tooling-api"] : []), "-q", soql])
    .records;

const quote = (value) => `'${String(value).replace(/'/g, "\\'")}'`;

async function downloadLogo(brandImage, dir, auth) {
  // BRAND_IMAGE는 '/file-asset/<이름>?v=1' 형태다. 이 경로는 브라우저 세션용이라 CLI 토큰으로 받을 수 없어서
  // ContentAsset → ContentVersion → REST VersionData 순으로 원본 파일을 받는다.
  const name = brandImage?.match(/\/file-asset\/([^?/]+)/)?.[1];
  if (!name) return null;

  const [asset] = query(
    `SELECT ContentDocumentId FROM ContentAsset WHERE DeveloperName = ${quote(name)}`
  );
  if (!asset) return null;
  const [version] = query(
    `SELECT Id, FileExtension FROM ContentVersion WHERE ContentDocumentId = ${quote(asset.ContentDocumentId)} AND IsLatest = true`
  );
  if (!version) return null;

  const res = await fetch(
    `${auth.instanceUrl}/services/data/${API}/sobjects/ContentVersion/${version.Id}/VersionData`,
    {
      headers: { Authorization: `Bearer ${auth.accessToken}` }
    }
  );
  if (!res.ok) throw new Error(`로고 다운로드 실패 (HTTP ${res.status})`);

  const file = `logo.${version.FileExtension.toLowerCase()}`;
  for (const old of readdirSync(dir).filter((f) => f.startsWith("logo.")))
    rmSync(`${dir}/${old}`);
  writeFileSync(`${dir}/${file}`, Buffer.from(await res.arrayBuffer()));
  return file;
}

const themes = query(
  "SELECT DeveloperName, MasterLabel, DefaultBrandingSetId, DesignSystemVersion FROM LightningExperienceTheme",
  true
);
if (!themes.length) {
  console.error(
    `org(${org})에 커스텀 테마가 없습니다. Setup > Themes and Branding에서 테마를 만든 뒤 다시 실행하세요.`
  );
  process.exit(1);
}

// BrandingSetId → { BRAND_COLOR: '#0176D3', ... }
const props = {};
for (const p of query(
  "SELECT BrandingSetId, PropertyName, PropertyValue FROM BrandingSetProperty",
  true
)) {
  (props[p.BrandingSetId] ??= {})[p.PropertyName] =
    p.PropertyValue === "null" ? null : p.PropertyValue;
}

const auth = sf(["org", "display"]);

for (const theme of themes) {
  const values = props[theme.DefaultBrandingSetId] ?? {};
  const dir = `brands/${theme.DeveloperName}`;
  mkdirSync(dir, { recursive: true });

  let logo = null;
  try {
    logo = await downloadLogo(values.BRAND_IMAGE, dir, auth);
  } catch (error) {
    console.warn(
      `[${theme.DeveloperName}] ${error.message}. 색은 계속 동기화합니다.`
    );
  }

  const json = {
    name: theme.DeveloperName,
    label: theme.MasterLabel,
    source: "org",
    designSystemVersion: theme.DesignSystemVersion,
    brandColor: values.BRAND_COLOR ?? null,
    headerBackgroundColor: values.HEADER_BACKGROUND_COLOR ?? null,
    logo
  };
  writeFileSync(`${dir}/theme.json`, `${JSON.stringify(json, null, 2)}\n`);
  console.log(
    `✓ ${dir}  brandColor=${json.brandColor ?? "없음"}  logo=${logo ?? "없음"}`
  );
}
