import { Auth } from "aws-amplify";

const getHeaders = async () => {
  const session = await Auth.currentSession();
  const accessToken = session.getAccessToken();
  return {
    Authorization: accessToken.getJwtToken(),
  };
};

const checkResponse = (response: Response) => {
  if (!response.ok) {
    throw new Error("API Error");
  }
};

export type GetUserUsernameResponseJson = {
  username: string;
  credit: number;
  plan: string;
};

export const getUserUsernameJson =
  async (): Promise<GetUserUsernameResponseJson> => {
    const response = await fetch(
      `${process.env.REACT_APP_API_ENDPOINT}/user/username`,
      {
        method: "get",
        headers: await getHeaders(),
      }
    );
    checkResponse(response);
    return await response.json();
  };

export type PostRenderEdgeBodyData = string;

export const postRenderEdgeJson = async (
  body: PostRenderEdgeBodyData,
  abortSignal?: AbortSignal
) => {
  const response = await fetch(
    `${process.env.REACT_APP_API_ENDPOINT}/render/edge`,
    {
      method: "post",
      body: body,
      headers: await getHeaders(),
      signal: abortSignal,
    }
  );
  checkResponse(response);
  return await response.json();
};

export type PostRenderGenerateBodyData = {
  sampler: string;
  steps: number;
  seed: number;
  maskBlur: number;
  cfgScale: number;
  denosing: number;
  initialNoiseMultiplier: number;
  controlMode: number;
  controlWeight: number;
  referenceControlMode: number;
  referenceControlWeight: number;
  inpaintingFill: number;
  width: number;
  height: number;
  positivePrompt: string;
  negativePrompt: string;
  antiGlareFilterFlag: number;
  antiGlareFilterSigmaS: number;
  antiGlareFilterSigmaR: number;
  imageData: string;
  maskData: string;
  edgeData: string;
  useEdge: boolean;
  useReference: boolean;
  useAnotherImageForReference: boolean;
  referenceImageData: string;
};

export const postRenderGenerateJson = async (
  renderGenerateBodyData: PostRenderGenerateBodyData,
  abortSignal?: AbortSignal
) => {
  const response = await fetch(
    `${process.env.REACT_APP_API_ENDPOINT}/render/generate`,
    {
      method: "post",
      body: JSON.stringify(renderGenerateBodyData),
      headers: await getHeaders(),
      signal: abortSignal,
    }
  );
  checkResponse(response);
  return await response.json();
};

export const getSdServiceInfraStatusJson = async () => {
  const response = await fetch(
    `${process.env.REACT_APP_API_ENDPOINT}/sd-service/infra/status`,
    {
      method: "get",
      headers: await getHeaders(),
    }
  );
  checkResponse(response);
  return await response.json();
};

export const getSdServiceAppServerStatusJson = async () => {
  const response = await fetch(
    `${process.env.REACT_APP_API_ENDPOINT}/sd-service/app-server/status`,
    {
      method: "get",
      headers: await getHeaders(),
    }
  );
  checkResponse(response);
  return await response.json();
};

export type PostSdServiceInfraControlBodyData = "stop" | "start";

export const postSdServiceInfraControlJson = async (
  body: PostSdServiceInfraControlBodyData
) => {
  const response = await fetch(
    `${process.env.REACT_APP_API_ENDPOINT}/sd-service/infra/control`,
    {
      method: "post",
      headers: await getHeaders(),
      body: body,
    }
  );
  checkResponse(response);
  return await response.json();
};

export type PostSdServiceInfraAutoTerminationBodyData = {
  duration: number;
};

export const postSdServiceInfraAutoTerminationJson = async (
  body: PostSdServiceInfraAutoTerminationBodyData
) => {
  const response = await fetch(
    `${process.env.REACT_APP_API_ENDPOINT}/sd-service/infra/auto-termination`,
    {
      method: "post",
      headers: await getHeaders(),
      body: JSON.stringify(body),
    }
  );
  checkResponse(response);
  return await response.json();
};
