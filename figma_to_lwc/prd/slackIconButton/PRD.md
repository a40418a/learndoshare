# PRD — slackIconButton (`<c-slack-icon-button>`)

- 입력: Figma Slack UI Kit › Icon Button `7:10043` (Framelink `fetch`, 3개 변형)
- 상태: **확정 (2026-10-30)**

## 변형

| Figma | LWC | 값 |
|---|---|---|
| State=Default | 기본 | 투명 바탕, 투명도 0.8 |
| State=Hover | CSS `:hover` | 바탕 `FFFFFF-20%` |
| State=Active | `@api active` | 바탕 `FFFFFF-25%`, `aria-pressed="true"` |

공통: padding 3, 모서리 4, 아이콘 20×20 (`slackIcons` 스프라이트).

## API

- `@api iconName` (스프라이트 id), `@api label` (필수 — `aria-label`·`title`), `@api active`, `@api disabled`

## Figma 에 없어 정한 것

- **아이콘 색:** 컴포넌트에 없음(사용처에서 덮어씀). 부모의 글자색(`color`)을 따른다
- **바탕:** 반투명 흰색 hover 는 어두운 바탕을 전제 — 밝은 바탕용은 별도 변형이 필요
- **Disabled·Focus:** Figma 에 없음. 포커스는 SLDS 포커스 링
