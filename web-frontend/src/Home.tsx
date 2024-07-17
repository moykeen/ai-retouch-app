import React, { useEffect } from "react";
import Alert from "react-s-alert";

import { AmplifyUser } from "@aws-amplify/ui";
import * as tf from "@tensorflow/tfjs";

import Canvas from "./components/Canvas";
import Header from "./components/Header/Header";
import Menu from "./components/Menu";
import Preview from "./components/Preview";
import Toolbar from "./components/Toolbar/Toolbar";
import { getUserUsernameJson } from "./external/api";
import { WEBGL_DELETE_TEXTURE_THRESHOLD } from "./helpers/imageManipulator";
import useStore from "./hooks/useStore";
import "react-s-alert/dist/s-alert-default.css";

type Props = {
  user?: AmplifyUser;
  signOut?: () => void;
};

const Home: React.FC<Props> = (props) => {
  const { user, signOut } = props;

  const { authStore } = useStore();
  useEffect(() => {
    tf.env().set(
      "WEBGL_DELETE_TEXTURE_THRESHOLD",
      WEBGL_DELETE_TEXTURE_THRESHOLD
    );

    (async () => {
      authStore.setUserInfo(await getUserUsernameJson());
      await authStore.getServerRunning();
    })();
    authStore.setSignOut(signOut);
  }, []);

  return (
    <div className="app">
      <Header />
      <Preview />
      <Menu />
      <Toolbar />
      <Canvas />
      <Alert stack={{ limit: 1 }} timeout={5000} />
    </div>
  );
};

export default Home;
