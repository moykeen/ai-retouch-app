import React, { useState } from "react";

type Props = {
  optionGroupId: string;
  options: string[];
  changeValue: (value: string) => void;
  initialSelectedIndex: number;
};

const OptionToggleSwitch: React.FC<Props> = (props) => {
  const { optionGroupId, options, changeValue, initialSelectedIndex } = props;
  const [selected, setSelected] = useState(options[initialSelectedIndex]);

  return (
    <div className="container">
      <div className="option-toggle-switches">
        {options.map((option) => {
          const uniqueId = `${optionGroupId}-${option}`;
          return (
            <div key={uniqueId}>
              <label htmlFor={uniqueId}>
                <input
                  className="option-toggle-input"
                  type="radio"
                  id={uniqueId}
                  name={optionGroupId}
                  checked={option === selected}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setSelected(option);
                    changeValue(option);
                  }}
                />
                <span className="option-toggle-tile">
                  <span className="option-toggle-label"> {option}</span>
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OptionToggleSwitch;
