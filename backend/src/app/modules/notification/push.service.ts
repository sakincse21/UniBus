import https from "https";
import { AppDataSource } from "../../db/data-source";
import { env } from "../../config/env";
import { User } from "../user/user.entity";

type PushRecipient = Pick<User, "user_id" | "pushToken">;

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: "default";
  channelId?: string;
  priority: "high";
  ttl?: number;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  details?: {
    error?: string;
  };
};

const EXPO_PUSH_ENDPOINT = new URL("https://exp.host/--/api/v2/push/send");
const EXPO_PUSH_TOKEN_REGEX = /^(Expo|Exponent)PushToken\[[^\]]+\]$/;
const EXPO_MAX_MESSAGES_PER_REQUEST = 100;

function chunkMessages<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function maskExpoToken(token: string): string {
  if (token.length <= 12) return token;
  return `${token.slice(0, 12)}...${token.slice(-6)}`;
}

function sendExpoPushChunk(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  if (!messages.length) return Promise.resolve([]);

  const payload = JSON.stringify(messages);

  return new Promise((resolve, reject) => {
    const headers: Record<string, string | number> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": Buffer.byteLength(payload),
    };

    if (env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
    }

    const request = https.request(
      {
        method: "POST",
        protocol: EXPO_PUSH_ENDPOINT.protocol,
        hostname: EXPO_PUSH_ENDPOINT.hostname,
        port: EXPO_PUSH_ENDPOINT.port || 443,
        path: `${EXPO_PUSH_ENDPOINT.pathname}${EXPO_PUSH_ENDPOINT.search}`,
        headers,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          const statusCode = response.statusCode ?? 0;

          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new Error(
                `Expo push request failed with status ${statusCode}: ${body}`,
              ),
            );
            return;
          }

          try {
            const parsed = JSON.parse(body) as { data?: ExpoPushTicket[] };
            resolve(Array.isArray(parsed.data) ? parsed.data : []);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.write(payload);
    request.end();
  });
}

function getValidTokens(recipients: PushRecipient[]): string[] {
  const deduped = new Set<string>();

  recipients.forEach((recipient) => {
    const token = recipient.pushToken?.trim();

    if (!token) {
      return;
    }

    if (!EXPO_PUSH_TOKEN_REGEX.test(token)) {
      return;
    }

    deduped.add(token);
  });

  return [...deduped];
}

async function clearInvalidTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;

  await AppDataSource.getRepository(User)
    .createQueryBuilder()
    .update(User)
    .set({ pushToken: null })
    .where("pushToken IN (:...tokens)", { tokens })
    .execute();
}

export async function sendPushToUsers(
  recipients: PushRecipient[],
  payload: PushPayload,
): Promise<number> {
  const tokens = getValidTokens(recipients);
  if (!tokens.length) return 0;

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default",
    channelId: payload.channelId || "default",
    priority: "high",
    ttl: 3600,
  }));

  let deliveredCount = 0;
  const invalidTokens = new Set<string>();

  const chunks = chunkMessages(messages, EXPO_MAX_MESSAGES_PER_REQUEST);
  for (const chunk of chunks) {
    try {
      const tickets = await sendExpoPushChunk(chunk);

      tickets.forEach((ticket, index) => {
        const token = chunk[index]?.to;

        if (ticket.status === "ok") {
          deliveredCount += 1;
          return;
        }

        if (
          ticket.status === "error" &&
          typeof token === "string" &&
          ticket.details?.error === "DeviceNotRegistered"
        ) {
          invalidTokens.add(token);
          return;
        }

        if (ticket.status === "error") {
          console.warn("Expo push ticket error:", {
            error: ticket.details?.error || "unknown",
            token: typeof token === "string" ? maskExpoToken(token) : undefined,
          });
        }
      });
    } catch (error) {
      console.error("Expo push send failed:", error);
    }
  }

  if (invalidTokens.size > 0) {
    try {
      await clearInvalidTokens([...invalidTokens]);
    } catch (error) {
      console.error("Failed to clear invalid Expo tokens:", error);
    }
  }

  return deliveredCount;
}