import { fabric } from "fabric";

import { AiStore } from "./aiStore";
import { AuthStore } from "./authStore";
import { CanvasStore } from "./canvasStore";
import { MaskStore, EdgeStore } from "./drawingStore";
import { ImageStore } from "./imageStore";
import { UIStore } from "./UIStore";

export class RootStore {
  canvasStore: CanvasStore;
  maskStore: MaskStore;
  edgeStore: EdgeStore;
  aiStore: AiStore;
  authStore: AuthStore;
  uiStore: UIStore;
  imageStore: ImageStore;

  private workingCanvasElement: HTMLCanvasElement;

  constructor() {
    this.workingCanvasElement = document.createElement("canvas");
    document.body.append(this.workingCanvasElement);
    const workingFabricCanvas = new fabric.Canvas(this.workingCanvasElement);

    this.canvasStore = new CanvasStore(this, workingFabricCanvas);
    this.imageStore = new ImageStore(this);
    this.maskStore = new MaskStore(this);
    this.edgeStore = new EdgeStore(this);
    this.aiStore = new AiStore(this);
    this.authStore = new AuthStore(this);
    this.uiStore = new UIStore(this);
  }

  addWorkingCanvasToDocument(container: HTMLElement): void {
    const parent = this.workingCanvasElement.parentElement as Node;
    container.append(parent);
  }
}

export default new RootStore();
