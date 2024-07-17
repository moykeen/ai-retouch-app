import { fabric } from "fabric";
import {
  observable,
  action,
  computed,
  IReactionDisposer,
  makeObservable,
} from "mobx";

import { ModeName } from "./canvasStore";
import { ImageStore } from "./imageStore";
import { RootStore } from "./rootStore";
import { AddObjectCommand } from "../command/addObject";

const BLACK = "0,0,0";
const BLACK_RGB = "rgb(" + BLACK + ")";
const WHITE = "255,255,255";
const WHITE_RGB = "rgb(" + WHITE + ")";

interface IDrawingMode {
  enable: () => void;
  disable: () => void;
}

abstract class BaseDrawingMode implements IDrawingMode {
  constructor(
    protected readonly canvas: fabric.Canvas,
    protected readonly store: BaseDrawingStore
  ) {}

  abstract enable(): void;

  disable(): void {
    this.canvas.isDrawingMode = false;
    this.canvas.off("path:created");
  }

  protected postProcess(obj: fabric.Object): void {
    this.canvas.remove(obj);
    this.store.getGroupToAdd().addWithUpdate(obj);
    this.store.registerDrawnObject(obj);
  }
}

class FreeDrawing extends BaseDrawingMode {
  enable(): void {
    this.canvas.isDrawingMode = true;
    this.canvas.freeDrawingBrush.color = this.store.color;
    this.canvas.freeDrawingBrush.width = this.store.lineWidth;

    this.canvas.on("path:created", (options) => {
      const obj: fabric.Object = (options as any).path as fabric.Object;
      this.postProcess(obj);
    });
  }
}

class FreeErasing extends BaseDrawingMode {
  enable(): void {
    this.canvas.isDrawingMode = true;
    this.canvas.freeDrawingBrush.color = BLACK_RGB;
    this.canvas.freeDrawingBrush.width = this.store.eraseLineWidth;

    this.canvas.on("path:created", (options) => {
      const obj: fabric.Object = (options as any).path as fabric.Object;
      obj.set({
        globalCompositeOperation: "destination-out",
      });
      this.postProcess(obj);
    });
  }
}

class FreeBackgroundFilling extends BaseDrawingMode {
  enable(): void {
    this.canvas.isDrawingMode = true;
    this.canvas.freeDrawingBrush.color = BLACK_RGB;
    this.canvas.freeDrawingBrush.width = this.store.eraseLineWidth;

    this.canvas.on("path:created", (options) => {
      const obj: fabric.Object = (options as any).path as fabric.Object;
      this.postProcess(obj);
    });
  }
}

export type Reactions = { [reactionName: string]: IReactionDisposer } | null;

abstract class BaseDrawingStore {
  @observable opacity = 1;
  @observable colorCode = "61,61,61";
  @observable lineWidth = 20;
  @observable eraseLineWidth = 20;
  @observable isEraseMode = false;

  @computed get color() {
    return `rgba(${this.colorCode}, ${this.opacity})`;
  }

  readonly OBJ_NAME: ModeName = ""; //"drawing";
  protected readonly canvas: fabric.Canvas;
  protected readonly imageStore: ImageStore;
  protected reactions: Reactions = null;
  protected currentMode: IDrawingMode;

  constructor(
    protected readonly root: RootStore,
    private readonly eraseByBackgroundColorFilling: boolean
  ) {
    makeObservable(this);
    this.canvas = root.canvasStore.instance;
    this.imageStore = root.imageStore;
    this.currentMode = new FreeDrawing(this.canvas, this);
  }

  @action setColorCode(colorCode: string): void {
    this.colorCode = colorCode;
  }

  @action setOpacity(value: number): void {
    this.opacity = value;
  }

  @action setLineWidth(lineWidth: number): void {
    this.lineWidth = lineWidth;
    this.canvas.freeDrawingBrush.width = lineWidth;
  }

  @action setEraseLineWidth(eraseLineWidth: number): void {
    this.eraseLineWidth = eraseLineWidth;
    this.canvas.freeDrawingBrush.width = eraseLineWidth;
  }

