// 브랜드 메타데이터 XML(설계 3장, 4.4). 모양은 2026-10-09에 org에서 받은(sf project retrieve start) 파일과
// Metadata API 형식(BrandingSet, LightningExperienceTheme, ContentAsset, LightningExperienceSettings)을 따른다.
// XML 선언은 저장소의 다른 메타 파일처럼 prettier 형식("UTF-8" ?>)으로 쓴다. 그래야 prettier가 결과를 바꾸지 않는다.
// 이름과 색은 검증한 값만 넣으므로 XML 이스케이프가 필요 없다
import { extname } from "node:path";

const HEX = /^#[0-9a-f]{6}$/i;

/** `^[A-Za-z][A-Za-z0-9_]*$`, `__`를 쓰지 않고 `_`로 끝나지 않는다(설계 4.1) */
export function isValidBrandName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !name.includes("__") && !name.endsWith("_");
}

function assertName(name: string): void {
  if (!isValidBrandName(name)) {
    throw new Error(`브랜드 이름은 영문자로 시작하고 영문자·숫자·_만 쓸 수 있습니다(__ 금지, _로 끝나지 않음): ${name}`);
  }
}

function assertColor(color: string, what: string): void {
  if (!HEX.test(color)) throw new Error(`${what} 값이 #rrggbb 형식이 아닙니다: ${color}`);
}

const doc = (root: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8" ?>\n<${root} xmlns="http://soap.sforce.com/2006/04/metadata">\n${body}</${root}>\n`;

const property = (name: string, value: string) =>
  `    <brandingSetProperty>\n        <propertyName>${name}</propertyName>\n        <propertyValue>${value}</propertyValue>\n    </brandingSetProperty>\n`;

/** BrandingSet XML에서 BRAND_COLOR와 BRAND_IMAGE를 읽는다. 주석은 무시한다. BRAND_COLOR가 없거나 #rrggbb가 아니면 던진다 */
export function readBranding(xml: string): { brandColor: string; brandImage?: string } {
  const props = new Map<string, string>();
  const body = xml.replace(/<!--[\s\S]*?-->/g, "");
  for (const [, block] of body.matchAll(/<brandingSetProperty>([\s\S]*?)<\/brandingSetProperty>/g)) {
    const name = /<propertyName>([^<]*)<\/propertyName>/.exec(block)?.[1].trim();
    const value = /<propertyValue>([^<]*)<\/propertyValue>/.exec(block)?.[1].trim() ?? "";
    if (name) props.set(name, value);
  }
  const brandColor = props.get("BRAND_COLOR");
  if (!brandColor) throw new Error("BrandingSet에 BRAND_COLOR가 없습니다");
  assertColor(brandColor, "BrandingSet의 BRAND_COLOR");
  const brandImage = props.get("BRAND_IMAGE");
  return brandImage ? { brandColor, brandImage } : { brandColor };
}

/**
 * BRAND_IMAGE(/file-asset/<자산 이름>?v=…)의 자산 이름. --from-org 프로젝트는 org 값 그대로라 <브랜드>Logo로 가정하지 않는다(R26).
 * 이름은 경로와 sf 인자에 들어가므로 Salesforce API 이름 규칙(브랜드 이름과 같다)에 맞지 않으면 undefined
 */
export function logoAsset(brandImage: string): string | undefined {
  const asset = /^\/file-asset\/([^/?]+)(\?.*)?$/.exec(brandImage)?.[1];
  return asset && isValidBrandName(asset) ? asset : undefined;
}

/** brandingSets/LEXTHEMING<name>.brandingSet-meta.xml. logo면 BRAND_IMAGE = /file-asset/<name>Logo?v=1 */
export function writeBrandingSet(o: { name: string; brandColor: string; logo?: boolean }): string {
  assertName(o.name);
  assertColor(o.brandColor, "브랜드 색");
  // ponytail: BRAND_COLOR(와 BRAND_IMAGE)만 넣는다. 10/8 프로브는 HEADER_BACKGROUND_COLOR(SLDS 1 전용)도 넣어 배포했다.
  //           이 두 속성만으로 배포되는지는 미확인이다. 배포가 거부되면 HEADER_BACKGROUND_COLOR #FFFFFF를 더한다
  const image = o.logo ? property("BRAND_IMAGE", `/file-asset/${o.name}Logo?v=1`) : "";
  return doc("BrandingSet", `${property("BRAND_COLOR", o.brandColor)}${image}    <masterLabel>${o.name}</masterLabel>\n`);
}

/** lightningExperienceThemes/<name>.lightningExperienceTheme-meta.xml */
export function writeTheme(name: string): string {
  assertName(name);
  return doc(
    "LightningExperienceTheme",
    `    <defaultBrandingSet>LEXTHEMING${name}</defaultBrandingSet>\n` +
      "    <designSystemVersion>SLDS_v2</designSystemVersion>\n" +
      `    <masterLabel>${name}</masterLabel>\n`,
  );
}

/**
 * contentassets/<name>Logo.asset-meta.xml. logoFile은 사용자가 준 로고 파일 경로이고, 확장자만 쓴다.
 * org에서 받은 로고 자산의 pathOnClient에는 원래 파일 이름과 확장자가 있어서 같은 모양으로 확장자를 붙인다
 */
export function writeContentAssetMeta(name: string, logoFile: string): string {
  assertName(name);
  const ext = extname(logoFile).toLowerCase();
  if (!/^\.[a-z0-9]+$/.test(ext)) throw new Error(`로고 파일에 확장자가 없습니다(.png, .jpg 등): ${logoFile}`);
  return doc(
    "ContentAsset",
    "    <isVisibleByExternalUsers>false</isVisibleByExternalUsers>\n" +
      // ponytail: 언어는 org에서 받은 로고 자산과 같은 ko로 고정한다. 다른 언어 org에서 거부되면 org 기본 언어를 받아 넣는다
      "    <language>ko</language>\n" +
      `    <masterLabel>${name}Logo</masterLabel>\n` +
      "    <relationships>\n        <organization>\n            <access>VIEWER</access>\n        </organization>\n    </relationships>\n" +
      `    <versions>\n        <version>\n            <number>1</number>\n            <pathOnClient>${name}Logo${ext}</pathOnClient>\n        </version>\n    </versions>\n`,
  );
}

/** mdapi 형식 settings/LightningExperience.settings. activeThemeName 한 필드만 담는다(설계 4.4의 6) */
export function writeActiveThemeSettings(name: string): string {
  assertName(name);
  return doc("LightningExperienceSettings", `    <activeThemeName>${name}</activeThemeName>\n`);
}

/** 위 settings 파일 하나를 배포하는 mdapi package.xml */
export function writeSettingsPackageXml(): string {
  return doc(
    "Package",
    "    <types>\n        <members>LightningExperience</members>\n        <name>Settings</name>\n    </types>\n" +
      // Metadata API 버전은 저장소 sourceApiVersion, 10/8 org 프로브와 같다
      "    <version>67.0</version>\n",
  );
}
