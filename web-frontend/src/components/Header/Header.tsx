import React from "react";

import { observer } from "mobx-react-lite";

import LayerControl from "./LayerControl";
import RedoButton from "./RedoButton";
import UndoButton from "./UndoButton";
import ZoomControl from "./ZoomControl";
import useStore from "../../hooks/useStore";

const Header: React.FC = observer(() => {
  const { uiStore } = useStore();
  return (
    <header
      className={`header ${uiStore.isToolbarOpen ? "header_toolbar-open" : ""}`}
    >
      <div className="header__items">
        <div className="header__items-group">
          <div className="header__item">
            <UndoButton />
          </div>
          <div className="header__item">
            <RedoButton />
          </div>
        </div>
        <div className="header__items-group">
          <div className="header__item">
            <ZoomControl />
          </div>
        </div>
        <div className="header__items-group">
          <div className="header__item">
            <LayerControl />
          </div>
        </div>
      </div>
    </header>
  );
});

export default Header;
