# 발표 Do 시연: 테스트와 캡처 가이드

10/23 발표의 **Do**(Learn Do Share)에서 보여 줄 "밀버스 패키지로 새 Salesforce 프로젝트를 브랜드에 맞게 세팅하기"를, 다른 노트북(Windows, Git Bash, pnpm 11)에서 처음부터 실행하며 캡처하는 순서다.
단계마다 **실행 → 캡처 → 왜**를 적었다. 발표에서는 "왜"를 한 줄씩 말하면 된다. 발표 구성 전체는 `README.md` 5.3을 따른다.

기준: 패키지 `@a40418a/milvus-design-system` **0.2.2**, 대상 org 별칭 `learndoshare_1`(리허설 DE org).

---

## 1. 캡처 원칙

- **전후는 같은 화면, 같은 크기.** 같은 레코드, 같은 창 크기(1440×900 권장), 확대율 100%. 다른 것은 브랜드 하나뿐이어야 한다
- **한 장에 메시지 하나.** 바뀐 곳 하나에만 테두리나 화살표를 넣고, 설명은 슬라이드 제목에 쓴다
- **터미널은 글자를 키운다.** 18pt 이상, 밝은 테마. 경고(`deprecated` 등)는 잘라도 된다
- **가린 뒤에 쓴다(공개 저장소·발표 화면).** 주소창의 org 도메인(`orgfarm-…`), org ID, 사용자 이름·이메일, 레코드의 전화·이메일 열, 토큰
- **Do는 녹화가 기본이다.** 2장 전체를 녹화 하나로 찍고, 단계별 캡처는 슬라이드 백업으로 남긴다. 발표장 네트워크·로그인에 기대지 않기 위해서다
- Windows 캡처: 창 하나는 `Win+Shift+S` → 창 모드, 녹화는 Xbox Game Bar(`Win+G`) 또는 Snipping Tool 녹화
- **캡처 저장 위치는 저장소 밖**(예: `바탕화면\milvus-captures\`). 파일 이름은 아래 표의 이름을 쓴다

---

## 2. Do: 단계별 실행과 캡처

### 0단계 — 준비 (녹화 전, 한 번)

| 확인 | 명령·방법 |
| --- | --- |
| Node 22.18 이상, pnpm, Salesforce CLI | `node -v`, `pnpm -v`, `sf --version` |
| GitHub 토큰(classic, `read:packages`)이 Windows 사용자 환경변수 `NODE_AUTH_TOKEN`에 있다 | `printenv NODE_AUTH_TOKEN > /dev/null && echo ok` (값은 출력하지 않는다). 없으면 "계정의 환경 변수 편집"에서 새로 만들고 Git Bash를 다시 연다 |
| 토큰 줄이 사용자 파일 `~/.npmrc`에 있다 | `grep -c npm.pkg.github.com ~/.npmrc` 가 1 이상. 없으면 `printf '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n' >> ~/.npmrc` |
| org에 로그인돼 있다 | `sf org list`에 `learndoshare_1`. 없으면 `sf org login web --alias learndoshare_1` |

**캡처:** 없음(토큰이 보일 수 있는 화면은 찍지 않는다).

**왜:** 패키지는 GitHub Packages에 있고, 이 레지스트리는 공개 패키지도 설치할 때 토큰을 요구한다. pnpm 11은 프로젝트 `.npmrc`에 쓴 `${NODE_AUTH_TOKEN}`을 풀지 않으므로(저장소에 커밋되는 파일이라 비밀이 샐 수 있어서) 토큰 줄은 사용자 파일에만 둔다.

### 1단계 — 새 SFDX 프로젝트와 설치

```bash
cd ~/Desktop
sf project generate -n milvus-demo
cd milvus-demo
printf '@a40418a:registry=https://npm.pkg.github.com\n' > .npmrc
printf "minimumReleaseAgeExclude:\n  - '@a40418a/*'\nallowBuilds:\n  esbuild: true\n" > pnpm-workspace.yaml
pnpm add -D @a40418a/milvus-design-system
pnpm milvus --version
```

**캡처:** `01-install.png` — `pnpm add` 끝부분(`+ @a40418a/milvus-design-system 0.2.2`)과 `--version`의 `0.2.2`.

**왜:**
- 디자인 시스템을 **복사가 아니라 버전 있는 패키지로** 받는다. 모든 프로젝트가 같은 버전을 쓰고, 고친 것은 `update` 한 번으로 받는다. 복사해 쓰면 프로젝트마다 조금씩 달라진다
- `pnpm-workspace.yaml`의 두 줄은 pnpm 11 기본값 때문이다: 발행한 지 하루가 안 된 버전을 막는 `minimumReleaseAge`(1440분)에서 밀버스만 빼고, Storybook이 쓰는 esbuild의 설치 스크립트를 허용한다(`strictDepBuilds`). 출처: https://pnpm.io/settings/dependency-resolution , https://pnpm.io/settings/build

### 2단계 — `init`: 세팅을 명령 하나로

```bash
pnpm milvus init --target-org learndoshare_1 --brand Demo --no-vf
```

(지금 org 테마 색을 가져오려면 `--brand` 대신 `--from-org`. VF도 보여 주려면 `--no-vf`를 뺀다)

**캡처:** `02-init.png` — 만든 파일 목록. `02b-files.png` — VS Code 파일 트리(`milvus-design.md`, `.claude/`, `force-app/main/default/lwc/milvus*`, `staticresources/`, `brandingSets/`).

**왜:**
- 빠뜨리기 쉬운 세팅(밀버스 LWC, 브랜드 파일, BrandingSet·테마 메타데이터, Claude Code 규칙과 skill)을 한 번에 같은 모양으로 놓는다
- 파일마다 **누가 고치는지** 정해져 있다. 밀버스 **관리** 파일은 sha256을 기록해 두고 직접 고치지 않으며, 프로젝트 **소유** 파일(`milvusBrand.css`, BrandingSet)만 고친다. 그래서 업데이트해도 프로젝트가 고친 내용이 지워지지 않는다

`init`은 프로젝트 `.npmrc`에 레지스트리 줄만 둔다(1단계에서 이미 넣었으므로 그대로다). 0.2.1까지는 토큰 줄도 더해 pnpm 11이 "무시했다"는 경고를 냈는데, 0.2.2부터는 토큰 줄을 넣지 않아 경고가 없다. 토큰은 `~/.npmrc`에서 읽는다(0단계).

### 3단계 — Storybook 브랜드 명세 페이지에 요청 쓰기

```bash
pnpm milvus storybook
```

브라우저에서 **시작하기 / 브랜드 명세**를 연다. 브랜드 색과 요청(예: "모서리는 거의 각지게, 회색은 쿨그레이로")을 입력하고 저장한다. 프로젝트에 `milvus-brand-request.md`가 생긴다.

**캡처:** `03-spec-page.png` — 브랜드 색을 넣자 버튼 색(50단계)·대비가 바로 계산된 부분. `03b-fixed.png` — 같은 페이지의 "Salesforce 고정" 목록.

**왜:**
- 발표 가제 "배포하지 않고 확인하는 UI"의 출발점이다. org에 올리기 전에 Storybook에서 모든 기본 컴포넌트(`lightning-*`)를 브랜드로 그려 본다
- 요청이 채팅에서 사라지지 않고 **파일로 남아** 리뷰할 수 있다
- 바꿀 수 없는 것(토스트 표시 시간, 아이콘 모양, LEX 컨트롤 높이 등)을 처음부터 보여 줘 기대치를 맞춘다

### 4단계 — Claude Code로 반영

Claude 데스크톱 앱에서 **폴더를 `milvus-demo`로 지정해** Code 세션을 연다(폴더 신뢰를 받아들인다). 다른 폴더로 열면 이 프로젝트의 규칙이 적용되지 않는다(2026-10-17 실측). 그리고 말한다.

> 브랜드 요청 반영해줘

Claude가 **브랜드 명세 표**(무엇을 어느 파일의 어떤 hook으로 바꾸는지)를 먼저 보여 준다. 확인하고 승인하면 BrandingSet과 `milvusBrand.css`를 고친다.

**캡처:** `04-claude-table.png` — 승인 전 명세 표. `04b-check-blocked.png` — 금지 값(예: "브랜드 색을 CSS에 직접 넣어줘")을 요청했을 때 hook `check --style`이 막고 고칠 값을 돌려준 화면.

**왜:**
- **사람이 먼저 승인한다.** Claude는 표를 보여 준 뒤에만 파일을 쓴다
- **규칙은 부탁이 아니라 코드다.** 파일을 고칠 때마다 hook이 util.css 규칙과 대비 4.5:1을 검사한다. 관리 파일 수정과 토큰 출력 명령은 `permissions.deny`로 막힌다(2026-10-17 실측)
- 반영 순서: org 테마(색·로고) → global hook → 컴포넌트 hook → 브리지 변수 → override(마지막 수단). 공식 경로부터 쓴다

### 5단계 — Storybook에서 확인

Storybook은 파일이 바뀌면 저절로 다시 그린다. 같은 스토리를 기본 브랜드와 새 브랜드로 비교하고, **시작하기 / 반영 검사**를 "반영 검사 시작"으로 돌린다(몇 분, 이 탭을 앞에 둔다).

**캡처:** `05-before.png`·`05-after.png` — 같은 스토리(예: Button 모음, Datatable), 같은 크기. `05b-reflect.png` — 반영 검사의 판정 표.

**왜:** 브랜드가 버튼 몇 개가 아니라 **모든 컴포넌트**에 닿는지 눈과 숫자로 확인한다. 정적 검사는 CSS 선언을 세고, 반영 검사는 실제로 그려진 화면의 계산값을 비교한다. 확인을 org가 아니라 로컬에서 하니 배포·롤백 없이 몇 초 만에 다시 본다.

### 6단계 — 배포 전 LEX 화면 (before)

배포하기 **전에** LEX 리드 목록을 찍어 둔다.

**캡처:** `06-lex-before.png` — 리드 목록. 주소창을 자르고 전화·이메일 열을 가린다.

### 7단계 — 배포: 계획을 보고 승인한 뒤에만

Claude에게 "반영한 거 배포 계획 보여줘"라고 하거나 직접 실행한다.

```bash
pnpm milvus deploy
```

계획(대상 org, 지금 테마 → 새 테마, 올릴 파일 목록, 경고)을 확인한 뒤 실행한다.

```bash
pnpm milvus deploy --yes
```

**캡처:** `07-deploy-plan.png` — 계획. `07b-deploy-done.png` — "배포를 마쳤습니다. 활성 테마: Demo".

**왜:**
- 활성 테마 변경은 **org 전체 사용자 화면**에 적용된다. 그래서 계획부터 보여 준다. Claude가 실행할 때는 `permissions.ask`가 한 번 더 묻는다
- 밀버스 메타데이터를 **한 번에** 올린다. 하나라도 실패하면 전부 롤백되고, 테마는 그 뒤에만 바꾼다. 반쯤 바뀐 org가 남지 않는다

### 8단계 — org에서 사람이 할 일

App Manager → 앱 편집 → 유틸리티 바에 `milvusBrandLoader` 추가 → **"앱이 열릴 때 백그라운드로 로드"** 체크.

**캡처:** `08-app-manager.png` — 유틸리티 항목과 체크 상자.

**왜:** 이 체크는 앱의 유틸리티 바 메타데이터에 저장된다(FlexiPage `eager`, 2026-10-14 확인). `deploy`가 이걸 바꾸면 고객이 꾸며 둔 앱 설정을 덮어쓸 수 있어 사람이 하도록 남겼다. 하지 않으면 표준 화면에는 테마 색만 들어온다.

### 9단계 — LEX 화면 (after)

리드 목록을 새로고침한다.

**캡처:** `09-lex-after.png` — 6단계와 같은 목록, 같은 크기.

**왜:** Storybook에서 본 것이 **우리가 만들지 않은 표준 화면**까지 닿는다는 마지막 증거다. 버튼·입력 높이는 Salesforce 원래 값 그대로다(2026-10-14 재측정).

### 10단계 (선택) — 업데이트가 내 수정을 지키는지

관리 파일 하나(예: `force-app/main/default/lwc/milvusBadge/milvusBadge.html`)에 한 줄을 더한 뒤 실행한다.

```bash
pnpm milvus update
```

**캡처:** `10-update-conflict.png` — 아무것도 바꾸지 않고 차이만 보여 준 화면. 끝나면 `pnpm milvus update --force`로 되돌린다.

**왜:** "패키지를 올리면 우리가 고친 게 날아가나?"에 대한 답이다. 고친 관리 파일이 하나라도 있으면 전부 멈추고, 프로젝트 소유 파일은 건드리지 않는다.

---

## 3. 새 컴포넌트 캡처 (0.2.0)

`pnpm milvus storybook`의 **컴포넌트 / 밀버스 추가**에서 찍는다.

| 파일 | 스토리 | 메시지 |
| --- | --- | --- |
| `11-notification.png` | Notification → 의미색 모음, 닫기 가능 | 공식 LWC가 없는 SLDS Scoped Notification 블루프린트를 채웠다. X는 밀버스 확장 |
| `12-calendar-month.png` | Calendar → 월 보기 | 공식 LWC에는 날짜 선택만 있고 일정표는 없다 |
| `12b-calendar-week.png` | Calendar → 주 보기 | 월·주 전환, 주 시작 요일 옵션(기본 일요일) |

**왜:** 판단 사다리의 예다. 토스트·날짜 선택은 Salesforce가 이미 주므로 만들지 않고(`lightning/toast`, `lightning-input type="date"`), 공식 LWC가 없는 것만 밀버스가 만든다.

---

## 4. Q&A 백업 캡처

| 파일 | 예상 질문 (README 5.4) | 내용 |
| --- | --- | --- |
| `qa-permissions.png` | Claude를 믿을 수 있나? | 고객 프로젝트 세션에서 토큰 출력 명령 deny, deploy ask, 관리 파일 Edit deny가 걸린 화면(2026-10-17 캡처를 그대로 써도 된다) |
| `qa-listview.png` | 모든 걸 바꿀 수 있나? | 컨트롤 높이를 바꾸면 리스트뷰 툴바가 어긋났던 사례 → "Salesforce 고정"으로 합의한 이유 |
| `qa-storybook-online.png` | 설치 없이 볼 수 있나? | 배포본 Storybook https://a40418a.github.io/learndoshare/ |

---

## 5. 문제 해결 (다른 노트북에서 실제로 겪은 것)

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `Ignored project-level auth setting … _authToken` 경고, 설치 404 | pnpm 11은 프로젝트 `.npmrc`의 `${…}` 토큰을 풀지 않는다 | 토큰 줄을 `~/.npmrc`로 (0단계) |
| `0.2.0 is available`인데 이전 버전이 설치됨 | `minimumReleaseAge` 기본 1440분 | `pnpm-workspace.yaml`의 `minimumReleaseAgeExclude` (1단계) |
| `ERR_PNPM_IGNORED_BUILDS: esbuild` | `strictDepBuilds` 기본 true | `allowBuilds: { esbuild: true }` (1단계) |
| `duplicated mapping key` | pnpm이 만든 `allowBuilds` 자리 밑에 같은 키를 덧붙임 | 파일을 1단계 내용으로 덮어쓴다(`>`) |
| `Command "milvus" not found` | `pnpm milvus add …`처럼 설치 전에 milvus를 부름 | 설치는 `pnpm add -D …` |
| `init`: sf CLI를 찾지 못했습니다 | Windows의 sf는 `sf.cmd` | 0.2.1에서 고침(#42). `pnpm add -D @a40418a/milvus-design-system@0.2.1` |
| `storybook`: `EISDIR lstat 'C:'` | Windows에서 Node의 `findPackageJSON`이 `\\?\C:\…` 경로를 돌려줌 | 0.2.2에서 고침(#46). `pnpm add -D @a40418a/milvus-design-system@0.2.2` |
| `milvus storybook`: 버전이 다릅니다 | 패키지만 올리고 `update`를 안 함 | `pnpm milvus update` |
| 설치를 엉뚱한 폴더에서 함 | 저장소 루트·`learndoshare_1`에서 실행 | 시연 프로젝트(`milvus-demo`) 폴더에서 실행 |

## 6. 끝난 뒤

- org의 활성 테마는 Demo로 남는다. 원래 테마로 되돌리거나 시연 메타데이터를 지울 때는 대상 org와 명령을 보여 주고 승인받아 실행한다
- 캡처는 1장 원칙대로 가린 뒤 발표 자료에 넣는다
