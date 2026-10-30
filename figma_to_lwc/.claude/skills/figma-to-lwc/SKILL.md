---
name: figma-to-lwc
description: Figma 링크(figma.com/design/...?node-id=...)를 받아 이 프로젝트(figma_to_lwc)에 새 LWC 를 만들 때 쓴다. "이거 LWC로 만들어줘"처럼 짧게 말하거나 Figma 링크만 붙여넣은 경우도 포함한다. experience-lwc-design-generate 스킬의 5단계 위에 이 프로젝트의 읽기·질문·검증 절차와 실측에서 나온 함정을 더한다. 기존 LWC 수정에는 쓰지 않는다.
---

# Figma → LWC (figma_to_lwc 실습 프로젝트)

`experience-lwc-design-generate` 스킬(플러그인 `experience-lwc`)의 5단계를 그대로 따르되, 아래 절차를 덧붙인다. 두 지침이 다르면 이 파일이 우선이다.

## 0. 범위

- 판단 기준은 **Figma 충실도, SLDS 결정 계층(기본 컴포넌트 → 블루프린트 → styling hook), 스킬 완료 기준 11항목**이다.
- 밀버스 디자인 시스템 규칙(`milvus check`, milvusBrand, 밀버스 패턴)은 적용하지 않는다.
- 대상 org 는 `learndoshare_1` (`.sf/config.json` 의 target-org).

## 1. Figma 읽기 — 링크만 받아도 이것까지 한다

1. URL 에서 파일 키와 노드를 뽑는다. `node-id=68-7367` → `68:7367`.
2. **구조·변수:** Framelink `get_figma_data(fileKey, nodeId)`.
3. **모양:** 공식 Figma MCP `get_screenshot(fileKey, nodeId)`. 사용자에게 스크린샷을 따로 달라고 하지 않는다.
4. **상태:** 노드가 `COMPONENT` 이고 `componentSetId` 가 있으면 같은 세트의 다른 변형(Empty·Filled·Disabled 등)도 읽는다. 링크가 하나여도 상태는 세트 전체가 기준이다.
5. 둘 중 하나가 연결돼 있지 않으면(`claude mcp list`) 멈추고 알린다. 추측으로 진행하지 않는다.

## 2. PRD — 확정 전에는 코드를 쓰지 않는다

- 위치: `prd/<componentName>/PRD.md`
- 구성은 스킬의 `references/figma-to-prd-blueprint.md` 를 따른다. `references/prd-analysis-template.md` 는 PRD 양식이 아니라 SARIF 프롬프트이므로 쓰지 않는다.
- 이름은 스킬의 `scripts/check-component-name.sh <camelCase> <kebab-case>` 로 검사한다.
- Figma 색·간격·반경은 SLDS 전역 hook 으로 대응표를 만든다(`.claude/skills/design-systems-slds-apply/assets/hooks-index.json` 에 있는 이름만).
- 아래 질문을 **추천안(A)과 함께** 한 번에 묻고, 답을 PRD 상단에 "확정" 으로 적는다. 사용자가 프롬프트에서 이미 답한 항목은 묻지 않는다.

| # | 질문 | 추천안(A) |
|---|---|---|
| Q1 | 같은 일을 하는 기본 컴포넌트가 있을 때: 기본 컴포넌트 vs Figma 모양 재현 | 기본 컴포넌트. 모양 차이를 PRD 에 적음 |
| Q2 | 아이콘: SLDS utility vs Figma SVG | Figma SVG 스프라이트 + 색 hook (3장) |
| Q3 | SLDS hook 이 없는 Figma 색 | 가장 가까운 SLDS 변형(brand 등). 그대로 쓰면 직접 값 위치를 PRD 에 적음 |
| Q4 | 버튼별 기능 범위: 실제 구현 vs 이벤트만 | 이벤트(`action`)만. 구현할 버튼을 고르게 함 |
| Q5 | 데이터: 연결할 객체·필드 | 없음(@api 로 받음) |
| Q6 | 놓을 곳: 앱·레코드·홈 페이지, 플로우 | App 페이지 |
| Q7 | 같은 역할의 기존 컴포넌트가 있으면: 교체 vs 나란히 | 나란히 두고 비교 |

## 3. 생성 — 실측에서 나온 함정

- **아이콘 스프라이트.** Framelink `download_figma_images` 로 아이콘 SVG 를 받고 `scripts/build-sprite.py` 로 한 파일로 합친다. path 의 `fill` 을 지워 색을 상속받게 한다.
  ```bash
  python .claude/skills/figma-to-lwc/scripts/build-sprite.py <svg 폴더> force-app/main/default/staticresources/<name>Icons.svg
  ```
  static resource meta 의 contentType 은 `image/svg+xml`. 쓸 때는 `<lightning-icon src={url#id}>`.
