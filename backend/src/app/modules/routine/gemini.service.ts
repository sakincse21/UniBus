import { env } from "../../config/env";
import fs from "fs";
import path from "path";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";
// const MODEL = "google/gemma-3-27b-it:free";

export interface RoutineSlot {
  day: string;
  firstHalfStart: string;
  secondHalfStart: string;
  confidence: number;
  note: string;
}

/**
 * Send a routine image to OpenRouter (Gemma 3 27B) and get structured class times.
 */
export async function analyzeRoutineImage(
  imagePath: string,
): Promise<RoutineSlot[]> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).slice(1).toLowerCase();
  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

  const prompt = `You are analyzing a university weekly class/lab routine image.

Extract the schedule and return ONLY a valid JSON array. Each element must have:
- "day": one of "saturday","sunday","monday","tuesday","wednesday","thursday","friday" (lowercase)
- "firstHalfStart": the time (HH:mm, 24-hour) when the FIRST class/lab of the day starts
- "secondHalfStart": the time (HH:mm, 24-hour) when the FIRST class/lab AFTER the lunch/mid-day break starts, the lunch break is usually around 13:10 to 14:30
- "confidence": a number 0 to 1 indicating how confident you are about the extracted times
- "note": a short description like "Classes start at 8:30 AM, afternoon after 1:00 PM"

Rules:
- If a day has no classes, skip it entirely.
- If you cannot determine the second half, set secondHalfStart to "" and confidence below 0.5.
- Return ONLY the raw JSON array, no markdown, no explanation, no code fences.

Example output:
[{"day":"sunday","firstHalfStart":"08:30","secondHalfStart":"13:00","confidence":0.95,"note":"Regular day"},{"day":"monday","firstHalfStart":"09:00","secondHalfStart":"14:00","confidence":0.85,"note":"Lab in afternoon"}]`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://unibus.app",
      "X-Title": "UniBus",
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
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });

  console.log(response)

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errBody.substring(0, 300)}`,
    );
  }

  const data = await response.json();
  const text = (data.choices?.[0]?.message?.content || "").trim();

  if (!text) {
    throw new Error("Empty response from AI model");
  }

  // Strip markdown fences if the model wraps them
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed: RoutineSlot[] = JSON.parse(cleaned);

    // Validate basic structure
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
      // secondHalfStart can be empty if uncertain
      if (slot.secondHalfStart && !timeRegex.test(slot.secondHalfStart))
        return false;
      slot.confidence = Math.min(1, Math.max(0, Number(slot.confidence) || 0));
      return true;
    });
  } catch {
    throw new Error(
      `Failed to parse AI response as JSON. Raw response: ${cleaned.substring(0, 200)}`,
    );
  }
}
