import React from "react";

import { observer } from "mobx-react-lite";

import useStore from "../../hooks/useStore";
import ModeToggleSwitch from "../ModeToggleSwitch";
import Slider from "../Slider";

const ToolbarMask: React.FC = observer(() => {
  const { maskStore, aiStore, imageStore } = useStore();

  const drawingModes = ["Draw", "Erase"];
  const changeMode = (value: string) => {
    if (value === "Draw") maskStore.enableDrawMode();
    else maskStore.enableEraseMode();
  };

  return (
    <div className="toolbar__content">
      <div className="toolbar__drawing">
        <ModeToggleSwitch
          options={drawingModes}
          changeValue={changeMode}
          initialSelectedIndex={!maskStore.isEraseMode ? 0 : 1}
        />
        <Slider
          title="Brush Size"
          value={maskStore.lineWidth}
          min={1}
          max={150}
          // disabled={maskStore.isEraseMode}
          callback={(value) => maskStore.setLineWidth(value)}
        />
        <Slider
          title="Eraser Size"
          value={maskStore.eraseLineWidth}
          min={1}
          max={150}
          // disabled={!maskStore.isEraseMode}
          callback={(value) => maskStore.setEraseLineWidth(value)}
        />
        <div className="toolbar__composite_wrapper">
          <div
            className={`toolbar__option`}
            onClick={() => maskStore.fillAll()}
          >
            Fill all
          </div>
          <div
            className={`toolbar__option`}
            onClick={() => maskStore.clearAll()}
          >
            Clear all
          </div>
        </div>
      </div>
      <div className="toolbar__block">
        <div className="slider__header">
          <p className="slider__title">Size adjustment</p>
        </div>
        <div className="toolbar__composite_wrapper">
          <div
            className={`toolbar__option`}
            onClick={async () => {
              await imageStore.morphologyMask("shrink");
            }}
          >
            Shrink
          </div>
          <div
            className={`toolbar__option`}
            onClick={async () => {
              await imageStore.morphologyMask("expand");
            }}
          >
            Expand
          </div>
        </div>
      </div>
      <div className="toolbar__composite_wrapper">
        <Slider
          title="Mask blur"
          value={Math.round(aiStore.maskBlur)}
          min={0}
          max={50}
          callback={(value) => aiStore.setMaskBlur(value)}
        />
      </div>

      <div className="toolbar__composite_wrapper">
        <Slider
          title="Paste opacity"
          value={Math.round(aiStore.pasteOpacity * 100)}
          min={0}
          max={100}
          callback={(value) => aiStore.setPasteOpacity(value / 100)}
        />
        <div
          className="toolbar__option"
          onClick={aiStore.pasteGeneratedImageData}
        >
          Re-apply
        </div>
      </div>
    </div>
  );
});

export default ToolbarMask;