- **`src` 아이콘 색은 `--slds-c-icon-color-foreground`.** `-default` 는 utility 아이콘용이라 효과가 없고, 그대로 두면 흰색(흰 배경에서 안 보임)이 된다.
- **`lightning-button-icon` 은 `src` 를 받지 않는다.** 버튼은 `slds-button slds-button_icon` 블루프린트 + 안에 `lightning-icon`.
- **SLDS 클래스 재정의 금지.** `.slds-button` 등에 스타일을 걸지 말고 자체 클래스(`icon-btn`, `send-btn`)를 붙인다.
- **RTL.** `left`·`border-left` 대신 `inset-inline-start`·`border-inline-start`.
- **화면 문자열**은 Custom Label(`labels/CustomLabels.labels-meta.xml`, 이름 `<Component>_<Key>`).
- **`lightning-input-rich-text`:**
  - `formats` 에 `code`·`code-block` 을 넣어도 툴바 버튼은 생기지 않는다.
  - 커서 자리에 넣을 때는 `setRangeText(text, undefined, undefined, "end")`. 인자 하나만 주면 커서가 넣은 글자 앞에 남는다. `insertTextAtCursor` 는 내부용이라 쓰지 않는다.
- **조회가 있는 팝오버**는 결과가 오기 전에 빈 결과 문구를 보이지 않는다(로딩 플래그).
- **GraphQL** 은 `lightning/graphql`. 필요할 때만 조회하려면 `query` 를 `undefined` 로 돌려준다.

## 4. 검증 — 이 순서로, 결과를 그대로 보고한다

```bash
npx eslint force-app/main/default/lwc/<name>
npx prettier --write force-app/main/default/lwc/<name>
npx sfdx-lwc-jest -- force-app/main/default/lwc/<name> --coverage
npx -y @salesforce-ux/slds-linter@latest lint force-app/main/default/lwc/<name>
```

- **Jest:** 모든 `@api`, 모든 이벤트, 오류 경로, 상태별 `toBeAccessible()`(`@sa11y/jest`). 스텁의 `gql` 은 `undefined` 를 돌려주므로 조회 조건을 검사하려면 `jest.mock("lightning/graphql", ...)` 으로 `gql` 을 문자열로 바꾼다.
- **SLDS Linter 는 hook 변수에 넣은 직접 색을 잡지 못한다.** `grep -nE "#[0-9a-fA-F]{3,8}\b" <name>.css` 로 따로 보고, 남은 것은 PRD 결정(Q3)과 맞는지 확인한다. `--fix` 는 fallback 에 hex·rem 을 넣으므로 적용 여부를 사용자에게 알린다.
- **org 확인 (Jest 가 못 잡는 버그가 여기서 나온다):**
  1. `sf project deploy start -o learndoshare_1 -d <경로들>`
  2. 확인 화면: `flexipages/<Name>_Test` (AppPage) + `tabs/<Name>_Test` + 권한 세트 `Message_Composer_Test` 의 `tabSettings` 에 탭 추가 + 앱 `Figma_To_LWC` 의 `<tabs>` 에 탭 추가. 탭만 배포하면 숨김이라 "페이지 없음" 이 뜬다.
  3. `/lightning/n/<Name>_Test` 에서 Figma 스크린샷과 상태별로 비교. 로그인은 사용자가 한다.
  4. 배포 직후 예전 화면이 보이면 Lightning 캐시다. 브라우저 IndexedDB `actions` 를 지우거나 다른 브라우저로 본다.

## 5. 기록

`prd/<componentName>/TEST-RECORD.md` 에 남긴다. `prd/messageComposer/TEST-RECORD.md` 와 같은 구성:

1. 테스트 기록 표 (일자, Figma 노드, 실행 경로, org, 확인 화면, 결과 요약)
2. 런북 06장 확인 항목 (MCP 연결 · Figma 읽기 · PRD · 코드 생성 · 스타일 · 접근성·보안·RTL · 테스트 · org 렌더)
3. 완료 기준 11항목
4. 발견 사항 — 새로 나온 함정은 이 파일 3장에도 추가한다
5. 남은 일

## 6. 커밋

저장소 루트 `CONTRIBUTING.md` 를 따른다. 실습 하나는 `[Spike]` 이슈 하나 → `spike/<번호>-<설명>` 브랜치 → 성격별 커밋 → PR → squash merge. 이슈·PR 에는 org ID, 사용자 이름, 토큰을 쓰지 않는다. 사용자가 요청할 때만 진행한다.
