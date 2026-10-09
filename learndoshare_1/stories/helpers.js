// Rollup으로 미리 컴파일한 LWC 번들 (pnpm build:lwc). Storybook(Vite)은 결과물만 @milvus/lwc alias로 읽는다.
import { createElement } from "@milvus/lwc/index.js";

export * from "@milvus/lwc/index.js";

/**
 * LWC 컴포넌트를 DOM 요소로 만든다.
 * customElements.define 대신 createElement를 쓰면 태그 이름이 엔진 내부 등록과 충돌하지 않는다.
 */
export function lwc(tag, Ctor, props = {}, events = {}) {
  const element = createElement(tag, { is: Ctor });
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) element[key] = value;
  }
  for (const [name, handler] of Object.entries(events)) {
    if (handler)
      element.addEventListener(name, (event) => handler(event.detail ?? event));
  }
  return element;
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * 스토리 args를 LWC 템플릿 사용 코드로 바꾼다. "Show code"와 코드 패널에 표시된다.
 * 배열·객체는 JS 속성으로 넘겨야 하므로 {이름} 바인딩으로 쓴다.
 */
export function usage(tag, args = {}, { events = [] } = {}) {
  const attrs = [];
  for (const [key, value] of Object.entries(args)) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === false ||
      typeof value === "function"
    )
      continue;
    if (value === true) attrs.push(kebab(key));
    else if (typeof value === "object") attrs.push(`${kebab(key)}={${key}}`);
    else attrs.push(`${kebab(key)}="${String(value).replace(/"/g, "&quot;")}"`);
  }
  for (const name of events)
    attrs.push(`on${name}={handle${name[0].toUpperCase()}${name.slice(1)}}`);
  const open = attrs.length
    ? `<${tag}\n    ${attrs.join("\n    ")}\n>`
    : `<${tag}>`;
  return `${open}</${tag}>`;
}

/** parameters.docs.source 설정: controls를 바꾸면 코드도 따라 바뀐다 */
export const sourceFor = (tag, options) => ({
  transform: (_code, context) => usage(tag, context.args, options)
});

/** 여러 요소를 한 줄로 늘어놓는다 (변형 모음 스토리용) */
export function row(...children) {
  const div = document.createElement("div");
  div.className = "sb-row";
  div.append(...children);
  return div;
}

// 밀버스 컴포넌트의 실제 소스. 문서 페이지에 그대로 보여 준다 (문서와 실물이 갈라지지 않게)
const RAW = import.meta.glob(
  "../force-app/main/default/lwc/*/*.{html,js,css}",
  {
    query: "?raw",
    import: "default",
    eager: true
  }
);

function sourceFiles(name) {
  return Object.entries(RAW)
    .filter(([path]) => path.includes(`/lwc/${name}/`))
    .map(([path, code]) => [path.split("/").pop(), code.trim()])
    .sort(([a], [b]) => a.localeCompare(b));
}

/** 문서 페이지 맨 끝에 붙는 "소스 코드" 스토리. 저장소의 실제 파일을 그대로 보여 준다 */
export function sourceStory(name) {
  const files = sourceFiles(name);
  return {
    name: "소스 코드",
    render: () => {
      const root = document.createElement("div");
      root.className = "sb-stack";
      for (const [file, code] of files) {
        const title = document.createElement("p");
        title.className = "slds-text-title_caps";
        title.textContent = `force-app/main/default/lwc/${name}/${file}`;
        const pre = document.createElement("pre");
        pre.className = "sb-code";
        pre.textContent = code;
        root.append(title, pre);
      }
      return root;
    },
    parameters: {
      controls: { disable: true },
      docs: {
        source: {
          transform: (code) => code,
          code: files
            .map(([file, code]) => `<!-- ${file} -->\n${code}`)
            .join("\n\n")
        }
      }
    }
  };
}

/** 페이지 상단 표시: 이 컴포넌트가 어디서 왔는지 */
export const ORIGIN = {
  slds: "> **SLDS 기본** · Salesforce가 제공하는 `lightning-*` 컴포넌트를 그대로 렌더한다. 색은 org 브랜드를 따른다.",
  milvus:
    "> **밀버스 추가** · Salesforce가 제공하지 않는 기능을 SLDS 블루프린트와 `lightning-*` 위에 더한 밀버스 컴포넌트다."
};
