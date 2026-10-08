// 분석 스크립트가 함께 쓰는 위치 (읽기만 함)
// - ROOT: 패키지를 찾을 프로젝트 루트. 기본은 이 폴더에서 세 단계 위(learndoshare_1). 다른 곳은 MILVUS_ROOT로 넘긴다
// - OUT: 생성 JSON을 읽고 쓰는 폴더. 기본은 이 폴더. 큰 JSON을 저장소 밖에 두려면 AUDIT_OUT으로 넘긴다
// - SLDS2, LBC: 설치된 패키지 폴더 (pnpm 심볼릭 링크와 상관없이 require.resolve로 찾음)
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(process.env.MILVUS_ROOT || path.join(__dirname, "../../.."));
const OUT = path.resolve(process.env.AUDIT_OUT || __dirname);
const req = createRequire(path.join(ROOT, "package.json"));
const pkgDir = (name) => path.dirname(req.resolve(name + "/package.json"));
const SLDS2 = pkgDir("@salesforce-ux/design-system-2");
const LBC_PKG = pkgDir("lightning-base-components");

module.exports = {
  ROOT,
  OUT,
  SLDS2,
  LBC_PKG,
  LBC: path.join(LBC_PKG, "src/lightning"),
  SLDS2_BUNDLE: path.join(SLDS2, "dist/css/bundled/slds2.cosmos.css"),
  SLDS2_COMPONENTS: path.join(SLDS2, "dist/components"),
  // postcss는 vite와 함께 설치되어 있다 (새 의존성 없음)
  postcss: createRequire(req.resolve("vite"))("postcss"),
};
