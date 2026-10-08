# 연구 자료 2026-10-08: 전 컴포넌트 브랜드 반영 분석과 org 프로브

설계 문서(`docs/specs/2026-10-08-milvus-package-design.md`) 9장 "모든 컴포넌트에 브랜드 반영하기"와 13장 "확인된 사실"의 근거 자료다. Learn 문서는 실측 근거로 이 폴더의 파일을 링크한다.

- 분석 대상: `@salesforce-ux/design-system-2` 2.264.2의 SLDS 2 CSS, `lightning-base-components`(이하 LBC) 1.28.19-alpha의 CSS·JS. 둘 다 이 저장소의 `package.json`에 고정된 버전이다
- 스크립트는 설치된 패키지를 **읽기만** 한다. 패키지 버전이 바뀌면 결과도 바뀐다
- org ID, org 주소, 사용자 이름, 개발자 PC 경로는 넣지 않았다

## 파일

### 문서

| 파일 | 내용 | 만든 방법 |
| --- | --- | --- |
| `summary.md` | 선언 17,398개를 항목(색, 모양, 간격, 움직임 등) × 값 종류(global hook, 컴포넌트 hook, 하드코딩 등)로 센 표. 움직임의 하드코딩 시간과 `@keyframes` 이름 | `extract.cjs`의 출력 |
| `synthesis.md` | 8개 항목(색, 모양, 간격, 글자, 그림자, 움직임, 포커스, 아이콘)별 감사를 종합한 문서. hook으로 바꿀 수 있는 비율, 빈틈, 메우는 방법, "Salesforce 고정" 후보, native 전환 대비 | 아래 스크립트 결과를 바탕으로 항목별 감사 8개와 종합 1개를 작성했다. 스크립트 출력이 아니다 |
| `org-probe.md` | org에 무엇을 배포하고 무엇을 쟀는지(테마 메타데이터 배포·활성화, `loadStyle` 도달 범위, VF의 `<apex:slds/>`, `.ts` LWC 배포)와 결과 | 프로브 기록을 정리했다. 원본 메타데이터는 옮기지 않았다 |

### 스크립트 (CommonJS, Node 22 이상)

| 파일 | 하는 일 | 읽는 것 → 만드는 것 |
| --- | --- | --- |
| `paths.cjs` | 공용 위치: 프로젝트 루트, 출력 폴더, 패키지 폴더(`require.resolve`), postcss(vite와 함께 설치된 것) | — |
| `extract.cjs` | SLDS 2 번들과 LBC CSS의 모든 선언을 항목 × 값 종류로 분류한다 | 패키지 → `decls.json`, `summary.md` |
| `shape.cjs` | 반경·테두리 두께 선언을 `var()` 체인 끝까지 풀어 분류한다 | 패키지 → `shape.json` |
| `color-resolve.cjs` | 색 선언을 custom property 정의까지 따라가 global hook / s hook / 하드코딩으로 나눈다. `:where(html)`의 hook 기본값도 모은다 | 패키지 → `color-rows.json`, `hookdefs.json` |
| `state.cjs` | 포커스·hover·active·disabled·cursor 상태 선언을 뽑는다 | 패키지 → `state.json` |
| `cov2.cjs` | 간격·크기 선언의 hook 비율을 컴포넌트 폴더별로 낸다 | 패키지 → `cov2.json` |
| `cov3.cjs` | LBC 컴포넌트별로 `@import`를 풀어 간격·크기 hook 비율을 다시 낸다 | 패키지 → `cov3.json` |
| `covstate.cjs` | 상태 선언을 hook / 혼합 / 하드코딩으로 나눠 컴포넌트별 포커스·상호작용 커버리지를 낸다 | `state.json`, `hookdefs.json` → `covstate.json` |
| `icon-cov.cjs` | 아이콘 관련 선언의 hook 비율 | `decls.json` → `icon-cov.json` |
| `icon-defs.cjs` | 아이콘 c hook 정의의 하드코딩(개체 아이콘 색 등)을 더해 아이콘 커버리지를 다시 낸다 | `icon-cov.json` + 패키지 → 화면 출력 |
| `post.cjs` | `shape.json`을 g / s / 하드코딩으로 다시 나누고, hook별로 읽는 선언 수를 낸다. `cov.cjs`가 모듈로 쓴다 | `shape.json` → 화면 출력 |
| `cov.cjs` | 모양 hook 커버리지를 synthetic(SLDS 2)과 native(LBC 지원 목록 156개)로 나눠 낸다 | `post.cjs`, `decls.json`, LBC `package.json` → 화면 출력 |
| `motion.cjs` | 움직임(transition, animation, transform) 선언의 hook 비율 | `decls.json` → 화면 출력 |
| `hooks.cjs` | 간격·크기·줄 간격에 쓰이는 hook별 선언 수 | 패키지 → 화면 출력 |
| `reach.cjs` | 간격 hook 묶음이 닿는 컴포넌트 수 | 패키지 → 화면 출력 |
| `hk.cjs` | `node hk.cjs <hook...>`: hook마다 정의 수, 읽는 곳 수, 읽는 컴포넌트 수 | 패키지 → 화면 출력 |
| `hookcheck.cjs` | `node hookcheck.cjs <hook...>`: SLDS 2 번들이나 LBC 소스 중 한쪽에라도 없는 이름만 출력한다. 문서에 쓴 hook 이름이 실제로 있는지 확인할 때 쓴다 | 패키지 → 화면 출력 |

