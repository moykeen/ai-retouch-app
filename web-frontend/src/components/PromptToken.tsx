import React from "react";

import { observer } from "mobx-react-lite";
import { AiFillCloseCircle as Remove } from "react-icons/ai";
import { AiFillEye as Enabled } from "react-icons/ai";
import { AiFillEyeInvisible as Disabled } from "react-icons/ai";
import { AiOutlineArrowUp as Up } from "react-icons/ai";
import { AiOutlineArrowDown as Down } from "react-icons/ai";

import { Prompt } from "../stores/aiStore";

type Props = {
  handleRemove: (index: number) => void;
  handleToggleEnabled: (index: number) => void;
  handleIncreaseWeight: (index: number) => void;
  handleDecreaseWeight: (index: number) => void;
  index: number;
  prompt: Prompt;
};

const PromptToken: React.FC<Props> = observer((props) => {
  const {
    handleRemove,
    handleToggleEnabled,
    handleIncreaseWeight,
    handleDecreaseWeight,
    index,
    prompt,
  } = props;

  const getWeightClass = () => {
    const v = Math.round((prompt.weight - 1) * 100);
    return v.toString();
  };

  return (
    <div
      className={`prompt-token__token-wrapper  ${
        !prompt.enabled
          ? "prompt-token__token-wrapper__disabled"
          : "prompt-token__token-wrapper__prompt-weighted" + getWeightClass()
      }`}
    >
      <div className="prompt-token__token-value">{prompt.value}</div>
      <div
        className="prompt-token__token-disable-button"
        onClick={() => {
          handleToggleEnabled(index);
        }}
      >
        {prompt.enabled ? <Enabled /> : <Disabled />}
      </div>
      <div
        className="prompt-token__token-up-button"
        onClick={() => {
          handleIncreaseWeight(index);
        }}
      >
        <Up />
      </div>
      <div
        className="prompt-token__token-down-button"
        onClick={() => {
          handleDecreaseWeight(index);
        }}
      >
        <Down />
      </div>
      <div
        className="prompt-token__token-remove-button"
        onClick={() => {
          handleRemove(index);
        }}
      >
        <Remove />
      </div>
    </div>
  );
});

export default PromptToken;
