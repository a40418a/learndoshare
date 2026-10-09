import { LightningElement, api } from "lwc";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

type Option = { label: string; value: unknown };

const OPTION_CLASS =
  "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small";

export default class MilvusMultiSelect extends LightningElement {
  @api label?: string;
  @api placeholder = "검색";
  @api noResultsText = "검색 결과가 없습니다";
  @api disabled = false;
  @api required = false;

  _options: Option[] = [];
  _value: unknown[] = [];
  searchTerm = "";
  isOpen = false;
  activeIndex = -1;
  nativeChecked = false;

  connectedCallback(): void {
    loadBrand(this);
  }

  renderedCallback(): void {
    if (this.nativeChecked) return;
    this.nativeChecked = true;
    const native = detectNativeShadow(this.template!);
    if (native.length) console.warn(`[milvus] native shadow로 그려지는 기본 컴포넌트: ${native.join(", ")}`);
  }

  /** [{ label, value }] — value가 없는 항목은 버린다 */
  @api
  get options(): Option[] {
    return this._options;
  }
  set options(options: unknown) {
    this._options = Array.isArray(options)
      ? options.filter((option) => option?.value != null)
      : [];
  }

  /** 선택된 value 배열 */
  @api
  get value(): unknown[] {
    return this._value;
  }
  set value(value: unknown) {
    this._value = Array.isArray(value) ? [...value] : [];
  }

  get filteredOptions() {
    const term = this.searchTerm.trim().toLowerCase();
    return term
      ? this._options.filter((option) =>
          String(option.label).toLowerCase().includes(term)
        )
      : this._options;
  }

  get visibleOptions() {
    return this.filteredOptions.map((option, index) => {
      const selected = this._value.includes(option.value);
      let className = OPTION_CLASS;
      if (index === this.activeIndex) className += " slds-has-focus";
      if (selected) className += " slds-is-selected";
      return {
        ...option,
        id: `option-${index}`,
        selected,
        ariaSelected: String(selected),
        className
      };
    });
  }

  get selectedOptions() {
    return this._value
      .map((value) => this._options.find((option) => option.value === value))
      .filter(Boolean);
  }

  get hasSelection() {
    return this.selectedOptions.length > 0;
  }

  get noResults() {
    return this.filteredOptions.length === 0;
  }

  get comboboxClass() {
    return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click${this.isOpen ? " slds-is-open" : ""}`;
  }

  get ariaExpanded() {
    return String(this.isOpen);
  }

  get ariaRequired() {
    return String(this.required);
  }

  get activeDescendant() {
    return this.activeIndex >= 0 ? `option-${this.activeIndex}` : undefined;
  }

  get selectionLabel() {
    return `${this.label ?? ""} 선택 항목`;
  }

  handleInput(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.isOpen = true;
    this.activeIndex = this.filteredOptions.length ? 0 : -1;
  }

  handleFocus(): void {
    this.isOpen = true;
  }

  handleBlur(): void {
    this.isOpen = false;
    this.activeIndex = -1;
  }

  handleKeyDown(event: KeyboardEvent): void {
    const count = this.filteredOptions.length;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        this.isOpen = true;
        if (!count) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        this.activeIndex = (this.activeIndex + step + count) % count;
        break;
      }
      case "Enter":
        if (this.isOpen && this.activeIndex >= 0 && this.activeIndex < count) {
          event.preventDefault();
          this.toggle(this.filteredOptions[this.activeIndex].value);
        }
        break;
      case "Escape":
        this.isOpen = false;
        this.activeIndex = -1;
        break;
      case "Backspace":
        if (!this.searchTerm && this._value.length) {
          this.remove(this._value[this._value.length - 1]);
        }
        break;
      default:
    }
  }

  handleOptionMouseDown(event: MouseEvent): void {
    // 클릭해도 입력창 포커스를 잃지 않게 한다 (blur로 목록이 닫히는 것을 막음)
    event.preventDefault();
    const value = this._options.find(
      (option) => String(option.value) === (event.currentTarget as HTMLElement).dataset.value
    )?.value;
    if (value !== undefined) this.toggle(value);
  }

  handleRemove(event: Event): void {
    this.remove(
      this._options.find((option) => String(option.value) === (event.target as unknown as Record<"name", string>).name)
        ?.value
    );
  }

  toggle(value: unknown): void {
    this._value = this._value.includes(value)
      ? this._value.filter((item) => item !== value)
      : [...this._value, value];
    this.notify();
  }

  remove(value: unknown): void {
    if (!this._value.includes(value)) return;
    this._value = this._value.filter((item) => item !== value);
    this.notify();
  }

  notify(): void {
    this.dispatchEvent(
      new CustomEvent("change", { detail: { value: [...this._value] } })
    );
  }
}
