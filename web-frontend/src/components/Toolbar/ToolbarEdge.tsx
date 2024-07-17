import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Toggle from "react-toggle";

import { observer } from "mobx-react-lite";

import useStore from "../../hooks/useStore";
import UploadButton from "../Header/UploadButton";
import ModeToggleSwitch from "../ModeToggleSwitch";
import OptionToggleSwitch from "../OptionToggleSwitch";
import Slider from "../Slider";

const ToolbarEdge: React.FC = observer(() => {
  const { edgeStore, aiStore } = useStore();

  const drawingModes = ["Draw", "Erase"];
  const controlModes = ["Precise", "Moderate", "Rough"];
  const referenceControlModes = ["Precise", "Moderate", "Rough"];

  const changeDrawingMode = (value: string) => {
    if (value === "Draw") edgeStore.enableDrawMode();
    else edgeStore.enableEraseMode();
  };
  const changeControlMode = (value: string) => {
    aiStore.setControlMode(controlModes.indexOf(value));
  };
  const changeReferenceControlMode = (value: string) => {
    aiStore.setReferenceControlMode(referenceControlModes.indexOf(value));
  };

  const setReferenceImage = (files: File[]) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageUrl = String(reader.result);
      aiStore.setReferenceImageData(imageUrl);
    };
    reader.readAsDataURL(files[0]);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setReferenceImage(acceptedFiles);
    aiStore.useAnotherImageForReference = true;
  }, []);
  const { getRootProps } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const placeholderImageUrl =
    "https://placehold.co/400x400?text=Drop+your+image";
  // "https://placehold.jp/30/aaaaaa/ffffff/400x400.png?text=Drop%20your%20image";

  const modificationGuideMarks = {
    30: "subtle",
    60: "moderate",
    80: "high",
    90: "drastic",
  };

  return (
    <div className="toolbar__content">
      <div className="toolbar__drawing">
        <div className="slider__header">
          <p className="slider__title">Emphasize consistency</p>
          <span className="slider__input">
            <Toggle
              checked={aiStore.emphasizeConsistency}
              icons={false}
              onChange={() => {
                aiStore.toggleEmphasizeConsistency();
              }}
            />
          </span>
        </div>

        <Slider
          title="Original image modification"
          value={Math.round(aiStore.denosing)}
          min={0}
          max={100}
          step={aiStore.denosingTick}
          marks={modificationGuideMarks}
          callback={(value) => aiStore.setDenosing(value)}
        />
        <Slider
          title="Simplicity"
          value={Math.round(aiStore.initialNoiseMultiplier)}
          min={0}
          max={150}
          callback={(value) => aiStore.setInitialNoiseMultiplier(value)}
        />
        <Slider
          title="Seed"
          value={aiStore.seed}
          min={-1}
          max={1000000}
          callback={(value) => aiStore.setSeed(value)}
        />
      </div>

      <div className="toolbar__labeled_text_content">
        <div className="slider__header">
          <p className="slider__title">Enable outline</p>
          <span className="slider__input">
            <Toggle
              checked={aiStore.useEdge}
              icons={false}
              onChange={() => {
                aiStore.toggleUseEdge();
              }}
            />
          </span>
        </div>

        <div className="toolbar__drawing">
          <ModeToggleSwitch
            options={drawingModes}
            changeValue={changeDrawingMode}
            initialSelectedIndex={!edgeStore.isEraseMode ? 0 : 1}
          />
          <Slider
            title="Pencil Size"
            value={edgeStore.lineWidth}
            min={1}
            max={150}
            callback={(value) => edgeStore.setLineWidth(value)}
          />

          <Slider
            title="Eraser Size"
            value={edgeStore.eraseLineWidth}
            min={1}
            max={150}
            // disabled={!edgeStore.isEraseMode}
            callback={(value) => edgeStore.setEraseLineWidth(value)}
          />
          <div className="toolbar__block">
            <div className="slider__header">
              <p className="slider__title">Fidelity to outline</p>
            </div>
            <OptionToggleSwitch
              optionGroupId="edge"
              options={controlModes}
              changeValue={changeControlMode}
              initialSelectedIndex={aiStore.controlMode}
            />
          </div>
        </div>
      </div>

      <div className="toolbar__labeled_text_content">
        <div className="slider__header">
          <p className="slider__title">Enable reference</p>
          <span className="slider__input">
            <Toggle
              checked={aiStore.useReference}
              icons={false}
              onChange={() => {
                aiStore.toggleUseReference();
              }}
            />
          </span>
        </div>
        <div className="toolbar__drawing">
          <div className="slider__header">
            <p className="slider__title">Use original image</p>
            <span className="slider__input">
              <Toggle
                checked={!aiStore.useAnotherImageForReference}
                icons={false}
                onChange={() => {
                  aiStore.toggleUseAnotherImageForReference();
                }}
              />
            </span>
          </div>
          <div className="slider__header">
            <p className="slider__title">Another reference image</p>
            <span className="slider__input">
              <UploadButton
                onFileSelected={setReferenceImage}
                allowDirectory={false}
              />
            </span>
            <div {...getRootProps({ className: "dropzone" })}>
              <img
                src={aiStore.referenceImageData || placeholderImageUrl}
                className="preview__mini"
                alt=""
              ></img>
            </div>
          </div>
          <div className="toolbar__block">
            <div className="slider__header">
              <p className="slider__title">Fidelity to reference</p>
            </div>
            <OptionToggleSwitch
              optionGroupId="reference"
              options={referenceControlModes}
              changeValue={changeReferenceControlMode}
              initialSelectedIndex={aiStore.referenceControlMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default ToolbarEdge;
