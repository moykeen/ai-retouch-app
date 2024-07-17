import { fabric } from "fabric";
import { observable, action, makeObservable } from "mobx";

import { RootStore } from "./rootStore";
import { History } from "../command/commandHistory";
import { disableHistoryRecording } from "../helpers/decorators";
import { toDataURL } from "../helpers/imageManipulator";

type CanvasSize = { width: number; height: number };
export const LAYER_OPACITY_ON_CANVAS = 0.5;

export type ModeName = "Setting" | "Prompt" | "Mask" | "Edge" | "Batch" | "";

export type LayerName = "image" | "mask" | "edge";

interface SessionManager {
  onSessionStart: (modeName?: ModeName) => void;
  onSessionEnd: (modeName?: ModeName) => void;
}

export class CanvasStore {
  readonly SCALE_STEP: number = 0.1;
  readonly SCALE_MAX_VALUE: number = 2;
  readonly SCALE_MIN_VALUE: number = 0.5;
  readonly SCALE_DEFAULT_VALUE: number = 1;

  @observable imageLayerVisible = true;
  @observable maskLayerVisible = true;
  @observable edgeLayerVisible = true;
  @observable scale: number = this.SCALE_DEFAULT_VALUE;
  @observable mode: ModeName = "";

  readonly history: History = new History();
  baseScale = 0;
  size: CanvasSize = { width: 0, height: 0 };

  private readonly scaling: Scaling;
  private readonly sessionManagers: { [modeName: string]: SessionManager } = {};
  private prevMode: ModeName = "";

  constructor(
    private readonly root: RootStore,
    readonly instance: fabric.Canvas
  ) {
    makeObservable(this);
    this.scaling = new Scaling(root);
    this.addEventListeners();
    this.instance.selection = false;
  }

  @action toggleImageLayerVisible(): void {
    this.imageLayerVisible = !this.imageLayerVisible;
    this.root.imageStore.imageObject!.visible = this.imageLayerVisible;
    this.instance.requestRenderAll();
  }

  @action toggleMaskLayerVisible(): void {
    this.maskLayerVisible = !this.maskLayerVisible;
    this.root.imageStore.maskGroup!.visible = this.maskLayerVisible;
    this.instance.requestRenderAll();
  }

  @action toggleEdgeLayerVisible(): void {
    this.edgeLayerVisible = !this.edgeLayerVisible;
    this.root.imageStore.edgeGroup!.visible = this.edgeLayerVisible;
    this.instance.requestRenderAll();
  }

  @action setLayerVisible({
    imageLayerVisible,
    maskLayerVisible,
    edgeLayerVisible,
  }: {
    imageLayerVisible: boolean;
    maskLayerVisible: boolean;
    edgeLayerVisible: boolean;
  }): void {
    this.imageLayerVisible = imageLayerVisible;
    this.maskLayerVisible = maskLayerVisible;
    this.edgeLayerVisible = edgeLayerVisible;
    this.root.imageStore.imageObject!.visible = this.imageLayerVisible;
    this.root.imageStore.maskGroup!.visible = this.maskLayerVisible;
    this.root.imageStore.edgeGroup!.visible = this.edgeLayerVisible;
    this.instance.requestRenderAll();
  }

  @action resetLayerVisible(): void {
    this.setLayerVisible({
      imageLayerVisible: true,
      maskLayerVisible: true,
      edgeLayerVisible: true,
    });
  }

  @action setScale(value: number): void {
    this.scale = Number(value.toFixed(1));
    this.scaling.setZoom(this.scale);
  }

  @action setMode(modeName: ModeName) {
    this.mode = modeName === this.mode ? "" : modeName;

    if (this.mode === this.prevMode) {
      return;
    }

    this.disableSession();

    if (this.mode) {
      this.prevMode = this.mode;
      this.enableSession();
    }
  }

  increaseScale(): void {
    if (this.scale >= this.SCALE_MAX_VALUE) {
      return;
    }
    this.setScale(this.scale + this.SCALE_STEP);
  }

  decreaseScale(): void {
    if (this.scale <= this.SCALE_MIN_VALUE) {
      return;
    }
    this.setScale(this.scale - this.SCALE_STEP);
  }

  setBaseScale(value: number): void {
    this.baseScale = value;
    this.setScale(value);
  }

  resetToBaseScale(): void {
    this.setScale(this.baseScale);
  }

