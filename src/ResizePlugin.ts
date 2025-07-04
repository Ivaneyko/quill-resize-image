import "./ResizePlugin.less";
import { I18n, Locale, defaultLocale } from "./i18n";
import { format } from "./utils";

interface Size {
  width: number;
  height: number;
}
interface Position {
  left: number;
  top: number;
  width: number;
  height: number;
}
class ResizeElement extends HTMLElement {
  public originSize?: Size | null = null;
  [key: string]: any;
}

interface ResizePluginOption {
  locale?: Locale;
  [index: string]: any;
  keepAspectRatio?: boolean;
  resizeConstraints?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
}
const template = `
<div class="handler" title="{0}"></div>
<div class="toolbar">
  <div class="group">
    <a class="btn" data-type="width" data-styles="width:100%">100%</a>
    <a class="btn" data-type="width" data-styles="width:50%">50%</a>
    <span class="input-wrapper"><input data-type="width" maxlength="3" /><span class="suffix">%</span><span class="tooltip">{5}</span></span>
    <a class="btn" data-type="width" data-styles="width:auto">{4}</a>
  </div>
  <div class="group">
    <a class="btn" data-type="align" data-styles="float:left">{1}</a>
    <a class="btn" data-type="align" data-styles="display:block;margin:auto;">{2}</a>
    <a class="btn" data-type="align" data-styles="float:right;">{3}</a>
    <a class="btn" data-type="align" data-styles="">{4}</a>
  </div>
</div>
`;
class ResizePlugin {
  resizeTarget: ResizeElement;
  resizer: HTMLElement | null = null;
  container: HTMLElement;
  editor: HTMLElement;
  startResizePosition: Position | null = null;
  i18n: I18n;
  options: any;

  constructor(
    resizeTarget: ResizeElement,
    container: HTMLElement,
    editor: HTMLElement,
    options?: ResizePluginOption
  ) {
    this.i18n = new I18n(options?.locale || defaultLocale);
    this.options = options;
    this.resizeTarget = resizeTarget;
    if (!resizeTarget.originSize) {
      resizeTarget.originSize = {
        width: resizeTarget.clientWidth,
        height: resizeTarget.clientHeight,
      };
    }
    
    this.editor = editor;
    this.container = container;
    this.initResizer();
    this.positionResizerToTarget(resizeTarget);

    this.resizing = this.resizing.bind(this);
    this.endResize = this.endResize.bind(this);
    this.startResize = this.startResize.bind(this);
    this.toolbarClick = this.toolbarClick.bind(this);
    this.toolbarInputChange = this.toolbarInputChange.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.bindEvents();
  }

