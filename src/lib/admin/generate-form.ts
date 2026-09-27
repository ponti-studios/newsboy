import { z } from "zod";
import {
  GENERATE_REASONING_EFFORTS,
  GENERATE_SOURCE_MODES,
  type GenerateRequest,
} from "./generate-types";

const optionalFormString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const formIdList = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const ids = value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry));
  return ids.length > 0 ? ids : undefined;
}, z.array(z.number().int()).optional());

const formMaxTokens = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}, z.number().int().positive().optional());

const generateFormSchema = z
  .object({
    dateKey: z.string().default(""),
    sourceMode: z.enum(GENERATE_SOURCE_MODES).default("inventory"),
    promptSource: z.enum(["file", "paste"]).optional(),
    promptChoice: z.string().optional(),
    promptPath: optionalFormString,
    promptText: optionalFormString,
    model: optionalFormString,
    feedUrl: optionalFormString,
    fixtureId: optionalFormString,
    compareGroupId: optionalFormString,
    feedIds: formIdList,
    articleIds: formIdList,
    maxTokens: formMaxTokens,
    reasoningEffort: z.enum(GENERATE_REASONING_EFFORTS).optional(),
  })
  .transform(({ promptChoice, promptSource, fixtureId, ...form }) => {
    const parsedPromptSource: "file" | "paste" =
      promptSource === "paste" || promptChoice === "custom" ? "paste" : "file";
    return {
      ...form,
      promptSource: parsedPromptSource,
      ...(fixtureId && fixtureId !== "none" ? { fixtureId } : {}),
    };
  });

export function readGenerateForm(form: FormData): GenerateRequest {
  return generateFormSchema.parse(Object.fromEntries(form.entries()));
}
