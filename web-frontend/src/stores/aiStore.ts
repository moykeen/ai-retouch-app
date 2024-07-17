import { Image as ImageGridGallery } from "react-grid-gallery";
import { PixelCrop } from "react-image-crop";
import Alert from "react-s-alert";

import { BodyPix } from "@tensorflow-models/body-pix";
import { BodySegmenter } from "@tensorflow-models/body-segmentation";
import { saveAs } from "file-saver";
import { observable, action, makeObservable, computed } from "mobx";

import { ModeName } from "./canvasStore";
import { BodyPart } from "./imageStore";
import { RootStore } from "./rootStore";
import {
  postRenderGenerateJson,
  PostRenderGenerateBodyData,
} from "../external/api";
import { postRenderEdgeJson } from "../external/api";
import {
  getCroppedMaskSegmentedDataUrl,
  getMaskForBodyParts,
  pasteImage,
} from "../helpers/imageManipulator";
import {
  getCroppedImage,
  loadBodyPixModel,
  loadBodySegmentationModel,
} from "../helpers/imageManipulator";

// TODO リファクタ prompt系を別ソースにまとめ直す
export class Prompt {
  constructor(
    readonly value: string,
    public weight = 1.0,
    public enabled = true
  ) {}

  toString = () => {
    if (!this.enabled) return "";
    const w = this.weight.toFixed(1);
    if (w === "1.0") return this.value;

    if (this.value.startsWith("<") && this.value.endsWith(">")) {
      return this.value.replace(/<(.+?)>/g, `<$1:${w}>`);
    }

    return `(${this.value}:${w})`;
  };
}

const DEFAULT_PROMPT = [
  new Prompt("masterpiece", 1.0),
  new Prompt("realistic", 1.0),
  new Prompt("photorealistic", 1.0),
];

const DEFAULT_NEGATIVE_PROMPT = [
  new Prompt("ng_deepnegative_v1_75t", 1.0, false),
  new Prompt("bad-hands-5", 1.0, false),
  new Prompt("unreal"),
  new Prompt("worst quality", 2),
  new Prompt("low quality", 2),
  new Prompt("normal quality", 1.6),
];

export type ServerStatus =
  | "UNKNOWN"
  | "STOPPED"
  | "RUNNING"
  | "PENDING"
  | "STOPPING";

export type AppServerStatus = "AVAILABLE" | "UNAVAILABLE";

const BATCH_SCRIPT_TEMPLATE: string = JSON.stringify(
  {
    range: "0...Infinity",
    bodyRegion: "all",
    maskExpand: 0,
    maskShrink: 0,
    fillAll: false,
  },
  null,
  2
);

type SegmentationModelMode = "bodypix" | "mediapipe";

type Sampler = "DPM++ 2M Karras" | "DDIM";

export type PromptData = {
  positive: Prompt[];
  extracted: Prompt[];
  negative: Prompt[];
};

const POSITIVE_PROMPT_OPTIONS = [
  // クオリティ
  "absurdres",
  "masterpiece",
  "realistic",
  "photorealistic",
  "pureerosface_v1",
  "perfect anatomy",
  "realistic depth of field",
  "ultra detailed",
  "8k uhd",
  "high quality",
  "film grain",
  "Fujifilm XT3",
  "ray tracing",

  // ライティング
  "dark night",
  "fire ambient light",
  "soft lighting",
  "back lighting",

  // 場面
  "indoors",
  "outdoors",

  // 髪型
  "ponytail",
  "see-though bang",
  "diagonal bangs",
  "layered haircut",
  "curly hair",
  "shaggy cut",
  "side ponytail",
  "high ponytail",
  "half updo",
  "french braid",
  "hair_pulled_back",

  //体型
  "skinny",
  "hourglass figure",
  "large breasts",
  "thin arms",

  // 肌感
  "pale skin",
  "prominent veins",

  // 服装
  "bikini",
  "swimsuit",
  "lingerie",
  "office suits",

  // 姿勢
  "full body",
  "standing",
  "sitting",
  "looking back",
  "looking at viewer",
  "squatting",

  // 表情
  "light smile",
  "angry",
  "serious",
  "closed mouth",
  "closed eye",

  // 年齢
  "40years old woman",
  "32 y.o mature female",
  "girl",

  // 人種
  "Japanese",

  // Lora
  "<lora:flat2>",
];

