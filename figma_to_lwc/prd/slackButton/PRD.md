# PRD — slackButton (`<c-slack-button>`)

- 입력: Figma Slack UI Kit › Button `92:11225` (Framelink `fetch`, 9개 변형)
- 상태: **확정 (2026-10-30)** — #83 규칙(Figma 부품은 항상 구현), Q2~Q7 추천안

## 변형

| Figma | LWC | 값 |
|---|---|---|
| Hierarchy=Primary | `variant="primary"` | 바탕 `007A5A`, 글자 흰색. Hover `148567` + 그림자 `Slack/button-primary`, Pressed `006E51` |
| Hierarchy=Secondary | `variant="secondary"` (기본) | 바탕 흰색, 테두리 `1D1C1D-30%`, 글자 `1D1C1D`. Hover `F8F8F8` + 그림자 `Slack/button`, Pressed `F8F8F8` + 테두리 `1D1C1D-50%` |
| Hierarchy=Tertiary | `variant="tertiary"` | 높이 28, 글자 13. 테두리 `007A5A-30%`, 글자 `007A5A`. Hover `F8F8F8` + 그림자, Pressed `FAFAFA-83%` + 테두리 `007A5A-50%` |
| State=Hover·Pressed | CSS `:hover`·`:active` | |

공통: 높이 36, 좌우 padding 8, 아래 1, gap 4, 모서리 4, Lato Bold 15/18.

## API

- `@api label`, `@api variant`, `@api disabled`, `@api type` (`button` 기본)
- 이벤트: 네이티브 `click` 이 그대로 밖으로 나온다(disabled 면 안 나옴). 따로 만든 이벤트 없음

## Figma 에 없어 정한 것

- **Disabled:** Figma 에 없음. 투명도 0.8 로만 표시 — 디자인 확정 필요
- **Focus:** Figma 에 없음. 접근성을 위해 SLDS 포커스 링
- **글꼴:** Lato 는 org 에 없어 org 기본 글꼴. 크기·굵기·줄높이만 맞춤
