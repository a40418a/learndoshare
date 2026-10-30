# PRD — slackMessageBox (`<c-slack-message-box>`)

> #90 에서 `messageComposer` 에서 이름을 바꿨다(#83 이름 규칙). 색은 slackTokens, 아이콘은 slackIcons 로 옮김. 아래 9장 표의 SLDS hook 대응은 #79 당시 기록이며 지금은 `prd/COLORS.md` 의 토큰을 쓴다.

- 입력: Figma `Slack Design System and UI Kit` › Message Box
  - State=Empty `68:7367`, State=Filled `68:7462` (+ 사용자 제공 Filled 스크린샷)
- 실행 경로: 스킬 경로(`experience-lwc-design-generate`) 수동 진행, Framelink `get_figma_data`로 읽음
- 이름 검사: `check-component-name.sh messageComposer message-composer` → OK
- 상태: **확정 (2026-10-30)** — Q1 A · Q2 C · Q3 B · Q4 B(이모지·멘션) · Q5 B

## 1. Purpose
메시지 한 건을 작성해 보내는 입력 상자. 위에 서식 툴바, 가운데 입력 영역, 아래에 첨부·이모지 등 보조 버튼과 보내기 버튼이 있다.

## 2. Content requirements
| 영역 | 요소 | Figma 근거 |
|---|---|---|
| 서식 툴바 | 굵게, 기울임, 취소선 │ 링크 │ 번호 목록, 글머리 목록 │ 코드, 코드 블록 (구분선 3개) | `#68:7356`, 두 상태 모두 opacity 0.3 (Disabled) |
| 입력 영역 | 한 줄 이상 텍스트, placeholder "Jot something down" | `Message Text Box` Empty / Simple Type |
| 하단 왼쪽 | 첨부(+, 원형 배경) │ 서식 숨기기(Aa), 이모지, 멘션 │ 영상, 음성 │ 단축키(/) | `#68:6901` |
| 하단 오른쪽 | 보내기 분할 버튼: 보내기 + 옵션(▼) | `Send Button` Disabled / Default |

## 3. Data requirements
- 멘션 검색: `lightning/graphql` 로 `User` 조회 — `Name LIKE '%검색어%' AND IsActive = true`, 이름순 10건, 필드 `Id`, `Name`. 팝오버가 열려 있을 때만 조회
- 그 밖의 org 데이터 없음. Apex 없음.
- `@api placeholder` (기본 "Jot something down")
- `@api disabled` — 전체 비활성
- 내부 상태: 입력값 `value`

## 4. Interactions
| 동작 | 결과 |
|---|---|
| 입력 | 값이 비면 Empty, 있으면 Filled 상태 |
| 보내기 클릭 | 값이 있을 때만 `send` 이벤트 후 입력 초기화 (Enter 는 rich text 기본 동작인 줄바꿈) |
| 서식 버튼 | `lightning-input-rich-text` 툴바가 처리 (Q1-A) |
| 이모지 | 팝오버에서 골라 커서 위치에 삽입 (Q4-B) |
| 멘션(@) | 팝오버에서 활성 사용자 검색 → `@이름` 삽입 (Q4-B) |
| 첨부·Aa·영상·음성·단축키·보내기 옵션(▼) | `action` 이벤트만 |

## 5. Component communication
- `send` — `detail: { value }`
- `action` — `detail: { name }` (attach, formatting, video, audio, shortcut, sendoptions)
- 모두 `bubbles: false, composed: false` (부모가 직접 받음)

## 6. States
| 상태 | 조건 | 보이는 것 |
|---|---|---|
| Empty | 값 없음 | placeholder 표시, 보내기 버튼 비활성(회색) |
| Filled | 값 있음 | 텍스트 표시, 보내기 버튼 활성(강조색) |
| Disabled | `disabled=true` | 전체 비활성 |
| Hover/Focus | 버튼 위 | Figma에 정의 없음 → SLDS 기본 상태를 따름 |

## 7. Accessibility
- 아이콘 버튼마다 `alternative-text`(lightning-button-icon) 필수
- 툴바는 `role="toolbar"` + `aria-label`, 구분선은 장식(`aria-hidden`)
- 입력 영역은 보이는 라벨이 없으므로 `label-hidden` + 라벨 텍스트 제공
- 보내기 비활성 상태는 `disabled` 속성으로 전달

