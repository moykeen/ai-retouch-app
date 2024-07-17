import React from "react";

import { observer } from "mobx-react-lite";

import { ReactComponent as Save } from "../../assets/save.svg";
import useStore from "../../hooks/useStore";
import Tooltip from "../Tooltip";

// デバッグとして使うことがあるので当面残しておく
const SaveButton: React.FC = observer(() => {
  const { canvasStore, imageStore, uiStore } = useStore();
  const saveImage = async () => {
    if (!imageStore.url || uiStore.isToolbarOpen) {
      return;
    }
    console.log(canvasStore.instance.getObjects());
    // return;

    const timestamp = Math.floor(Date.now() / 100);
    const fileName = `image-${timestamp}.png`;
    const link = document.createElement("a");
    link.download = fileName;
    // link.href = canvasStore.getDataUrl();
    // link.href = canvasStore.getEdgeDataUrl();

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    link.remove();
  };

  return (
    <Tooltip content="Save" placement="bottom">
      <Save
        className={`${
          !imageStore.url || uiStore.isToolbarOpen ? "disabled" : ""
        }`}
        onClick={saveImage}
      />
    </Tooltip>
  );
});

export default SaveButton;
