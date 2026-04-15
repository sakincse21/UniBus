import { env } from "../../config/env";
import fs from "fs";

const OLLAMA_URL = env.OLLAMA_URL;
const MODEL = env.OLLAMA_MODEL; // Change this to your preferred vision model
const OLLAMA_TIMEOUT_MS = env.OLLAMA_TIMEOUT_MS;

export interface RoutineSlot {
  day: string;
  firstHalfStart: string;
  secondHalfStart: string;
  confidence: number;
  note: string;
}

/**
 * Send a routine image to Ollama and get structured class times.
 */
export async function analyzeRoutineImageWithOllama(
  imagePath: string,
): Promise<RoutineSlot[]> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const prompt = `You are analyzing a university in Bangladesh weekly class/lab routine image containing a table with days (Sunday–Thursday) and time slots.

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
   - Always subtract the detected class start time

2. Session definitions:
   - First half = morning session (before break)
   - Second half = starts from 14:30 (2:30 PM onward)
   - Only detect secondHalfStart if there is a class at or after 14:30

3. Detection logic:
   - Ignore empty cells
   - Find the FIRST non-empty cell in each half
   - If a class spans multiple slots, use its earliest start time
   - If all cells in a half are empty -> that half has no class

4. Missing data:
   - When a cell is blank it means no class in that time slot
   - If no second-half class exists -> set "secondHalfStart": ""
   - In that case, set confidence <= 0.5

5. Days:
   - Only include Sunday to Thursday
   - Don't skip any days from Sunday to Friday
   - Skip days with no classes at all

6. Confidence scoring:
   - 0.9-1.0 -> clear, unambiguous table
   - 0.7-0.89 -> minor ambiguity (merged cells, unclear labels)
   - 0.5-0.69 -> partially unclear
   - <0.5 -> missing or highly uncertain

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
  
  console.log("Using Ollama for routine analysis...");
  console.log("Ollama url: ", OLLAMA_URL);
  console.log("Ollama model: ", MODEL);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.2,
        }
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Routine analysis request timed out with Ollama");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `Ollama API error (${response.status}): ${errBody.substring(0, 300)}`,
    );
  }

  const data = await response.json();
  const text = (data.response || "").trim();

  if (!text) {
    throw new Error("Empty response from Ollama model");
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
  } catch (err) {
    throw new Error(
      `Failed to parse Ollama AI response as JSON. Raw response: ${cleaned.substring(0, 200)}`,
    );
  }
}
