import { describe, expect, it } from 'vitest';

import { buildChoiceDescription, buildChoiceTitle } from '@/lib/services/course-interactive-options';

describe('course-interactive-options', () => {
  it('uses numeric pattern as title', () => {
    expect(buildChoiceTitle({ pattern: '4', outputValue: 'Muy bueno' })).toBe('4');
  });

  it('does not repeat numeric descriptions when hint equals the numeric title', () => {
    expect(buildChoiceDescription({ pattern: '4', outputValue: '4', displayHint: '4' })).toBeUndefined();
  });

  it('keeps descriptive hints for numeric choices', () => {
    expect(buildChoiceDescription({ pattern: '4', outputValue: 'Muy bueno', displayHint: 'Muy bueno' })).toBe('Muy bueno');
  });

  it('keeps alphanumeric output values as descriptions when useful', () => {
    expect(buildChoiceDescription({ pattern: 'a', outputValue: 'Respuesta A' })).toBeUndefined();
    expect(buildChoiceTitle({ pattern: 'a', outputValue: 'Respuesta A' })).toBe('Respuesta A');
  });
});