  @action enableEraseMode(): void {
    if (this.isEraseMode) {
      return;
    }
    this.isEraseMode = true;
    this.updateDrawingMode();
  }
  @action enableDrawMode(): void {
    if (!this.isEraseMode) {
      return;
    }
    this.isEraseMode = false;
    this.updateDrawingMode();
  }

  private updateDrawingMode(): void {
    this.currentMode.disable();
    this.currentMode = this.isEraseMode
      ? this.eraseByBackgroundColorFilling
        ? new FreeBackgroundFilling(this.canvas, this)
        : new FreeErasing(this.canvas, this)
      : new FreeDrawing(this.canvas, this);
    this.currentMode.enable();
  }

  // TODO deprecated
  @action toggleEraseMode(): void {
    // console.log("toggled");
    this.isEraseMode = !this.isEraseMode;
    this.currentMode.disable();
    this.currentMode = this.isEraseMode
      ? this.eraseByBackgroundColorFilling
        ? new FreeBackgroundFilling(this.canvas, this)
        : new FreeErasing(this.canvas, this)
      : new FreeDrawing(this.canvas, this);
    this.currentMode.enable();
  }

  registerDrawnObject(obj: fabric.Object): void {
    this.root.canvasStore.history.push(
      new AddObjectCommand(
        obj,
        this.root.canvasStore.instance,
        this.getGroupToAdd()
      )
    );
  }

  abstract getGroupToAdd(): fabric.Group;

  onSessionStart(): void {
    this.currentMode.enable();
  }

  onSessionEnd(): void {
    this.currentMode.disable();
  }

  // TODO この関数は使われていない?なら削除
  protected onAdded(obj: fabric.Object): void {
    if (obj) {
      obj.set({
        name: this.OBJ_NAME,
      });

      obj.set({
        globalCompositeOperation: "destination-out",
      });

      this.root.canvasStore.instance.remove(obj);

      // TODO need variable
      this.root.imageStore.maskGroup!.addWithUpdate(obj);
    }
  }

  clearAll(): void {
    const group = this.getGroupToAdd();
    for (const obj of group.getObjects()) {
      group.remove(obj);
    }
    group.setCoords();
    this.root.canvasStore.instance.requestRenderAll();
    this.root.canvasStore.history.clear();
  }

  fillAll(): void {
    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    const rect = new fabric.Rect({
      left: 0,
      top: 0,
      fill: WHITE_RGB,
      width: canvasWidth * 2, // 実際のサイズより十分大きくしておく
      height: canvasHeight * 2,
    });

    this.getGroupToAdd().addWithUpdate(rect);
    this.registerDrawnObject(rect);
    this.root.canvasStore.instance.requestRenderAll();
  }
}

export class MaskStore extends BaseDrawingStore {
  readonly OBJ_NAME: ModeName = "Mask";

  @observable detectionThreshold = 0.2;
  @observable targetPerson = 0;

  constructor(root: RootStore) {
    super(root, false);

    this.setColorCode(WHITE);
    this.setOpacity(1);
    this.setLineWidth(40);
    this.setEraseLineWidth(40);

    makeObservable(this);

    root.canvasStore.registerSessionManager("Mask", this);
  }

  getGroupToAdd(): fabric.Group {
    return this.root.imageStore.maskGroup!;
  }

  @action setDetectionThreshold(threshold: number): void {
    this.detectionThreshold = threshold;
  }
  @action setTargetPerson(target: number): void {
    this.targetPerson = target;
  }
}

export class EdgeStore extends BaseDrawingStore {
  readonly OBJ_NAME: ModeName = "Edge";

  constructor(root: RootStore) {
    super(root, true);

    this.setColorCode(WHITE);
    this.setOpacity(1);
    this.setLineWidth(1);
    this.setEraseLineWidth(30);

    root.canvasStore.registerSessionManager("Edge", this);
  }

  getGroupToAdd(): fabric.Group {
    return this.root.imageStore.edgeGroup!;
  }
}
