import React, { useState } from "react";

type Props = {
  options: string[];
  changeValue: (value: string) => void;
  initialSelectedIndex: number;
};

const ModeToggleSwitch: React.FC<Props> = (props) => {
  const { options, changeValue, initialSelectedIndex } = props;
  const radioName = options.join("");
  const [selected, setSelected] = useState(options[initialSelectedIndex]);

  return (
    <div className="container">
      <div className="mode-toggle-switches">
        {options.map((option) => {
          return (
            <div key={option}>
              <input
                type="radio"
                id={option}
                name={radioName}
                checked={option === selected}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setSelected(option);
                  changeValue(option);
                }}
              />
              <label className="mode-toggle-switch" htmlFor={option}>
                {option}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModeToggleSwitch;
