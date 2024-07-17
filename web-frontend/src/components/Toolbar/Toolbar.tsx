import React from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";

import { observer } from "mobx-react-lite";

import ToolbarBatch from "./ToolbarBatch";
import ToolbarEdge from "./ToolbarEdge";
import ToolbarMask from "./ToolbarMask";
import ToolbarPrompt from "./ToolbarPrompt";
import ToolbarSetting from "./ToolbarSetting";
import { ReactComponent as Close } from "../../assets/close.svg";
import useStore from "../../hooks/useStore";
import { ModeName } from "../../stores/canvasStore";

function translateModeName(modeName: ModeName): string {
  if (modeName === "Edge") return "Outline";
  return modeName as string;
}

const Toolbar: React.FC = observer(() => {
  const { uiStore, canvasStore } = useStore();
  const contentMap: { [name: string]: JSX.Element } = {
    Setting: <ToolbarSetting />,
    Prompt: <ToolbarPrompt />,
    Mask: <ToolbarMask />,
    Edge: <ToolbarEdge />,
    Batch: <ToolbarBatch />,
  };

  return (
    <TransitionGroup component={null}>
      {uiStore.isToolbarOpen && (
        <CSSTransition timeout={600} classNames="toolbar">
          <section className={"toolbar custom-scrollbar"}>
            <div className="toolbar__header">
              <h4>{translateModeName(canvasStore.mode)}</h4>
              <Close
                onClick={() => {
                  // canvasStore.resetToBaseScale();
                  uiStore.closeToolbar();
                }}
              />
            </div>
            {contentMap[canvasStore.mode]}
          </section>
        </CSSTransition>
      )}
    </TransitionGroup>
  );
});

export default Toolbar;
