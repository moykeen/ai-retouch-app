import React, { useRef, useState, useEffect } from "react";

import { observer } from "mobx-react-lite";

import OptionList from "./OptionList";
import PromptToken from "./PromptToken";
import useStore from "../hooks/useStore";
import { PromptData } from "../stores/aiStore";

type Props = {
  placeholder: string;
  promptCategory: keyof PromptData;
};

const PromptTokenInput: React.FC<Props> = observer((props) => {
  const { placeholder, promptCategory } = props;
  const { aiStore } = useStore();

  const options = aiStore.getOptions(promptCategory);

  const input = useRef<HTMLInputElement>(null);
  const optionList = useRef<{ getSelected: () => string }>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const limitToOptions = false;
  const threshold = 50;
  const filterOptions = true;

  useEffect(() => {
    if (window) {
      window.addEventListener("click", handleClick);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (window) {
        window.removeEventListener("click", handleClick);
      }
    };
  }, []);

  const bindListeners = () => {
    window.addEventListener("keydown", onKeyDown);
  };

  const unbindListeners = () => {
    window.removeEventListener("keydown", onKeyDown);
  };

  const onInputChange = (e: any) => {
    setInputValue(e.target.value);
  };

  const onKeyDown = (e: any) => {
    // console.log(e.key);
    switch (e.key) {
      case "Escape":
        blur();
        break;
      case "Enter":
        addSelectedValue();
        break;

      //   // TODO 誤って消すとundoできないので保留。他のフィールドのトークン消してしまうバグもある
      //   case "Backspace":
      //     if (!input.current?.value.length) {
      //       setInputValue(inputValue.slice(0, -1));
      //       deleteValue(aiStore.prompts[promptCategory].length - 1);
      //       e.preventDefault();
      //     }
      //     break;
    }
  };

  const handleClick = (e: any) => {
    const clickedOutside = !wrapper.current?.contains(e.target);
    if (clickedOutside) {
      blur();
    }
    if (!clickedOutside && !focused) {
      gainFocus();
    }
  };

  const gainFocus = () => {
    if (input.current) {
      input.current.focus();
    }
    bindListeners();
    setFocused(true);
  };

  const blur = () => {
    if (input.current) {
      input.current.blur();
    }
    unbindListeners();
    setFocused(false);
  };

  const deleteValue = (index: number) => {
    aiStore.removePrompt(promptCategory, index);
  };

  const toggleEnabled = (index: number) => {
    aiStore.togglePromptEnabled(promptCategory, index);
  };

  const increaseWeight = (index: number) => {
    aiStore.increasePromptWeight(promptCategory, index, 0.2);
  };
  const decreaseWeight = (index: number) => {
    aiStore.increasePromptWeight(promptCategory, index, -0.2);
  };

  const addSelectedValue = () => {
    const newValue = optionList.current?.getSelected();

    if (newValue) {
      const values = aiStore.prompts[promptCategory].map((p) => p.value);
      const isAlreadySelected = values.includes(newValue);
      if (!isAlreadySelected) {
        aiStore.addPrompt(promptCategory, newValue);
        setInputValue("");
      }
    }
  };

  //HELPERS

  const getAvailableOptions = () => {
    let availableOptions = [];
    const values = aiStore.prompts[promptCategory].map((p) => p.value);
    availableOptions = options.filter((x) => !values.includes(x));
    availableOptions = availableOptions.filter((option) =>
      option.includes(inputValue)
    );

    if (
      shouldAllowCustomValue() &&
      inputValue.length &&
      !availableOptions.includes(inputValue)
    ) {
      availableOptions.unshift(inputValue);
    }

    return availableOptions;
  };

  const shouldAllowCustomValue = () => {
    return !limitToOptions;
  };

  const shouldShowOptions = () => {
    return focused;
  };

  const isThresholdReached = () => {
    return inputValue.length >= threshold;
  };

  const renderOptionsDropdown = () => {
    const show = shouldShowOptions();
    if (show) {
      const passProps = {
        options: getAvailableOptions(),
        handleAddSelected: addSelectedValue,
      };
      return <OptionList ref={optionList} {...passProps} />;
    }
  };

  const renderTokens = () => {
    const prompts = aiStore.prompts[promptCategory];
    return prompts.map((value, key) => {
      return (
        <PromptToken
          key={key}
          index={key}
          prompt={value}
          handleRemove={deleteValue}
          handleToggleEnabled={toggleEnabled}
          handleIncreaseWeight={increaseWeight}
          handleDecreaseWeight={decreaseWeight}
        />
      );
    });
  };

  const renderInput = () => {
    return (
      <input
        className="prompt-token__input"
        onChange={onInputChange}
        value={inputValue}
        placeholder={placeholder}
        ref={input}
      />
    );
  };

  return (
    <div ref={wrapper} className="prompt-token__wrapper">
      <div className="prompt-token__input-wrapper">
        {renderTokens()}
        {renderInput()}
        {/* MobXで配列の要素のプロパティ変化が検知されない問題に対応するハック */}
        {aiStore.dummyForForceObserving ? "" : ""}
      </div>
      {renderOptionsDropdown()}
    </div>
  );
});

export default PromptTokenInput;
