export enum GenerateReasonType {
  UnmatchedArticle = "unmatched-article",
  NotFiveLetters = "not-five-letters",
  NotLetters = "not-letters",
  NotDictionaryWord = "not-dictionary-word",
  MissingAnswerType = "missing-answer-type",
  PersonAnswerType = "person-answer-type",
  AnswerLeaked = "answer-leaked",
  PromptControlText = "prompt-control-text",
  SemanticMismatch = "semantic-mismatch",
  RepeatInWindow = "repeat-in-window",
  MissingSource = "missing-source",
  AnswerNotInArticle = "answer-not-in-article",
}

const REASON_COPY: Record<GenerateReasonType, string> = {
  [GenerateReasonType.UnmatchedArticle]:
    "The model didn’t point this word at one of the stories we sent.",
  [GenerateReasonType.NotFiveLetters]: "The answer isn’t exactly five letters.",
  [GenerateReasonType.NotLetters]: "The answer has characters we can’t use.",
  [GenerateReasonType.NotDictionaryWord]: "Not real word",
  [GenerateReasonType.MissingAnswerType]: "The model didn’t say what kind of answer this is.",
  [GenerateReasonType.PersonAnswerType]:
    "Names of people aren’t allowed. We need a storyline, place, or phrase.",
  [GenerateReasonType.AnswerLeaked]: "The clue or detail gives the word away.",
  [GenerateReasonType.PromptControlText]:
    "The clue looks like it was talking to the model, not to a player.",
  [GenerateReasonType.SemanticMismatch]:
    "The word’s actual meaning does not describe the article concept.",
  [GenerateReasonType.RepeatInWindow]: "We used this word too recently.",
  [GenerateReasonType.MissingSource]: "The source URL doesn’t match the stories we offered.",
  [GenerateReasonType.AnswerNotInArticle]: "The word doesn’t actually appear in the article.",
};

const LEGACY_REASON_TYPES: Array<{ match: string; type: GenerateReasonType }> = [
  { match: "unmatched-article", type: GenerateReasonType.UnmatchedArticle },
  {
    match: "answer must normalize to exactly five letters",
    type: GenerateReasonType.NotFiveLetters,
  },
  { match: "answer does not normalize cleanly to letters", type: GenerateReasonType.NotLetters },
  {
    match: "answer is not in the accepted five-letter word list",
    type: GenerateReasonType.NotDictionaryWord,
  },
  { match: "answer type is missing", type: GenerateReasonType.MissingAnswerType },
  { match: "answer type must not be a person", type: GenerateReasonType.PersonAnswerType },
  { match: "answer is leaked in clue or detail", type: GenerateReasonType.AnswerLeaked },
  {
    match: "clue or detail contains prompt-control text",
    type: GenerateReasonType.PromptControlText,
  },
  { match: "answer repeats inside cooldown window", type: GenerateReasonType.RepeatInWindow },
  { match: "missing a", type: GenerateReasonType.MissingSource },
];

function isGenerateReasonType(value: string): value is GenerateReasonType {
  return Object.values(GenerateReasonType).includes(value as GenerateReasonType);
}

export function explainGenerateReason(reason: string): string {
  if (isGenerateReasonType(reason)) return REASON_COPY[reason];
  const legacy = LEGACY_REASON_TYPES.find((entry) => reason.includes(entry.match));
  if (legacy) return REASON_COPY[legacy.type];
  return reason;
}

export function generateStagePercent(stage: string): number {
  switch (stage) {
    case "prepare":
      return 12;
    case "articles":
      return 28;
    case "model":
      return 62;
    case "score":
      return 86;
    case "done":
      return 100;
    default:
      return 8;
  }
}
