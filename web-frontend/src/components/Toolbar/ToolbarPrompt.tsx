import React from "react";
import Toggle from "react-toggle";

import { observer } from "mobx-react-lite";

import useStore from "../../hooks/useStore";
import PromptTokenInput from "../PromptTokenInput";
import "react-toggle/style.css";

const ToolbarPrompt: React.FC = observer(() => {
  const { authStore, aiStore } = useStore();

  return (
    <div className="toolbar__content">
      {authStore.canUsePrompt() ? (
        <>
          <div className="toolbar__labeled_text_content">
            <div className="slider__header">
              <p className="slider__title">Prompt extracted from image</p>
            </div>
            <PromptTokenInput placeholder="" promptCategory="extracted" />
            <div className="slider__header">
              <p className="slider__title">Use for image generation</p>
              <span className="slider__input">
                <Toggle
                  checked={aiStore.usePromptExtracted}
                  icons={false}
                  onChange={() => {
                    aiStore.toggleUsePromptExtracted();
                  }}
                />
              </span>
            </div>
            <div
              className="toolbar__option"
              onClick={() => {
                aiStore.movePromptExtracted();
              }}
            >
              <p>Move to your prompt</p>
            </div>
          </div>

          <div className="toolbar__labeled_text_content">
            <div className="slider__header">
              <p className="slider__title">Your prompt</p>
            </div>
            <PromptTokenInput placeholder="" promptCategory="positive" />
          </div>

          <div className="toolbar__labeled_text_content">
            <div className="slider__header">
              <p className="slider__title">Your negative prompt</p>
            </div>
            <PromptTokenInput placeholder="" promptCategory="negative" />
          </div>
        </>
      ) : (
        <div>Not available to free users</div>
      )}
    </div>
  );
});

export default ToolbarPrompt;
