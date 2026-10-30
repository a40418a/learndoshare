# Figma to LWC 실측 기록 — messageComposer

런북 06장 "테스트 기록" 표와 스킬 완료 기준(Definition of Done) 11항목을 채운 기록이다.

## 테스트 기록

| 항목 | 내용 |
|---|---|
| 테스트 일자 | 2026-10-30 |
| Figma 프레임 | Slack Design System and UI Kit (Community) › Message Box<br>State=Empty `68:7367`, State=Filled `68:7462` (파일 키 `kDh031bj7y4HFXwzg4s4Ky`) |
| 실행 경로 | 스킬 경로(`experience-lwc-design-generate` 0.3.0, `experience-lwc` 플러그인). 플러그인을 세션 도중 설치해 스킬이 자동으로 뜨지 않았고, 스킬 문서의 5단계를 Claude Code 에서 그대로 따라감. Figma 읽기는 Framelink `get_figma_data` |
| 대상 org | `learndoshare_1` (Developer Edition, API 68.0) |
| 결과 요약 | 생성·검사·테스트·배포·org 화면 확인까지 완료. PRD 확정(사람) 1회. org 확인에서 버그 3개를 찾아 고침(발견 4·7·8) |
| 확인 화면 | 앱 **Figma To LWC** › 탭 **Message Composer Test** (`/lightning/n/Message_Composer_Test`) |
| 다음 조치 | 아래 "남은 일" |

## 06장 확인 항목

| 확인 항목 | 결과 | 근거 |
|---|---|---|
| MCP 서버 연결 | ✔ Framelink, Salesforce DX(`lwc-experts`·`aura-experts`·`experts-validation`) 모두 Connected | `claude mcp list` |
| Figma 읽기 | ✔ 두 노드 모두 반환. 변수 9개, 컴포넌트 세트 6개 | `get_figma_data` |
| PRD | ✔ 11개 섹션 작성, 모호한 5개 항목을 질문으로 돌려 확정 | `PRD.md` |
| 코드 생성 | ✔ 네 파일 + Custom Label 15개 + 아이콘 스프라이트. 배포(컴파일) 성공 | `sf project deploy start` |
| 스타일 | △ SLDS Linter 경고 1개(`bottom: 100%`, 대응 hook 없음). Q3-B 직접 색 2곳은 의도적 | `slds-linter lint` |
| 접근성·보안·RTL | △ sa11y 자동 검사 통과(Empty·Filled·팝오버 열림). RTL 은 논리 속성으로 수정. 스킬의 a11y·보안·RTL 리뷰 스킬은 실행하지 않음 | Jest |
| 테스트 | ✔ 17개 통과. 줄 100%, 분기 86% | `sfdx-lwc-jest --coverage` |
| org 렌더 | ✔ Empty(회색 보내기)·Filled(초록 보내기)·이모지 삽입·멘션 검색/삽입·Esc 닫기·보내기 후 비움. 서식 툴바의 코드·코드 블록 버튼은 없음(발견 5) | 브라우저 확인 |

## 완료 기준 11항목

| # | 기준 | 결과 |
|---|---|---|
| 1 | PRD 요구사항 모두 구현 또는 TODO | ✔ (반응형 좁은 폭 규칙은 PRD 에 TODO 로만 남음) |
| 2 | TODO·console·alert 없음 | ✔ |
| 3 | 주석 처리된 코드·빈 함수·더미 없음 | ✔ |
| 4 | `lwc:dom="manual"` 없음 | ✔ |
| 5 | `.js-meta.xml` AI 메타데이터 | ✘ `<ai>` 요소 스키마를 스킬 문서에서 찾지 못해 넣지 않음 |
| 6 | SLDS: 직접 hex·px 없음 | △ Q3-B 로 `#007a5a` 2곳 의도적. Linter `--fix` 가 넣은 fallback 값(`#ffffff`, `0.25rem` 등) |
| 7 | 접근성 리뷰 + a11y Jest | △ a11y Jest ✔, 소스 리뷰 스킬 미실행 |
| 8 | 보안 + RTL | △ 리뷰 스킬 미실행. RTL 은 `inset-inline-start`·`border-inline-start` 로 직접 수정 |
| 9 | 데이터 계층이 PRD 와 일치 | ✔ `lightning/graphql` User 조회 1건, PRD 3장과 같음 |
| 10 | Jest 통과·커버리지 | ✔ 모든 `@api`, 이벤트 2종, 오류 경로(GraphQL errors) 포함 |
| 11 | UTAM | 해당 없음 |

