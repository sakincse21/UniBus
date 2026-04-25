import fs from "fs";
import { env } from "./app/config/env";
import { analyzeRoutineImage } from "./app/modules/routine/gemini.service";
import { analyzeRoutineImageWithGroq } from "./app/modules/routine/groq.service";
import { analyzeRoutineImageWithOllama } from "./app/modules/routine/ollama.service";

type MockResponseInput = {
  ok?: boolean;
  status?: number;
  jsonData?: unknown;
  textData?: string;
};

function createMockResponse({
  ok = true,
  status = 200,
  jsonData = {},
  textData = "",
}: MockResponseInput): Response {
  return {
    ok,
    status,
    json: async () => jsonData,
    text: async () => textData,
  } as unknown as Response;
}

describe("Routine service layer unit tests", () => {
  const originalFetch = global.fetch;
  const originalGroqApiKey = env.GROQ_API_KEY;
  const originalOpenRouterApiKey = env.OPENROUTER_API_KEY;

  let readFileSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    readFileSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.from("fake-image-bytes") as any,
    );
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

    (global as any).fetch = jest.fn();

    env.GROQ_API_KEY = "test-groq-key";
    env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  afterEach(() => {
    readFileSpy.mockRestore();
    logSpy.mockRestore();
  });

  afterAll(() => {
    (global as any).fetch = originalFetch;
    env.GROQ_API_KEY = originalGroqApiKey;
    env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  });

  describe("analyzeRoutineImageWithGroq", () => {
    it("parses fenced JSON, filters invalid slots, and clamps confidence", async () => {
      const fetchMock = global.fetch as unknown as jest.Mock;
      fetchMock.mockResolvedValue(
        createMockResponse({
          jsonData: {
            choices: [
              {
                message: {
                  content: [
                    {
                      type: "text",
                      text: "```json\n[\n  {\"day\":\"sunday\",\"firstHalfStart\":\"08:00\",\"secondHalfStart\":\"14:30\",\"confidence\":2,\"note\":\"ok\"},\n  {\"day\":\"holiday\",\"firstHalfStart\":\"09:00\",\"secondHalfStart\":\"\",\"confidence\":0.4,\"note\":\"invalid day\"},\n  {\"day\":\"monday\",\"firstHalfStart\":\"8:00\",\"secondHalfStart\":\"\",\"confidence\":0.3,\"note\":\"invalid time\"},\n  {\"day\":\"thursday\",\"firstHalfStart\":\"10:00\",\"secondHalfStart\":\"\",\"confidence\":-5,\"note\":\"only morning\"}\n]\n```",
                    },
                  ],
                },
              },
            ],
          },
        }),
      );

      const result = await analyzeRoutineImageWithGroq("/tmp/routine.jpg");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        day: "sunday",
        firstHalfStart: "08:00",
        secondHalfStart: "14:30",
        confidence: 1,
      });
      expect(result[1]).toMatchObject({
        day: "thursday",
        firstHalfStart: "10:00",
        secondHalfStart: "",
        confidence: 0,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.groq.com/openai/v1/chat/completions",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("fails early when GROQ_API_KEY is missing", async () => {
      const fetchMock = global.fetch as unknown as jest.Mock;
      env.GROQ_API_KEY = "";

      await expect(analyzeRoutineImageWithGroq("/tmp/routine.jpg")).rejects.toThrow(
        "GROQ_API_KEY is not configured",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns timeout error on AbortError", async () => {
      const fetchMock = global.fetch as unknown as jest.Mock;
      fetchMock.mockRejectedValue({ name: "AbortError" });

      await expect(analyzeRoutineImageWithGroq("/tmp/routine.jpg")).rejects.toThrow(
        "Routine analysis request timed out with Groq",
      );
    });
  });

  describe("analyzeRoutineImage (OpenRouter)", () => {
    it("parses response and filters invalid entries", async () => {
      const fetchMock = global.fetch as unknown as jest.Mock;
      fetchMock.mockResolvedValue(
        createMockResponse({
          jsonData: {
            choices: [
              {
                message: {
                  content:
                    "```json\n[{\"day\":\"monday\",\"firstHalfStart\":\"09:00\",\"secondHalfStart\":\"15:00\",\"confidence\":1.2,\"note\":\"both\"},{\"day\":\"sunday\",\"firstHalfStart\":\"09:60\",\"secondHalfStart\":\"\",\"confidence\":0.5,\"note\":\"bad time\"}]\n```",
                },
              },
            ],
          },
        }),
      );

      const result = await analyzeRoutineImage("/tmp/routine.png");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        day: "monday",
        firstHalfStart: "09:00",
        secondHalfStart: "15:00",
        confidence: 1,
      });
    });

    it("throws API error when OpenRouter responds non-2xx", async () => {
      const fetchMock = global.fetch as unknown as jest.Mock;
      fetchMock.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 502,
          textData: "bad gateway",
        }),
      );

      await expect(analyzeRoutineImage("/tmp/routine.png")).rejects.toThrow(
        "OpenRouter API error (502): bad gateway",
      );
    });
  });

  describe("analyzeRoutineImageWithOllama", () => {
    it("parses fenced JSON and clamps confidence values", async () => {
      const fetchMock = global.fetch as unknown as jest.Mock;
      fetchMock.mockResolvedValue(
        createMockResponse({
          jsonData: {
            response:
              "```json\n[{\"day\":\"wednesday\",\"firstHalfStart\":\"10:30\",\"secondHalfStart\":\"\",\"confidence\":-2,\"note\":\"morning only\"}]\n```",
          },
        }),
      );

      const result = await analyzeRoutineImageWithOllama("/tmp/routine.webp");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        day: "wednesday",
        firstHalfStart: "10:30",
        secondHalfStart: "",
        confidence: 0,
      });
    });

    it("returns timeout error on AbortError", async () => {
      const fetchMock = global.fetch as unknown as jest.Mock;
      fetchMock.mockRejectedValue({ name: "AbortError" });

      await expect(
        analyzeRoutineImageWithOllama("/tmp/routine.webp"),
      ).rejects.toThrow("Routine analysis request timed out with Ollama");
    });
  });
});