const NEGATIVE_PROMPT_OPTIONS = [
  "ng_deepnegative_v1_75t",
  "bad-hands-5",
  "bad-picture-chill-75v",
  "unreal",
  "drawing",
  "paintings",
  "sketches",
  "worst quality",
  "low quality",
  "normal quality",
  "back lighting",
  "skin spots",
  "acnes",
  "skin blemishes",
  "age spot",
  "wrinkled skin",
  "shaded face",
  "bad anatomy",
  "artificial light",
];

export class AiStore {
  @observable imageData = "";
  private targetImageFileName = "";
  targetImageIndex = -1;
  private originalImageData = "";
  private generatedImageData = "";

  @observable prompts: PromptData = {
    positive: DEFAULT_PROMPT,
    extracted: [],
    negative: DEFAULT_NEGATIVE_PROMPT,
  };

  // MobXで配列の要素のプロパティ変化が検知されない問題に対応するハック
  @observable dummyForForceObserving = true;
  private toggleDummyVariable = () => {
    this.dummyForForceObserving = !this.dummyForForceObserving;
  };

  @observable sampler: Sampler = "DPM++ 2M Karras";
  @observable steps = 20;
  @observable seed = -1;
  @observable usePromptExtracted = true;
  @observable useMask = true;
  @observable useEdge = true;
  @observable useReference = false;
  @observable useAnotherImageForReference = false;
  @observable maskBlur = 4;
  @observable antiGlare = 0;
  @observable denosing = 60;
  @observable initialNoiseMultiplier = 100;
  @observable referenceImageData = "";
  @observable controlMode: 0 | 1 | 2 = 0;
  @observable referenceControlMode: 0 | 1 | 2 = 0;
  @observable inpaintingFill: 0 | 1 | 2 = 0; // UI上はdenosingの従属変数化した
  @observable pasteOpacity = 1.0;
  @observable equalizeColor = false;
  @observable lastGenerationParams = {};
  @observable batchScript = BATCH_SCRIPT_TEMPLATE;

  imageHistory = observable.array<ImageGridGallery>([]);

  @observable serverStatus: ServerStatus = "UNKNOWN";
  @observable serverIp: string | undefined = undefined;
  @observable appServerStatus: AppServerStatus = "UNAVAILABLE";

  private croppedArea: PixelCrop | undefined = undefined;
  @observable segmentationModelMode: SegmentationModelMode = "bodypix";
  private bodyPixModel?: BodyPix = undefined;
  private bodySegmentationModel?: BodySegmenter = undefined;

  constructor(public root: RootStore) {
    //, readonly instance: fabric.Canvas) {
    makeObservable(this);
    root.canvasStore.registerSessionManager("Prompt", this);
  }

  onSessionStart(modeName: ModeName = ""): void {
    //
  }

  onSessionEnd(modeName: ModeName = ""): void {
    //
  }

  getCroppedArea(): PixelCrop | undefined {
    return this.croppedArea;
  }

  private async getBodyPixModel(): Promise<BodyPix> {
    if (!this.bodyPixModel) {
      this.bodyPixModel = await loadBodyPixModel();
    }
    return this.bodyPixModel;
  }

  private async getBodySegmentationModel(): Promise<BodySegmenter> {
    if (!this.bodySegmentationModel) {
      this.bodySegmentationModel = await loadBodySegmentationModel();
    }
    return this.bodySegmentationModel;
  }

  private limitFilename(filename: string): string {
    const basename = filename.slice(0, filename.lastIndexOf("."));
    return basename.length <= 10 ? basename : `...${basename.slice(-7)}`;
  }

