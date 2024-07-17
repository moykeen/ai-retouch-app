import { PixelCrop } from "react-image-crop";

import * as tf from "@tensorflow/tfjs";
import * as bodyPix from "@tensorflow-models/body-pix";
import {
  BodyPixArchitecture,
  BodyPixOutputStride,
  BodyPixQuantBytes,
  BodyPixMultiplier,
  Pose,
} from "@tensorflow-models/body-pix/dist/types";
import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import { Segmentation } from "@tensorflow-models/body-segmentation/dist/shared/calculators/interfaces/common_interfaces";
import { fabric } from "fabric";
import "@tensorflow/tfjs";
import cv from "opencv-ts";
import { MorphTypes } from "opencv-ts/src/ImageProcessing/ImageFiltering";

import { BodyPart } from "../stores/imageStore";

const TARGET_LENGTH = 512;
const JPEG_QUALITY = 0.85;
const MASK_THRESHOLD = 128;
export const CROP_ASPECT_RATIO_LIMIT = 16 / 9;
export const WEBGL_DELETE_TEXTURE_THRESHOLD = 700000000 * 3;

export type BodyPartMaskData = {
  maskUrlFace: string;
  areaFace: number;
  maskUrlTorso: string;
  areaTorso: number;
  maskUrlLeftArm: string;
  areaLeftArm: number;
  maskUrlRightArm: string;
  areaRightArm: number;
  maskUrlLeftLeg: string;
  areaLeftLeg: number;
  maskUrlRightLeg: string;
  areaRightLeg: number;
};

export function toDataURL(
  canvas: HTMLCanvasElement | fabric.Canvas,
  format = "jpeg"
): string {
  // console.log(canvas.width, canvas.height);
  if (canvas instanceof HTMLCanvasElement) {
    if (format === "jpeg") return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    else return canvas.toDataURL("image/png");
  } else if (canvas instanceof fabric.Canvas) {
    return canvas.toDataURL({
      format: format,
      quality: JPEG_QUALITY,
    });
  } else {
    throw new Error("Unsupported canvas type");
  }
}

export function getCroppedImage(
  image: HTMLImageElement,
  crop: PixelCrop
): [HTMLCanvasElement, string, PixelCrop] {
  const canvas: HTMLCanvasElement = document.createElement("canvas");

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No 2d context");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio;

  // 所定のサイズに合わせると共に、SDの画像サイズが8の倍数縛りであることを考慮してcropを微調節する
  let w = crop.width * scaleX;
  let h = crop.height * scaleY;
  let adjustedCropWidth: number;
  let adjustedCropHeight: number;
  let scaleForTargetSize = 1;
  if (w < h) {
    const r = h / w;
    scaleForTargetSize = TARGET_LENGTH / w;
    w = TARGET_LENGTH;

    // ensure multiple of 8
    h = Math.round((w * r) / 8) * 8;
    // h = Math.round(w * r);

    adjustedCropWidth = crop.width * scaleX;
    adjustedCropHeight = (adjustedCropWidth / w) * h;
  } else {
    const r = w / h;
    scaleForTargetSize = TARGET_LENGTH / h;
    h = TARGET_LENGTH;

    // ensure multiple of 8
    w = Math.round((h * r) / 8) * 8;
    // w = Math.round(h * r);

    adjustedCropHeight = crop.height * scaleY;
    adjustedCropWidth = (adjustedCropHeight / h) * w;
  }

  canvas.width = Math.floor(w * pixelRatio);
  canvas.height = Math.floor(h * pixelRatio);
  console.log("canvas size", canvas.width, canvas.height);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = "high";

  const cropX = crop.x * scaleX * scaleForTargetSize;
  const cropY = crop.y * scaleY * scaleForTargetSize;

  ctx.save();

  ctx.translate(-cropX, -cropY);
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth * scaleForTargetSize,
    image.naturalHeight * scaleForTargetSize
  );
  ctx.restore();

  const adjustedCrop: PixelCrop = {
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    width: adjustedCropWidth,
    height: adjustedCropHeight,
    unit: crop.unit,
  };
  // return [canvas.toDataURL(), adjustedCrop];
  return [canvas, toDataURL(canvas), adjustedCrop];
}

