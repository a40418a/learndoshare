import { test } from "node:test";
import assert from "node:assert/strict";
import { checkModalComponent, type LwcFile } from "../lib/modal-rules.ts";

const LWC = "force-app/main/default/lwc";
// 폴더 이름과 { 파일 이름: 내용 }으로 검사하고 걸린 [파일, 규칙]만 돌려준다
const rulesOf = (name: string, files: Record<string, string>) =>
  checkModalComponent(
    `${LWC}/${name}`,
    Object.entries(files).map(([file, text]): LwcFile => ({ path: `${LWC}/${name}/${file}`, text })),
  ).map((i) => [i.file.slice(LWC.length + 1), i.rule]);

const MODAL_JS = `import { api } from "lwc";
import LightningModal from "lightning/modal";

export default class ModalAccountEdit extends LightningModal {
  @api recordName;
  handleSave() {
    this.close({ saved: true });
  }
}
`;
const MODAL_HTML = `<template>
  <!-- 내용만 채운다 -->
  <c-milvus-modal label="거래처 수정" primary-label="저장" secondary-label="취소" onprimary={handleSave}>
    <lightning-input label="거래처 이름" value={recordName}></lightning-input>
  </c-milvus-modal>
</template>
`;

test("형식대로 만든 modal_ 컴포넌트와 그것을 여는 일반 LWC는 통과한다", () => {
  assert.deepEqual(rulesOf("modal_accountEdit", { "modal_accountEdit.js": MODAL_JS, "modal_accountEdit.html": MODAL_HTML }), []);
  const opener = `import { LightningElement } from "lwc";
import ModalAccountEdit from "c/modal_accountEdit";
import LightningConfirm from "lightning/confirm";

export default class AccountPanel extends LightningElement {
  // LightningModal은 modal_ 컴포넌트에만 쓴다(주석은 보지 않는다)
  async handleEdit() {
    await ModalAccountEdit.open({ size: "small", description: "거래처 수정 창" });
  }
}
`;
  const openerHtml = `<template><!-- slds-modal은 쓰지 않는다 --><lightning-button label="수정" onclick={handleEdit}></lightning-button></template>`;
  assert.deepEqual(rulesOf("accountPanel", { "accountPanel.js": opener, "accountPanel.html": openerHtml }), []);
});

test("일반 LWC 안에서 모달을 만들면 파일마다 modal-separate로 막는다", () => {
  const js = `import LightningModal from "lightning/modal";\nexport default class Inline extends LightningModal {}\n`;
  const html = `<template>
  <section role="dialog" class="slds-modal slds-fade-in-open"><div class="slds-modal__container"></div></section>
  <lightning-modal-header label="x"></lightning-modal-header>
</template>`;
  assert.deepEqual(rulesOf("accountPanel", { "accountPanel.js": js, "accountPanel.html": html }), [
    ["accountPanel/accountPanel.js", "modal-separate"],
    ["accountPanel/accountPanel.html", "modal-separate"],
  ]);
  // c-milvus-modal도 LightningModal 밖에서는 쓰지 않는다. 걸린 것이 메시지에 나온다
  const [issue] = checkModalComponent(`${LWC}/card`, [{ path: `${LWC}/card/card.html`, text: `<template><c-milvus-modal label="x"></c-milvus-modal></template>` }]);
  assert.equal(issue.rule, "modal-separate");
  assert.match(issue.message, /\(c-milvus-modal\)/);
  assert.match(issue.fix ?? "", /c\/modal_accountEdit/);
});

test("modal_ 컴포넌트가 LightningModal을 상속하지 않으면 modal-base", () => {
  const plain = MODAL_JS.replace('import LightningModal from "lightning/modal";', 'import { LightningElement } from "lwc";').replace("extends LightningModal", "extends LightningElement");
  assert.deepEqual(rulesOf("modal_accountEdit", { "modal_accountEdit.js": plain, "modal_accountEdit.html": MODAL_HTML }), [
    ["modal_accountEdit/modal_accountEdit.js", "modal-base"],
  ]);
  // JS가 아직 없어도 같다(hook은 파일 하나를 쓸 때마다 돈다)
  assert.deepEqual(rulesOf("modal_accountEdit", { "modal_accountEdit.html": MODAL_HTML }), [["modal_accountEdit/modal_accountEdit.js", "modal-base"]]);
});

test("modal_ 템플릿이 <c-milvus-modal> 하나가 아니면 modal-frame", () => {
  const frame = (html: string) => rulesOf("modal_x", { "modal_x.js": MODAL_JS, "modal_x.html": html });
  const bad = [
    // helper를 직접 쓴다(여러 단계 모달도 예외 없음)
    `<template><lightning-modal-header label="x"></lightning-modal-header><lightning-modal-body>내용</lightning-modal-body></template>`,
    // c-milvus-modal 밖에 다른 요소가 있다
    `<template><p>밖</p><c-milvus-modal label="x">내용</c-milvus-modal></template>`,
    `<template><c-milvus-modal label="x">내용</c-milvus-modal><p>밖</p></template>`,
    // 둘이다
    `<template><c-milvus-modal label="x"></c-milvus-modal><c-milvus-modal label="y"></c-milvus-modal></template>`,
    // 슬롯 안에 footer를 따로 둔다
    `<template><c-milvus-modal label="x"><lightning-modal-footer></lightning-modal-footer></c-milvus-modal></template>`,
    `<template><c-milvus-modal label="x"><div class="slds-modal__footer_directional"></div></c-milvus-modal></template>`,
  ];
  for (const html of bad) assert.deepEqual(frame(html), [["modal_x/modal_x.html", "modal-frame"]], html);
  // 템플릿이 없으면 있어야 할 파일 이름으로 알린다
  assert.deepEqual(rulesOf("modal_x", { "modal_x.js": MODAL_JS }), [["modal_x/modal_x.html", "modal-frame"]]);
});
