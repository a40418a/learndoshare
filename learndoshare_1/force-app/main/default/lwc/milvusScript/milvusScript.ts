import type { LightningElement } from "lwc";
import { loadStyle } from "lightning/platformResourceLoader";
import milvusBridge from "@salesforce/resourceUrl/milvusBridge";
import milvusBrand from "@salesforce/resourceUrl/milvusBrand";
import milvusOverride from "@salesforce/resourceUrl/milvusOverride";

// 문서 head에 넣는 순서. 뒤에 넣은 규칙이 이기므로 프로젝트 소유 override가 마지막이다(설계 5.1)
const STYLES = [milvusBridge, milvusBrand, milvusOverride];

/** 브랜드 스타일을 문서에 넣는다. 실패해도 화면을 막지 않도록 던지지 않고 console.error로 남긴다 */
export async function loadBrand(component: LightningElement): Promise<void> {
  for (const url of STYLES) {
    try {
      // 순서를 지키려고 하나씩 기다린다. 하나가 실패해도 나머지는 넣는다
      // eslint-disable-next-line no-await-in-loop
      await loadStyle(component, url);
    } catch (error) {
      console.error(`[milvus] 브랜드 스타일을 불러오지 못했습니다: ${url}`, error);
    }
  }
}

/** native shadow로 그려진 기본 컴포넌트(호스트에 data-render-mode="shadow")의 태그 이름. synthetic이면 빈 배열 */
export function detectNativeShadow(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-render-mode="shadow"]')]
    .map((el) => el.localName)
    .filter((name) => name.startsWith("lightning-"));
}