  registerSessionManager(modeName: ModeName, manager: SessionManager): void {
    this.sessionManagers[modeName] = manager;
  }

  getDataUrl(): string {
    return toDataURL(this.instance);
    // return this.instance.toDataURL();
  }

  private withReset<T>(func: () => T): T {
    // pre-process
    const currentScale = this.scale;
    this.setScale(1.0);
    this.root.imageStore.imageObject!.opacity = 1.0;
    this.root.imageStore.maskGroup!.opacity = 1.0;

    const t = func();

    // post-process
    this.resetLayerVisible();
    this.setScale(currentScale);
    this.root.imageStore.imageObject!.opacity = LAYER_OPACITY_ON_CANVAS;
    this.root.imageStore.maskGroup!.opacity = LAYER_OPACITY_ON_CANVAS;

    return t;
  }

  private getDataAndRest(): string {
    return this.withReset(this.getDataUrl.bind(this));
  }

  private getCanvasAndRest(): HTMLCanvasElement {
    // withResetに渡すときにオブジェクト情報が失われるのでbindが必要
    return this.withReset(this.instance.toCanvasElement.bind(this.instance));
  }

  getImageDataUrl(): string {
    this.setLayerVisible({
      imageLayerVisible: true,
      maskLayerVisible: false,
      edgeLayerVisible: false,
    });
    return this.getDataAndRest();
  }

  getMaskDataUrl(): string {
    this.setLayerVisible({
      imageLayerVisible: false,
      maskLayerVisible: true,
      edgeLayerVisible: false,
    });
    return this.getDataAndRest();
  }

  getMaskMergedCanvas(): HTMLCanvasElement {
    this.setLayerVisible({
      imageLayerVisible: false,
      maskLayerVisible: true,
      edgeLayerVisible: false,
    });
    return this.getCanvasAndRest();
  }

  getEdgeDataUrl(): string {
    this.setLayerVisible({
      imageLayerVisible: false,
      maskLayerVisible: false,
      edgeLayerVisible: true,
    });
    return this.getDataAndRest();
  }

  @disableHistoryRecording
  resetState(): void {
    this.setBaseScale(this.SCALE_DEFAULT_VALUE);
  }

  setSize(width: number, height: number): void {
    this.size = { width, height };
    this.instance.setHeight(height);
    this.instance.setWidth(width);
  }

  getCenter(): { x: number; y: number } {
    const { width, height } = this.size;
    return {
      x: width / 2,
      y: height / 2,
    };
  }

  setZoom(scale: number): void {
    this.scaling.setZoom(scale);
  }

  updateBaseScale(): void {
    this.scaling.setBaseScale();
  }

  onSessionStart(modeName: ModeName = ""): void {
    //
  }

  onSessionEnd(modeName: ModeName = ""): void {
    //
  }

  private addEventListeners(): void {
    // ホイールで拡大縮小はオフ
    // const canvas = (this.instance as any).upperCanvasEl;
    // canvas.addEventListener("wheel", this.listeners.onMouseWheel);
  }

  private disableSession(): void {
    const sessionManager = this.sessionManagers[this.prevMode];
    if (sessionManager) {
      sessionManager.onSessionEnd(this.prevMode);
    }
    this.prevMode = "";
  }

  private enableSession(): void {
    const sessionManager = this.sessionManagers[this.mode];
    if (sessionManager) {
      sessionManager.onSessionStart(this.mode);
    }
  }
}

class Scaling {
  constructor(private root: RootStore) {}

  setZoom(scale: number): void {
    this.root.imageStore.setSize();
    this.root.canvasStore.instance.setZoom(scale);
  }

  setBaseScale(): void {
    const scale = this.getBaseScale();
    this.root.canvasStore.setBaseScale(scale);
  }

  getBaseScale(): number {
    const canvasContainer = document.querySelector(".canvas");
    const containerHeight =
      canvasContainer?.clientHeight ?? this.root.imageStore.height;
    const containerWidth =
      canvasContainer?.clientWidth ?? this.root.imageStore.width;
    const scaleByHeight = Math.floor(
      (containerHeight * 100) / this.root.imageStore.height
    );
    const scaleByWidth = Math.floor(
      (containerWidth * 100) / this.root.imageStore.width
    );
    const scale = Math.min(scaleByHeight, scaleByWidth);

    if (scale) {
      return (scale - (scale % 10)) / 100;
    }
    return 1;
  }
}
