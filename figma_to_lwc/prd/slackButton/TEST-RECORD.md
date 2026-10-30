# 실측 기록 — slackButton · slackIconButton (#88)

| 항목 | 내용 |
|---|---|
| 일자 | 2026-10-30 |
| Figma | Button `92:11225`, Icon Button `7:10043` |
| Figma 읽기 | Framelink MCP 도구가 세션에 없어 `figma-developer-mcp fetch` 명령줄로 읽음. 3번째 호출부터 REST API 429(약 4.5일) — 2단계 부품 11개 중 2개만 진행 |
| org | `learndoshare_1`, 앱 Figma To LWC › 탭 **Slack Gallery Test** |
| 결과 | 성공 |

## 확인 항목

| 항목 | 결과 |
|---|---|
| 코드 생성 | ✔ slackTokens(CSS 모듈), slackButton, slackIconButton, slackGallery(확인용) |
| 스타일 | ✔ 직접 색은 slackTokens 한 곳. SLDS Linter 경고 1개씩(포커스 hook 대체값 없음 — 넣으면 직접 색이 생겨 두었음) |
| 테스트 | ✔ 신규 15개 포함 전체 32개 통과, 두 부품 커버리지 100%, sa11y 통과 |
| org 렌더 | ✔ 높이 36/28, 바탕·테두리·글자색, 15/13px Bold, 아이콘 20px 이 Figma 값과 같음. Secondary hover `F8F8F8` + 그림자 확인. 선 아이콘(double-arrow) 정상 |

## 발견 사항

1. **CSS 만 있는 모듈은 Jest 가 찾지 못한다.** `@import 'c/slackTokens'` 가 `Cannot find module`. `jest.config.js` 의 `moduleNameMapper` 로 .css 를 직접 가리켜 해결. org 배포는 그대로 동작.
2. **SLDS 의미 hook 은 Slack 색이 아니다.** `--slds-g-color-on-surface-3` 은 `#03234d`(남색) — Figma 를 그대로 따르려면 Figma 변수 값을 토큰으로 두는 쪽이 맞다. #85 의 COLORS.md 대응을 토큰 기준으로 바꿈.
3. **아이콘은 `lightning-icon` 대신 `<svg><use>`.** 20px 같은 SLDS 에 없는 크기와 `color` 상속이 바로 된다.
4. **Figma 에 없는 상태:** 두 부품 모두 Disabled·Focus 가 없다. 임시 처리하고 PRD 에 적음.
