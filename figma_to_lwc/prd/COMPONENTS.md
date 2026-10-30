# Figma 컴포넌트 → LWC 목록

새 LWC 를 만들기 전에 여기서 찾고, 만든 뒤 바로 추가한다 (`figma-to-lwc` 스킬 1.5장).

## Slack Design System and UI Kit (Community) — 파일 키 `kDh031bj7y4HFXwzg4s4Ky`, 접두사 `slack`

| Figma 세트 | 세트 id | LWC | 구현한 변형 | 안 한 변형 | 비고 |
|---|---|---|---|---|---|
| Message Box | `68:7368` | `messageComposer` | State=Empty, Filled | State=Active, Filled Active | 접두사 규칙 이전에 만듦. 부품(Message Buttons, Send Button, Text Format Buttons)을 안에 직접 그림 → 부품 LWC 가 생기면 바꿔 끼움 |

아이콘 스프라이트: `messageComposerIcons` (Slack Icons 섹션 중 9개)
