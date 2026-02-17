import type { ClassificationLevel } from "../types/index.js";

/**
 * Data classification utilities.
 */

export const CLASSIFICATION_ORDER: ClassificationLevel[] = [
  "public",
  "internal",
  "confidential",
  "restricted",
];

export function compareClassification(a: ClassificationLevel, b: ClassificationLevel): number {
  return CLASSIFICATION_ORDER.indexOf(a) - CLASSIFICATION_ORDER.indexOf(b);
}

export interface PiiMaskResult {
  text: string;
  masked: boolean;
  matches: Array<{ kind: string; value: string }>;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/g;

/**
 * Best-effort PII masking.
 */
export function maskPII(input: string): PiiMaskResult {
  const matches: PiiMaskResult["matches"] = [];
  let text = input;
  const replaceAll = (re: RegExp, kind: string) => {
    text = text.replace(re, (m) => {
      matches.push({ kind, value: m });
      return `[${kind.toUpperCase()}_REDACTED]`;
    });
  };

  replaceAll(EMAIL_RE, "email");
  replaceAll(PHONE_RE, "phone");
  replaceAll(CC_RE, "card");

  return { text, masked: matches.length > 0, matches };
}

export interface ExternalLLMGatingPolicy {
  /** Max classification allowed to leave boundary (e.g., "internal"). */
  maxExternalClassification: ClassificationLevel;
  /** If true, will mask PII before sending externally. */
  maskPiiBeforeExternal?: boolean;
}

export function canSendToExternalLLM(classification: ClassificationLevel, policy: ExternalLLMGatingPolicy): boolean {
  return compareClassification(classification, policy.maxExternalClassification) <= 0;
}

/**
 * Apply policy to outbound text. Throws if forbidden.
 */
export function gateExternalLLM(params: {
  classification: ClassificationLevel;
  policy: ExternalLLMGatingPolicy;
  text: string;
}): { text: string; masked: boolean } {
  if (!canSendToExternalLLM(params.classification, params.policy)) {
    throw new Error(
      `[CLASSIFICATION] External LLM blocked for classification=${params.classification}; max=${params.policy.maxExternalClassification}`
    );
  }

  if (params.policy.maskPiiBeforeExternal) {
    const r = maskPII(params.text);
    return { text: r.text, masked: r.masked };
  }

  return { text: params.text, masked: false };
}
