import React from "react";

import { observer } from "mobx-react-lite";
import { CgTranscript as Prompt } from "react-icons/cg";

import Tooltip from "./Tooltip";
import { ReactComponent as Ai } from "../assets/artificial-intelligence-ai-chip-icon.svg";
import { ReactComponent as Mask } from "../assets/combine-merge-icon.svg";
import { ReactComponent as Edge } from "../assets/pencil.svg";
import { ReactComponent as Setting } from "../assets/settings-gear-icon.svg";
import { ReactComponent as Stack } from "../assets/stack.svg";
import useStore from "../hooks/useStore";
import { ModeName } from "../stores/canvasStore";

interface IMenuItems {
  icon: React.ReactElement;
  name: ModeName;
  handler: () => void;
  tooltip?: string;
}

const Menu: React.FC = observer(() => {
  const { uiStore, canvasStore, imageStore, aiStore } = useStore();

  const disabledWithoutImage = (modeName: ModeName) => {
    return false; // convenient for development
    // return !imageStore.url && !["Setting"].includes(modeName);
  };

  const handleClick = (modeName: ModeName) => {
    if (disabledWithoutImage(modeName)) {
      return;
    }

    uiStore.toggleToolbar(modeName);
  };

  const items: IMenuItems[] = [
    {
      icon: <Setting />,
      name: "Setting",
      handler: () => handleClick("Setting"),
    },
    {
      // このアイコンだけreact-iconsを利用しているのでここで色の切り替え
      icon: <Prompt color="fff" />,
      name: "Prompt",
      handler: () => handleClick("Prompt"),
      tooltip: "Edit prompt texts",
    },

    {
      icon: <Mask />,
      name: "Mask",
      handler: () => handleClick("Mask"),
      tooltip: "Edit inpaint mask",
    },
    {
      icon: <Edge />,
      name: "Edge",
      tooltip: "Edit outline and reference",
      handler: () => handleClick("Edge"),
    },
    {
      icon: <Stack />,
      name: "Batch",
      handler: () => handleClick("Batch"),
    },
  ];

  return (
    <section className="menu">
      <div>
        {items.map((item, index) => {
          const tooltip = item.tooltip || item.name;
          return (
            <Tooltip key={index} content={tooltip} placement="right">
              <div
                className={`menu__item ${
                  canvasStore.mode === item.name ? "menu__item_active" : ""
                }
                   ${disabledWithoutImage(item.name) ? "disabled" : ""}`}
                onClick={item.handler}
              >
                {item.icon}
              </div>
            </Tooltip>
          );
        })}
      </div>
      <Tooltip
        content={uiStore.inProgress ? "Abort" : "Execute"}
        placement="right"
      >
        <div
          className={`menu__item generate_button ${
            !imageStore.url ? "disabled" : ""
          }`}
          onClick={async () => {
            if (uiStore.inProgress) {
              uiStore.abortCurrentProcess();
            } else {
              await aiStore.processAi();
            }
          }}
        >
          <Ai className={uiStore.inProgress ? "progress" : ""} />
        </div>
      </Tooltip>
    </section>
  );
});

export default Menu;
