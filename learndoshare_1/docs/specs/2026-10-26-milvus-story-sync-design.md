# 밀버스 컴포넌트 Storybook 자동 등록 설계

- 상태: **승인** (2026-10-26 사용자 승인). 이슈 [#76](https://github.com/a40418a/learndoshare/issues/76), 브랜치 `feat/76-milvus-story-sync`, 구현 계획 `docs/plans/2026-10-26-milvus-story-sync-plan.md`
- 작업 저장소: 이 저장소(learndoshare)에서 만들고, 병합 뒤 배포 저장소(Milvus-Wina/milvus-design-system)로 옮긴다

## 1. 목적

이 저장소에서 `milvus*` LWC를 만들거나 고친 뒤 **빌드 명령 하나로 Storybook이 그 코드를 그대로 갖게** 한다. 컴포넌트를 더할 때마다 손으로 등록하는 일을 없애, `force-app`과 Storybook이 어긋날 수 없게 한다.

## 2. 범위

| 하는 것                                                                                                                                       | 하지 않는 것                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm build:lwc`(그래서 `pnpm storybook`·`build-storybook`도)와 `prepack`이 `force-app`의 `milvus*` 화면 컴포넌트를 찾아 Storybook에 등록한다 | 고객 프로젝트의 `pnpm milvus …` 명령과 동작은 바꾸지 않는다                                     |
| 손으로 쓴 스토리가 없는 컴포넌트에 기본 스토리를 만든다                                                                                       | 손으로 쓴 스토리를 고치거나 덮어쓰지 않는다                                                     |
|                                                                                                                                               | 고객 프로젝트의 LWC를 고객 Storybook에 띄우지 않는다(2.1)                                       |
|                                                                                                                                               | 파일을 고칠 때마다 다시 만드는 watch는 만들지 않는다. 지금처럼 `pnpm storybook`을 다시 실행한다 |

고객 프로젝트에서 `milvus*`는 패키지가 준 것만 쓴다. 공용 컴포넌트가 필요하면 밀버스에 요청하고, 이 저장소에서 만들어 발행한 뒤 `update`로 받아 쓴다. 이번 기능은 그 "이 저장소에서 만드는" 단계를 줄인다.

### 2.1 고객 LWC를 띄우지 않는 이유 (2026-10-26 사용자 결정)

- 이 Storybook은 다시 쓰는 부품(SLDS 기본 컴포넌트와 `milvus*`)에 브랜드가 어떻게 입혀지는지 보는 곳이다. 고객 프로젝트의 LWC는 부품을 묶어 실제 화면(레코드 페이지, 앱 페이지)에 두는 것이라, 맞는지는 레코드 컨텍스트·org 데이터·권한·페이지 배치에 달려 있다
- org 데이터 없이 띄우면 빈 상태만 보인다. 가짜 데이터를 넣으면 org와 따로 노는 두 번째 사본이 생겨, "같은 코드를 쓴다"는 이 기능의 목적과 어긋난다
- 실제 고객 프로젝트 하나(LWC 82개)의 import를 세어 보았다(2026-10-26, 개수만 셌다)
  - org 없이 그대로 그려지는 것은 2개, 라벨·이동 같은 간단한 대체 모듈만 있으면 되는 것이 4개다
  - 나머지 약 90%는 데이터가 필요하다. 75개가 Apex를 직접 import하고, `@wire`는 53개, LDS(`lightning/ui*Api`)는 27개가 쓴다
  - 71개가 App Builder에 노출되고, 그중 55개가 빠른 작업(`lightning__RecordAction`)이다. 대부분 `@api recordId`에 기대어 레코드 없이는 뜻이 없다
- 지금 고객 LWC는 컴파일되지도 않는다. `sfdxLwcModules`는 `c/<이름>`으로 찾을 수 있게 등록만 하고, Rollup은 진입 파일이 닿는 모듈만 컴파일한다(`lib/lwc-build.ts`, `cli/storybook.ts`). 고객 LWC 하나라도 진입에서 닿으면 Apex·고객 라벨·`lightning/uiRecordApi` 같은 org 전용 import를 풀지 못해 빌드 전체가 실패하고 Storybook이 뜨지 않는다(`lib/lwc-build.ts`의 `UNRESOLVED_IMPORT` 처리)
- 화면은 org에 붙는 Salesforce Live Preview(`sf lightning dev component`·`app`)로 확인한다(README 3장)
- 여러 화면에서 쓸 부품이 생기면 밀버스에 요청해 `milvus*`로 만든다. 그러면 이 기능으로 Storybook에 자동으로 뜬다

## 3. 지금 흐름 (확인 2026-10-26)

- `pnpm build:lwc` = `generate-slds-catalog.ts` → `build-lwc.ts`. `build-lwc.ts`는 진입 두 개(`index` = `stories/lwc-entry.js`, `catalog` = `stories/slds-catalog/entry.js`)와 모듈 목록(`sfdxLwcModules(".")`가 주는 force-app LWC의 `c/<이름>` 별칭, `catalogModules`가 주는 카탈로그 예제)으로 Rollup 빌드해 `dist/lwc`에 쓴다. Storybook은 `@milvus/lwc`로 그 결과를 읽는다
- 모듈 목록은 이름으로 찾는 별칭일 뿐이다. Rollup은 진입에서 import로 닿는 모듈만 컴파일한다
- 컴포넌트 코드는 이미 같은 파일 하나다. 빌드가 `force-app`의 파일을 그대로 컴파일하고, 스토리의 "소스 코드"(`sourceStory`)도 `import.meta.glob`으로 실제 파일을 읽는다
- 손으로 하는 일은 두 가지다
  1. `stories/lwc-entry.js`에 `export { default as MilvusFoo } from "c/milvusFoo";` 한 줄을 넣는다. 안 넣으면 그 컴포넌트는 진입에서 닿지 않아 컴파일되지 않고, 스토리도 가져올 수 없다
  2. `stories/components/milvus/Foo.stories.js`를 쓴다
- SLDS 카탈로그가 이미 같은 방식이다: `stories/slds-catalog/`를 `build:lwc`와 `prepack`이 만들고(커밋하지 않음, `.gitignore`), 패키지에 그대로 들어가 고객 프로젝트의 `milvus storybook`도 그것을 쓴다

## 4. 설계

### 4.1 찾는 대상

- **대상:** `force-app/main/default/lwc/` 바로 아래의 `milvus`로 시작하는 폴더 가운데, 그 폴더 바로 아래에 `<폴더 이름>.js`와 `<폴더 이름>.html`이 둘 다 있는 것(화면 컴포넌트). 하위 폴더(`__tests__` 등)와 이름이 다른 `.html`은 보지 않는다. 그래서 `render()`로 다른 템플릿만 쓰는 컴포넌트는 대상이 아니다
- 지금은 `milvusBadge`, `milvusBrandLoader`, `milvusCalendar`, `milvusModal`, `milvusMultiSelect`, `milvusNotification` 6개다. `milvusScript`는 html이 없는 공용 함수 모듈이라 빠진다
- **이름 규칙:** 폴더 이름은 `milvus` 다음 첫 글자가 영문 대문자여야 한다(`milvusFoo`). 아니면(`milvusfoo`) 생성기가 그 폴더 이름을 보여 주며 실패한다(5장)
- 이름은 폴더 이름에서 만든다. export 이름은 첫 글자를 대문자로, 태그는 `c-` 뒤에 camelCase를 kebab-case로, 스토리 이름은 `milvus`를 뺀 나머지다

  | 폴더                | export 이름         | 태그                    | 스토리 이름   |
  | ------------------- | ------------------- | ----------------------- | ------------- |
  | `milvusMultiSelect` | `MilvusMultiSelect` | `c-milvus-multi-select` | `MultiSelect` |

  export 이름은 지금 손으로 쓴 것과 같아서 기존 스토리는 고칠 것이 없다

### 4.2 생성물: `stories/milvus-generated/` (커밋하지 않음)

| 파일 | 내용 |
| --- | --- |
| `entry.js` | 첫 줄은 표시 주석, 그다음 찾은 컴포넌트마다 `export { default as MilvusFoo } from "c/milvusFoo";` |
| `<스토리 이름>.stories.js` | 손으로 쓴 스토리(아래 판정)가 **없을 때만** 만든다. 첫 줄은 같은 표시 주석이다 |

- **표시 주석:** `// 생성 파일: scripts/generate-milvus-stories.ts. 고치지 않는다`
- **손으로 쓴 스토리 판정:** `stories/components/milvus/`를 `readdirSync`로 읽어, `<스토리 이름>.stories.js`나 `<스토리 이름>.stories.ts`와 대소문자까지 같은 이름이 있으면 손으로 쓴 것으로 본다. `existsSync`는 Windows에서 대소문자를 무시해 Linux CI·`prepack`과 결과가 달라지므로 쓰지 않는다
- **다시 쓰기:** 실행할 때마다 폴더를 지우고 다시 쓴다. 지운 컴포넌트가 남지 않는다. 손으로 쓴 스토리를 만들면 다음 빌드부터 그 컴포넌트의 기본 스토리는 생기지 않는다
- **지우기 전 확인:** 출력 폴더가 없거나, 비었거나, `entry.js` 첫 줄이 표시 주석일 때만 지운다. 아니면 지우지 않고 실패한다(5장). 카탈로그 생성기의 `assertErasable`과 같은 보호다. 카탈로그 폴더에도 `entry.js`가 있으므로 파일 이름이 아니라 첫 줄로 구별한다
- **경로:** 생성물에는 개발자 PC 경로를 넣지 않는다. import는 `c/<이름>`과 `../helpers.js`만 쓴다(패키지에 들어가 다른 PC에서 쓰인다)
- 지금 6개는 모두 손으로 쓴 스토리가 있어서 **생성되는 스토리는 0개**이고 `entry.js`만 생긴다. 새 컴포넌트부터 기본 스토리가 생긴다

### 4.3 기본 스토리 내용

```js
// 생성 파일: scripts/generate-milvus-stories.ts. 고치지 않는다
// 예시나 변형이 필요하면 stories/components/milvus/Foo.stories.js를 쓴다. 그 파일이 생기면 다음 빌드부터 이 파일은 만들지 않는다
import { MilvusFoo, ORIGIN, lwc, sourceFor, sourceStory } from "../helpers.js";

export default {
  title: "컴포넌트/밀버스 추가/Foo",
  render: (args) => lwc("c-milvus-foo", MilvusFoo, args),
  args: { variant: "info", dismissible: false },
  argTypes: {
    variant: {
      control: "text",
      description: "info(기본) | success | warning | error"
    },
    dismissible: { control: "boolean", description: "닫기 버튼을 보인다" }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-foo"),
      description: {
        component: ORIGIN.milvus + "\n\n" + "<js-meta.xml의 description>" + "\n\n" + "> 자동으로 만든 기본 스토리입니다. 예시나 변형이 필요하면 `stories/components/milvus/Foo.stories.js`를 쓰세요"
      }
    }
  }
};

export const 기본 = {};
export const 소스_코드 = sourceStory("milvusFoo");
```

- **문자열 넣기:** 생성 코드에 들어가는 문자열(title, 태그, JSDoc 설명, description, 기본값)은 모두 `JSON.stringify`로 넣는다(카탈로그 생성기와 같다). 템플릿 리터럴 안에 원문을 끼우지 않는다. 읽은 원문의 줄바꿈 `\r\n`은 `\n`으로 맞춘다. 실제 설명에도 큰따옴표가 있다(`milvusCalendar`의 `"+N개 더"`, `milvusBrandLoader` description)
- 설명: 컴포넌트의 `.js-meta.xml`을 `/<description\b[^>]*>([\s\S]*?)<\/description>/`로 읽고 앞뒤 공백을 지운다. 여는 태그가 두 줄로 나뉜 `milvusBrandLoader` 모양도 잡는다. `&amp;` `&lt;` `&gt;` `&quot;` `&apos;`는 되돌린다. 지금 6개 모두 있다
- Controls: `.js`의 `@api` 선언에서 만든다. 설명은 바로 위 `/** … */` 주석이다
  | 선언                                  | Control     | 시작 값 |
  | ------------------------------------- | ----------- | ------- |
  | `@api x = true` / `false`             | boolean     | 그 값   |
  | `@api x = 3`                          | number      | 그 값   |
  | `@api x = "info"`                     | text        | 그 값   |
  | `@api x = [ … ]` / `{ … }`            | object      | 없음    |
  | `@api x;`, `@api` 다음 줄의 `get x()` | text        | 없음    |
  | `@api focus() { … }`(메서드)          | 넣지 않는다 |         |
- "Show code"는 `sourceFor`가 Controls 값으로 사용 코드를 보여 준다(기존 helper). "소스 코드" 스토리는 실제 파일이다(기존 `sourceStory`)
- 그릴 자리가 따로 필요한 컴포넌트(예: `LightningModal` 안에서만 동작하는 `milvusModal`)는 기본 스토리로는 제대로 보이지 않는다. 이런 컴포넌트는 손으로 스토리를 쓴다. 기본 스토리는 "빠짐없이 뜨는 것"을 맡고, 좋은 예시는 손으로 쓴 스토리가 맡는다
- `<slot>`으로 내용을 받는 컴포넌트(예: `milvusNotification`, `milvusModal`)도 기본 스토리로는 내용이 비어 보인다. `lwc()`는 호스트에 속성만 넣고, synthetic shadow에서는 호스트에 붙인 자식이 슬롯에 들어가지 않기 때문이다(README 3장 "createElement와 슬롯"). 이런 컴포넌트는 슬롯을 채우는 스토리 전용 LWC(`stories/lwc/`)와 손 스토리를 쓴다

### 4.4 연결

| 파일                                      | 바뀌는 것                                                                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/milvus-stories.ts` (새)              | 찾기, `@api`·description 해석, `entry.js`·스토리 글 만들기. 파일을 쓰지 않는 함수만 둔다(테스트하기 쉽게)                                                                                                 |
| `scripts/generate-milvus-stories.ts` (새) | `generateMilvusStories({ lwcDir, handStoriesDir, out })`를 내보낸다(카탈로그의 `generateCatalog({ lbcDir, outStories })`와 같은 모양). 4.2의 확인을 거쳐 `out`을 지우고 다시 쓴다. 저장소 기본값(`force-app/main/default/lwc`, `stories/components/milvus`, `stories/milvus-generated`)은 main 가드 아래의 CLI만 쓴다. import만 해서는 파일을 건드리지 않는다 |
| `package.json`                            | `build:lwc`: 카탈로그 생성 → **밀버스 스토리 생성** → `build-lwc.ts`. `prepack`에도 생성을 넣는다                                                                                                         |
| `stories/lwc-entry.js`                    | 밀버스 컴포넌트 export 6줄을 `export * from "./milvus-generated/entry.js";` 한 줄로 바꾼다. synthetic shadow import, `createElement`, 스토리 전용 데모(`NotificationSlotDemo`, `ModalDemo`)는 그대로 둔다 |
| `.gitignore`                              | `stories/milvus-generated/`                                                                                                                                                                               |
| `.storybook/main.ts`                      | 바꾸지 않는다. `stories/` 아래 모든 `.stories.js`·`.stories.ts`를 읽는 지금 글롭이 생성 폴더도 읽는다                                                                                                     |
| `cli/storybook.ts`                        | 바꾸지 않는다. 고객 쪽은 패키지에 든 `lwc-entry.js`와 생성 폴더를 그대로 쓴다                                                                                                                             |
| `tests/storybook-cli.test.ts`             | 고친다. 가짜 패키지(`makePkg`)는 저장소의 `lwc-entry.js`와 `stories/lwc`만 복사해서, `lwc-entry.js`가 생성 entry를 import하면 빌드 테스트가 깨진다. light·broken이 아닐 때 `lib/milvus-stories.ts`의 함수로 저장소 `force-app` 기준의 `entry.js`를 만들어 `<pkg>/stories/milvus-generated/`에 직접 쓴다. 저장소의 생성 폴더는 복사하지 않는다(gitignore 대상이라 CI의 `pnpm test` 시점에 없고, pack 테스트의 `prepack`이 같은 시간에 다시 쓴다). `publish.yml`도 발행 전에 `pnpm test`를 돌리므로 이 수정이 없으면 발행도 막힌다 |

- **고객 쪽:** `package.json`의 `files`에 `stories`가 있어 생성물이 패키지에 들어간다. 고객 프로젝트의 `milvus*` 사본은 `init`·`update`가 패키지와 같은 목록으로 놓고, 버전이 다르면 `assertSameVersion`이 이미 빌드 전에 막는다
- **새 밀버스 컴포넌트를 만드는 순서(바뀐 뒤):** `force-app/main/default/lwc/milvusFoo/`를 만든다 → `pnpm storybook` → "컴포넌트 / 밀버스 추가 / Foo"가 뜬다 → 필요하면 `stories/components/milvus/Foo.stories.js`를 손으로 쓰고 `pnpm storybook`을 다시 실행한다. 다시 빌드하기 전까지는 생성 스토리가 남아 있어 손 스토리와 export 이름이 겹치면 중복 오류가 난다(5장)
- CLAUDE.md의 "컴포넌트마다 스토리"는 손으로 쓴 스토리를 뜻한다. 기본 스토리는 빠짐없이 뜨게 하는 바탕이고, 새 컴포넌트를 병합할 때는 지금처럼 손 스토리를 함께 쓴다

### 4.5 의도적 단순화 (`ponytail:` 주석으로 남긴다)

- `@api` 해석은 정규식이다. 한 줄에 선언 두 개, 기본값이 여러 줄인 식은 text로 떨어진다. 실제로 틀리게 나오면 `@lwc/babel-plugin-component`의 메타데이터나 JS 파서로 바꾼다
- 손으로 쓴 스토리인지는 파일 이름으로만 본다(4.2). 파일 안의 title은 읽지 않는다. 이름이 규칙과 다르면 5장 마지막 행처럼 된다

## 5. 오류 처리

| 상황                                                              | 동작                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 밀버스 컴포넌트가 컴파일되지 않는다                               | 지금처럼 Rollup이 실패하고 `build-storybook`(CI)이 실패한다. 이 저장소의 컴포넌트라 숨기지 않는다                                                                                                                                                                                  |
| `@api` 기본값을 해석하지 못한다                                   | 그 속성은 text Control, 시작 값 없음. 빌드는 멈추지 않는다                                                                                                                                                                                                                         |
| `.js-meta.xml`이 없거나 description이 없다                        | 설명 없이 만든다                                                                                                                                                                                                                                                                   |
| 출력 폴더가 비어 있지 않고 `entry.js` 첫 줄도 표시 주석이 아니다 | 지우지 않는다. "출력 위치가 비어 있지 않고 밀버스 스토리 생성기가 만든 폴더도 아니다. 지우지 않는다: <경로>"를 내고 종료 코드 1로 끝난다(카탈로그 생성기의 `UnsafeOutputError`와 같다). `build:lwc`도 여기서 멈춘다 |
| 폴더 이름이 `milvus` 다음 대문자로 시작하지 않는다(`milvusfoo`) | 그 폴더 이름과 이름 규칙(4.1)을 보여 주고 종료 코드 1로 끝난다 |
| 손으로 쓴 스토리의 파일 이름이 규칙과 다르다(대소문자 포함) | 기본 스토리도 함께 생긴다. 두 파일의 title이 같고 export 이름도 겹치면(지금 손 스토리 6개는 모두 `소스_코드`를 export한다) Storybook이 `IndexingError: Duplicate stories with id`로 멈추고 두 파일 경로를 보여 준다(Storybook 10.6.0 `core-server`의 `chooseDuplicate`, 2026-10-26 확인). export가 겹치지 않으면 오류 없이 한 문서 페이지에 섞이고, title도 다르면 페이지가 둘 생긴다. 생성 스토리 머리 주석에 올바른 파일 이름을 적어 둔다(4.3) |

## 6. 테스트와 확인

- **원칙:** 테스트는 임시 폴더에만 쓴다. 저장소의 `stories/milvus-generated/`는 읽지도 쓰지도 않는다. pack 테스트의 `prepack`이 같은 시간에 다시 만들기 때문이다(`tests/catalog.test.ts`와 같다). 저장소 상태에 묶인 숫자(6개, 0개)로 단언하지 않는다. 새 컴포넌트를 만드는 순간 깨지기 때문이다
- `tests/milvus-stories.test.ts` (`node --test`)
  1. 찾기·생성: 임시 폴더의 fixture 네 개로 본다. `milvusHand`(js·html·손 스토리), `milvusAuto`(js·html만), `milvusLib`(js만), `accountCard`(밀버스 아님). 대상은 Hand·Auto이고 `entry.js`에 두 줄이 생기며, 기본 스토리는 `Auto.stories.js` 하나다. export 이름·태그·스토리 이름도 확인한다
  2. 이름 규칙: `milvusfoo` 폴더가 있으면 그 이름을 보여 주며 실패한다
  3. 손 스토리 판정: `Auto.stories.ts`만 있어도 생성하지 않는다. `auto.stories.js`처럼 대소문자만 다르면 생성한다(어느 OS에서나 같게)
  4. `@api` 해석: 4.3 표의 행마다 한 경우씩, `/** */` 설명, `@api` 다음 줄의 getter, 메서드 제외
  5. description: 여는 태그가 두 줄로 나뉜 모양, XML 기호 되돌리기, meta.xml이나 description이 없으면 빈 값
  6. 글이 파싱된다: 스토리 글 함수로 만든 글을 설치된 `rollup/parseAst`로 파싱한다. (a) JSDoc·description에 `"`, 백틱, `${`, `\`, CRLF가 든 가짜 `milvusProbe`. title, `lwc("c-milvus-probe", MilvusProbe`, `기본`·`소스_코드` export도 확인한다. (b) 저장소의 실제 `milvus*` 컴포넌트 전부로도 글을 만들어 파싱한다(파일로는 쓰지 않는다). 지금은 생성 스토리가 0개라 CI의 `build-storybook`이 이 틀을 컴파일하지 않으므로 여기서 잡는다
  7. 다시 실행: 출력 폴더에 남은 이전 생성 파일(지운 컴포넌트의 스토리)은 지워진다. 손 스토리를 더하고 다시 실행하면 그 기본 스토리가 사라진다
  8. 지우기 보호: 남의 파일이 든 폴더와, 표시 주석 없는 `entry.js`가 든 폴더(카탈로그 모양)는 거부하고 안의 파일을 그대로 둔다. CLI로 실행하면 종료 코드 1과 한국어 오류를 낸다
  9. 실제 저장소(메모리에서만): 찾은 목록이 지금의 6개를 포함하고 `milvusScript`를 뺀다
- `tests/storybook-cli.test.ts`: 4.4대로 `makePkg`가 생성 entry를 직접 쓴다. 기존 `MilvusBadge` export 확인은 그대로 두고, 밀버스 화면 컴포넌트 6개와 데모 두 개(`NotificationSlotDemo`, `ModalDemo`)가 모두 export되는지 더한다. 고객 흐름이 그대로인지도 이것으로 확인한다
- `tests/pack.test.ts`
  1. 패키지에 든 `stories/milvus-generated/entry.js`의 export 목록이 패키지에 든 `force-app/main/default/lwc/milvus*/<이름>.html` 목록과 같다
  2. 판정 R1(개발자 PC 경로 검사) 대상에 `package/stories/milvus-generated/`를 더한다
  3. `package.json` 스크립트를 글로 확인한다. `build:lwc`가 카탈로그 생성 → 밀버스 스토리 생성 → `build-lwc.ts` 순서이고, `prepack`에 밀버스 스토리 생성이 있다. CI에서는 pack 테스트의 `prepack`이 생성 폴더를 남겨, `build:lwc`에서 생성 단계가 빠져도 뒤이은 `build-storybook`이 통과해 버리기 때문이다
- `pnpm lint`, `pnpm test`, `pnpm build-storybook`
- 직접 확인: 임시 `milvusProbe`를 만들어 `pnpm storybook`에서 "밀버스 추가 / Probe"가 뜨고 Controls가 바뀌는지 본 뒤 지운다

## 7. 문서

- `CLAUDE.md`·README: 새 밀버스 컴포넌트를 만드는 순서(4.4)와 생성 폴더
- `CLAUDE.md` 4장 표의 `pnpm build-storybook` 행: "`build:lwc`(카탈로그 생성 + 밀버스 스토리 생성 + Rollup LWC 빌드) 뒤 Storybook 정적 빌드"로 고친다
- 고객용 런북은 바꾸지 않는다(고객 쪽 변화 없음)

## 8. 작업 순서

1. 이 문서 검토·승인
2. learndoshare: 이슈 #76 → 브랜치 `feat/76-milvus-story-sync` → 구현 계획 `docs/plans/2026-10-26-milvus-story-sync-plan.md` → 구현 → 6장 확인 → 커밋·PR(요청할 때)
3. 병합 뒤 milvus-design-system으로 옮긴다(이슈·브랜치·PR)

## 9. 정해야 할 것

- ~~milvus-design-system 이슈 #9를 닫을지~~ → **그대로 둔다** (2026-10-26 사용자 결정). #9("프로젝트에서 만든 LWC를 milvus storybook에 자동으로 띄우기")는 이번 기능과 별개이고, 이 문서는 2.1의 이유로 그 방향을 택하지 않는다
- **고객 쪽 빈틈** → 이번 범위 밖. **별도 이슈 [#74](https://github.com/a40418a/learndoshare/issues/74)로 남겼다** (2026-10-26 사용자 결정). 다음 패키지 발행 전에 고친다. 패키지에 없는 `milvus*` 폴더는 `check` 실패, 패키지에서 빠진 컴포넌트(`milvusButton` 등)는 경고만 한다
  - 고객 프로젝트에서 사람이 패키지에 없는 `milvus*` 폴더를 만들어도 막히지 않는다(`check`는 `milvus.config.json`의 관리 목록만 본다)
  - 모달 검사(`lib/modal-rules.ts`)가 `milvus*` 폴더를 건너뛰어, 그 이름이면 모달 규칙을 피한다
  - Claude가 `milvus*`를 고치려 하면 `permissions.deny`가 거부만 하고 "밀버스에 요청하세요" 같은 안내는 없다
