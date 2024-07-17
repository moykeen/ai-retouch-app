import React from "react";

import { observer } from "mobx-react-lite";

import { ReactComponent as Minus } from "../../assets/minus.svg";
import { ReactComponent as Plus } from "../../assets/plus.svg";
import useStore from "../../hooks/useStore";

const ZoomControl: React.FC = observer(() => {
  const { canvasStore, imageStore } = useStore();
  return imageStore.url ? (
    <div className="zoom-control">
      <button
        className="zoom-control__zoom-in"
        onClick={() => {
          canvasStore.increaseScale();
        }}
      >
        <Plus />
      </button>
      <p className="zoom-control__value">
        {`${Math.floor(canvasStore.scale * 100)}%`}
      </p>
      <button
        className="zoom-control__zoom-out"
        onClick={() => {
          canvasStore.decreaseScale();
        }}
      >
        <Minus />
      </button>
    </div>
  ) : null;
});

export default ZoomControl;
