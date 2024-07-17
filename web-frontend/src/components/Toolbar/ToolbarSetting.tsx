import React, { useState } from "react";
import { JsonView } from "react-json-view-lite";

import * as tf from "@tensorflow/tfjs";
import { observer } from "mobx-react-lite";

import "react-json-view-lite/dist/index.css";
import { ReactComponent as InProgress } from "../../assets/loader.svg";
import { ReactComponent as SignOut } from "../../assets/window-close-icon.svg";
import {
  postSdServiceInfraControlJson,
  postSdServiceInfraAutoTerminationJson,
} from "../../external/api";
import useStore from "../../hooks/useStore";
import Tooltip from "../Tooltip";

const ToolbarSetting: React.FC = observer(() => {
  const { authStore, aiStore } = useStore();

  const [serverRunningQueryInProgress, setServerRunningQueryInProgress] =
    useState(false);
  const [changeServerRunningInProgress, setChangeServerRunningInProgress] =
    useState(false);

  const getServerRunningWithProgress = async () => {
    setServerRunningQueryInProgress(true);
    await authStore.getServerRunning();
    setServerRunningQueryInProgress(false);
  };

  const serverShouldStop = () => {
    return (
      aiStore.serverStatus === "RUNNING" ||
      aiStore.serverStatus === "PENDING" ||
      aiStore.serverStatus === "STOPPING"
    );
  };

  const changeServerRunning = async () => {
    setChangeServerRunningInProgress(true);
    await postSdServiceInfraControlJson(serverShouldStop() ? "stop" : "start");

    // check server status
    for (let i = 0; i < 7; i++) {
      await getServerRunningWithProgress();

      if (
        aiStore.serverStatus === "RUNNING" ||
        aiStore.serverStatus === "STOPPED"
      )
        break;

      await new Promise((resolve) => setTimeout(resolve, 7000));
    }

    setChangeServerRunningInProgress(false);
    return;
  };

  const shouldShowServerControl = () => {
    if (authStore.canMaintainServer()) {
      return aiStore.serverStatus !== "UNKNOWN";
    }
    return aiStore.serverStatus === "STOPPED";
  };

  const copyIp = async () => {
    if (aiStore.serverIp) {
      try {
        await navigator.clipboard.writeText(aiStore.serverIp);
      } catch (error) {
        console.log("could not copy to clipboard");
      }
    }
  };

  const setAutoTermination = async (duration: number) => {
    try {
      await postSdServiceInfraAutoTerminationJson({ duration: duration });
    } catch (error) {
      console.log("failed");
    }
  };

  const getPerformance = () => {
    return tf.memory();
  };

  return (
    <div className="toolbar__content">
      <div className="toolbar__block">
        <div className="slider__header">
          <p className="slider__title">Your ID</p>
          <span className="slider__input">
            {authStore.username.slice(0, 8)}
          </span>
        </div>
        <div className="slider__header">
          <p className="slider__title">Plan</p>
          <span className="slider__input">{authStore.plan}</span>
        </div>
        <div className="slider__header">
          <p className="slider__title">Remaining credit</p>
          <span className="slider__input">{authStore.credit}</span>
        </div>

        <div
          className="toolbar__option"
          onClick={() => {
            authStore.signOut?.();
            authStore.resetUserInfo();
          }}
        >
          <SignOut />
          <p> Sign Out</p>
        </div>
      </div>
      <div className="toolbar__block">
        <div className="slider__header">
          <p className="slider__title">Server</p>
          <span className="slider__input">{aiStore.serverStatus}</span>
        </div>
        {aiStore.serverStatus === "RUNNING" && (
          <div className="slider__header">
            <p className="slider__title">App Server</p>
            <span className="slider__input">{aiStore.appServerStatus}</span>
          </div>
        )}
        {aiStore.serverStatus === "RUNNING" && authStore.canViewServerIp() && (
          <div className="slider__header">
            <p className="slider__title">IP</p>
            <Tooltip content="click to copy" placement="bottom">
              <span className="slider__input" onClick={copyIp}>
                {aiStore.serverIp || "not assigned"}
              </span>
            </Tooltip>
          </div>
        )}
        <div className="toolbar__option" onClick={getServerRunningWithProgress}>
          <p>Check status</p>
          {serverRunningQueryInProgress && <InProgress />}
        </div>
      </div>
      {shouldShowServerControl() && (
        <div className="toolbar__block">
          <div className="toolbar__option" onClick={changeServerRunning}>
            <p>
              {serverShouldStop() ? "Stop server" : "Request starting server"}
            </p>
            {changeServerRunningInProgress && <InProgress />}
          </div>
        </div>
      )}

      {authStore.canChangeAllowedIdle() && (
        <div className="toolbar__block">
          <div className="slider__header">
            <p className="slider__title">Auto termination</p>
          </div>
          <div className="toolbar__composite_wrapper">
            <div
              className={`toolbar__option`}
              onClick={async () => {
                await setAutoTermination(40 * 60);
              }}
            >
              40min.
            </div>
            <div
              className={`toolbar__option`}
              onClick={async () => {
                await setAutoTermination(24 * 60 * 60);
              }}
            >
              1day
            </div>
          </div>
        </div>
      )}
      {authStore.canViewApiParameters() && (
        <JsonView
          data={aiStore.lastGenerationParams}
          shouldExpandNode={() => false}
        />
      )}

      {authStore.canViewPerformance() && (
        <JsonView data={getPerformance()} shouldExpandNode={() => false} />
      )}
    </div>
  );
});

export default ToolbarSetting;
