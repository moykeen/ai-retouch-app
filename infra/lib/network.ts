#!/usr/bin/env node
import { Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cidr = "10.0.0.0/16";

    // VPC
    const vpc = new ec2.Vpc(this, "retouchapp-vpc", {
      vpcName: "retouchapp-vpc",
      ipAddresses: ec2.IpAddresses.cidr(cidr),
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "retouchapp-public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "retouchapp-private-subnet",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // VPC-endpoint for S3
    vpc.addGatewayEndpoint("S3EndpointForIsolatedSubnet", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });

    // VPC-endpoint for DynamoDB
    vpc.addGatewayEndpoint("DynamoDBEndpointForIsolatedSubnet", {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });

    const securityGroupAppClient = new ec2.SecurityGroup(
      this,
      "retouchapp-application-API-port-client",
      { vpc, securityGroupName: "retouchapp-application-API-port-client" }
    );
    const securityGroupAppServer = new ec2.SecurityGroup(
      this,
      "retouchapp-application-API-port-server",
      { vpc, securityGroupName: "retouchapp-application-API-port-server" }
    );
    securityGroupAppServer.addIngressRule(
      ec2.Peer.ipv4(cidr),
      ec2.Port.tcp(7861),
      "allow application API"
    );
    securityGroupAppServer.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(7860),
      "allow application API"
    );
    securityGroupAppServer.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "allow application API"
    );
  }
}
