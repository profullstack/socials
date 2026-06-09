export { runLoginAutomation } from "./automation.js";
export { loadCredentials, loadSecret, loadSessionJson, parseSessionJson } from "./input.js";
export { redactObject, redactValue } from "./redact.js";
export type {
  CliOptions,
  LoadedSecret,
  LoginAutomationOptions,
  LoginAutomationResult,
  LoginCredentials,
  LoginInput,
  LoginSelectors,
  SecretInputRef,
  SecretInputSource,
  SessionState,
} from "./types.js";
