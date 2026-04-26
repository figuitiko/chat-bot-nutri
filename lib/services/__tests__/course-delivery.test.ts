import { describe, expect, it } from "vitest";

import {
  buildStepBodyWithDeliveryMode,
  estimateOutboundMessagesForStep,
  shouldPauseForTwilioBurst,
} from "@/lib/services/course-delivery";

describe("buildStepBodyWithDeliveryMode", () => {
  it("appends the resource link for LINK_ONLY steps", () => {
    expect(
      buildStepBodyWithDeliveryMode({
        body: "Escucha este audio.",
        deliveryMode: "LINK_ONLY",
        resolvedMediaUrl: "https://example.com/audio.mp3",
      }),
    ).toContain("https://example.com/audio.mp3");
  });

  it("does not duplicate the link when the body already contains it", () => {
    const body = "Escucha este audio aqui: https://example.com/audio.mp3";

    expect(
      buildStepBodyWithDeliveryMode({
        body,
        deliveryMode: "LINK_ONLY",
        resolvedMediaUrl: "https://example.com/audio.mp3",
      }),
    ).toBe(body);
  });
});

describe("estimateOutboundMessagesForStep", () => {
  it("returns 2 for MEDIA_FIRST steps with media", () => {
    expect(
      estimateOutboundMessagesForStep({
        deliveryMode: "MEDIA_FIRST",
        kind: "TEXT",
        hasMedia: true,
      }),
    ).toBe(2);
  });

  it("returns 2 for interactive STANDARD steps with media", () => {
    expect(
      estimateOutboundMessagesForStep({
        deliveryMode: "STANDARD",
        kind: "TWILIO_CONTENT_TEMPLATE",
        hasMedia: true,
      }),
    ).toBe(2);
  });

  it("returns 1 for LINK_ONLY steps with media", () => {
    expect(
      estimateOutboundMessagesForStep({
        deliveryMode: "LINK_ONLY",
        kind: "TWILIO_CONTENT_TEMPLATE",
        hasMedia: true,
      }),
    ).toBe(1);
  });
});

describe("shouldPauseForTwilioBurst", () => {
  it("pauses when the projected count reaches the hard limit", () => {
    expect(
      shouldPauseForTwilioBurst({
        recentOutboundCount: 23,
        projectedOutboundCount: 2,
        hardPauseThreshold: 24,
      }),
    ).toBe(true);
  });

  it("does not pause when the projected count stays below the hard limit", () => {
    expect(
      shouldPauseForTwilioBurst({
        recentOutboundCount: 20,
        projectedOutboundCount: 1,
        hardPauseThreshold: 24,
      }),
    ).toBe(false);
  });
});
