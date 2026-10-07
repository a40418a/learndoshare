# CLAUDE.md — 밀버스 디자인 시스템

밀버스(영문 표기 **milvus**) 프로젝트들이 공유할 LWC 디자인 시스템을 검증하고 구축하는 SFDX 저장소다.
계획, 일정, 결정 사항은 `README.md`에 있고 규칙은 `../CONTRIBUTING.md`에 있다. 필요한 절만 찾아 읽는다.

- Claude Code는 이 폴더(`learndoshare_1/`)에서 실행한다. git 루트는 상위 `learndoshare/`다
- 이 문서는 **작업 방식**만 다룬다. 반드시 지켜야 하는 규칙은 hook이 강제한다 (README 11장)

---

## 1. 작업 흐름

모든 작업은 아래 순서로 진행한다. 단계를 건너뛰지 않는다.

1. **이슈 확인.** 작업할 이슈 번호가 없으면 먼저 만든다 (`.github/ISSUE_TEMPLATE/*.yml` 폼 항목대로)
2. **브랜치.** `main`에서 `<타입>/<이슈번호>-<설명>`으로 만든다. 예: `feat/5-milvus-button`
3. **이해.** 바꿀 코드와 README의 해당 Phase를 먼저 읽는다. 실제 흐름을 따라간 뒤에 해법을 고른다
4. **판단 사다리** (2장)를 거쳐 가장 낮은 단계의 해법을 고른다
5. **구현.** 판단 사다리에서 고른 만큼만 만든다
6. **검증.** 4장의 명령을 실행한다. 통과하지 못하면 커밋하지 않는다
7. **리뷰.** `/ponytail-review`로 과잉 구현을 찾는다
8. **커밋.** `[태그] 요약 (#이슈번호)` 형식으로 쓴다. 커밋과 push는 사용자가 요청할 때만 한다
9. **PR.** 제목은 대표 커밋과 같게 하고, 본문에 `Closes #N`과 확인 방법을 적는다. 병합은 Squash and merge로 한다

## 2. 판단 사다리 (Ponytail × 밀버스)

코드를 쓰기 전에 위에서부터 차례로 묻는다. **해결되는 첫 단계에서 멈춘다.**

| 단계 | 질문 | 해결되면 |
| --- | --- | --- |
| 1 | 이 작업이 필요한가? README의 현재 Phase와 파일럿 범위 안에 있는가? | 범위 밖이면 만들지 않고 백로그 이슈로 남긴다 |
| 2 | 저장소에 이미 있는가? (`milvus*` 컴포넌트, `scripts/`, `brands/`) | 재사용한다 |
| 3 | org 설정으로 되는가? (Themes and Branding의 색·로고) | 코드를 쓰지 않는다 |
| 4 | SLDS가 제공하는가? (`lightning-*` base component → SLDS 블루프린트 클래스) | 그대로 쓴다 |
| 5 | 브랜드 root style로 되는가? (`brands/<브랜드>/root.css`의 `--milvus-*`) | 변수만 추가한다 |
| 6 | 이미 설치된 의존성이나 Node/브라우저 기본 기능으로 되는가? | 그것을 쓴다 |
| 7 | 그래도 안 되면 | 동작하는 최소 구현을 만든다 |

**새 의존성 추가**는 6단계까지 안 될 때만 한다. PR 본문에 이유를 적는다.

### 사다리보다 우선하는 결정

아래는 README에서 이미 결정한 것이다. Ponytail이 "필요 없다"고 판단해도 **빼지 않는다.**

- `milvusButton`: SLDS 2에는 `lightning-button` 모양을 브랜드별로 바꿀 공식 경로가 없다. 고객사별 니즈 때문에 구현한다
- opt-in `override.css`: `lightning-button` 자체를 바꿔야 하는 고객사용 확장 계층이다
- `pnpm sync:theme`, `create-project.mjs`, hook H1~H8, `milvus.config.json`
- 표현/컨테이너 분리: 표현 컴포넌트에는 `@wire`, Apex, LDS를 넣지 않는다. 한 파일로 합치는 편이 짧더라도 합치지 않는다

### 절대 줄이지 않는 것

코드가 짧아지는 것은 결과일 뿐 목표가 아니다. 아래는 어떤 단계에서도 생략하지 않는다.

- 입력 검증(`@api` 값), 에러 처리, 데이터 손실 방지
- 접근성: SLDS 블루프린트의 `aria-*`, 키보드 조작, 대비. `milvusButton` 같은 블루프린트 기반 컴포넌트는 `lightning-*`이 해 주던 접근성을 직접 맞춘다
- 보안: 인증 정보·org ID를 코드와 문서에 넣지 않는다
- `var()` fallback, 컴포넌트마다 스토리와 Jest 테스트

### 의도적 단순화는 기록한다

