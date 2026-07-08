export function shouldUseLegacyRuleRouting(input: {
  hasActiveCourseConversation: boolean;
  hasActiveLegacyConversation: boolean;
}) {
  if (input.hasActiveCourseConversation) {
    return false;
  }

  return input.hasActiveLegacyConversation;
}
