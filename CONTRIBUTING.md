# 작업 규칙 — 이슈 · 브랜치 · 커밋

이 저장소(`learndoshare`)의 모든 하위 프로젝트(`learndoshare_1` 등)에 공통으로 적용한다.

**흐름:** 이슈 생성 → 브랜치 생성 → 커밋(이슈 번호 포함) → PR → 이슈 닫힘

---

## 1. 태그

이슈 제목, 커밋 메시지, PR 제목은 모두 같은 태그 체계를 쓴다.

| 태그 | 언제 | 예시 |
| --- | --- | --- |
| `[Init]` | 프로젝트, 도구 최초 생성 | `[Init] Storybook 초기 설정` |
| `[Feat]` | 기능, 컴포넌트 추가 | `[Feat] milvusBadge 의미색 변형 추가` |
| `[Fix]` | 버그 수정 | `[Fix] 다크 모드에서 뱃지 대비 부족 수정` |
| `[Spike]` | 검증 실험 (결과가 실패여도 기록) | `[Spike] lightning-badge Storybook 렌더 검증` |
| `[Docs]` | 문서, README, 학습 자료 | `[Docs] 10/23 발표 준비 계획서 작성` |
| `[Style]` | 코드 포맷, 세미콜론 등 동작 변화 없음 | `[Style] prettier 적용` |
| `[Refactor]` | 동작 변화 없는 구조 개선 | `[Refactor] 테마 매핑 함수 분리` |
| `[Test]` | 테스트 추가, 수정 | `[Test] milvusBadge Jest 테스트 추가` |
| `[Chore]` | 의존성, 설정, 빌드 스크립트 | `[Chore] pnpm 전환 및 lockfile 추가` |

## 2. 이슈 규칙

- **작업은 이슈부터 만든다.** 5분 안에 끝나는 오타 수정만 예외다
- 제목: `[태그] 무엇을 하는지` (명사형으로 끝낸다)
- 본문은 YAML 이슈 폼(`.github/ISSUE_TEMPLATE/*.yml`)으로 작성한다. 모든 폼에 **완료 기준**이 들어가고, 필수 항목을 채워야 제출된다. 빈 이슈는 막혀 있다
- 라벨

  | 라벨 | 대상 |
  | --- | --- |
  | `enhancement` | `[Feat]` |
  | `bug` | `[Fix]` |
  | `documentation` | `[Docs]` |
  | `spike` | `[Spike]` 검증 실험 |
  | `study` | 학습 자료 |
  | `presentation` | 10/23 발표 관련 |

- `[Spike]` 이슈는 성공이든 실패든 **결과를 댓글로 남기고** 닫는다. 실패한 검증도 발표 근거가 된다
- 공개 저장소다. org ID, 사용자 이름, 인증 정보, 고객 데이터는 이슈에 쓰지 않는다

## 3. 브랜치 규칙

### 형식

```
<타입>/<이슈 번호>-<짧은 설명>
```

- **타입:** 1장 태그의 소문자형. `init` · `feat` · `fix` · `spike` · `docs` · `style` · `refactor` · `test` · `chore`
- **이슈 번호:** 브랜치는 반드시 이슈에서 시작한다. 번호가 없으면 이슈부터 만든다
- **짧은 설명:** 영어 소문자, 숫자, 하이픈만 쓴다. 2~5단어로 쓰고, 이슈 제목의 핵심만 담는다

검사용 정규식 (husky와 Claude Code hook이 같은 식을 쓴다):

```
^(init|feat|fix|spike|docs|style|refactor|test|chore)/[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$
```

### 예시

| 이슈 | 브랜치 | 판정 |
| --- | --- | --- |
| #1 `[Docs] 10/23 디자인 시스템 발표 준비 계획서 작성` | `docs/1-presentation-plan` | 통과 |
| #2 `[Spike] lightning-badge Storybook 렌더 검증` | `spike/2-lightning-badge-render` | 통과 |
| #5 `[Feat] milvusButton 브랜드 버튼 구현` | `feat/5-milvus-button` | 통과 |
| — | `feature/milvus-button` | 거부: 타입이 목록에 없고 이슈 번호가 없음 |
| — | `feat/5-MilvusButton` | 거부: 대문자 |
| — | `feat/5_milvus_button` | 거부: 밑줄 |

