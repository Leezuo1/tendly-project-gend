// Domain tests isolate authorization; app-security.test.mjs exercises the real gate on every API.
export const businessSecurity = {
  AppSecurityError: class AppSecurityError extends Error {},
  withAppAccess: handler => handler,
  legacyAccessError: () => undefined,
  assertOperationAllowed: async () => {},
  canRunAutomation: async () => true,
  isInteractiveRequest: () => true,
  runAutomaticAccess: (_at, operation) => operation(),
};
