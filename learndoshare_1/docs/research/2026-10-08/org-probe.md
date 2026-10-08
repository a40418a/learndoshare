# org 프로브: 무엇을 배포하고 무엇을 쟀나 (2026-10-08)

설계 문서 13장 "확인된 사실" 가운데 org에서 잰 항목의 근거다. 프로브 파일은 저장소 밖 임시 폴더에서 만들고, 측정이 끝난 뒤 org에서 지웠다. 이 문서는 그 구성을 설명만 한다. 원본 메타데이터 파일은 옮기지 않았다.

- 대상: 이 저장소가 연결한 개발용 org. org ID, 주소, 사용자 이름은 적지 않는다
- 메타데이터 API 버전: 67.0
- 표시: 보관된 파일로 다시 확인한 것은 **(파일 확인)**, 화면에서 잰 것은 **(org 측정)**, 기록이 남지 않은 것은 **미확인**으로 적는다

## 1. 배포한 것

### 1.1 테마와 브랜드 색

| 메타데이터 | 이름 | 내용 |
| --- | --- | --- |
| `LightningExperienceTheme` | `Milvus_Verify` | 디자인 시스템 버전 `SLDS_v2`, 다크 모드 꺼짐, 기본 브랜딩 세트로 아래 `BrandingSet`을 가리킨다 |
| `BrandingSet` | `LEXTHEMINGMilvus_Verify` | `BRAND_COLOR` `#2E7D32`(지금 테마와 확실히 다른 초록), `HEADER_BACKGROUND_COLOR` `#FFFFFF`. 로고는 넣지 않았다 |
| `Settings` (`LightningExperience`) | 활성화용 | `activeThemeName` 필드 **하나만** 담는다. 활성화는 `Milvus_Verify`, 복구는 원래 테마 `Milvus_DesignSystem` |

- 이름 규칙: 조회한 기존 테마 `Milvus_DesignSystem`의 `BrandingSet` 이름이 `LEXTHEMINGMilvus_DesignSystem`이다 (파일 확인). 프로브도 `LEXTHEMING` + 테마 이름을 따랐다

### 1.2 util.css가 닿는 범위를 재는 화면

| 메타데이터 | 이름 | 내용 |
| --- | --- | --- |
| `StaticResource` | `milvusBrand` | `text/css`. `:root`에 눈에 띄는 값 두 개만 둔다: global hook `--slds-g-radius-border-pill: 0`, 컴포넌트 hook `--slds-s-input-radius-border: 0` |
| `LightningComponentBundle` | `milvusBrandProbe` | 나타날 때 `lightning/platformResourceLoader`의 `loadStyle(this, milvusBrand)`를 부르고 결과(loaded / error)를 화면에 쓴다. `lightning-card` 안에 `lightning-button`(brand, neutral), `lightning-badge`, `lightning-input`을 둔다. brand 버튼은 `lightning/alert`의 `LightningAlert.open()`으로 모달을 연다. 대상: `lightning__Tab`, `lightning__UrlAddressable` |
| `CustomTab` | `Milvus_Probe` | 위 LWC를 여는 탭 |
| `ApexPage` | `MilvusProbe` | API 67.0. 헤더·사이드바·표준 스타일시트 끔. `<head>`에 `<apex:slds/>`(속성 없음)와 `<apex:stylesheet value="{!$Resource.milvusBrand}"/>`. `slds-scope` 안에 SLDS 블루프린트 마크업으로 brand·neutral 버튼, 배지, 입력창을 둔다 (파일 확인) |

### 1.3 TypeScript LWC 배포 (별도 프로젝트)

| 메타데이터 | 이름 | 내용 |
| --- | --- | --- |
| `LightningComponentBundle` | `milvusTsProbe` | `.js` 없이 `.ts`, `.html`, `.js-meta.xml`만 둔다. `.ts`에는 `@api label: string`, 타입이 붙은 필드, 반환 타입이 붙은 getter가 있다. 화면에 계산한 값 `ts-probe:42`를 그린다. 대상: `lightning__UrlAddressable` |

## 2. 순서

1. **배포 전 조회:** 기존 테마(`BrandingSet`, `LightningExperienceTheme` 전부)와 `Settings:LightningExperience`를 받아 둔다
2. **프로브 배포:** 1.1의 테마·브랜딩 세트와 1.2의 네 가지를 함께 배포한다 (매니페스트 6종)
3. **활성화:** `activeThemeName`만 담은 설정을 배포하고, 설정을 다시 조회해 배포 전과 비교한다
4. **측정:** LEX에서 프로브 화면을 열고, VF 페이지를 연다. 측정 도구와 요소별 측정값은 기록으로 남지 않았다 (**미확인**). 남은 것은 3장의 결론이다
5. **복구:** 원래 테마 이름만 담은 설정을 배포하고, 다시 조회해 배포 전과 비교한다
6. **정리:** 삭제 배포로 프로브를 지운다. 매니페스트는 한 번에 지우는 것과 두 단계(① 탭·VF 페이지·LWC·정적 리소스·테마, ② `BrandingSet`)로 나눈 것이 남아 있다. 실제로 어느 매니페스트를 어떤 순서로 썼는지는 기록이 없다 (**미확인**)
7. **TS 프로브:** `milvusTsProbe`를 배포하고, 다시 조회하고, 화면에서 연 뒤 삭제 배포로 지운다

