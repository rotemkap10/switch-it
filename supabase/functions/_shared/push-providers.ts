import { googleAccessToken, signEs256Jwt } from "./push-jwt.ts";

export type PushSendResult = {
  ok: boolean;
  status: number;
  invalidToken: boolean;
  detail: string;
};

export type PushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
};

function tokenLooksUnregistered(status: number, body: string): boolean {
  const lower = body.toLowerCase();
  return (
    status === 404 ||
    status === 410 ||
    lower.includes("unregistered") ||
    lower.includes("notregistered") ||
    lower.includes("baddevicetoken") ||
    lower.includes("invalidregistration") ||
    lower.includes("registration-token-not-registered")
  );
}

export async function sendApnsPush(input: {
  token: string;
  bundleId: string;
  keyId: string;
  teamId: string;
  privateKeyPem: string;
  production: boolean;
  message: PushMessage;
}): Promise<PushSendResult> {
  const jwt = await signEs256Jwt({
    privateKeyPem: input.privateKeyPem,
    keyId: input.keyId,
    issuer: input.teamId,
  });
  const host = input.production
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
  const response = await fetch(
    `https://${host}/3/device/${input.token}`,
    {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": input.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: {
          alert: {
            title: input.message.title,
            body: input.message.body,
          },
          sound: "default",
        },
        ...input.message.data,
      }),
    },
  );
  const detail = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    invalidToken: tokenLooksUnregistered(response.status, detail),
    detail: detail.slice(0, 300),
  };
}

export async function sendFcmPush(input: {
  token: string;
  projectId: string;
  clientEmail: string;
  privateKeyPem: string;
  message: PushMessage;
}): Promise<PushSendResult> {
  const accessToken = await googleAccessToken({
    clientEmail: input.clientEmail,
    privateKeyPem: input.privateKeyPem,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  });
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${input.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: input.token,
          notification: {
            title: input.message.title,
            body: input.message.body,
          },
          data: input.message.data,
          android: {
            priority: "HIGH",
            notification: {
              channelId: "switch_it_handoff",
              sound: "default",
            },
          },
        },
      }),
    },
  );
  const detail = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    invalidToken: tokenLooksUnregistered(response.status, detail),
    detail: detail.slice(0, 300),
  };
}

export async function sendPushToDevice(input: {
  platform: "ios" | "android";
  token: string;
  message: PushMessage;
}): Promise<PushSendResult> {
  if (input.platform === "ios") {
    const keyId = Deno.env.get("APNS_KEY_ID") ?? "";
    const teamId = Deno.env.get("APNS_TEAM_ID") ?? "";
    const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "il.ac.runi.switchit";
    const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
    const production = (Deno.env.get("APNS_PRODUCTION") ?? "false") === "true";
    if (!keyId || !teamId || !privateKeyPem) {
      return {
        ok: false,
        status: 0,
        invalidToken: false,
        detail: "apns_not_configured",
      };
    }
    return sendApnsPush({
      token: input.token,
      bundleId,
      keyId,
      teamId,
      privateKeyPem,
      production,
      message: input.message,
    });
  }

  const projectId = Deno.env.get("FCM_PROJECT_ID") ?? "";
  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL") ?? "";
  const privateKeyPem = Deno.env.get("FCM_PRIVATE_KEY") ?? "";
  if (!projectId || !clientEmail || !privateKeyPem) {
    return {
      ok: false,
      status: 0,
      invalidToken: false,
      detail: "fcm_not_configured",
    };
  }
  return sendFcmPush({
    token: input.token,
    projectId,
    clientEmail,
    privateKeyPem,
    message: input.message,
  });
}