export function pasteImage(
  baseImage: HTMLImageElement,
  pasteImage: HTMLImageElement,
  crop: PixelCrop,
  pasteOpacity: number
) {
  const canvas: HTMLCanvasElement = document.createElement("canvas");

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No 2d context");
  }

  const scaleX = baseImage.naturalWidth / baseImage.width;
  const scaleY = baseImage.naturalHeight / baseImage.height;
  const pixelRatio = window.devicePixelRatio;
  // console.log(baseImage.naturalWidth, baseImage.width, pixelRatio);

  const w = baseImage.naturalWidth;
  const h = baseImage.naturalHeight;
  canvas.width = Math.floor(w); // * pixelRatio);
  canvas.height = Math.floor(h); // * pixelRatio);
  ctx.imageSmoothingQuality = "high";

  ctx.save();

  ctx.drawImage(
    baseImage,
    0,
    0,
    baseImage.naturalWidth,
    baseImage.naturalHeight,
    0,
    0,
    baseImage.naturalWidth,
    baseImage.naturalHeight
  );

  ctx.globalAlpha = pasteOpacity;
  ctx.drawImage(
    pasteImage,
    0,
    0,
    pasteImage.naturalWidth,
    pasteImage.naturalHeight,
    crop.x / scaleX,
    crop.y / scaleY,
    crop.width,
    crop.height
  );

  ctx.restore();

  // console.log(
  //   pasteImage.naturalWidth,
  //   pasteImage.width,
  //   "-----",
  //   pasteImage.naturalHeight,
  //   pasteImage.height
  // );
  // console.log(canvas.width, canvas.height);
  // console.log(scaleX, scaleY);
  // console.log(crop);

  // return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return toDataURL(canvas);
}

function resizeImage(
  image: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx!.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas;
}

export function getMaskForBodyParts(
  segmentation: bodyPix.PartSegmentation,
  bodyParts: BodyPart[],
  boundingBoxMarginRatio = 0.1
): [HTMLCanvasElement, PixelCrop] {
  const partsCodes: number[] = [];

  for (const part of bodyParts) {
    switch (part) {
      case "Face":
        partsCodes.push(0, 1);
        break;
      case "Torso":
        partsCodes.push(12, 13);
        break;
      case "Left arm":
        partsCodes.push(2, 3, 6, 7, 10);
        break;
      case "Right arm":
        partsCodes.push(4, 5, 8, 9, 11);
        break;
      case "Left leg":
        partsCodes.push(14, 15, 18, 19, 22);
        break;
      case "Right leg":
        partsCodes.push(16, 17, 20, 21, 23);
        break;
    }
  }

  const limitedSegmentation = { ...segmentation };
  limitedSegmentation.data = limitedSegmentation.data.map((value) =>
    partsCodes.includes(value) ? 1 : 0
  );

  const boundingBox = tf.tidy(() => {
    const segTensor = tf.tensor2d(limitedSegmentation.data, [
      segmentation.height,
      segmentation.width,
    ]);
    const segSum = segTensor.sum().toFloat();
    const segCumX = tf.div(segTensor.sum(0).cumsum(), segSum);
    const segCumY = tf.div(segTensor.sum(1).cumsum(), segSum);
    const x1 = segCumX.greater(0.01).argMax().dataSync()[0];
    const x2 = segCumX.greater(0.99).argMax().dataSync()[0];
    const y1 = segCumY.greater(0.01).argMax().dataSync()[0];
    const y2 = segCumY.greater(0.99).argMax().dataSync()[0];
    const widthMargin = (x2 - x1) * boundingBoxMarginRatio;
    const heightMargin = (y2 - y1) * boundingBoxMarginRatio;

    // derive bounding box
    let adjustedX: number;
    let adjustedY: number;
    let adjustedWidth: number;
    let adjustedHeight: number;
    adjustedX = x1 - widthMargin;
    adjustedY = y1 - heightMargin;
    adjustedWidth = x2 - x1 + 2 * widthMargin;
    adjustedHeight = y2 - y1 + 2 * heightMargin;

    // increase shorter edge to meet aspect ratio constraint
    if (adjustedWidth < adjustedHeight) {
      adjustedWidth = Math.max(
        adjustedWidth,
        Math.round(adjustedHeight / CROP_ASPECT_RATIO_LIMIT)
      );
    } else {
      adjustedHeight = Math.max(
        adjustedHeight,
        Math.round(adjustedWidth / CROP_ASPECT_RATIO_LIMIT)
      );
    }

    adjustedX = Math.max(0, adjustedX);
    adjustedY = Math.max(0, adjustedY);
    adjustedWidth = Math.min(segmentation.width - adjustedX, adjustedWidth);
    adjustedHeight = Math.min(segmentation.height - adjustedY, adjustedHeight);

    return {
      x: adjustedX,
      y: adjustedY,
      width: adjustedWidth,
      height: adjustedHeight,
      unit: "px",
    };
  });

  // console.log(boundingBox);

  // パーツの面積を計算して自動オンオフを行う試み
  // const area = limitedSegmentation.data.reduce(
  //   (accumulator, currentValue) => accumulator + currentValue,
  //   0
  // );

  const foregroundColor = { r: 255, g: 255, b: 255, a: 255 };
  const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };

  const canvas = document.createElement("canvas");
  tf.tidy(() => {
    const mask = bodyPix.toMask(
      [limitedSegmentation],
      foregroundColor,
      backgroundColor
    );
    canvas.width = mask.width;
    canvas.height = mask.height;
    bodyPix.drawMask(canvas, canvas, mask, 1, 1);
  });

  return [canvas, boundingBox as PixelCrop];
}

