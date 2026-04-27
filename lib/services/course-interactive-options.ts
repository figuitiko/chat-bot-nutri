interface InteractiveChoiceInput {
  pattern: string;
  outputValue?: string | null;
  displayLabel?: string | null;
  displayHint?: string | null;
}

function toTitleCase(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function buildChoiceTitle(
  transition: Pick<InteractiveChoiceInput, 'pattern' | 'outputValue' | 'displayLabel'>,
) {
  if (transition.displayLabel?.trim()) {
    return transition.displayLabel.trim();
  }

  const outputValue = transition.outputValue?.trim();
  const pattern = transition.pattern.trim();

  if (outputValue) {
    return /^\d+$/.test(pattern) ? pattern : outputValue;
  }

  return toTitleCase(pattern);
}

export function buildChoiceDescription(
  transition: Pick<InteractiveChoiceInput, 'pattern' | 'outputValue' | 'displayHint' | 'displayLabel'>,
) {
  const title = buildChoiceTitle(transition);

  if (transition.displayHint?.trim()) {
    const hint = transition.displayHint.trim();
    return hint === title ? undefined : hint;
  }

  const pattern = transition.pattern.trim();
  const outputValue = transition.outputValue?.trim();

  if (!outputValue || !/^\d+$/.test(pattern) || outputValue === pattern || outputValue === title) {
    return undefined;
  }

  return outputValue;
}
