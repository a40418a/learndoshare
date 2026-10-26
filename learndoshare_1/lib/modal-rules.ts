// 모달 규칙. 원본은 패턴 명세 docs/milvus/patterns/modal.md(템플릿 templates/docs/milvus/patterns/modal.md)이고 check가 실패시킨다(#72)
// - modal_<이름> 컴포넌트: lightning/modal의 LightningModal을 상속하고, 템플릿은 <c-milvus-modal> 하나만 둔다. 제목·버튼 자리는 c-milvus-modal이 정한다
// - 그 밖의 LWC: 모달을 안에서 만들지 않는다. modal_<이름>을 import해 open()으로 연다
// ponytail: 정규식으로 본다. 주석은 빼지만 문자열 안의 글자는 걸린다. 오탐이 실제로 나오면 @lwc/template-compiler와 JS 파서로 바꾼다
import type { Issue } from "./rules.ts";

const MODAL_PREFIX = "modal_";

export type LwcFile = { path: string; text: string };

const OPEN_FIX = `import ModalAccountEdit from "c/${MODAL_PREFIX}accountEdit"; … await ModalAccountEdit.open({ size, description, … })`;

// 일반 LWC에 있으면 안 되는 것. c-milvus-modal은 LightningModal 안에서만 동작한다
const MODAL_TOKENS: [RegExp, string][] = [
  [/["']lightning\/modal["']/, "lightning/modal"],
  [/\bLightningModal\b/, "LightningModal"],
  [/<lightning-modal-/, "lightning-modal-*"],
  [/\bslds-modal/, "slds-modal"],
  [/<c-milvus-modal\b/, "c-milvus-modal"],
];

const stripComments = (f: LwcFile) =>
  f.path.endsWith(".html") ? f.text.replace(/<!--[\s\S]*?-->/g, "") : f.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// <template> 바로 안에 <c-milvus-modal> 하나만 있는지 본다. 내용(슬롯)은 자유지만 lightning-modal-*·slds-modal은 안 된다
function isFixedFrame(html: string): boolean {
  const inner = html
    .trim()
    .replace(/^<template\b[^>]*>/, "")
    .replace(/<\/template>$/, "")
    .trim();
  return (
    /^<c-milvus-modal\b[\s\S]*<\/c-milvus-modal>$/.test(inner) &&
    inner.split("<c-milvus-modal").length === 2 &&
    !/<lightning-modal-|\bslds-modal/.test(inner)
  );
}

/** LWC 컴포넌트 폴더 하나(dir은 루트 기준 경로)의 .js·.html을 모달 규칙으로 본다. 밀버스 관리 컴포넌트(milvus*)는 넘기지 않는다 */
export function checkModalComponent(dir: string, files: LwcFile[]): Issue[] {
  const name = dir.slice(dir.lastIndexOf("/") + 1);
  const sources = files.map((f) => ({ path: f.path, text: stripComments(f) }));

  if (!name.startsWith(MODAL_PREFIX)) {
    return sources.flatMap(({ path, text }) => {
      const found = MODAL_TOKENS.filter(([re]) => re.test(text)).map(([, label]) => label);
      if (!found.length) return [];
      return [
        {
          file: path,
          rule: "modal-separate",
          message: `LWC 안에서 모달을 만들지 않습니다(${found.join(", ")}). 모달은 ${MODAL_PREFIX}<이름> 컴포넌트로 분리하고 여기서는 import해 open()으로 엽니다`,
          fix: OPEN_FIX,
        },
      ];
    });
  }

  const issues: Issue[] = [];
  const js = sources.filter((f) => f.path.endsWith(".js"));
  const extendsModal = js.some(
    ({ text }) => /import\s+LightningModal\s+from\s+["']lightning\/modal["']/.test(text) && /\bextends\s+LightningModal\b/.test(text),
  );
  if (!extendsModal) {
    issues.push({
      file: `${dir}/${name}.js`,
      rule: "modal-base",
      message: `${MODAL_PREFIX} 컴포넌트는 lightning/modal의 LightningModal을 상속합니다`,
      fix: `import LightningModal from "lightning/modal"; export default class … extends LightningModal`,
    });
  }
  const html = sources.filter((f) => f.path.endsWith(".html"));
  const frameIssue = (file: string): Issue => ({
    file,
    rule: "modal-frame",
    message: "모달 템플릿은 <c-milvus-modal> 하나만 둡니다. 내용은 그 안(기본 슬롯)에 넣고, lightning-modal-header·body·footer나 slds-modal을 직접 쓰지 않습니다",
    fix: `<template><c-milvus-modal label="제목" primary-label="저장" secondary-label="취소" onprimary={handleSave} onsecondary={handleCancel}>내용</c-milvus-modal></template>`,
  });
  if (!html.length) issues.push(frameIssue(`${dir}/${name}.html`));
  for (const f of html) if (!isFixedFrame(f.text)) issues.push(frameIssue(f.path));
  return issues;
}