  private pushImageHistory(
    data: string,
    caption: string,
    filename: string,
    alt: string | undefined = undefined
  ): void {
    this.imageHistory.unshift({
      src: data,
      width: 640,
      height: 640,
      tags: [
        { value: this.limitFilename(filename), title: "filename" },
        { value: caption, title: "type" },
      ],
      caption: filename,
      ...(alt !== undefined && { alt: alt }),
    });
    this.targetImageIndex = 0;
  }

  private expandToBodyParts(bodyRegion: string): BodyPart[] {
    let parts: BodyPart[] = [];
    switch (bodyRegion) {
      case "face":
        parts = ["Face"];
        break;
      case "body":
        parts = ["Torso", "Left arm", "Right arm", "Left leg", "Right leg"];
        break;
    }
    return parts;
  }

  async setImageOnCanvas(
    imageElement: HTMLImageElement,
    bodyRegion?: string,
    forceSinglePerson = false // trueだとシングルモードとして検出する多人数モードで部位ごとの抽出がうまくできないため
  ): Promise<boolean> {
    if (!this.imageData) return false;
    let success: boolean;
    this.root.uiStore.setInprogress(true);

    let origCroppedArea = this.getCroppedArea();
    if (!origCroppedArea) {
      origCroppedArea = {
        x: 0,
        y: 0,
        width: imageElement.width,
        height: imageElement.height,
        unit: "px",
      };
    }

    const [croppedCanvas, imageData, croppedArea] = getCroppedImage(
      imageElement,
      origCroppedArea
    );

    const getEdgeUrl = async () => {
      try {
        if (["UNKNOWN", "STOPPED", "STOPPING"].includes(this.serverStatus)) {
          throw new Error("Server status is not active");
        }
        const result = await postRenderEdgeJson(
          imageData,
          this.root.uiStore.prepareForAbort()
        );
        this.root.authStore.setCredit(result.remainingCredit);
        const edgeUrl = "data:image/png;base64," + (result.image as string);
        const extractedPrompts = result.taggingResult.caption.tag;
        return [edgeUrl, extractedPrompts];
      } catch (error) {
        console.log(error);
        return ["", []];
      }
    };

    const [segmentation, [edgeUrl, extractedPrompts]] = await Promise.all([
      getCroppedMaskSegmentedDataUrl(
        this.segmentationModelMode === "bodypix"
          ? await this.getBodyPixModel()
          : await this.getBodySegmentationModel(),
        croppedCanvas,
        this.root.maskStore.detectionThreshold,
        forceSinglePerson ? 0 : this.root.maskStore.targetPerson
      ),
      getEdgeUrl(),
    ]);
    if (!edgeUrl) {
      Alert.warning("Server is not active. Your image was not preprocessed.", {
        position: "bottom-left",
      });
      success = false;
    }
    this.initializeExtractedPrompts(extractedPrompts);

    this.setEditTargetState();
    await this.root.imageStore.load({
      baseUrl: imageData,
      edgeUrl: edgeUrl,
      segmentation: segmentation,
      cropOnOriginalImage: croppedArea,
      ...(bodyRegion
        ? { bodyPartsEnabled: this.expandToBodyParts(bodyRegion) }
        : {}),
    });
    success = true;
    this.root.uiStore.setInprogress(false);
    return success;
  }

