const SAMPLES = [
  ["slds-text-heading_large", "페이지 제목 · Page Title"],
  ["slds-text-heading_medium", "섹션 제목 · Section Title"],
  ["slds-text-heading_small", "카드 제목 · Card Title"],
  ["slds-text-title_caps", "레이블 · LABEL"],
  [
    "slds-text-body_regular",
    "본문입니다. 밀버스 디자인 시스템은 SLDS를 최대한 쓰고, 없는 것만 더한다."
  ],
  ["slds-text-body_small", "보조 설명과 도움말에 쓰는 작은 본문"]
];

export default {
  title: "Foundations/타이포그래피",
  parameters: {
    docs: {
      description: {
        component: `폰트는 org Themes and Branding에서 바꿀 수 없다(플랫폼 고정). 텍스트 크기와 굵기는 SLDS 텍스트 유틸리티 클래스를 쓴다.
브랜드별 타이포는 브랜드 root style(\`brands/<브랜드>/root.css\`의 \`--milvus-*\`)에서 관리한다 (#4).`
      },
      source: {
        code: SAMPLES.map(
          ([cls, text]) => `<p class="${cls}">${text}</p>`
        ).join("\n")
      }
    }
  }
};

export const 텍스트_스타일 = {
  render: () => {
    const root = document.createElement("div");
    root.className = "sb-stack";
    for (const [cls, text] of SAMPLES) {
      const item = document.createElement("div");
      item.innerHTML = `<p class="${cls}">${text}</p><code class="slds-text-color_weak">.${cls}</code>`;
      root.append(item);
    }
    return root;
  }
};
