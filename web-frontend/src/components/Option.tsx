import React from "react";

type Props = {
  value: string;
  selected: boolean;
  index: number;
  handleSelect: (index: number) => void;

  handleClick: () => void;
};

const Option: React.FC<Props> = (props) => {
  const { value, selected, index, handleSelect, handleClick } = props;

  const onMouseEnter = () => {
    handleSelect(index);
  };

  const onClick = () => {
    handleClick();
  };

  return (
    <div
      className={`prompt-token__option ${
        selected ? "prompt-token__option__selected" : ""
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {value}
    </div>
  );
};

export default Option;
