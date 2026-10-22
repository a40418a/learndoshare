import { MilvusBrandLoader, ORIGIN, lwc, sourceStory } from "../../helpers.js";

export default {
  title: "컴포넌트/밀버스 추가/BrandLoader",
  parameters: {
    controls: { disable: true },
    docs: {
      source: {
        code: "<!-- 화면 템플릿에 넣지 않는다. App Manager에서 앱의 유틸리티 바에 추가한다 -->"
      },
      description: {
        component: `${ORIGIN.milvus}

**앱 전체에 브랜드 CSS를 넣는 화면 없는 컴포넌트다.** 밀버스 컴포넌트는 자기가 놓인 페이지에만 브랜드 CSS(\`milvusBridge\`·\`milvusBrand\`·\`milvusOverride\`)를 넣는다. 이 로더를 앱의 유틸리티 바에 두면 커스텀 컴포넌트가 없는 그 앱의 표준 화면(예: 리드 목록)에도 들어간다.

**앱에 붙이는 순서** (앱마다 한 번, 배포 뒤 사람이 App Manager에서 한다. \`milvus deploy\`는 앱을 바꾸지 않는다)

1. App Manager에서 앱을 편집해 유틸리티 항목으로 \`Milvus Brand Loader\`를 추가한다
2. 그 항목의 "**앱이 열릴 때 백그라운드로 로드**"를 체크하고 저장한다

- 보이는 유틸리티 항목이라 유틸리티 바에 버튼으로 나온다. 라벨과 아이콘은 App Manager에서 정한다
- 템플릿이 비어 있어 패널을 열어도 아무것도 그리지 않는다
- 다른 앱에는 들어가지 않는다. 로더가 없는 앱의 표준 화면에는 org 테마 색만 적용된다
- org에서는 FlexiPage의 백그라운드 로드(\`eager\`)로 확인했다. App Manager의 체크와 같은 설정인지는 **미확인**이다(설계 9.7)
- Storybook에서는 \`loadStyle\`이 바로 끝나는 대체 모듈이라 아무것도 넣지 않는다. 브랜드 CSS는 상단 툴바의 브랜드가 넣는다. 아래 스토리는 빈 화면이 정상이고 콘솔에 오류가 없어야 한다`
      }
    }
  }
};

export const 기본 = {
  render: () => {
    const wrap = document.createElement("div");
    const note = document.createElement("p");
    note.className = "slds-text-body_small";
    note.textContent =
      "아래에 c-milvus-brand-loader를 붙였다. 화면이 없으므로 아무것도 보이지 않는 것이 정상이다.";
    wrap.append(note, lwc("c-milvus-brand-loader", MilvusBrandLoader));
    return wrap;
  }
};

export const 소스_코드 = sourceStory("milvusBrandLoader");