function getTargetPersonSegmentation(
  multiPersonSegmentation: bodyPix.PartSegmentation[],
  targetIndex: number,
  image: HTMLCanvasElement | HTMLImageElement
): bodyPix.PartSegmentation {
  if (multiPersonSegmentation.length === 0) {
    return {
      width: image.width,
      height: image.height,
      data: new Int32Array(image.width * image.height).fill(-1),
      pose: {
        keypoints: [],
        score: 0,
      },
    };
  }
  if (multiPersonSegmentation.length === 1) {
    return multiPersonSegmentation[0];
  }

  const sortedSegmentations = multiPersonSegmentation
    .map((s) => ({
      data: s,
      averageX: s.pose.keypoints
        .filter((kp) => kp.score >= 0.5)
        .reduce((acc, kp, _, arr) => acc + kp.position.x / arr.length, 0),
    }))
    .sort((a, b) => a.averageX - b.averageX);

  const safeIndex = Math.min(
    Math.max(targetIndex, 0),
    sortedSegmentations.length - 1
  );
  return sortedSegmentations[safeIndex].data;
}

export async function loadBodyPixModel(): Promise<bodyPix.BodyPix> {
  // Maybe, the minimal setting
  const model_config = {
    architecture: "MobileNetV1" as BodyPixArchitecture,
    outputStride: 16 as BodyPixOutputStride, // higher value can reduce computation (MobileNet is up to 16?)
    quantBytes: 2 as BodyPixQuantBytes, // small value can reduce model size. 1 results in horrible quality
    multiplier: 0.5 as BodyPixMultiplier, // lower is smaller model size, no effect for resnet
  };

  const net = await bodyPix.load(model_config);
  return net;
}

export async function loadBodySegmentationModel(): Promise<bodySegmentation.BodySegmenter> {
  const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
  const segmenterConfig: bodySegmentation.MediaPipeSelfieSegmentationMediaPipeModelConfig =
    {
      runtime: "mediapipe",
      solutionPath:
        "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
      modelType: "general",
    };
  const segmenter: bodySegmentation.BodySegmenter =
    await bodySegmentation.createSegmenter(model, segmenterConfig);

  return segmenter;
}

