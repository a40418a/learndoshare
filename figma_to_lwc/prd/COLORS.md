# Figma 색 → SLDS hook 대응표

컴포넌트를 읽을 때 나온 Figma 색 변수를 여기 모은다. 같은 색은 모든 컴포넌트에서 같은 hook 을 쓴다.
Colour Palette 섹션 값은 Figma API 한도 때문에 한꺼번에 읽지 않았다(#85). 새 색이 나오면 이 표에 먼저 추가하고 쓴다.

## Slack Design System and UI Kit (Community)

| Figma 변수 | 값 | SLDS hook | 처음 나온 곳 | 비고 |
|---|---|---|---|---|
| Slack/Brand/FFFFFF | `#FFFFFF` | `--slds-g-color-surface-container-1` | Message Box | |
| Slack/Brand/F8F8F8 | `#F8F8F8` | `--slds-g-color-surface-container-2` | Message Box | |
| Slack/Brand/1D1C1D | `#1D1C1D` | `--slds-g-color-on-surface-3` | Message Box | 본문 글자 |
| Slack/UI/1D1C1D-70% | `rgba(29,28,29,0.7)` | `--slds-g-color-on-surface-2` | Message Box | 아이콘 |
| Slack/UI/1D1C1D-50% | `rgba(29,28,29,0.5)` | `--slds-g-color-on-surface-1` | Message Box | placeholder |
| Slack/UI/1D1C1D-13% | `rgba(29,28,29,0.13)` | `--slds-g-color-border-1` | Message Box | 테두리·구분선 |
| Slack/UI/1D1C1D-6% | `rgba(29,28,29,0.06)` | `--slds-g-color-surface-container-2` | Message Box | 첨부 버튼 배경 |
| Slack/Brand/007A5A | `#007A5A` | 없음 — 직접 값 | Message Box | 보내기 버튼. SLDS 에 대응 hook 없음 |
