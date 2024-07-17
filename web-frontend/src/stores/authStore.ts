import { observable, makeObservable, action } from "mobx";

import { RootStore } from "./rootStore";
import {
  getSdServiceInfraStatusJson,
  getSdServiceAppServerStatusJson,
} from "../external/api";
import { GetUserUsernameResponseJson } from "../external/api";

export class AuthStore {
  @observable username = "";
  @observable credit = 0;
  @observable plan = "";

  @observable signOut?: () => void;

  constructor(public root: RootStore) {
    makeObservable(this);
  }

  @action setUserInfo(userInfo: GetUserUsernameResponseJson): void {
    this.username = userInfo.username;
    this.credit = userInfo.credit;
    this.plan = userInfo.plan;
  }

  @action setCredit(credit: number): void {
    this.credit = credit;
  }

  @action setSignOut(signOut?: () => void): void {
    this.signOut = signOut;
  }

  @action resetUserInfo(): void {
    this.username = "";
    this.credit = 0;
    this.plan = "";
  }

  getServerRunning = async () => {
    let status;
    let ip;
    try {
      ({ status, ip } = await getSdServiceInfraStatusJson());
    } catch (error) {
      status = "UNKNOWN";
    }

    this.root.aiStore.setServerStatus(status);
    this.root.aiStore.setServerIp(ip);

    if (status === "RUNNING") {
      await this.getAppServerStatus();
    }
  };

  getAppServerStatus = async () => {
    let status;
    try {
      status = await getSdServiceAppServerStatusJson();
    } catch (error) {
      status = "UNAVAILABLE";
    }
    this.root.aiStore.setAppServerStatus(status);
  };

  canMaintainServer(): boolean {
    return this.username === "root";
  }
  canChangeAllowedIdle(): boolean {
    return this.username === "root";
  }
  canUsePrompt(): boolean {
    return true;
  }
  canUseBatch(): boolean {
    return this.plan === "infinite";
  }
  canViewApiParameters(): boolean {
    return this.username === "root";
  }
  canViewPerformance(): boolean {
    return this.username === "root";
  }
  canViewServerIp(): boolean {
    return this.username === "root";
  }
}