export async function getCroppedMaskSegmentedDataUrl(
  model: bodyPix.BodyPix | bodySegmentation.BodySegmenter,
  image: HTMLImageElement | HTMLCanvasElement,
  threshold: number,
  target: number
): Promise<bodyPix.PartSegmentation> {
  let segmentation: bodyPix.PartSegmentation;

  // scale image if needed
  const resizingFactor = Math.max(image.width, image.height) / 512;
  const doScaling = resizingFactor > 1;

  const imageInput = doScaling
    ? resizeImage(
        image,
        Math.round(image.width / resizingFactor),
        Math.round(image.height / resizingFactor)
      )
    : image;

  if (model instanceof bodyPix.BodyPix) {
    // detect single person, or detect all people altogether
    if (target === 0) {
      const segmentationSingle = await model.segmentPersonParts(imageInput, {
        internalResolution: "medium",
        // internalResolution: "high",
        // internalResolution: "full",
        segmentationThreshold: threshold,
      });

      segmentation = {
        ...segmentationSingle,
        pose: segmentationSingle.allPoses[0], // pose is not used, so an arbitrary pose is set
      };
    } else {
      // detect one of multiple people このモードは顔だけだったり体の領域が少ないと正しく検出できない模様
      const multiPersonSegmentation = await model.segmentMultiPersonParts(
        imageInput,
        {
          internalResolution: "medium",
          segmentationThreshold: threshold,
        }
      );
      segmentation = getTargetPersonSegmentation(
        multiPersonSegmentation,
        target - 1,
        image
      );
    }

    return segmentation;
  } else {
    const s: Segmentation[] = await model.segmentPeople(imageInput);
    const imageTensor = await s[0].mask.toTensor();

    const [grayImageInt32Array, width, height] = tf.tidy(() => {
      const [height, width] = imageTensor.shape;
      let t = imageTensor.slice([0, 0, 0], [-1, -1, 3]).mean(2, true);

      t = t.notEqual(0).mul(255); // to binary mask
      t = t
        .dilation2d(createKernel(11, false), 1, "same") // apply small expansion
        .less(MASK_THRESHOLD)
        .mul(255);

      return [new Int32Array(t.flatten().toInt().dataSync()), width, height];
    });
    imageTensor.dispose();

    // 必要性わからないがresetしておく
    model.reset();
    // console.log(imageTensor.shape);

    const dummyPose: Pose = {
      keypoints: [],
      score: 0,
    };
    return {
      data: grayImageInt32Array,
      width: width,
      height: height,
      pose: dummyPose,
    };
  }
}

function createKernel(kernelSize: number, circularKernel: boolean) {
  if (!circularKernel) {
    return tf.ones([kernelSize, kernelSize, 1], "float32") as tf.Tensor3D;
  }
  const radius = kernelSize / 2;
  const squareKernel = tf.ones([kernelSize, kernelSize], "float32");
  const indices = tf.tensor2d(Array.from(Array(kernelSize).keys()), [
    kernelSize,
    1,
  ]);
  const distFromCenter = indices
    .sub(tf.scalar(radius))
    .square()
    .add(indices.transpose().sub(tf.scalar(radius)).square())
    .sqrt();
  const kernel = squareKernel.mul(
    distFromCenter.lessEqual(tf.scalar(radius)).toFloat()
  );
  return kernel.expandDims(-1) as tf.Tensor3D;
}

export async function morphology(
  operation: MorphTypes,
  canvas: HTMLCanvasElement,
  kernelSize: number,
  circularKernel = true
): Promise<void> {
  const resultTensor = tf.tidy(() => {
    const imageTensor = tf.browser.fromPixels(canvas);
    let grayImg;
    if (operation === cv.MORPH_ERODE) {
      grayImg = imageTensor
        .mean(2)
        .less(MASK_THRESHOLD)
        .expandDims(-1)
        .mul(255);
    } else {
      // cv.MORPH_DILATE
      grayImg = imageTensor
        .mean(2)
        .greater(MASK_THRESHOLD)
        .expandDims(-1)
        .mul(255);
    }
    const kernel = createKernel(kernelSize, circularKernel);

    let morphedImg;
    if (operation === cv.MORPH_ERODE) {
      morphedImg = grayImg
        .dilation2d(kernel, 1, "same")
        .less(MASK_THRESHOLD)
        .mul(255)
        .cast("int32") as tf.Tensor3D;
    } else {
      // cv.MORPH_DILATE
      morphedImg = grayImg
        .dilation2d(kernel, 1, "same")
        .greater(MASK_THRESHOLD)
        .mul(255)
        .cast("int32") as tf.Tensor3D;
    }
    return morphedImg;
  });

  await tf.browser.toPixels(resultTensor, canvas);
  resultTensor.dispose();
}

// OpenCVによる実装 (遅い)
export function morphologyCV(
  operation: MorphTypes,
  imageSource: HTMLCanvasElement | string,
  kernelSize: number
): HTMLCanvasElement | string {
  const src = cv.imread(imageSource);
  const dst = new cv.Mat();
  const M = new cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U);
  const anchor = new cv.Point(-1, -1);

  cv.morphologyEx(
    src,
    dst,
    operation,
    M,
    anchor,
    1,
    cv.BORDER_CONSTANT,
    cv.morphologyDefaultBorderValue()
  );

  cv.imshow(imageSource, dst);
  return imageSource;
}
