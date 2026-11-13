// Quiet period before the Messenger AI answers, so a customer finishing several messages gets one reply.
// Shared by the webhook and the inbox's automatic analysis; otherwise an open inbox would skip the wait.
export function messengerDebounceMs() {
  return Math.min(Math.max(Number(process.env.MESSENGER_AI_DEBOUNCE_MS ?? 15000) || 0, 0), 15000);
}