  async setCropForBodyRegion(
    imageElement: HTMLImageElement,
    bodyRegion: string
  ): Promise<PixelCrop | undefined> {
    if (!this.imageData) return;
    this.root.uiStore.setInprogress(true);

    const fullCroppedArea: PixelCrop = {
      x: 0,
      y: 0,
      width: imageElement.width,
      height: imageElement.height,
      unit: "px",
    };

    const [croppedCanvasPreprocess] = getCroppedImage(
      imageElement,
      fullCroppedArea
    );
    const segmentationPreprocess = await getCroppedMaskSegmentedDataUrl(
      this.segmentationModelMode === "bodypix"
        ? await this.getBodyPixModel()
        : await this.getBodySegmentationModel(),
      croppedCanvasPreprocess,
      this.root.maskStore.detectionThreshold,
      this.root.maskStore.targetPerson
    );
    const [maskCanvas, boundingBox] = getMaskForBodyParts(
      segmentationPreprocess,
      this.expandToBodyParts(bodyRegion)
    );
    const ratio = imageElement.width / segmentationPreprocess.width;

    const derivedCrop: PixelCrop = {
      x: boundingBox.x * ratio,
      y: boundingBox.y * ratio,
      width: boundingBox.width * ratio,
      height: boundingBox.height * ratio,
      unit: "px",
    };

    this.setCroppedArea(derivedCrop);
    this.root.uiStore.setInprogress(false);
    return derivedCrop;
  }

  setCroppedArea(croppedArea: PixelCrop | undefined): void {
    const cropApplied =
      croppedArea && croppedArea.width > 0 && croppedArea.height > 0;
    if (cropApplied) {
      //   // ensure multiple of 8, i.e., constraint of SD
      //   const adjustedCroppedArea: PixelCrop = {
      //     x: croppedArea.x,
      //     y: croppedArea.y,
      //     width: Math.round(croppedArea.width / 8) * 8,
      //     height: Math.round(croppedArea.height / 8) * 8,
      //     unit: "px",
      //   };
      //   this.croppedArea = adjustedCroppedArea;
      //   console.log(this.croppedArea);
      this.croppedArea = croppedArea;
    } else this.croppedArea = undefined;
  }

  @action setTargetImageData(data: string, filename: string): void {
    this.setCroppedArea(undefined);
    // console.log(data);
    this.imageData = data;
    this.targetImageFileName = filename;
    // this.originalImageData = data;
    this.pushImageHistory(data, "orig", filename);
  }
  setEditTargetState(): void {
    this.originalImageData = this.imageData;
  }

  @action async pasteEditedImageData(
    data: string,
    cropOnOriginalImage?: PixelCrop
  ): Promise<void> {
    let newData: string;
    if (!cropOnOriginalImage) {
      newData = data;
    } else {
      const imgElement = new Image();
      const baseImageData = this.originalImageData; //|| this.imageData;
      imgElement.setAttribute("crossorigin", "anonymous");
      await new Promise<void>(function (resolve) {
        imgElement.onload = function () {
          resolve();
        };
        imgElement.src = baseImageData;
      });

      const pastedImgElement = new Image();
      pastedImgElement.setAttribute("crossorigin", "anonymous");
      await new Promise<void>(function (resolve) {
        pastedImgElement.onload = function () {
          resolve();
        };
        pastedImgElement.src = data;
      });

      newData = pasteImage(
        imgElement,
        pastedImgElement,
        cropOnOriginalImage,
        this.pasteOpacity
      );
      //   this.imageData = newData;
    }
    this.imageData = newData;
    // this.originalImageData = newData;

    this.pushImageHistory(
      newData,
      "edited",
      this.targetImageFileName,
      this.originalImageData
    );
  }

  @action deleteFromHistory(index: number): void {
    this.imageHistory.splice(index, 1);
  }

  @action deleteFromHistoryAll(): void {
    this.imageHistory.length = 0;
  }

  @action toggleFavorite(index: number): void {
    // use `nano` to manage favorite `nano`の意図された役割は分からないが任意の文字列が入れられそうだったので使っている
    const nano = this.imageHistory[index].nano;
    this.imageHistory[index].nano = nano === "favorite" ? "" : "favorite";

    // 既存要素の変更に反応しないので配列を置き換える
    this.imageHistory.replace(this.imageHistory.slice());
  }

  isFavorite(index: number): boolean {
    return this.imageHistory[index].nano === "favorite";
  }

  @action setTargetImageDataFromHistory(index: number): void {
    this.imageData = this.imageHistory[index].src;
    this.targetImageIndex = index;
    // this.originalImageData = this.imageData;
  }