### 운영

| 항목 | 규칙 |
| --- | --- |
| 기준 브랜치 | `main`에서 분기하고 `main`으로 PR을 연다 |
| `main` 직접 커밋 | 금지 (저장소 최초 생성 커밋만 예외) |
| 브랜치 : 이슈 | 1 : 1. 한 브랜치에서 여러 이슈를 처리하지 않는다 |
| 병합 방식 | **Squash and merge.** 병합 커밋 메시지는 PR 제목(`[태그] 요약 (#N)`)을 쓴다. 세부 커밋은 PR에 남는다 |
| 병합 후 | 원격·로컬 브랜치를 삭제한다 |
| 오래된 브랜치 | 3일 이상 작업이 이어지면 `main`을 받아 충돌을 미리 해결한다 |
| `spike/*` | 결과는 이슈 댓글로 남긴다. 성공한 코드만 PR로 병합하고, 실패한 실험 브랜치는 발표 근거로 쓸 수 있게 병합하지 않은 채 보존해도 된다 |
| Claude Code가 만드는 브랜치 | 사람과 같은 규칙을 따른다 |

## 4. 커밋 규칙

### 형식

```
[태그] 요약 (#이슈번호)

본문 (선택): 무엇을 왜 바꿨는지. 어떻게는 코드가 말한다.

Refs #이슈번호 / Closes #이슈번호
```

### 규칙

- 요약은 **한국어, 50자 이내**로 쓰고 마침표를 찍지 않는다
- 요약 끝에 이슈 번호를 붙인다: `(#1)`
- 한 커밋에는 한 가지 변경만 담는다. 문서와 코드 변경이 섞이면 나눈다
- 이슈를 끝내는 커밋이나 PR에는 `Closes #N`을 쓴다 (merge되면 이슈가 자동으로 닫힌다)
- **커밋하면 안 되는 것:** `.sfdx/`, `.sf/`, `.env`, `package-lock.json`, `node_modules/`

### 예시

```
[Docs] 10/23 발표 준비 계획서 작성 (#1)

주차별 일정, go/no-go 판단 시점, 컷 라인, 발표 구성과
Storybook vs sf lightning dev 실습 계획을 README에 추가

Closes #1
```

```
[Spike] lightning-badge Storybook 렌더 검증 (#2)

lightning-base-components + synthetic-shadow + 전역 SLDS CSS 구성으로
c-milvus-badge 내부의 lightning-badge 렌더를 확인

Refs #2
```

## 5. PR 규칙

- 제목은 대표 커밋과 같은 형식: `[태그] 요약 (#이슈번호)`
- 본문에 `Closes #N`과 확인 방법(스크린샷, 실행 명령)을 적는다
- 혼자 작업하더라도 PR을 거친다. 변경 기록이 발표와 회고의 근거가 된다

## 6. 자동 검사 (예정)

| 대상 | 사람의 작업 | Claude Code의 작업 |
| --- | --- | --- |
| 커밋 메시지 형식 | husky `commit-msg` | hook H3 (`guard-commit.mjs`) |
| 브랜치 이름 형식, `main` 직접 커밋 | husky `pre-commit`에서 현재 브랜치 검사 | hook H3가 `git commit` 전에 현재 브랜치를 검사하고, `git checkout -b` / `git switch -c`의 새 이름도 검사 |
| `main` 보호 (PR 필수, force push 금지) | GitHub 브랜치 보호 규칙 (설정 여부 **미정**) | 같음 |

- 위 표의 정규식은 한 파일(`learndoshare_1/scripts/rules.mjs` 예정)에 두고 husky와 hook이 함께 가져다 쓴다
- 현재 husky hook은 **설치되지 않은 상태**다. git 루트(`learndoshare/`)와 `package.json` 위치(`learndoshare_1/`)가 달라서, `prepare` 스크립트를 고쳐야 한다. `learndoshare_1` Phase 1(기반 셋업)에서 함께 처리한다
