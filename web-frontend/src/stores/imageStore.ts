import { PixelCrop } from "react-image-crop";

import * as bodyPix from "@tensorflow-models/body-pix";
import { fabric } from "fabric";
import { observable, action, makeObservable } from "mobx";
import cv from "opencv-ts";

import { CanvasStore, LAYER_OPACITY_ON_CANVAS, ModeName } from "./canvasStore";
import { RootStore } from "./rootStore";
import { getMaskForBodyParts, morphology } from "../helpers/imageManipulator";

export type BodyPart =
  | "Face"
  | "Torso"
  | "Left arm"
  | "Right arm"
  | "Left leg"
  | "Right leg";

export class ImageStore {
  readonly OBJ_NAME: string = "image";

  @observable url = "";

  element: HTMLImageElement;
  maskElement: HTMLImageElement;
  edgeElement: HTMLImageElement;
  segmentation?: bodyPix.PartSegmentation;

  width = 0;
  height = 0;
  cropOnOriginalImage?: PixelCrop = undefined;

  imageObject: fabric.Object | undefined;
  maskGroup: fabric.Group | undefined;
  edgeGroup: fabric.Group | undefined;

  @observable bodyPartsEnabled!: BodyPart[];

  private readonly canvas: CanvasStore;

  constructor(private readonly root: RootStore) {
    makeObservable(this);
    this.canvas = root.canvasStore;
    this.element = new Image();
    this.element.setAttribute("crossorigin", "anonymous");
    this.maskElement = new Image();
    this.maskElement.setAttribute("crossorigin", "anonymous");
    this.edgeElement = new Image();
    this.edgeElement.setAttribute("crossorigin", "anonymous");
    this.resetBodyPartsEnabled();
  }

  @action private resetBodyPartsEnabled() {
    this.bodyPartsEnabled = [
      "Face",
      "Torso",
      "Left arm",
      "Right arm",
      "Left leg",
      "Right leg",
    ];
  }

