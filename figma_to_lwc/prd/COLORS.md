# Figma 색 → slackTokens 대응표

Figma 변수 값은 `lwc/slackTokens/slackTokens.css` 한 곳에 두고, 컴포넌트는 토큰만 쓴다. 토큰 이름은 Figma 변수 이름을 그대로 옮긴다(`Slack/UI/1D1C1D-30%` → `--slack-ui-1d1c1d-30`).
SLDS 의미 hook(`--slds-g-color-on-surface-*` 등)은 Salesforce 색이라 Figma 와 값이 달라 쓰지 않는다(#88 발견 2). 새 변수가 나오면 slackTokens 와 이 표에 함께 추가한다.
Colour Palette 섹션 전체 값은 Figma API 한도 때문에 아직 읽지 않았다.

## Slack Design System and UI Kit (Community)

| Figma 변수 | 값 | 토큰 | 처음 나온 곳 |
|---|---|---|---|
| Slack/Brand/FFFFFF | `#FFFFFF` | `--slack-brand-ffffff` | Message Box |
| Slack/Brand/F8F8F8 | `#F8F8F8` | `--slack-brand-f8f8f8` | Message Box |
| Slack/Brand/1D1C1D | `#1D1C1D` | `--slack-brand-1d1c1d` | Message Box |
| Slack/Brand/007A5A | `#007A5A` | `--slack-brand-007a5a` | Message Box |
| Slack/UI/1D1C1D-70% | `rgba(29,28,29,0.7)` | `--slack-ui-1d1c1d-70` | Message Box |
| Slack/UI/1D1C1D-50% | `rgba(29,28,29,0.5)` | `--slack-ui-1d1c1d-50` | Message Box |
| Slack/UI/1D1C1D-30% | `rgba(29,28,29,0.3)` | `--slack-ui-1d1c1d-30` | Button |
| Slack/UI/1D1C1D-13% | `rgba(29,28,29,0.13)` | `--slack-ui-1d1c1d-13` | Message Box |
| Slack/UI/1D1C1D-6% | `rgba(29,28,29,0.06)` | `--slack-ui-1d1c1d-6` | Message Box |
| Slack/UI/148567 | `#148567` | `--slack-ui-148567` | Button |
| Slack/UI/006e51 | `#006E51` | `--slack-ui-006e51` | Button |
| Slack/UI/007A5A-30% | `rgba(0,122,90,0.3)` | `--slack-ui-007a5a-30` | Button |
| Slack/UI/007A5A-50% | `rgba(0,122,90,0.5)` | `--slack-ui-007a5a-50` | Button |
| Slack/UI/FAFAFA-83% | `rgba(250,250,250,0.83)` | `--slack-ui-fafafa-83` | Button |
| Slack/UI/FFFFFF-20% | `rgba(255,255,255,0.2)` | `--slack-ui-ffffff-20` | Icon Button |
| Slack/UI/FFFFFF-25% | `rgba(255,255,255,0.25)` | `--slack-ui-ffffff-25` | Icon Button |
| 효과 Slack/button | `0 1px 3px rgba(0,0,0,0.08)` | `--slack-shadow-button` | Button |
| 효과 Slack/button-primary | `0 1px 4px rgba(0,0,0,0.3)` | `--slack-shadow-button-primary` | Button |
