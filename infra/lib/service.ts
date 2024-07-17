#!/usr/bin/env node
import {
  Duration,
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy,
} from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apigwv2Integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as apigwv2Authorizers from "@aws-cdk/aws-apigatewayv2-authorizers-alpha";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const stage = scope.node.tryGetContext("stage");
    const context = scope.node.tryGetContext(stage);
    const sdServerUrl = context.serviceUrl;
    const adminUserName = context.adminUserName;
    const lineNotifyAccessToken = context.lineNotifyAccessToken;
    const servicePlan = scope.node.tryGetContext("servicePlan");

    const vpc = ec2.Vpc.fromLookup(
      this,
      "RetouchAppNetworkStack/retouchapp-vpc",
      {
        vpcName: "retouchapp-vpc",
      }
    );

    const securityGroupAppClient = ec2.SecurityGroup.fromLookupByName(
      this,
      "retouchapp-application-API-port-client",
      "retouchapp-application-API-port-client",
      vpc
    );

    // S3
    const bucket = new s3.Bucket(this, "workBucket", {
      bucketName: "retouchapp-work",
    });

    // TODO cognito と dynamoのようなユーザ管理に関するものは別スタックにする
    // DynamoDB
    const dynamoTable = new dynamodb.Table(this, "retouchappUserDB", {
      tableName: "retouchappUserDB",
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Cognito
    const userPool = new cognito.UserPool(this, "userPool", {
      selfSignUpEnabled: true,
      signInAliases: {
        username: true,
        email: true,
      },
      email: cognito.UserPoolEmail.withCognito(),
      customAttributes: {
        invitation: new cognito.StringAttribute({
          minLen: 6,
          maxLen: 6,
          mutable: true,
        }),
      },
    });
    const userPoolAppClient = userPool.addClient("appClient");
    const appClientId = userPoolAppClient.userPoolClientId;

    userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      new lambda.Function(this, "invitationCheckLambda", {
        runtime: lambda.Runtime.PYTHON_3_10,
        code: lambda.Code.fromAsset("lambda"),
        handler: "invitation_code_check.lambda_handler",
        functionName: "retouchapp-invitation-check",
        logRetention: logs.RetentionDays.FIVE_DAYS,
      })
    );

    // API-gateway
    const httpApi = new apigwv2.HttpApi(this, "api", {
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowCredentials: true,
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.HEAD,
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.POST,
        ],
        allowOrigins: ["http://localho.st:3000", "https://production-url.com"],
        maxAge: Duration.days(1),
      },
    });

    const httpAuthorizer = new apigwv2Authorizers.HttpUserPoolAuthorizer(
      "httpAuthorizer",
      userPool,
      {
        userPoolClients: [userPoolAppClient],
        identitySource: ["$request.header.Authorization"],
      }
    );

    const pillowLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "pillow",
      "arn:aws:lambda:ap-northeast-1:770693421928:layer:Klayers-p310-Pillow:2"
    );
    const numpyLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "numpy",
      "arn:aws:lambda:ap-northeast-1:770693421928:layer:Klayers-p310-numpy:1"
    );
    const pillowLayerPy38 = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "pillowPy38",
      "arn:aws:lambda:ap-northeast-1:770693421928:layer:Klayers-p38-Pillow:10"
    );
    const numpyLayerPy38 = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "numpyPy38",
      "arn:aws:lambda:ap-northeast-1:770693421928:layer:Klayers-p38-numpy:13"
    );

    const opencvLayerPy38 = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "opencv-python-headlessPy38",
      "arn:aws:lambda:ap-northeast-1:770693421928:layer:Klayers-python38-opencv-python-headless:11"
    );
    const libgthreadLayerPy38 = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "libgthreadPy38",
      "arn:aws:lambda:ap-northeast-1:770693421928:layer:Klayers-python38-libgthread-so:1"
    );

    // Lambda to control EC2
    const shutdownServerLambda = new lambda.Function(
      this,
      "shutdownServerLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_10,
        code: lambda.Code.fromAsset("lambda"),
        handler: "shutdown_server.lambda_handler",
        functionName: "retouchapp-shutdown-server",
        logRetention: logs.RetentionDays.FIVE_DAYS,
        timeout: Duration.seconds(6),
        environment: {
          DYNAMO_TABLE_NAME: dynamoTable.tableName,
          LINE_NOTIFY_ACCESS_TOKEN: lineNotifyAccessToken,
        },
      }
    );
    dynamoTable.grantReadWriteData(shutdownServerLambda);
    new events.Rule(this, "shutdownServerRule", {
      schedule: events.Schedule.cron({ minute: "0/15" }),
      targets: [
        new targets.LambdaFunction(shutdownServerLambda, { retryAttempts: 2 }),
      ],
    });

    const ec2ControlLambda = new lambda.Function(this, "ec2ControlLambda", {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset("lambda"),
      handler: "ec2control.lambda_handler",
      functionName: "ec2control",
      logRetention: logs.RetentionDays.FIVE_DAYS,
      timeout: Duration.seconds(6),
      reservedConcurrentExecutions: 1,
      environment: {
        DYNAMO_TABLE_NAME: dynamoTable.tableName,
        LINE_NOTIFY_ACCESS_TOKEN: lineNotifyAccessToken,
      },
    });
    dynamoTable.grantReadWriteData(ec2ControlLambda);
    const ec2StatusLambda = new lambda.Function(this, "ec2StatusLambda", {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset("lambda"),
      handler: "ec2status.lambda_handler",
      functionName: "ec2status",
      logRetention: logs.RetentionDays.FIVE_DAYS,
      timeout: Duration.seconds(6),
    });
    for (const ec2Lambda of [
      ec2ControlLambda,
      ec2StatusLambda,
      shutdownServerLambda,
    ]) {
      ec2Lambda.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "ec2:DescribeInstances",
            "ec2:StartInstances",
            "ec2:StopInstances",
          ],
          resources: ["*"],
        })
      );
    }

    const setAutoTerminationLambda = new lambda.Function(
      this,
      "setAutoTerminationLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_10,
        code: lambda.Code.fromAsset("lambda"),
        handler: "set_auto_termination.lambda_handler",
        functionName: "set-auto-termination",
        logRetention: logs.RetentionDays.FIVE_DAYS,
        timeout: Duration.seconds(6),
        reservedConcurrentExecutions: 1,
        environment: {
          DYNAMO_TABLE_NAME: dynamoTable.tableName,
          LINE_NOTIFY_ACCESS_TOKEN: lineNotifyAccessToken,
        },
      }
    );
    dynamoTable.grantReadWriteData(setAutoTerminationLambda);

    const preflightLambda = new lambda.Function(this, "preflightLambda", {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset("lambda"),
      handler: "preflight.lambda_handler",
      functionName: "retouchapp-preflight",
      logRetention: logs.RetentionDays.FIVE_DAYS,
    });

    const usernameLambda = new lambda.Function(this, "usernameLambda", {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset("lambda"),
      handler: "username.lambda_handler",
      functionName: "retouchapp-username",
      logRetention: logs.RetentionDays.FIVE_DAYS,
      environment: {
        DYNAMO_TABLE_NAME: dynamoTable.tableName,
        PLAN_NAME_FREE: servicePlan.planNameFree,
        FULL_CREDIT_FREE: servicePlan.fullCreditFree,
      },
    });
    dynamoTable.grantReadWriteData(usernameLambda);

    const generateLambda = new lambda.Function(this, "generateLambda", {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset("lambda"),
      handler: "generate.lambda_handler",
      functionName: "retouchapp-generate",
      logRetention: logs.RetentionDays.FIVE_DAYS,
      layers: [
        pillowLayerPy38,
        numpyLayerPy38,
        opencvLayerPy38,
        libgthreadLayerPy38,
      ],
      timeout: Duration.seconds(45),
      vpc: vpc,
      securityGroups: [securityGroupAppClient],
      environment: {
        DYNAMO_TABLE_NAME: dynamoTable.tableName,
        CREDIT_CONSUMPTION: servicePlan.creditForImageGeneration,
        SD_SERVER_URL: sdServerUrl,
      },
      reservedConcurrentExecutions: 1,
    });
    bucket.grantWrite(generateLambda.role!);
    dynamoTable.grantReadWriteData(generateLambda);

    const edgeLambda = new lambda.Function(this, "edgeLambda", {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset("lambda"),
      handler: "edge.lambda_handler",
      functionName: "retouchapp-edge",
      logRetention: logs.RetentionDays.FIVE_DAYS,
      layers: [pillowLayer, numpyLayer],
      timeout: Duration.seconds(30),
      vpc: vpc,
      securityGroups: [securityGroupAppClient],
      environment: {
        DYNAMO_TABLE_NAME: dynamoTable.tableName,
        CREDIT_CONSUMPTION: servicePlan.creditForEdgeDetection,
        SD_SERVER_URL: sdServerUrl,
      },
      reservedConcurrentExecutions: 1,
    });
    bucket.grantRead(edgeLambda.role!);
    dynamoTable.grantReadWriteData(edgeLambda);

    const appSeverStatusLambda = new lambda.Function(
      this,
      "appServerStatusLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_10,
        code: lambda.Code.fromAsset("lambda"),
        handler: "app_server_status.lambda_handler",
        functionName: "retouchapp-app-server-status",
        logRetention: logs.RetentionDays.FIVE_DAYS,
        layers: [pillowLayer, numpyLayer],
        timeout: Duration.seconds(5),
        vpc: vpc,
        securityGroups: [securityGroupAppClient],
        environment: {
          SD_SERVER_URL: sdServerUrl,
        },
      }
    );

    const refreshCreditLambda = new lambda.Function(
      this,
      "refreshCreditLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_10,
        code: lambda.Code.fromAsset("lambda"),
        handler: "refresh_credit.lambda_handler",
        functionName: "retouchapp-refresh-credit",
        logRetention: logs.RetentionDays.FIVE_DAYS,
        environment: {
          DYNAMO_TABLE_NAME: dynamoTable.tableName,
          PLAN_NAME_FREE: servicePlan.planNameFree,
          PLAN_NAME_STANDARD: servicePlan.planNameStandard,
          FULL_CREDIT_FREE: servicePlan.fullCreditFree,
          FULL_CREDIT_STANDARD: servicePlan.fullCreditStandard,
        },
      }
    );
    dynamoTable.grantReadWriteData(refreshCreditLambda);
    new events.Rule(this, "refreshCreditRule", {
      schedule: events.Schedule.cron({ minute: "5", hour: "2" }),
      targets: [
        new targets.LambdaFunction(refreshCreditLambda, { retryAttempts: 2 }),
      ],
    });

    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "preflightIntegration",
        preflightLambda
      ),
      path: "/",
      methods: [apigwv2.HttpMethod.OPTIONS],
    });

    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "usernameIntegration",
        usernameLambda
      ),
      path: "/user/username",
      methods: [apigwv2.HttpMethod.GET],
      authorizationScopes: ["aws.cognito.signin.user.admin"],
      authorizer: httpAuthorizer,
    });

    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "generateIntegration",
        generateLambda
      ),
      path: "/render/generate",
      methods: [apigwv2.HttpMethod.POST],
      authorizationScopes: ["aws.cognito.signin.user.admin"],
      authorizer: httpAuthorizer,
    });

    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "edgeIntegration",
        edgeLambda
      ),
      path: "/render/edge",
      methods: [apigwv2.HttpMethod.POST],
      authorizationScopes: ["aws.cognito.signin.user.admin"],
      authorizer: httpAuthorizer,
    });
    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "appServerStatusIntegration",
        appSeverStatusLambda
      ),
      path: "/sd-service/app-server/status",
      methods: [apigwv2.HttpMethod.GET],
      authorizationScopes: ["aws.cognito.signin.user.admin"],
      authorizer: httpAuthorizer,
    });

    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "ec2statusIntegration",
        ec2StatusLambda
      ),
      path: "/sd-service/infra/status",
      methods: [apigwv2.HttpMethod.GET],
      authorizationScopes: ["aws.cognito.signin.user.admin"],
      authorizer: httpAuthorizer,
    });
    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "ec2controlIntegration",
        ec2ControlLambda
      ),
      path: "/sd-service/infra/control",
      methods: [apigwv2.HttpMethod.POST],
      authorizationScopes: ["aws.cognito.signin.user.admin"],
      authorizer: httpAuthorizer,
    });
    httpApi.addRoutes({
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "setAutoTerminationIntegration",
        setAutoTerminationLambda
      ),
      path: "/sd-service/infra/auto-termination",
      methods: [apigwv2.HttpMethod.POST],
      authorizationScopes: ["aws.cognito.signin.user.admin"],
      authorizer: httpAuthorizer,
    });

    // output
    new CfnOutput(this, "userPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "appClientId", { value: appClientId });
    new CfnOutput(this, "apiEndpoint", { value: httpApi.apiEndpoint });
  }
}
