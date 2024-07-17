import React from "react";

import { observer } from "mobx-react-lite";

import { ReactComponent as Undo } from "../../assets/reply-arrow-outline-icon.svg";
import useStore from "../../hooks/useStore";

export const UndoButton = observer(() => {
  const { uiStore, canvasStore } = useStore();
  return (
    <div>
      <Undo
        className={`${!uiStore.canUndo ? "disabled" : ""}`}
        onClick={() => {
          if (!uiStore.canUndo) {
            return;
          }
          canvasStore.history.undo();
        }}
      />
    </div>
  );
});

export default UndoButton;
