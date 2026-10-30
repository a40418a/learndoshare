import { LightningElement, api, wire } from "lwc";
import { gql, graphql } from "lightning/graphql";
import ICONS from "@salesforce/resourceUrl/slackIcons";
import INPUT from "@salesforce/label/c.SlackMessageBox_Input";
import PLACEHOLDER from "@salesforce/label/c.SlackMessageBox_Placeholder";
import ACTIONS from "@salesforce/label/c.SlackMessageBox_Actions";
import ATTACH from "@salesforce/label/c.SlackMessageBox_Attach";
import FORMATTING from "@salesforce/label/c.SlackMessageBox_Formatting";
import EMOJI from "@salesforce/label/c.SlackMessageBox_Emoji";
import MENTION from "@salesforce/label/c.SlackMessageBox_Mention";
import MENTION_SEARCH from "@salesforce/label/c.SlackMessageBox_MentionSearch";
import MENTION_EMPTY from "@salesforce/label/c.SlackMessageBox_MentionEmpty";
import MENTION_ERROR from "@salesforce/label/c.SlackMessageBox_MentionError";
import VIDEO from "@salesforce/label/c.SlackMessageBox_Video";
import AUDIO from "@salesforce/label/c.SlackMessageBox_Audio";
import SHORTCUT from "@salesforce/label/c.SlackMessageBox_Shortcut";
import SEND from "@salesforce/label/c.SlackMessageBox_Send";
import SEND_OPTIONS from "@salesforce/label/c.SlackMessageBox_SendOptions";

// PRD: prd/slackMessageBox/PRD.md — Figma Message Box (68:7367 Empty, 68:7462 Filled)

// 툴바 항목은 Figma 서식 버튼(굵게·기울임·취소선·링크·목록·코드·코드 블록)과 같다 (PRD 2, Q1-A)
const FORMATS = [
  "bold",
  "italic",
  "strike",
  "link",
  "list",
  "code",
  "code-block"
];

// 이모지 선택지 (PRD 4, Q4-B). 목록 출처가 Figma 에 없어 자주 쓰는 것만 둔다
const EMOJIS = [
  "😀",
  "😂",
  "😊",
  "😍",
  "🤔",
  "😢",
  "👍",
  "👏",
  "🙏",
  "🎉",
  "🔥",
  "✅"
];

// 멘션 검색: 활성 사용자 중 이름이 검색어를 포함하는 10명 (PRD 3)
const USERS_QUERY = gql`
  query SlackMessageBoxUsers($term: String) {
    uiapi {
      query {
        User(
          where: {
            and: [{ Name: { like: $term } }, { IsActive: { eq: true } }]
          }
          first: 10
          orderBy: { Name: { order: ASC } }
        ) {
          edges {
            node {
              Id
              Name {
                value
              }
            }
          }
        }
      }
    }
  }
`;

const icon = (name) => `${ICONS}#${name}`;

export default class SlackMessageBox extends LightningElement {
  /** 입력 영역 안내 문구 */
  @api placeholder = PLACEHOLDER;
  /** true 면 입력과 모든 버튼을 막는다 */
  @api disabled = false;

  labels = {
    INPUT,
    ACTIONS,
    ATTACH,
    FORMATTING,
    EMOJI,
    MENTION,
    MENTION_SEARCH,
    MENTION_EMPTY,
    MENTION_ERROR,
    VIDEO,
    AUDIO,
    SHORTCUT,
    SEND,
    SEND_OPTIONS
  };
  formats = FORMATS;
  icons = {
    plus: icon("plus"),
    formatting: icon("formatting"),
    emoji: icon("emoji-1"),
    mention: icon("mention"),
    video: icon("video-clip"),
    audio: icon("audio-clip"),
    shortcut: icon("shortcut"),
    send: icon("send-fill"),
    chevron: icon("chevron-down")
  };
  emojis = EMOJIS.map((char) => ({ char }));

  value = "";
  openPopover = null; // "emoji" | "mention" | null
  mentionTerm = "";
  users = [];
  usersError;
  usersLoaded = false; // 조회 결과가 오기 전에는 "No people found" 를 보이지 않는다

  get isEmpty() {
    // rich text 값은 HTML 이라 태그와 공백을 빼고 판단한다 (Empty / Filled 상태, PRD 6)
    return !this.value.replace(/<[^>]*>|&nbsp;/g, "").trim();
  }

  get sendDisabled() {
    return this.disabled || this.isEmpty;
  }

  get emojiOpen() {
    return this.openPopover === "emoji";
  }

  get mentionOpen() {
    return this.openPopover === "mention";
  }

  get noUsers() {
    return this.usersLoaded && !this.hasUsers;
  }

  get hasUsers() {
    return this.users.length > 0;
  }

  // 팝오버가 열렸을 때만 조회한다 — query 가 undefined 면 wire 가 돌지 않는다
  get usersQuery() {
    return this.mentionOpen ? USERS_QUERY : undefined;
  }

  get usersVariables() {
    return { term: `%${this.mentionTerm}%` };
  }

  @wire(graphql, { query: "$usersQuery", variables: "$usersVariables" })
  wiredUsers({ data, errors }) {
    if (errors) {
      this.users = [];
      this.usersError = errors;
      this.usersLoaded = true;
      return;
    }
    if (data) {
      this.usersError = undefined;
      this.usersLoaded = true;
      this.users = data.uiapi.query.User.edges.map(({ node }) => ({
        id: node.Id,
        name: node.Name.value
      }));
    }
  }

  handleChange(event) {
    this.value = event.target.value;
  }

  handleSend() {
    if (this.sendDisabled) return;
    this.dispatchEvent(
      new CustomEvent("send", { detail: { value: this.value } })
    );
    this.value = "";
  }

  // 실제 기능은 범위 밖이라 부모에게 알리기만 한다 (PRD 5, Q4)
  handleAction(event) {
    this.dispatchEvent(
      new CustomEvent("action", {
        detail: { name: event.currentTarget.dataset.name }
      })
    );
  }

  togglePopover(event) {
    const name = event.currentTarget.dataset.popover;
    this.openPopover = this.openPopover === name ? null : name;
    this.mentionTerm = "";
    this.usersLoaded = false;
  }

  handlePopoverKeydown(event) {
    if (event.key === "Escape") this.openPopover = null;
  }

  handleMentionSearch(event) {
    this.mentionTerm = event.target.value;
    this.usersLoaded = false;
  }

  handleEmojiPick(event) {
    this.insert(event.currentTarget.dataset.char);
  }

  handleMentionPick(event) {
    this.insert(`@${event.currentTarget.dataset.name} `);
  }

  // 커서(선택 영역) 자리에 글자를 넣고 커서를 넣은 글자 뒤로 옮긴다('end').
  // start·end 를 비우면 지금 선택 영역을 쓴다 — org 에서 확인함 (TEST-RECORD 발견 4)
  insert(text) {
    this.openPopover = null;
    const editor = this.refs.editor;
    editor.focus();
    editor.setRangeText(text, undefined, undefined, "end");
    this.value = editor.value;
  }
}