  @action toggleUsePromptExtracted(): void {
    this.usePromptExtracted = !this.usePromptExtracted;
  }
  @action movePromptExtracted(): void {
    this.prompts.positive = [
      ...this.prompts.positive,
      ...this.prompts.extracted,
    ];
    this.prompts.extracted = [];
  }
  @action toggleUseMask(): void {
    this.useMask = !this.useMask;
  }
  @action toggleUseEdge(): void {
    this.useEdge = !this.useEdge;
  }
  @action toggleUseReference(): void {
    this.useReference = !this.useReference;
  }
  @action toggleUseAnotherImageForReference(): void {
    this.useAnotherImageForReference = !this.useAnotherImageForReference;
  }
  @action setMaskBlur(maskBlur: number): void {
    this.maskBlur = maskBlur;
  }
  @action setAntiGlare(antiGlare: number): void {
    this.antiGlare = antiGlare;
  }
  @action setSeed(seed: number): void {
    this.seed = seed;
  }
  @action setDenosing(denosing: number): void {
    this.denosing = denosing;
  }
  @action setInitialNoiseMultiplier(initialNoiseMultiplier: number): void {
    this.initialNoiseMultiplier = initialNoiseMultiplier;
  }
  @action setControlMode(mode: number): void {
    if ([0, 1, 2].includes(mode)) {
      this.controlMode = mode as 0 | 1 | 2;
    } else {
      throw new Error("Invalid mode value");
    }
  }
  @action setReferenceControlMode(mode: number): void {
    if ([0, 1, 2].includes(mode)) {
      this.referenceControlMode = mode as 0 | 1 | 2;
    } else {
      throw new Error("Invalid mode value");
    }
  }
  @action setReferenceImageData(referenceImageData: string): void {
    this.referenceImageData = referenceImageData;
  }
  @action setInpaintingFill(mode: number): void {
    if ([0, 1, 2].includes(mode)) {
      this.inpaintingFill = mode as 0 | 1 | 2;
    } else {
      throw new Error("Invalid mode value");
    }
  }
  @action setPasteOpacity(opacity: number): void {
    this.pasteOpacity = opacity;
  }

  @action setServerStatus(status: ServerStatus): void {
    this.serverStatus = status;
  }
  @action setServerIp(ip: string): void {
    this.serverIp = ip;
  }
  @action setAppServerStatus(status: AppServerStatus): void {
    this.appServerStatus = status;
  }

  @action addPrompt(category: keyof PromptData, value: string): void {
    this.prompts[category].push(new Prompt(value, 1.0, true));
  }
  @action removePrompt(category: keyof PromptData, index: number): void {
    this.prompts[category].splice(index, 1);
  }
  @action togglePromptEnabled(category: keyof PromptData, index: number): void {
    this.prompts[category][index].enabled =
      !this.prompts[category][index].enabled;
    this.toggleDummyVariable();
    // console.log(this.getPromptText(category));
  }
  @action increasePromptWeight(
    category: keyof PromptData,
    index: number,
    inc: number
  ): void {
    let w = this.prompts[category][index].weight + inc;
    w = Math.max(w, 0);
    w = Math.min(w, 3);
    this.prompts[category][index].weight = w;
    this.toggleDummyVariable();
  }

  @action toggleEqualizeColor(): void {
    this.equalizeColor = !this.equalizeColor;
  }

  @action setBatchScript(script: string): void {
    this.batchScript = script;
  }

  @computed get denosingTick() {
    return 100 / this.steps;
  }

  @computed get emphasizeConsistency() {
    return this.sampler === "DDIM";
  }
  @action toggleEmphasizeConsistency(): void {
    if (this.emphasizeConsistency) {
      this.sampler = "DPM++ 2M Karras";
    } else {
      this.sampler = "DDIM";
    }
  }
  @action toggleSegmentationModelMode(): void {
    if (this.segmentationModelMode === "bodypix") {
      this.segmentationModelMode = "mediapipe";
    } else {
      this.segmentationModelMode = "bodypix";
    }
  }

