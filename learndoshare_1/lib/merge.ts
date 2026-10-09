// init·update가 프로젝트 소유 파일에 밀버스 항목을 더하는 도구(설계 3장의 병합 예외).
// 원칙: 사용자 항목은 지우거나 순서를 바꾸지 않고, 같은 항목은 두 번 넣지 않는다. 그래서 다시 실행해도 결과가 같다

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const commandsOf = (entry: unknown): unknown[] =>
  isObj(entry) && Array.isArray(entry.hooks) ? entry.hooks.map((h) => h?.command) : [];

function mergeArray(existing: unknown[], add: unknown[], isHookList: boolean): unknown[] {
  const out = [...existing];
  for (const item of add) {
    if (isHookList && isObj(item) && Array.isArray(item.hooks)) {
      // hooks.<이벤트>: 같은 command가 이미 있으면(matcher가 달라도) 그 hook은 넣지 않는다
      const have = new Set(out.flatMap(commandsOf));
      const hooks = item.hooks.filter((h) => !have.has(h?.command));
      if (hooks.length) out.push({ ...item, hooks });
    } else if (!out.some((x) => JSON.stringify(x) === JSON.stringify(item))) {
      out.push(item);
    }
  }
  return out;
}

function merge(existing: unknown, add: unknown, path: string[]): unknown {
  if (Array.isArray(existing) && Array.isArray(add)) {
    return mergeArray(existing, add, path.length === 2 && path[0] === "hooks");
  }
  if (isObj(existing) && isObj(add)) {
    const out: Obj = { ...existing };
    for (const [k, v] of Object.entries(add)) out[k] = Object.hasOwn(existing, k) ? merge(existing[k], v, [...path, k]) : v;
    return out;
  }
  // 값이 다르거나 모양이 다르면 사용자 값을 지킨다
  return existing;
}

/** .claude/settings.json 병합(설계 7.2). 배열은 기존 순서 뒤에 없는 항목만 붙인다. 입력은 바꾸지 않는다 */
export function mergeSettings(existing: Obj | undefined, fragment: Obj): Obj {
  return merge(existing ?? {}, fragment, []) as Obj;
}

/** .gitignore·.forceignore·.npmrc에 없는 줄만 끝에 붙인다(앞뒤 공백은 무시하고 비교). 붙일 것이 없으면 text를 그대로 돌려준다 */
export function appendLines(text: string | undefined, lines: string[]): string {
  const eol = text?.includes("\r\n") ? "\r\n" : "\n";
  const have = new Set((text ?? "").split(/\r?\n/).map((l) => l.trim()));
  const add = [...new Set(lines)].filter((l) => !have.has(l.trim()));
  if (!add.length) return text ?? "";
  const head = !text ? "" : text.endsWith("\n") ? text : text + eol;
  return head + add.join(eol) + eol;
}

/**
 * key가 없을 때만 value를 넣은 새 객체를 돌려준다. 있으면 obj를 그대로 돌려준다.
 * 점 경로("scripts.storybook")는 안쪽 객체에 넣고, 중간 객체가 없으면 만든다. 중간 값이 객체가 아니면 건드리지 않는다
 */
export function addKeyIfMissing<T extends object>(obj: T, key: string, value: unknown): T {
  const [head, ...rest] = key.split(".");
  const o = obj as Obj;
  if (!rest.length) return Object.hasOwn(o, head) ? obj : ({ ...o, [head]: value } as T);
  const inner = Object.hasOwn(o, head) ? o[head] : {};
  if (!isObj(inner)) return obj;
  const next = addKeyIfMissing(inner, rest.join("."), value);
  return next === inner ? obj : ({ ...o, [head]: next } as T);
}
