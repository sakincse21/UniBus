import { env } from "../../config/env";
import fs from "fs";
import path from "path";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = env.OPENROUTER_MODEL;
const OPENROUTER_TIMEOUT_MS = 60_000;
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

  //   const prompt = `You are analyzing a university weekly class/lab routine image.

  // Extract the schedule and return ONLY a valid JSON array. Each element must have:
  // - "day": one of "saturday","sunday","monday","tuesday","wednesday","thursday","friday" (lowercase)
  // - "firstHalfStart": the time (HH:mm, 24-hour) when the FIRST class/lab of the day starts
  // - "secondHalfStart": the time (HH:mm, 24-hour) when the FIRST class/lab AFTER the lunch/mid-day break starts
  // - "confidence": a number 0 to 1 indicating how confident you are about the extracted times
  // - "note": a short description like "First half start at 8:30 AM, second half start at 2:30 PM"

  // Rules:
  // - If a day has no classes, skip it entirely.
  // - If you cannot determine the second half or the cells in 2nd half is blank, set secondHalfStart to "" and confidence below 0.5.
  // - provide times 10minutes earlier than the actual start time to allow for preparation.
  // - Second half starts at 2:30 PM and its crucial to remember.
  // - We have classes from Sunday to Thursday, keep that in mind.
  // - if a cell is blank that means there no class in that slot, so look for the first non-blank cell to determine start times.
  // - Return ONLY the raw JSON array, no markdown, no explanation, no code fences.

  // Example output:
  // [{"day":"sunday","firstHalfStart":"08:30","secondHalfStart":"13:00","confidence":0.95,"note":"Regular day"},{"day":"monday","firstHalfStart":"09:00","secondHalfStart":"14:00","confidence":0.85,"note":"Lab in afternoon"}]`;

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
   - Always subtract 10 minutes from the detected class start time

2. Session definitions:
   - First half = morning session (before break)
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
    "firstHalfStart": "10:30",
    "secondHalfStart": "14:20",
    "confidence": 0.95,
    "note": "morning 10:40, afternoon 14:30"
  }
]`;
  console.log(prompt);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
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
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Routine analysis request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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