  getOptions(category: keyof PromptData): string[] {
    switch (category) {
      case "positive":
        return POSITIVE_PROMPT_OPTIONS;
      case "negative":
        return NEGATIVE_PROMPT_OPTIONS;
    }
    return [];
  }

  getPromptText(category: keyof PromptData): string {
    return this.prompts[category]
      .map((p) => p.toString())
      .filter((p) => p !== "")
      .join(",");
  }

  @action initializeExtractedPrompts(
    extractedPrompts: Record<string, number>
  ): void {
    this.prompts.extracted.length = 0;

    const sortedExtractedPrompts = Object.fromEntries(
      Object.entries(extractedPrompts).sort(([, a], [, b]) => b - a)
    );

    Object.keys(sortedExtractedPrompts).forEach((key) => {
      this.prompts.extracted.push(new Prompt(key, 1.0, true));
    });
  }

  private calculateAntiGlareParameters(): {
    antiGlareFilterFlag: number;
    antiGlareFilterSigmaS: number;
    antiGlareFilterSigmaR: number;
  } {
    let antiGlareFilterFlag = 0;
    let antiGlareFilterSigmaS = 0;
    let antiGlareFilterSigmaR = 0;

    if (this.antiGlare > 0) antiGlareFilterFlag = 1;

    // ぼかしの強度を決定する
    if (this.antiGlare) {
      // antiGlareの値に基づいて、適当な計算を行う
      antiGlareFilterSigmaS = this.antiGlare * 0.5;
      antiGlareFilterSigmaR = this.antiGlare / 100;
    }

    return {
      antiGlareFilterFlag,
      antiGlareFilterSigmaS,
      antiGlareFilterSigmaR,
    };
  }

  pasteGeneratedImageData = async () => {
    await this.pasteEditedImageData(
      this.generatedImageData,
      this.root.imageStore.cropOnOriginalImage
    );
  };

