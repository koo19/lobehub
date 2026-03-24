interface WebOnboardingToolActionResult {
  content?: string;
  error?: {
    message?: string;
    type?: string;
  };
  success: boolean;
}

export const createWebOnboardingToolResult = <T extends WebOnboardingToolActionResult>(
  result: T,
) => {
  const isError = !result.success;
  const errorMessage =
    result.error?.message ||
    (isError
      ? typeof result.content === 'string'
        ? result.content
        : 'Web onboarding tool call failed.'
      : undefined);
  const errorType = result.error?.type || 'WebOnboardingToolError';
  const payload = {
    data: result,
    ...(errorMessage ? { error: { message: errorMessage, type: errorType } } : {}),
    isError,
    success: result.success,
  };

  return {
    content: JSON.stringify(payload, null, 2),
    ...(errorMessage ? { error: { body: result, message: errorMessage, type: errorType } } : {}),
    state: payload,
    success: result.success,
  };
};
