// stories/lwc-entry.js와 같은 순서: synthetic shadow를 엔진보다 먼저 import한다
import "@lwc/synthetic-shadow";

export { createElement } from "lwc";
export { default as Probe } from "c/probe";
