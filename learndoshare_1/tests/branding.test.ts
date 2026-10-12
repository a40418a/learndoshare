import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isValidBrandName,
  readBranding,
  writeActiveThemeSettings,
  writeBrandingSet,
  writeContentAssetMeta,
  writeSettingsPackageXml,
  writeTheme,
} from "../lib/branding.ts";

const template = (file: string) => readFileSync(new URL(`../templates/brand/${file}`, import.meta.url), "utf8");

test("writeBrandingSet → readBranding 왕복에서 brandColor가 같고, logo면 BRAND_IMAGE가 /file-asset/AcmeLogo?v=1", () => {
  assert.deepEqual(readBranding(writeBrandingSet({ name: "Acme", brandColor: "#0176D3" })), { brandColor: "#0176D3" });
  assert.deepEqual(readBranding(writeBrandingSet({ name: "Acme", brandColor: "#2E7D32", logo: true })), {
    brandColor: "#2E7D32",
    brandImage: "/file-asset/AcmeLogo?v=1",
  });
});

test("readBranding은 org에서 받은 형식(속성 여러 개, 빈 값, 주석)을 읽고 BRAND_COLOR가 없거나 틀리면 던진다", () => {
  // sf project retrieve start로 받은 BrandingSet과 같은 모양 (2026-10-09, 자산 이름만 바꿈)
  const retrieved = `<?xml version="1.0" encoding="UTF-8"?>
<BrandingSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <!-- <brandingSetProperty><propertyName>BRAND_COLOR</propertyName><propertyValue>#000000</propertyValue></brandingSetProperty> -->
    <brandingSetProperty>
        <propertyName>BRAND_COLOR</propertyName>
        <propertyValue>#0176D3</propertyValue>
    </brandingSetProperty>
    <brandingSetProperty>
        <propertyName>HEADER_BACKGROUND_COLOR</propertyName>
        <propertyValue>#FFFFFF</propertyValue>
    </brandingSetProperty>
    <brandingSetProperty>
        <propertyName>BRAND_IMAGE</propertyName>
        <propertyValue>/file-asset/Sample_logo_1?v=1</propertyValue>
    </brandingSetProperty>
    <brandingSetProperty>
        <propertyName>BRAND_IMAGE_DARK_MODE</propertyName>
        <propertyValue></propertyValue>
    </brandingSetProperty>
    <masterLabel>Sample</masterLabel>
</BrandingSet>
`;
  assert.deepEqual(readBranding(retrieved), { brandColor: "#0176D3", brandImage: "/file-asset/Sample_logo_1?v=1" });
  assert.deepEqual(readBranding(retrieved.replace("/file-asset/Sample_logo_1?v=1", "")), { brandColor: "#0176D3" });
  // 주석 안의 BRAND_COLOR는 세지 않는다
  assert.throws(() => readBranding(retrieved.replace("<propertyName>BRAND_COLOR</propertyName>\n", "")), /BRAND_COLOR가 없습니다/);
  assert.throws(() => readBranding(retrieved.replace("#0176D3", "blue")), /BRAND_COLOR/);
});

test("writeTheme은 LEXTHEMING<이름>을 가리키는 SLDS_v2 테마다", () => {
  assert.equal(
    writeTheme("Acme"),
    `<?xml version="1.0" encoding="UTF-8" ?>
<LightningExperienceTheme xmlns="http://soap.sforce.com/2006/04/metadata">
    <defaultBrandingSet>LEXTHEMINGAcme</defaultBrandingSet>
    <designSystemVersion>SLDS_v2</designSystemVersion>
    <masterLabel>Acme</masterLabel>
</LightningExperienceTheme>
`,
  );
});

test("writeContentAssetMeta는 <이름>Logo 자산이고 pathOnClient에 로고 파일의 확장자를 붙인다", () => {
  const meta = writeContentAssetMeta("Acme", "/어느 폴더/회사 로고.PNG");
  assert.match(meta, /<masterLabel>AcmeLogo<\/masterLabel>/);
  assert.match(meta, /<pathOnClient>AcmeLogo\.png<\/pathOnClient>/);
  assert.match(meta, /<organization>\s*<access>VIEWER<\/access>\s*<\/organization>/);
  assert.throws(() => writeContentAssetMeta("Acme", "logo"), /확장자/);
});

test("writeActiveThemeSettings에는 activeThemeName 하나만 있다", () => {
  assert.equal(
    writeActiveThemeSettings("Acme"),
    `<?xml version="1.0" encoding="UTF-8" ?>
<LightningExperienceSettings xmlns="http://soap.sforce.com/2006/04/metadata">
    <activeThemeName>Acme</activeThemeName>
</LightningExperienceSettings>
`,
  );
  assert.equal(
    writeSettingsPackageXml(),
    `<?xml version="1.0" encoding="UTF-8" ?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>LightningExperience</members>
        <name>Settings</name>
    </types>
    <version>67.0</version>
</Package>
`,
  );
});

test("isValidBrandName: 'Milvus_DS' 참, '밀버스'·'A__B'·'Ab_'·'1A' 거짓", () => {
  assert.equal(isValidBrandName("Milvus_DS"), true);
  for (const bad of ["밀버스", "A__B", "Ab_", "1A", "", "A-B", "A B"]) assert.equal(isValidBrandName(bad), false, bad);
});

test("write 함수는 틀린 이름이나 색을 받으면 던진다", () => {
  assert.throws(() => writeTheme("1A"), /브랜드 이름/);
  assert.throws(() => writeActiveThemeSettings("A<B"), /브랜드 이름/);
  assert.throws(() => writeBrandingSet({ name: "Acme", brandColor: "#0176D" }), /#rrggbb/);
});

test("templates/brand 틀은 writeBrandingSet·writeTheme 결과와 같다 (이름 BrandName, 기본색 #0176D3)", () => {
  assert.equal(template("brandingSet.xml"), writeBrandingSet({ name: "BrandName", brandColor: "#0176D3" }));
  assert.equal(template("theme.xml"), writeTheme("BrandName"));
});
