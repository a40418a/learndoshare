# 발표 캡처 자료 (10/23)

발표 구성은 `learndoshare_1/README.md` 5.3을 따른다. 이 폴더에는 그 구성에 쓸 캡처와 녹화만 둔다.

## 1. 원칙

- **전후(before/after)는 같은 화면을 같은 크기로 찍는다.** 같은 레코드, 같은 창 크기(1440×900 권장), 같은 확대율(100%)로 찍어 나란히 둔다. 다른 것은 브랜드 하나뿐이어야 차이가 보인다
- **한 장에 메시지 하나.** 바뀐 곳에 빨간 테두리나 화살표를 하나만 넣는다. 설명은 슬라이드 제목에 쓴다
- **터미널은 글자를 키운다.** 18pt 이상, 밝은 테마, 프롬프트를 짧게 한다. 긴 출력은 핵심 줄만 남기고 자른다
- **공개 저장소다. 개인 정보와 org 정보를 지운다.**
  - 주소창의 org 도메인(`orgfarm-…`), org ID, 사용자 이름, 이메일, 레코드의 전화·이메일 열
  - 토큰, `.npmrc`의 토큰 줄
  - 민감한 캡처는 커밋하지 않고 `private/`에 둔다(아래 4장)
- **라이브 대신 녹화.** 실습 A·B는 녹화를 기본으로 하고(5.5 체크리스트), 녹화는 발표 PC에 저장해 둔다

## 2. 섹션별 캡처 목록

표시: 📷 캡처, 🎬 녹화, ✅ 지금 org·Storybook에서 바로 찍을 수 있음

### 섹션 1 — 실제로 있었던 일 (3분)

| 파일 | 내용 | 비고 |
| --- | --- | --- |
| `01-problem/a-page-1.png` 📷 | 같은 SLDS인데 모양이 다른 화면 1 | 실제 프로젝트 사례. 고객명·데이터를 가린다 |
| `01-problem/b-page-2.png` 📷 | 같은 SLDS인데 모양이 다른 화면 2 | 1과 나란히 |

### 섹션 3 — 왜 어려운가 (3분)

| 파일 | 내용 | 비고 |
| --- | --- | --- |
| `03-why/a-storybook-lightning.png` 📷✅ | Storybook에서 `lightning-button`·`lightning-datatable`이 그려진 화면 | 배포본 https://a40418a.github.io/learndoshare/ 에서 찍는다. "LWC 기본 컴포넌트가 Storybook에 뜬다"가 메시지 |
| `03-why/b-structure.png` | 구조도(LWC Rollup 사전 컴파일 → Storybook) | 슬라이드에서 직접 그린다 |

### 섹션 4 — 밀버스 방향 (4분)

| 파일 | 내용 | 비고 |
| --- | --- | --- |
| `04-direction/a-layers.png` | 반영 순서 계층도: org 테마 → global hook → 컴포넌트 hook → 브리지 → override | 슬라이드에서 그린다 |
| `04-direction/b-fixed-list.png` 📷✅ | Storybook "시작하기/브랜드 명세"의 "Salesforce 고정" 목록 | 토스트 시간, 아이콘 모양, LEX 컨트롤 높이 등 |
| `04-direction/c-reflect-check.png` 📷✅ | Storybook "시작하기/반영 검사" 결과 표(컴포넌트 × 항목) | "모든 컴포넌트에 닿는가"의 근거. 판정 표 부분을 확대해서 찍는다 |

### 섹션 5 — 실습 A: 새 프로젝트 시작 (7분, 핵심)

녹화 하나(`05-demo-a/demo-a.mov`)로 이어 찍고, 아래 장면은 슬라이드 백업용 캡처로도 남긴다.

