import React from "react";

import RcSlider from "rc-slider";
import "rc-slider/assets/index.css";

type Props = {
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  startPoint?: number;
  marks?: any;
  disabled?: boolean;
  renderIcon?: () => JSX.Element;
  callback: (value: number) => void;
};

const Slider: React.FC<Props> = (props) => {
  const {
    title,
    value,
    min,
    max,
    step = 1,
    startPoint = 0,
    marks = {},
    callback,
    disabled,
  } = props;

  // TODO gray-out RCSlider itself, when disabled
  return (
    <div className="toolbar__block">
      <div className={`slider__header ${disabled ? "slider__disabled" : ""}`}>
        <p className={`slider__title ${disabled ? "slider__disabled" : ""}`}>
          {title}
        </p>
        <span className={`slider__input ${disabled ? "slider__disabled" : ""}`}>
          {value}
        </span>
      </div>
      <RcSlider
        value={value}
        min={min}
        max={max}
        startPoint={startPoint}
        step={step}
        onChange={(num) => callback(num as number)}
        // onChange={num => callbackWrapped(num)}
        marks={marks}
      />
    </div>
  );
};

export default Slider;