## 3. 결과

설계 13장의 문장과 같다. 근거 열에 이 폴더에서 다시 확인할 수 있는 정도를 적었다.

| 결과 | 근거 |
| --- | --- |
| `BrandingSet`과 `LightningExperienceTheme`은 배포로 만들어진다 | 2단계 배포 성공 (org 측정) |
| `activeThemeName`만 담은 설정을 배포하면 그 필드만 바뀐다 | 배포 전후 조회 파일의 차이가 `activeThemeName` 한 줄뿐이다. 복구 뒤 조회 파일은 배포 전과 바이트 단위로 같다 (파일 확인). 조회 파일의 설정 필드는 모두 40개라서 바뀌지 않은 필드는 39개다. 설계 13장의 "다른 42개 필드"와 숫자가 다르다 (설계 쪽 확인 필요) |
| 활성화한 브랜드 색 `#2E7D32`의 LEX accent는 `#468244`이고, 우리 팔레트 규칙(`scripts/palette.mjs`)의 50단계와 같다 | org 측정. 팔레트 계산은 저장소 스크립트로 다시 할 수 있다 |
| 테마를 지우면 그 테마의 `BrandingSet`도 함께 지워진다 | 삭제 배포 (org 측정) |
| LEX에서 `loadStyle`한 CSS는 문서 head에 들어간다. 프로브 컴포넌트뿐 아니라 같은 페이지의 표준 헤더 버튼과 `document.body`에 붙는 `LightningAlert` 모달까지 바뀐다. 컴포넌트 hook(`--slds-s-input-radius-border`)도 닿는다 | org 측정 |
| VF의 `<apex:slds/>`는 SLDS 1이다. 테마 색은 따라오지만 util.css는 효과가 없다 | org 측정. 이때 Setup → User Interface의 Visualforce 설정("SLDS 2 테마가 활성이면 `<apex:slds>` 페이지에 SLDS 2를 쓴다")이 켜져 있었는지는 조회하지 않았다 (**미확인**). 공식 문서상 `lightningStyleMode` 기본값 `Auto`는 org 테마 설정을 따른다 |
| VF에 SLDS 2 CSS를 넣으면 util.css가 작동한다. 팔레트(브랜드 색 단계)는 직접 넣어야 한다 | org 측정. SLDS 2 CSS를 어떤 방법으로 넣었는지는 보관된 파일에 없다 (**미확인**). 10/12 프로브에서 `milvusVf`로 다시 잰다(설계 14장) |
| 메타데이터로 배포한 새 탭은 프로필에서 숨김이다. 확인용 화면은 `lightning__UrlAddressable`로 연다 | org 측정 |
| `.ts`만 있는 LWC를 배포하면 org가 `.ts`를 그대로 저장하고, 타입을 지워 실행한다 | 다시 조회한 번들에 `.js` 없이 `.ts`가 있고, 내용은 원본과 같다(파일 끝 줄바꿈만 다름) (파일 확인). 실행은 화면에서 확인 (org 측정) |

## 4. 이 프로브로 확인하지 않은 것

설계 14장의 미확인 항목 가운데 org와 관련된 것이다. 10/12 org 프로브(승인 후)에서 잰다.

- 피드백 색·중립 색 hook을 util.css로 바꾸면 LEX 표준 화면에도 반영되는가
- Visualforce 설정(`<apex:slds>`에 SLDS 2 사용)을 켠 상태에서 `<apex:slds/>`만으로 SLDS 2와 브랜드 팔레트가 함께 들어오는가. 그렇다면 `milvusVf`가 필요 없다
- VF에서 `milvusVf.css` + `milvusBrand`가 SLDS 2, 팔레트, util.css를 함께 적용하는가
- LWC 유틸리티 바 항목을 백그라운드로 로드하면 앱의 모든 페이지에서 `loadBrand`가 실행되는가
- npm 번들의 hook 기본값과 org 런타임 값이 같은가, 정의 없는 hook(`--slds-g-color-accent-4` 등)을 org가 정의하는가

## 5. 다시 재려면

- 위 표대로 메타데이터를 저장소 밖 임시 SFDX 프로젝트에 만든다. 브랜드 색은 지금 테마와 확실히 다른 값을, util.css 값은 기본값과 확실히 다른 값을 쓴다
- 배포, 활성화, 삭제는 org를 바꾼다. 실행 전에 대상 org와 명령을 보여 주고 승인을 받는다 (CLAUDE.md 5장)
- 활성화 전후와 복구 뒤에 `Settings:LightningExperience`를 조회해 비교한다. 복구 뒤 조회 결과가 배포 전과 같아야 끝난다
- 조회 결과를 저장소에 옮길 때는 org ID, 주소, 사용자 이름, 파일 자산 경로를 지운다
