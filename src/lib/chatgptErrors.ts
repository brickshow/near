const PLAN_REQUIREMENT = "ChatGPT AI in NEAR requires a Go, Plus, Pro, or Business plan. Free accounts can use NEAR’s local features, but not its ChatGPT AI.";

export function friendlyChatGptError(error: unknown): string {
  const raw = String(error);
  const normalized = raw.toLowerCase();
  const requestId = raw.match(/request id:\s*([a-z0-9_-]+)/i)?.[1];
  let message: string;

  if (normalized.includes("invalid_grant")) {
    message = `That ChatGPT sign-in expired or could not be completed. Start a fresh sign-in. ${PLAN_REQUIREMENT}`;
  } else if (/access_denied|permission.*unavailable|plan usage.*not enabled|workspace.*(denied|unavailable)/i.test(raw)) {
    message = `This account or workspace cannot share ChatGPT plan usage with NEAR. ${PLAN_REQUIREMENT} A Business workspace administrator may also need to allow plan usage.`;
  } else if (normalized.includes("invalid_request")) {
    message = `OpenAI could not accept this sign-in. ${PLAN_REQUIREMENT} If you have an eligible plan, choose the workspace that has it.`;
  } else {
    message = `ChatGPT could not connect. ${PLAN_REQUIREMENT}`;
  }

  return requestId ? `${message} OpenAI reference: ${requestId}.` : message;
}
