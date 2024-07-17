import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";

import Option from "./Option";

type Props = {
  options: string[];
  //   term: string;
  handleAddSelected: () => void;
};

const OptionList = forwardRef<{ getSelected: () => string }, Props>(
  function optionList(props: Props, ref) {
    const { options, handleAddSelected } = props;

    const emptyInfo = "(no suggestions)";

    const [selected, setSelected] = useState(0);

    useEffect(() => {
      if (window) {
        window.addEventListener("keydown", onKeyDown);
      }
    }, []);

    useEffect(() => {
      return () => {
        // console.log("componentWillUnmount OptionList");
        if (window) {
          window.removeEventListener("keydown", onKeyDown);
        }
      };
    }, []);

    // TOOD 必要？
    //   componentWillReceiveProps(newProps) {
    //     if (newProps.options.length <= this.state.selected) {
    //       this.setState({ selected: newProps.options.length - 1 });
    //     }
    //     if (!newProps.options.length) {
    //       this.setState({ selected: 0 });
    //     }
    //   }

    const onKeyDown = (e: any) => {
      switch (e.key) {
        case "Up":
          selectPrev();
          e.preventDefault();
          break;
        case "Down":
          selectNext();
          e.preventDefault();
          break;
      }
    };

    const renderOption = (option: string, index: number) => {
      return (
        <Option
          key={index}
          index={index}
          handleClick={handleAddSelected}
          handleSelect={handleSelect}
          value={option}
          selected={index === selected}
        />
      );
    };

    const renderOptions = () => {
      return options.map((option: string, index: number) => {
        return renderOption(option, index);
      });
    };

    const selectNext = () => {
      setSelected(selected === options.length - 1 ? 0 : selected + 1);
    };

    const selectPrev = () => {
      setSelected(!selected ? options.length - 1 : selected - 1);
    };

    const handleSelect = (index: number) => {
      setSelected(index);
    };

    // 親から呼ばれる関数を定義
    useImperativeHandle(ref, () => ({
      getSelected() {
        return options[selected];
      },
    }));

    const renderEmptyInfo = () => {
      return <div>{emptyInfo}</div>;
    };

    return (
      <div className="prompt-token__option-list">
        {!options.length ? renderEmptyInfo() : renderOptions()}
      </div>
    );
  }
);

export default OptionList;
