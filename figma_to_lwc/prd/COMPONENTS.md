# Figma 컴포넌트 → LWC 목록

새 LWC 를 만들기 전에 여기서 찾고, 만든 뒤 바로 추가한다 (`figma-to-lwc` 스킬 1.5장).

## Slack Design System and UI Kit (Community) — 파일 키 `kDh031bj7y4HFXwzg4s4Ky`, 접두사 `slack`

| Figma 세트 | 세트 id | LWC | 구현한 변형 | 안 한 변형 | 비고 |
|---|---|---|---|---|---|
| Button | `92:11225` | `slackButton` | Hierarchy=Primary·Secondary·Tertiary × State=Default·Hover·Pressed | — | Disabled·Focus 는 Figma 에 없어 임시 |
| Icon Button | `7:10043` | `slackIconButton` | State=Default·Hover·Active | — | 어두운 바탕용. 아이콘 색은 부모 `color` |
| Message Box | `68:7368` | `slackMessageBox` | State=Empty, Filled | State=Active, Filled Active | 내부 부품(Message Buttons, Text Format Buttons, Send Button, Footer Divider, Message Text Box)을 아직 안에 직접 그림 → 부품 LWC 가 생기면 바꿔 끼움. 서식 툴바는 `lightning-input-rich-text` |

## 공통 자원

| 자원 | 내용 |
|---|---|
| `slackIcons` (static resource) | Slack Icons 섹션 49개 스프라이트. 원본 `figma/icons/`, id 는 Figma 레이어 이름. 새 컴포넌트는 이것을 쓴다 |
| `slackTokens` (CSS 모듈) | Slack 색·크기·그림자. CSS 첫 줄 `@import 'c/slackTokens';` 직접 값은 여기에만 |
| `slackGallery` | org 확인용 페이지(탭 Slack Gallery Test). 새 부품을 여기에 추가 |
| `prd/COLORS.md` | Figma 변수 → slackTokens |