## 8. Responsiveness
- Figma 설계 폭 512px, 가로는 부모 폭을 채움(`contextual`)
- 좁은 폭에서 하단 버튼 줄은 줄바꿈 허용 — TODO: Figma에는 "designedWidth 512px"만 있고 좁은 폭 규칙이 없음

## 9. Styling (SLDS 결정 계층)
- 직접 값(hex·px) 금지. Figma 색은 아래처럼 hook으로 옮긴다.

| Figma 변수 | 값 | 대응 |
|---|---|---|
| Slack/Brand/FFFFFF | #FFFFFF | `--slds-g-color-surface-container-1` |
| Slack/Brand/F8F8F8 | #F8F8F8 | `--slds-g-color-surface-container-2` |
| Slack/UI/1D1C1D-13% | 테두리·구분선 | `--slds-g-color-border-1` |
| Slack/Brand/1D1C1D | 본문 | `--slds-g-color-on-surface-3` |
| Slack/UI/1D1C1D-50% | placeholder | SLDS 입력 기본값 |
| Slack/Brand/007A5A | 보내기 버튼 | 컴포넌트 CSS 에서 `--slds-c-button-brand-*` hook 재정의 (Q3-B, Figma 색 그대로) |
| radius 8px / 4px | | `--slds-g-radius-border-2` / `-1` |
| 간격 4·8·12px | | `--slds-g-spacing-1` / `-2` / `-3` |

- 글꼴: Figma Lato 15px → org 기본 글꼴 유지(Lato를 넣지 않음)
- 아이콘: Slack SVG 9개를 `messageComposerIcons` 스프라이트로 합치고 `lightning-icon src` 로 사용, 색은 `--slds-c-icon-color-foreground` (Q2-C)

## 10. Localization
- 화면 문자열(placeholder, 버튼 대체 텍스트)은 Custom Label로 뺀다 — TODO: 라벨 이름 규칙 확인

## 11. Security
- 입력값은 텍스트로만 다루고 HTML로 렌더하지 않음(`lwc:dom="manual"`, `innerHTML` 사용 없음)

---

## ❓ 확정이 필요한 항목

**Q1. 구현 방식 (서식 툴바 + 입력 영역)**
- (A) **`lightning-input-rich-text` 기본 컴포넌트** — `formats=bold,italic,strike,link,list,code,code-block`로 Figma 툴바와 같은 항목만 켬. 서식이 실제로 동작. 대신 툴바 모양은 SLDS 기본(Figma와 다름). ← 스킬의 SLDS 결정 계층 1순위(기본 컴포넌트)
- (B) Figma 그대로 — `lightning-textarea` + 비활성 서식 버튼 줄. 모양은 같지만 서식은 동작하지 않음(Figma 두 상태 모두 Disabled)

**Q2. 아이콘**
- (A) **SLDS utility 아이콘** — bold, italic, strikethrough, link, richtextnumberedlist, richtextbulletedlist, add, emoji, slack_mentions, video, send, chevrondown 은 있음. code / code-block / Aa / 단축키(/) / 마이크는 정확한 대응 없음 → 가까운 아이콘으로 대체
- (B) 기존 `slackIcons` static resource 재사용 — Figma와 같지만 `<img>`라 색·크기를 hook으로 못 바꿈
- (C) Slack SVG를 `fill="currentColor"` 스프라이트(`<symbol id>`)로 바꿔 `lightning-icon src="…#bold"`로 사용 — Figma 모양 그대로, 색은 `--slds-c-icon-color-foreground` hook으로 제어. 버튼은 SLDS `slds-button_icon` 블루프린트

**Q3. 보내기 버튼 색 (#007A5A)**
- (A) **`lightning-button-icon variant="brand"`** — org 브랜드색을 따름(Figma 색과 다를 수 있음)
- (B) Slack 초록을 컴포넌트에서 hook으로 재정의 — Figma 와 같은 색, 대신 직접 값 2곳

**Q4. 하단 버튼 범위**
- (A) **`action` 이벤트만 보내고 실제 기능(파일 첨부, 이모지 선택 등)은 범위 밖** — 런북 "비즈니스 로직은 생성 뒤 추가"
- (B) 첨부·이모지 등 일부 기능까지 구현

**Q5. 기존 `slackMessageBox`**
- (A) **그대로 두고 새 `messageComposer`와 나란히 비교** (06장 테스트 기록용)
- (B) 새 컴포넌트로 교체
