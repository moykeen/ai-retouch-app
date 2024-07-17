import React from "react";

import { observer } from "mobx-react-lite";

import { ReactComponent as Mask } from "../../assets/background-icon.svg";
import { ReactComponent as Edge } from "../../assets/happy-icon.svg";
import { ReactComponent as Background } from "../../assets/image-photography-icon.svg";
import useStore from "../../hooks/useStore";

const LayerControl: React.FC = observer(() => {
  const { canvasStore, imageStore } = useStore();
  return imageStore.url ? (
    <div className="layer-control">
      <button
        className={`${
          canvasStore.imageLayerVisible ? "" : "layer-control__invisible"
        }`}
        onClick={() => {
          canvasStore.toggleImageLayerVisible();
        }}
      >
        <Background />
      </button>
      <p className="layer-control__value">
        <button
          className={`${
            canvasStore.maskLayerVisible ? "" : "layer-control__invisible"
          }`}
          onClick={() => {
            canvasStore.toggleMaskLayerVisible();
          }}
        >
          <Mask />
        </button>
      </p>
      <button
        className={`${
          canvasStore.edgeLayerVisible ? "" : "layer-control__invisible"
        }`}
        onClick={() => {
          canvasStore.toggleEdgeLayerVisible();
        }}
      >
        <Edge />
      </button>
    </div>
  ) : null;
});

export default LayerControl;