### 결과 JSON (200KB 이하만 넣음)

| 파일 | 만드는 스크립트 |
| --- | --- |
| `cov3.json` | `cov3.cjs` |
| `covstate.json` | `covstate.cjs` |
| `hookdefs.json` | `color-resolve.cjs` |
| `icon-cov.json` | `icon-cov.cjs` |

## 넣지 않은 파일

| 파일 | 크기 | 다시 만드는 법 |
| --- | --- | --- |
| `decls.json` | 약 3.5MB | `extract.cjs` |
| `cov2.json` | 약 1.8MB | `cov2.cjs` |
| `color-rows.json` | 약 1.2MB | `color-resolve.cjs` |
| `state.json` | 약 1.2MB | `state.cjs` |
| `shape.json` | 약 0.5MB | `shape.cjs` |
| `audit.json` | 약 214KB | 항목별 감사 8개의 원본 결과다. 스크립트 출력이 아니라 다시 만들 수 없다. 내용은 `synthesis.md`에 종합되어 있다 |
| `cov-spacing.json` | 약 47KB | 만든 스크립트가 남아 있지 않다. 간격 커버리지는 `cov2.cjs`·`cov3.cjs`로 다시 낼 수 있다 |

## 다시 만들기

`learndoshare_1`에서 `pnpm install`을 한 뒤 실행한다. 큰 JSON이 저장소에 생기지 않도록 출력 폴더(`AUDIT_OUT`)를 저장소 밖으로 지정한다. 지정하지 않으면 이 폴더에 쓴다.

```sh
cd docs/research/2026-10-08
export AUDIT_OUT="$(mktemp -d)"

node extract.cjs         # decls.json, summary.md
node shape.cjs           # shape.json
node color-resolve.cjs   # color-rows.json, hookdefs.json
node state.cjs           # state.json
node cov2.cjs            # cov2.json
node cov3.cjs            # cov3.json
node covstate.cjs        # covstate.json   (state.json, hookdefs.json 필요)
node icon-cov.cjs        # icon-cov.json   (decls.json 필요)

# 화면 출력만 하는 스크립트 (위 JSON 필요)
node icon-defs.cjs
node post.cjs
node cov.cjs
node motion.cjs
node hooks.cjs
node reach.cjs
node hk.cjs --slds-s-button-radius-border
node hookcheck.cjs --slds-g-radius-border-pill --slds-g-color-accent-4
```

- 다른 프로젝트의 패키지를 분석하려면 `MILVUS_ROOT=<그 프로젝트 루트>`를 함께 넘긴다
- 2026-10-09 확인: 위 순서로 다시 실행한 결과 `summary.md`와 JSON 9개(`decls`, `shape`, `color-rows`, `hookdefs`, `state`, `cov2`, `cov3`, `covstate`, `icon-cov`)가 원본과 바이트 단위로 같았다