| 파일 | 장면 | 비고 |
| --- | --- | --- |
| `05-demo-a/01-install.png` 📷 | 터미널 `pnpm add -D @a40418a/milvus-design-system` | 새 빈 SFDX 프로젝트에서 |
| `05-demo-a/02-init.png` 📷 | `pnpm milvus init --target-org … --brand …` 출력(만든 파일 목록) | |
| `05-demo-a/03-spec-page.png` 📷 | Storybook "브랜드 명세" 페이지에 요청을 입력한 화면 | 브랜드 색 입력 → 버튼 색(50단계)·대비가 바로 보이는 부분 |
| `05-demo-a/04-claude-table.png` 📷 | Claude Code "브랜드 요청 반영해줘" → 브랜드 명세 표 | 승인 전 표가 보이게 |
| `05-demo-a/05-check-blocked.png` 📷 | 금지 값을 넣었을 때 hook `check --style`이 막는 화면 | "Claude를 믿을 수 있나?"의 답 |
| `05-demo-a/06-storybook-before.png` 📷 | 기본 브랜드 Storybook(같은 스토리) | 06·07은 같은 스토리·같은 크기 |
| `05-demo-a/07-storybook-after.png` 📷 | 반영 후 Storybook | |
| `05-demo-a/08-deploy-plan.png` 📷 | `pnpm milvus deploy` 계획 출력(대상 org, 테마 변화, 13개 목록) | org 별칭만 보이고 ID는 없다 |
| `05-demo-a/09-lex-before.png` 📷 | LEX 리드 목록, 기본 테마 | 주소창을 자른다. 전화·이메일 열을 가린다 |
| `05-demo-a/10-lex-after.png` 📷✅ | LEX 리드 목록, 반영 후(지금 org의 Rehearsal 테마) | 09와 같은 화면·같은 크기 |
| `05-demo-a/11-app-manager.png` 📷 | App Manager 유틸리티 바 `milvusBrandLoader`와 "앱이 열릴 때 백그라운드로 로드" 체크 | 사람이 할 일 두 가지 중 하나 |

### 섹션 6 — 실습 B: 도구 역할 분담 (2분)

| 파일 | 내용 | 비고 |
| --- | --- | --- |
| `06-demo-b/a-live-preview.png` 📷 | `sf lightning dev`(Live Preview) 화면 | 개발 중 확인용 |
| `06-demo-b/b-storybook.png` 📷 | 같은 컴포넌트의 Storybook 화면 | 카탈로그·브랜드·공유용. 비교표는 Learn 06 |

### Q&A 백업 (슬라이드 뒤에 둔다)

| 파일 | 예상 질문(README 5.4) | 내용 |
| --- | --- | --- |
| `qa/a-permissions.png` 📷 | Claude를 믿을 수 있나? | 고객 프로젝트 Code 세션에서 토큰 출력 명령이 deny로 막히고, deploy는 승인을 묻고, 관리 파일 Edit가 막힌 화면(2026-10-17 실측) |
| `qa/b-update-conflict.png` 📷 | 업데이트하면 내 수정이 사라지나? | `pnpm milvus update`가 고친 관리 파일을 보여 주고 아무것도 바꾸지 않은 출력 |
| `qa/c-listview-height.png` 📷 | 모든 걸 바꿀 수 있나? | 컨트롤 높이를 바꾸면 리스트뷰 툴바가 어긋났던 사례 → 그래서 "Salesforce 고정"으로 합의(2026-10-14) |
| `qa/d-vf.png` 📷 | VF도 되나? | `<c:milvusHead/>`를 넣은 VF 페이지가 LEX와 같은 브랜드 버튼 색 |
| `qa/e-learn-09.png` 📷 | override는 안전한가? | Learn 09 "override와 공식 권고" 요약 |

## 3. 찍는 순서 제안

1. **지금 org 상태로 먼저 찍는다(after).** org에 Rehearsal 테마가 켜져 있으니 `10-lex-after`, `11-app-manager`를 먼저 찍는다
2. **Storybook 캡처**(배포본이나 로컬 `pnpm storybook`): `03-why/a`, `04-direction/b`·`c`, `06`·`07`
3. **실습 A 녹화**: 새 빈 프로젝트에서 처음부터 찍는다. 이때 `01`~`05`, `08` 캡처도 함께 남긴다
4. **before 캡처**: 녹화가 끝나고 테마를 원래대로 되돌린 뒤 `09-lex-before`를 찍는다(테마 되돌리기는 승인 후 실행)
5. Q&A 백업은 남는 시간에

macOS: 창 하나는 `⌘⇧4` → `스페이스` → 창 클릭, 녹화는 `⌘⇧5`.

## 4. 폴더와 커밋

```
learndoshare_0/
  README.md        이 문서
  01-problem/ … qa/ 위 표의 파일 이름 그대로
  private/         org 정보·고객 화면이 남은 원본 (커밋하지 않음)
```

- 공개 저장소라서, 가린 뒤의 캡처만 커밋한다. 원본은 `private/`에 둔다
- 녹화 파일(`.mov`)은 용량이 커서 커밋하지 않는다
