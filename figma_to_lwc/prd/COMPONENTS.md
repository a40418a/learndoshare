# Figma 컴포넌트 → LWC 목록

새 LWC 를 만들기 전에 여기서 찾고, 만든 뒤 바로 추가한다 (`figma-to-lwc` 스킬 1.5장).

## Slack Design System and UI Kit (Community) — 파일 키 `kDh031bj7y4HFXwzg4s4Ky`, 접두사 `slack`

| Figma 세트 | 세트 id | LWC | 구현한 변형 | 안 한 변형 | 비고 |
|---|---|---|---|---|---|
| Message Box | `68:7368` | `messageComposer` | State=Empty, Filled | State=Active, Filled Active | 접두사 규칙 이전에 만듦. 부품(Message Buttons, Send Button, Text Format Buttons)을 안에 직접 그림 → 부품 LWC 가 생기면 바꿔 끼움 |

## 공통 자원

| 자원 | 내용 |
|---|---|
| `slackIcons` (static resource) | Slack Icons 섹션 49개 스프라이트. 원본 `figma/icons/`, id 는 Figma 레이어 이름. 새 컴포넌트는 이것을 쓴다 |
| `messageComposerIcons` (static resource) | messageComposer 전용 9개. 부품 LWC 로 바꿀 때 `slackIcons` 로 옮긴다 |
| `prd/COLORS.md` | Figma 색 → SLDS hook |
