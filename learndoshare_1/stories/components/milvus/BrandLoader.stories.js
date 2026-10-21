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

앱 전체 화면에 브랜드를 적용하는 로더입니다. 화면에는 아무것도 그리지 않습니다.

**앱에 붙이기** (앱마다 한 번, 배포한 뒤)

1. App Manager에서 앱을 편집하세요.
2. 유틸리티 항목에 \`Milvus Brand Loader\`를 추가하세요.
3. "**앱이 열릴 때 백그라운드로 로드**"를 체크하고 저장하세요.

- 붙이지 않은 앱의 표준 화면에는 테마 색만 적용됩니다.
- 이 미리보기에서는 아무것도 보이지 않는 것이 정상입니다.`
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
      "화면이 없는 컴포넌트라 아무것도 보이지 않는 것이 정상입니다.";
    wrap.append(note, lwc("c-milvus-brand-loader", MilvusBrandLoader));
    return wrap;
  }
};

export const 소스_코드 = sourceStory("milvusBrandLoader");
