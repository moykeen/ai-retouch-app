import React from "react";

import { observer } from "mobx-react-lite";

import { ReactComponent as Redo } from "../../assets/forward-arrow-outline-icon.svg";
import useStore from "../../hooks/useStore";

export const RedoButton = observer(() => {
  const { uiStore, canvasStore } = useStore();
  return (
    <div>
      <Redo
        className={`${!uiStore.canRedo ? "disabled" : ""}`}
        onClick={() => {
          if (!uiStore.canRedo) {
            return;
          }
          canvasStore.history.redo();
        }}
      />
    </div>
  );
});

export default RedoButton;