## 발견 사항

1. **스킬 참조 파일 오류.** `references/prd-analysis-template.md` 가 PRD 양식이 아니라 SARIF 검사 보고서 프롬프트다. PRD 구성은 `figma-to-prd-blueprint.md` 로 대신함.
2. **hook 에 넣은 직접 색은 SLDS Linter 가 잡지 않는다.** `--slds-c-button-brand-color-background: #007a5a` 는 경고 없이 통과. 완료 기준 6(직접 hex 금지)을 Linter 만으로는 확인할 수 없음.
3. **Linter `--fix` 가 직접 값을 넣는다.** fallback 제안(`var(--hook, #e5e5e5)`)을 적용하면 hex·rem 이 CSS 에 생긴다. 완료 기준 6(직접 hex·px 금지)과 기준이 다름.
4. **rich text 삽입 후 커서.** `insertTextAtCursor` 는 "Reserved for internal use" 라 `setRangeText` 를 씀. 인자 하나만 주면 기본 모드 `preserve` 라 커서가 넣은 글자 **앞**에 남아, 이어 친 글자가 이모지·멘션 앞에 들어갔다(org 에서 발견). `setRangeText(text, undefined, undefined, "end")` 로 고침 — start·end 를 비워도 지금 선택 영역을 쓰는 것을 org 에서 확인.
5. **Figma 와 다른 점.** 서식 툴바는 `lightning-input-rich-text` 의 SLDS 모양(Q1-A)이고, `formats` 에 `code`·`code-block` 을 넣어도 **툴바 버튼은 생기지 않는다**(굵게·기울임·취소선·목록·링크만 보임). 툴바 버튼 색은 org 테마색. 아이콘 18px → `x-small` 16px. 툴바 배경 `#F8F8F8` 은 기본 컴포넌트 안이라 적용하지 않음.
6. **환경.** pnpm 전역 설치 claude CLI 가 자동 업데이트 때 `claude.exe` 를 잃는 문제가 2번 남. Local Dev 미리보기는 이미 떠 있는 서버와 8081 포트가 겹쳐 실행하지 못함.
7. **`src` 로 넣은 아이콘이 흰색.** `lightning-icon src=…` 는 아이콘 종류(utility 등)가 없어 기본 `slds-icon` 색(흰색)을 쓴다. 처음 쓴 `--slds-c-icon-color-foreground-default` 는 utility 아이콘용이라 효과가 없었고, `--slds-c-icon-color-foreground` 로 고침. Jest 는 이 문제를 잡지 못함(스텁이 아이콘을 그리지 않음) — org 확인이 필요한 이유.
8. **멘션 로딩 중 "No people found".** 조회 결과가 오기 전에 빈 결과 문구가 먼저 보였다. 결과가 온 뒤에만 보이도록 고치고 Jest 에 로딩 중 케이스를 추가.
9. **org 확인 준비에 든 것.** App 페이지만 배포하면 탭이 숨김이라 "페이지 없음". 탭 + 권한 세트(탭·앱 보기) + 앱 `Figma To LWC` 를 만들고 권한 세트를 할당해야 보였다. 배포 직후에는 Lightning 이 컴포넌트를 브라우저 저장소(IndexedDB `actions`)에 캐시해 예전 CSS 가 보일 수 있음.

## 남은 일

- 좁은 폭(모바일·사이드바)에서 하단 버튼 줄 확인
- 코드·코드 블록 서식이 필요하면 툴바 대안 정하기 (발견 5)
- 새 세션에서 스킬이 자동으로 뜨는지, `experience-accessibility-validate`·`experience-lwc-security-validate`·`experience-lwc-rtl-validate` 실행
- 발견 2 처럼 Linter 가 놓치는 직접 값을 어떻게 확인할지 정하기
