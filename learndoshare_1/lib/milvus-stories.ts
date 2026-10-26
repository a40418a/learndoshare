// 밀버스 컴포넌트를 Storybook에 자동 등록할 글을 만든다(설계 docs/specs/2026-10-26-milvus-story-sync-design.md).
// 파일을 쓰지 않는 함수만 둔다. 쓰기는 scripts/generate-milvus-stories.ts가 한다
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 생성 파일마다 첫 줄. 생성기는 이 줄이 있는 폴더만 지운다(설계 4.2) */
export const GENERATED_MARK = "// 생성 파일: scripts/generate-milvus-stories.ts. 고치지 않는다";

/** 사용자가 고칠 수 있는 오류(이름 규칙, 지우기 거부). CLI가 한국어 문구와 종료 코드 1로 바꾼다 */
export class GenerateError extends Error {}

export type ComponentNames = { folder: string; exportName: string; tag: string; storyName: string };

/** 폴더 이름에서 export 이름·태그·스토리 이름을 만든다(설계 4.1) */
export function componentNames(folder: string): ComponentNames {
  if (!/^milvus[A-Z][A-Za-z0-9]*$/.test(folder)) {
    throw new GenerateError(`밀버스 컴포넌트 폴더 이름은 milvus 다음 첫 글자가 영문 대문자여야 한다(예: milvusFoo): ${folder}`);
  }
  return {
    folder,
    exportName: folder[0].toUpperCase() + folder.slice(1),
    tag: `c-${folder.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
    storyName: folder.slice("milvus".length),
  };
}

/**
 * lwcDir 바로 아래의 milvus 폴더 중 <폴더>.js와 <폴더>.html이 둘 다 있는 것(화면 컴포넌트)을 이름순으로.
 * 파일 이름은 readdirSync 결과로 대소문자까지 비교한다(Windows의 existsSync는 대소문자를 무시한다)
 */
export function findMilvusComponents(lwcDir: string): ComponentNames[] {
  if (!existsSync(lwcDir)) return [];
  return readdirSync(lwcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("milvus"))
    .filter((d) => {
      const files = readdirSync(join(lwcDir, d.name));
      return files.includes(`${d.name}.js`) && files.includes(`${d.name}.html`);
    })
    .map((d) => d.name)
    .sort()
    .map(componentNames);
}

/** stories/milvus-generated/entry.js. lwc-entry.js가 다시 내보낸다 */
export function entrySource(components: ComponentNames[]): string {
  return [GENERATED_MARK, ...components.map((c) => `export { default as ${c.exportName} } from "c/${c.folder}";`)].join("\n") + "\n";
}

/**
 * 손으로 쓴 스토리가 있는지. handFiles는 stories/components/milvus의 readdirSync 결과다(대소문자까지 비교, 설계 4.2)
 * ponytail: 손 스토리는 파일 이름으로만 판정한다. title이 같고 이름이 다르면 Storybook 중복 오류로 드러난다(설계 5장)
 */
export function hasHandStory(handFiles: string[], storyName: string): boolean {
  return handFiles.includes(`${storyName}.stories.js`) || handFiles.includes(`${storyName}.stories.ts`);
}

export type ApiProp ={ name: string; control: "boolean" | "number" | "text" | "object"; value?: boolean | number | string; description?: string };

// ponytail: @api는 정규식으로 읽는다. 한 줄에 선언 둘, 여러 줄 기본값은 text로 떨어진다. 틀리게 나오면 @lwc/babel-plugin-component 메타데이터로 바꾼다
// 주석 본문은 */를 넘지 않고, /** */와 @api 사이는 공백만 허용한다(떨어진 클래스 JSDoc을 붙이지 않는다)
const API = /(?:\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*)?@api\s+(get\s+)?([A-Za-z_$][\w$]*)\s*(\(|=\s*([^;\n]+)|;)/g;

const jsdoc = (body: string): string =>
  body
    .split("\n")
    .map((line) => line.replace(/^\s*\*?/, "").trim())
    .filter(Boolean)
    .join(" ");

/** .js의 @api 선언을 Controls로 바꾼다(설계 4.3 표). 메서드는 뺀다 */
export function parseApiProps(js: string): ApiProp[] {
  const props: ApiProp[] = [];
  for (const m of js.replace(/\r\n/g, "\n").matchAll(API)) {
    const [, comment, getter, name, tail, raw] = m;
    if (!getter && tail === "(") continue;
    const prop: ApiProp = { name, control: "text" };
    const value = raw?.trim();
    if (!getter && value !== undefined) {
      if (value === "true" || value === "false") Object.assign(prop, { control: "boolean", value: value === "true" });
      else if (/^-?\d+(\.\d+)?$/.test(value)) Object.assign(prop, { control: "number", value: Number(value) });
      else if (/^(["'])(.*)\1$/.test(value)) prop.value = value.slice(1, -1);
      else if (/^[[{]/.test(value)) prop.control = "object";
    }
    const description = comment === undefined ? "" : jsdoc(comment);
    if (description) prop.description = description;
    props.push(prop);
  }
  return props;
}

/** .js-meta.xml의 description. 여는 태그가 두 줄로 나뉜 모양도 읽고 XML 기호를 되돌린다 */
export function parseDescription(metaXml: string | undefined): string {
  const m = metaXml && /<description\b[^>]*>([\s\S]*?)<\/description>/.exec(metaXml);
  if (!m) return "";
  return m[1]
    .replace(/\r\n/g, "\n")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export type MilvusComponent = ComponentNames & { description: string; props: ApiProp[] };

/** <폴더>.js와(있으면) <폴더>.js-meta.xml을 읽는다 */
export function loadComponent(lwcDir: string, names: ComponentNames): MilvusComponent {
  const dir = join(lwcDir, names.folder);
  const meta = join(dir, `${names.folder}.js-meta.xml`);
  return {
    ...names,
    description: parseDescription(existsSync(meta) ? readFileSync(meta, "utf8") : undefined),
    props: parseApiProps(readFileSync(join(dir, `${names.folder}.js`), "utf8")),
  };
}

/** 기본 스토리 글(설계 4.3). 문자열은 모두 JSON.stringify로 넣고 줄 끝은 LF만 쓴다 */
export function storySource(c: MilvusComponent): string {
  const q = (v: unknown) => JSON.stringify(typeof v === "string" ? v.replace(/\r\n?/g, "\n") : v);
  const hand = `stories/components/milvus/${c.storyName}.stories.js`;
  const notice = `> 자동으로 만든 기본 스토리입니다. 예시나 변형이 필요하면 \`${hand}\`를 쓰세요`;
  const args = c.props.filter((p) => p.value !== undefined).map((p) => `    ${q(p.name)}: ${q(p.value)}`);
  const argTypes = c.props.map(
    (p) => `    ${q(p.name)}: { control: ${q(p.control)}${p.description ? `, description: ${q(p.description)}` : ""} }`,
  );
  const block = (lines: string[]) => (lines.length ? `{\n${lines.join(",\n")}\n  }` : "{}");
  return [
    GENERATED_MARK,
    `// 예시나 변형이 필요하면 ${hand}를 쓴다. 그 파일이 생기면 다음 빌드부터 이 파일은 만들지 않는다`,
    `import { ${c.exportName}, ORIGIN, lwc, sourceFor, sourceStory } from "../helpers.js";`,
    ``,
    `export default {`,
    `  title: ${q(`컴포넌트/밀버스 추가/${c.storyName}`)},`,
    `  render: (args) => lwc(${q(c.tag)}, ${c.exportName}, args),`,
    `  args: ${block(args)},`,
    `  argTypes: ${block(argTypes)},`,
    `  parameters: {`,
    `    docs: {`,
    `      source: sourceFor(${q(c.tag)}),`,
    `      description: { component: ORIGIN.milvus + "\\n\\n" + ${q([c.description, notice].filter(Boolean).join("\n\n"))} }`,
    `    }`,
    `  }`,
    `};`,
    ``,
    `export const 기본 = {};`,
    `export const 소스_코드 = sourceStory(${q(c.folder)});`,
    ``,
  ].join("\n");
}
