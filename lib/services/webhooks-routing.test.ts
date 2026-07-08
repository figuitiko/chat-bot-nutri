import { describe, expect, it } from 'vitest';

import { shouldUseLegacyRuleRouting } from '@/lib/services/webhooks-routing';

describe('shouldUseLegacyRuleRouting', () => {
  it('does not allow legacy bot rules while a course conversation is active', () => {
    expect(
      shouldUseLegacyRuleRouting({
        hasActiveCourseConversation: true,
        hasActiveLegacyConversation: false,
      }),
    ).toBe(false);
  });

  it('allows legacy bot rules only for an active legacy conversation', () => {
    expect(
      shouldUseLegacyRuleRouting({
        hasActiveCourseConversation: false,
        hasActiveLegacyConversation: true,
      }),
    ).toBe(true);
  });
});