  @action async load({
    baseUrl,
    segmentation,
    edgeUrl,
    cropOnOriginalImage,
    bodyPartsEnabled,
  }: {
    baseUrl: string;
    segmentation?: bodyPix.PartSegmentation;
    edgeUrl?: string;
    cropOnOriginalImage?: PixelCrop;
    bodyPartsEnabled?: BodyPart[];
  }): Promise<void> {
    if (bodyPartsEnabled) {
      this.bodyPartsEnabled = bodyPartsEnabled;
    } else {
      this.resetBodyPartsEnabled();
    }

    const renderPromises = [];
    this.url = baseUrl;
    renderPromises.push(this.render(this.element, this.url));
    if (segmentation) {
      this.segmentation = segmentation;
    }
    if (edgeUrl) {
      renderPromises.push(this.render(this.edgeElement, edgeUrl));
    }
    this.cropOnOriginalImage = cropOnOriginalImage;
    this.canvas.history.clear();
    this.canvas.resetState();
    this.canvas.history.disableRecording();

    await Promise.all(renderPromises);

    this.onLoad();

    this.canvas.history.enableRecording();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onSessionStart(modeName: ModeName = ""): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onSessionEnd(modeName: ModeName = ""): void {}

  setSize(): void {
    const { width, height } = this.getSize();
    this.width = width;
    this.height = height;
    this.canvas.setSize(this.width, this.height);
  }

  private render(imgElement: HTMLImageElement, url: string): Promise<void> {
    return new Promise<void>(function (resolve) {
      imgElement.onload = function () {
        resolve();
      };
      imgElement.src = url;
    });
  }

  private onLoad(): void {
    this.canvas.instance.clear();
    this.setSize();
    this.addImage();
    this.canvas.updateBaseScale();
  }

  private addImage(): void {
    this.edgeGroup = new fabric.Group([this.createEdgeImage()], {
      selectable: false,
    });
    this.canvas.instance.add(this.edgeGroup);

    this.maskGroup = new fabric.Group([this.createMaskImage()], {
      selectable: false,
      opacity: LAYER_OPACITY_ON_CANVAS,
    });
    this.canvas.instance.add(this.maskGroup);

    this.imageObject = this.createImage();
    this.canvas.instance.add(this.imageObject);
  }

  private createImage(): fabric.Image {
    const image = new fabric.Image(this.element, {
      opacity: LAYER_OPACITY_ON_CANVAS,
    });

    this.adjustImage(image, "image");
    return image;
  }

  private createMaskImage(): fabric.Image {
    const [maskCanvas, boundingBox] = getMaskForBodyParts(
      this.segmentation!,
      this.bodyPartsEnabled
    );
    const image = new fabric.Image(maskCanvas);
    this.adjustImage(image, "mask");
    image.set("group", this.maskGroup);
    return image;
  }

  private createEdgeImage(): fabric.Image {
    const image = new fabric.Image(this.edgeElement);
    this.adjustImage(image, "edge");
    image.set("group", this.edgeGroup);
    return image;
  }

  private adjustImage(image: fabric.Image, name: string): void {
    image.set({
      selectable: false,
      hoverCursor: "default",
      crossOrigin: "anonymous",
      name: name,
    });
    image.scaleToWidth(this.width);
    image.scaleToHeight(this.height);
  }

  private getSize(scale = this.canvas.scale): {
    width: number;
    height: number;
  } {
    const { width: originalWidth, height: originalHeight } =
      this.getOriginalSize();

    // console.log("originalSize is ", originalWidth, originalHeight);
    // const width = originalWidth;
    // const height = originalHeight;

    const containerHeight = 0.85 * window.innerHeight * scale;
    const ratio = originalWidth / originalHeight;
    const height = Math.min(containerHeight / ratio, containerHeight);
    const width = ratio * height;
    return { width, height };
  }

  private getOriginalSize(): { width: number; height: number } {
    const originalImage = new fabric.Image(this.element);
    // originalImage.rotate(this.canvas.angle).setCoords();
    const { width, height } = originalImage.getBoundingRect();
    return { width, height };
  }

  toggleBodyPartsEnabled(bodyPart: BodyPart): void {
    this.bodyPartsEnabled = this.bodyPartsEnabled.includes(bodyPart)
      ? this.bodyPartsEnabled.filter((part) => part !== bodyPart)
      : [...this.bodyPartsEnabled, bodyPart];

    if (!this.maskGroup) {
      return;
    }

    // clear current mask and recreate
    const group = this.maskGroup!;
    let referenceImage: fabric.Object | undefined = undefined;
    for (const obj of group.getObjects()) {
      // the first element can be assumed to be the current mask image. use it as reference
      // TODO Clearコマンドでマスクを全消しするとこのreferenceが確保できなくなる。あまりClear使わないだろうと過程して対応しない
      if (!referenceImage) {
        referenceImage = obj;
      }
      group.remove(obj);
    }

    const [maskCanvas, boundingBox] = getMaskForBodyParts(
      this.segmentation!,
      this.bodyPartsEnabled
    );
    const image = new fabric.Image(maskCanvas);
    this.adjustImage(image, "mask");
    if (referenceImage) {
      image.set({
        top: referenceImage.top,
        left: referenceImage.left,
        scaleX: referenceImage.scaleX,
        scaleY: referenceImage.scaleY,
      });
    }
    group.add(image);

    this.canvas.instance.requestRenderAll();
    this.canvas.history.clear();
  }

  async morphologyMask(operation: string): Promise<void> {
    if (!this.maskGroup) {
      return;
    }

    const maskCanvas = this.canvas.getMaskMergedCanvas();
    await morphology(
      operation === "expand" ? cv.MORPH_DILATE : cv.MORPH_ERODE,
      maskCanvas,
      20
    );

    // clear current mask and recreate
    const group = this.maskGroup!;
    let referenceImage: fabric.Object | undefined = undefined;
    for (const obj of group.getObjects()) {
      // TODO same issue as in toggleBodyPartsEnabled
      if (!referenceImage) {
        referenceImage = obj;
      }
      group.remove(obj);
    }

    let image = new fabric.Image(maskCanvas);
    if (referenceImage) {
      // 後ほどreferenceImageのスケールを適用した場合にちょうどになるように逆スケールしておく
      // 初めからscale=1.0に固定しても同じだが、それだとtoggleBodyPartsEnabledでマスク作り直したときにスケール情報がなくなって困る
      image.scaleX = 1.0 / referenceImage.scaleX!;
      image.scaleY = 1.0 / referenceImage.scaleY!;
      image = new fabric.Image(image.toCanvasElement());
    }

    this.adjustImage(image, "mask");
    if (referenceImage) {
      image.set({
        top: referenceImage.top,
        left: referenceImage.left,
        scaleX: referenceImage.scaleX,
        scaleY: referenceImage.scaleY,
      });
    }
    group.add(image);

    this.canvas.instance.requestRenderAll();
    this.canvas.history.clear();
  }
}