일부러 단순하게 만든 곳에는 `ponytail:` 주석으로 이유와 한계를 남긴다. `/ponytail-debt`로 모아 백로그에 넣는다.

```js
// ponytail: 테마 JSON을 파일 단위로 덮어쓴다. 브랜드가 수십 개가 되면 증분 동기화로 바꾼다.
```

## 3. 스타일 규칙

| 위치 | 해도 되는 것 | 하면 안 되는 것 |
| --- | --- | --- |
| 컴포넌트 CSS | `var(--slds-g-*, fallback)`, `var(--milvus-*, fallback)` 읽기 | hex 색, 브랜드 값, `--slds-c-*`, `--slds-g-*` 재정의, `.slds-*` 클래스 덮어쓰기 |
| `brands/<브랜드>/util.css` | `:root`의 `--slds-g-*` global hook (반경, 글꼴, 간격 등). 이 파일 하나로 모든 컴포넌트가 바뀐다 | 클래스 규칙, `--slds-c-*`·`--sds-c-*`·`--slds-s-*` (native shadow로 그려지는 기본 컴포넌트 안에 닿지 않음), 브랜드 색(accent) 재정의 |
| `brands/<브랜드>/theme.json`, `logo.*` | 없음 (`pnpm sync:theme`만 생성) | 직접 편집 |

- 브랜드 요구가 들어오면 org 테마(색·로고) → `util.css`의 global hook(모양·글꼴, 영향 지도 참고) → 특정 컴포넌트만 바꿔야 하면 밀버스 컴포넌트 순으로 제안한다
- 커스텀 변수 접두사는 `--milvus-`만 쓴다

## 4. 검증 명령

아직 스크립트가 없는 명령은 해당 Phase에서 만든다. 없으면 없다고 보고하고, 있는 척하지 않는다.

| 명령 | 확인하는 것 | 생기는 시점 |
| --- | --- | --- |
| `pnpm lint` | ESLint (+ SLDS Linter) | 지금 있음, SLDS Linter는 Phase 8 |
| `pnpm test:unit` | Jest (`sfdx-lwc-jest`) | 지금 있음 |
| `pnpm build:lwc` | Rollup으로 LWC 컴파일 | Phase 2 |
| `pnpm storybook` / `pnpm exec storybook build` | Storybook 실행, 정적 빌드 | Phase 1~2 |
| `pnpm sync:theme` | org 테마 → `brands/` | Phase 4 |

UI 변경은 Storybook에서 해당 브랜드로 직접 확인한다. 가능하면 org 화면과 비교한다.

## 5. 도구와 안전

- **pnpm만 쓴다.** `npm`, `npx`, `yarn`은 쓰지 않는다. 문서 예제에 `npx`가 나오면 `pnpm exec`(설치됨)나 `pnpm dlx`(미설치)로 바꾼다
- **sf CLI:** 조회(`data query`, `sobject describe`, `project retrieve`, `lightning dev`)는 자유롭게 한다. 배포, 삭제, 데이터 변경, `apex run`은 실행 전에 대상 org와 명령을 보여 주고 승인을 받는다
- 개인정보 필드(`Phone`, `Email`, 주소)나 `FIELDS(ALL)`는 조회하지 않는다
- `sf org display`처럼 **액세스 토큰을 출력하는 명령은 직접 실행하지 않는다.** 토큰이 필요한 작업(로고 다운로드 등)은 script 안에서 처리하고 토큰을 출력하지 않는다
- `.sfdx/`, `.sf/`, `.env`, `package-lock.json`은 커밋하지 않는다
- 공개 저장소(`a40418a/learndoshare`)다. 이슈·PR·커밋에 org ID와 인증 정보를 쓰지 않는다
- `.vscode/settings.json`은 사용자의 개인 설정이다. 요청 없이 커밋하지 않는다

## 6. 사실 확인

- 필드명, hook 이름, 패키지 옵션은 **추측하지 않는다.** describe, 공식 문서, 패키지 소스로 확인한다
- 확인하지 못한 것은 문서에 **미확인**으로 표시한다. README의 확정 / 미확인 / 미정 구분을 유지한다
- 새로 확인한 사실은 README 3장("현재까지 확인된 사실")에 반영한다

## 7. 현재 위치 (2026-09-26 기준)

| 날짜 | 이정표 |
| --- | --- |
| 9/28 | Phase 1 기반 셋업 시작 |
| **10/2** | ★ go/no-go: `lightning-*`이 Storybook에서 렌더되는가 |
| **10/16** | ★ 내용 동결. 이후 기능 추가 없음 |
| **10/23** | 발표 |

- 일정이 밀리면 README 5.2의 컷 라인 순서대로 뺀다
- 작업을 시작할 때 README 4장에서 현재 Phase의 체크리스트와 완료 기준을 확인한다