  processAi = async (seedOverwritten?: number) => {
    if (!this.root.imageStore.url) {
      return false;
    }
    const seed = seedOverwritten ? seedOverwritten : this.seed;
    this.root.uiStore.setInprogress(true);

    let positivePrompt = this.getPromptText("positive");
    const negativePrompt = this.getPromptText("negative");
    if (this.usePromptExtracted) {
      const extractedPrompt = this.getPromptText("extracted");
      positivePrompt = positivePrompt + "," + extractedPrompt;
    }
    // console.log(positivePrompt);
    // console.log(negativePrompt);

    // 0と1の対応を入れ替える
    let derivedInpaintingFill: number;
    if (this.denosing < 80) derivedInpaintingFill = 0;
    else if (this.denosing < 90) derivedInpaintingFill = 1;
    else derivedInpaintingFill = 2;
    let remappedInpaintingFill: number = derivedInpaintingFill;
    if (derivedInpaintingFill === 0) remappedInpaintingFill = 1;
    else if (derivedInpaintingFill === 1) remappedInpaintingFill = 0;

    // 対応を入れ替える
    let remappedControlMode: number;
    if (this.controlMode === 0) remappedControlMode = 0;
    else if (this.controlMode === 1) remappedControlMode = 2;
    else remappedControlMode = 1;
    const controlWeight = 1.0; // 固定

    let remappedReferenceControlMode: number;
    let referenceControlWeight: number;
    if (this.referenceControlMode === 0) {
      remappedReferenceControlMode = 2;
      referenceControlWeight = 1.0; // 1.0以上で変化ない模様
    } else if (this.referenceControlMode === 1) {
      remappedReferenceControlMode = 0;
      referenceControlWeight = 1.0;
    } else {
      remappedReferenceControlMode = 0;
      referenceControlWeight = 0.5;
    }

    const cfgScale = 7;

    const antiGlareParams = this.calculateAntiGlareParameters();

    // TODO キャンパスのズームがかかっているなどすると、必ずしもサイズが512じゃなくなるか。
    const body: PostRenderGenerateBodyData = {
      sampler: this.sampler,
      steps: this.steps,
      seed: seed,
      maskBlur: this.maskBlur,
      cfgScale: cfgScale,
      denosing: this.denosing / 100,
      initialNoiseMultiplier: this.initialNoiseMultiplier / 100,
      controlMode: remappedControlMode,
      controlWeight: controlWeight,
      referenceControlMode: remappedReferenceControlMode,
      referenceControlWeight: referenceControlWeight,
      inpaintingFill: remappedInpaintingFill,
      width: this.root.imageStore.element.naturalWidth,
      height: this.root.imageStore.element.naturalHeight,
      positivePrompt: positivePrompt,
      negativePrompt: negativePrompt,
      antiGlareFilterFlag: antiGlareParams.antiGlareFilterFlag,
      antiGlareFilterSigmaS: antiGlareParams.antiGlareFilterSigmaS,
      antiGlareFilterSigmaR: antiGlareParams.antiGlareFilterSigmaR,
      imageData: this.root.canvasStore.getImageDataUrl(),
      maskData: this.root.canvasStore.getMaskDataUrl(),
      edgeData: this.useEdge ? this.root.canvasStore.getEdgeDataUrl() : "",
      useEdge: this.useEdge,
      useReference: this.useReference,
      useAnotherImageForReference: this.useAnotherImageForReference,
      referenceImageData: this.referenceImageData,
    };

    // // デバッグ
    // const body: PostRenderGenerateBodyData = {
    //   maskBlur: 1,
    //   cfgScale: 1,
    //   controlMode: 1,
    //   inpaintingFill: 1,
    //   width: 1,
    //   height: 1,
    //   positivePrompt: "aa",
    //   negativePrompt: "bb",
    //   imageData: "aa",
    //   maskData: "bb",
    //   edgeData: "bbb",
    // };

    this.lastGenerationParams = {
      ...body,
      imageData: body.imageData.substring(0, 10) + " (trimmed)",
      maskData: body.maskData.substring(0, 10) + " (trimmed)",
      edgeData: body.edgeData
        ? body.edgeData.substring(0, 10) + " (trimmed)"
        : "",
      referenceImageData: body.referenceImageData
        ? body.referenceImageData.substring(0, 10) + " (trimmed)"
        : "",
    };

    try {
      const result = await postRenderGenerateJson(
        body,
        this.root.uiStore.prepareForAbort()
      );
      this.root.authStore.setCredit(result.remainingCredit);
      this.generatedImageData = "data:image/png;base64," + result.image;
      await this.pasteGeneratedImageData();

      Alert.success("Processed successfully", {
        position: "bottom-left",
      });
      return true;
    } catch (error) {
      Alert.error("Failed to process image. Server is busy or down.", {
        position: "bottom-left",
      });
      console.log(error);
      return false;
    } finally {
      this.root.uiStore.setInprogress(false);
    }
  };

  scriptingProcess = async (
    image: HTMLImageElement,
    outputFileName: string
  ) => {
    const script = JSON.parse(this.batchScript);

    let success: boolean;
    if (script.bodyRegion === "all") {
      success = await this.setImageOnCanvas(image);
    } else {
      await this.setCropForBodyRegion(image, script.bodyRegion);
      success = await this.setImageOnCanvas(image, script.bodyRegion, true);
    }

    if (!success) {
      throw Error("image preprocess failed");
    }

    for (let i = 0; i < script.maskExpand; i++) {
      await this.root.imageStore.morphologyMask("expand");
    }
    for (let i = 0; i < script.maskShrink; i++) {
      await this.root.imageStore.morphologyMask("shrink");
    }

    if (script.fillAll) {
      this.root.maskStore.fillAll();
    }

    console.log("preprocess done");

    success = await this.processAi();
    if (!success) {
      throw Error("image generation failed");
    }
    console.log("generation done");

    // save
    const generatedImageUrl = this.imageHistory[0].src;
    saveAs(generatedImageUrl, outputFileName);
    this.deleteFromHistoryAll();
  };
}