  initResizer() {
    let resizer: HTMLElement | null =
      this.container.querySelector("#editor-resizer");
    if (!resizer) {
      resizer = document.createElement("div");
      resizer.setAttribute("id", "editor-resizer");
      resizer.innerHTML = format(
        template,
        this.i18n.findLabel("altTip"),
        this.i18n.findLabel("floatLeft"),
        this.i18n.findLabel("center"),
        this.i18n.findLabel("floatRight"),
        this.i18n.findLabel("restore"),
        this.i18n.findLabel("inputTip")
      );
      this.container.appendChild(resizer);
    }
    this.resizer = resizer;
  }
  positionResizerToTarget(el: HTMLElement) {
    if (!this.resizer || !this.editor) return;

    // Use getBoundingClientRect to get the latest position relative to viewport
    const elRect = el.getBoundingClientRect();
    const editorRect = this.editor.getBoundingClientRect();

    // Calculate position relative to the editor, including scroll offsets
    const left = elRect.left - editorRect.left;
    const top = elRect.top - editorRect.top;

    // Update resizer position and size
    this.resizer.style.left = `${left}px`;
    this.resizer.style.top = `${top}px`;
    this.resizer.style.width = `${el.clientWidth}px`;
    this.resizer.style.height = `${el.clientHeight}px`;
  }
  bindEvents() {
    if (this.resizer !== null) {
      this.resizer.addEventListener("mousedown", this.startResize);
      this.resizer.addEventListener("click", this.toolbarClick);
      this.resizer.addEventListener("change", this.toolbarInputChange);
    }
    window.addEventListener("mouseup", this.endResize);
    window.addEventListener("mousemove", this.resizing);
    this.editor.addEventListener('scroll', this.onScroll);
  }
  onScroll() {
    this.positionResizerToTarget(this.resizeTarget);
  }
  _setStylesForToolbar(type: string, styles: string | undefined) {
    const storeKey = `_styles_${type}`;
    const style: CSSStyleDeclaration = this.resizeTarget.style;
    const originStyles = this.resizeTarget[storeKey];
    style.cssText =
      style.cssText.replaceAll(" ", "").replace(originStyles, "") +
      `;${styles}`;
    this.resizeTarget[storeKey] = styles;

    this.positionResizerToTarget(this.resizeTarget);
    this.options?.onChange(this.resizeTarget);
  }
  toolbarInputChange(e: Event) {
    const target: HTMLInputElement = e.target as HTMLInputElement;
    const type = target?.dataset?.type;
    const value = target.value;
    if (type && Number(value)) {
      this._setStylesForToolbar(type, `width: ${Number(value)}%;`);
    }
  }
  toolbarClick(e: MouseEvent) {
    const target: HTMLElement = e.target as HTMLElement;
    const type = target?.dataset?.type;

    if (type && target.classList.contains("btn")) {
      this._setStylesForToolbar(type, target?.dataset?.styles);
    }
  }
  startResize(e: MouseEvent) {
    const target: HTMLElement = e.target as HTMLElement;
    if (target.classList.contains("handler") && e.which === 1) {
      this.startResizePosition = {
        left: e.clientX,
        top: e.clientY,
        width: this.resizeTarget.clientWidth,
        height: this.resizeTarget.clientHeight,
      };
    }
  }
  endResize() {
    this.startResizePosition = null;
    this.options?.onChange(this.resizeTarget);
  }
  resizing(e: MouseEvent) {
    if (!this.startResizePosition) return;
    const deltaX: number = e.clientX - this.startResizePosition.left;
    const deltaY: number = e.clientY - this.startResizePosition.top;
    let width = this.startResizePosition.width;
    let height = this.startResizePosition.height;
    width += deltaX;
    height += deltaY;

    if (e.altKey) {
      const originSize = this.resizeTarget.originSize as Size;
      const rate: number = originSize.height / originSize.width;
      height = rate * width;
    }

    const minWidth = this.options?.resizeConstraints?.minWidth ?? 30;
    const minHeight = this.options?.resizeConstraints?.minHeight ?? 30;

    if (width < minWidth) {
      width = minWidth;
    }
    if (
      this.options?.resizeConstraints?.maxWidth !== undefined &&
      width > this.options.resizeConstraints.maxWidth
    ) {
      width = this.options.resizeConstraints.maxWidth;
    }

    if (height < minHeight) {
      height = minHeight;
    }
    if (
      this.options?.resizeConstraints?.maxHeight !== undefined &&
      height > this.options.resizeConstraints.maxHeight
    ) {
      height = this.options.resizeConstraints.maxHeight;
    }
    this.resizeTarget.setAttribute("width", `${width}`);
    if (!this.options?.keepAspectRatio) {
      this.resizeTarget.setAttribute("height", `${height}`);
    }
    this.positionResizerToTarget(this.resizeTarget);
  }

  destory() {
    this.container.removeChild(this.resizer as HTMLElement);
    window.removeEventListener("mouseup", this.endResize);
    window.removeEventListener("mousemove", this.resizing);
    this.editor.removeEventListener('scroll', this.onScroll);
    this.resizer = null;
  }
}

export default ResizePlugin;
