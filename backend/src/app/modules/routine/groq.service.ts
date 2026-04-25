import { env } from "../../config/env";
import fs from "fs";
import path from "path";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = env.GROQ_MODEL;
const GROQ_TIMEOUT_MS = env.GROQ_TIMEOUT_MS;

export interface RoutineSlot {
  day: string;
  firstHalfStart: string;
  secondHalfStart: string;
  confidence: number;
  note: string;
}

function getMimeType(imagePath: string): string {
  const ext = path.extname(imagePath).slice(1).toLowerCase();

  if (ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }

  if (ext === "png") {
    return "image/png";
  }

  if (ext === "webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          "text" in part &&
          (part as { type?: unknown }).type === "text"
        ) {
          return String((part as { text: unknown }).text || "");
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

// Analyze a routine image with Groq vision and return parsed slots.
export async function analyzeRoutineImageWithGroq(
  imagePath: string,
): Promise<RoutineSlot[]> {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = getMimeType(imagePath);

  // Keep a strict prompt so output stays in predictable JSON format.

  const prompt = `You are analyzing a university weekly class/lab routine image containing a table with days (Sunday–Thursday) and time slots.

Your task is to extract, for each day that has at least one class, the start times of:
1. The FIRST class/lab in the morning session (first half)
2. The FIRST class/lab in the afternoon session (second half)

Return ONLY a valid JSON array. No explanation, no markdown.

Each object must follow this exact schema:
{
  "day": "sunday" | "monday" | "tuesday" | "wednesday" | "thursday",
  "firstHalfStart": "HH:mm",
  "secondHalfStart": "HH:mm" | "",
  "confidence": number (0 to 1),
  "note": string
}

Strict rules:

1. Time format:
   - Use 24-hour format HH:mm
   - Always return the detected class cell's start time

2. Session definitions:
   - First half = morning sessions usually start anytime from 8:00 to 12:20
   - Second half = starts from 14:30 (2:30 PM onward)
   - Only detect secondHalfStart if there is a class at or after 14:30

3. Detection logic:
   - Ignore empty cells
   - Find the FIRST non-empty cell in each half
   - If a class spans multiple slots, use its earliest start time
   - If all cells in a half are empty → that half has no class

4. Missing data:
   - If no second-half class exists → set "secondHalfStart": ""
   - In that case, set confidence ≤ 0.5

5. Days:
   - Only include Sunday to Thursday
   - Skip days with no classes at all

6. Confidence scoring:
   - 0.9–1.0 → clear, unambiguous table
   - 0.7–0.89 → minor ambiguity (merged cells, unclear labels)
   - 0.5–0.69 → partially unclear
   - <0.5 → missing or highly uncertain

7. Note field:
   - Keep it short and structured
   - Example: "morning 08:00, afternoon 14:30" or "only morning classes"

Output example:
[
  {
    "day": "sunday",
    "firstHalfStart": "10:40",
    "secondHalfStart": "14:30",
    "confidence": 0.95,
    "note": "morning 10:40, afternoon 14:30"
  }
]`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Routine analysis request timed out with Groq");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `Groq API error (${response.status}): ${errBody.substring(0, 300)}`,
    );
  }

  const data = await response.json();
  const text = extractContentText(data.choices?.[0]?.message?.content).trim();

  if (!text) {
    throw new Error("Empty response from Groq model");
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed: RoutineSlot[] = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    const validDays = new Set([
      "saturday",
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]);
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    return parsed.filter((slot) => {
      if (!validDays.has(slot.day)) return false;
      if (!timeRegex.test(slot.firstHalfStart)) return false;
      if (slot.secondHalfStart && !timeRegex.test(slot.secondHalfStart)) {
        return false;
      }

      slot.confidence = Math.min(1, Math.max(0, Number(slot.confidence) || 0));
      return true;
    });
  } catch {
    throw new Error(
      `Failed to parse Groq AI response as JSON. Raw response: ${cleaned.substring(0, 200)}`,
    );
  }
}
