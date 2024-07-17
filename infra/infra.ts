#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { NetworkStack } from "./lib/network";
import { ServiceStack } from "./lib/service";

const app = new cdk.App();

const stage = app.node.tryGetContext("stage");
const context = app.node.tryGetContext(stage);

new NetworkStack(app, "RetouchAppNetworkStack");
new ServiceStack(app, "RetouchAppServiceStack", {
  env: {
    account: context.account,
    region: context.region,
  },
});
