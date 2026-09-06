import { describe, expect, test } from "vitest";

import {
  degreesToRadians,
  calculateCm,
  calculateTrimAngleDeg,
  calculateDeltaCm,
  classifyDisturbance,
  isTrimmed,
} from "../../src/student/physics/trim-response.js";

describe("trim-response physics", () => {
  test("numerical case", () => {
    const cm0 = 0.04;
    const cmAlphaPerRad = -0.8;
    const angleOfAttackDeg = 2.86;
    const disturbanceAlphaDeg = 2.0;

    const alphaRad = degreesToRadians(angleOfAttackDeg);
    const disturbanceRad = degreesToRadians(
      disturbanceAlphaDeg
    );

    expect(alphaRad).toBeCloseTo(0.0499, 4);
    expect(disturbanceRad).toBeCloseTo(0.0349, 4);

    const cm = calculateCm(
      cm0,
      cmAlphaPerRad,
      angleOfAttackDeg
    );

    const trimAngleDeg = calculateTrimAngleDeg(
      cm0,
      cmAlphaPerRad
    );

    const deltaCm = calculateDeltaCm(
      cmAlphaPerRad,
      disturbanceAlphaDeg
    );

    expect(cm).toBeCloseTo(0.0001, 4);
    expect(trimAngleDeg).toBeCloseTo(2.865, 4);
    expect(deltaCm).toBeCloseTo(-0.027, 4);
    expect(isTrimmed(cm)).toBe(true);
    expect(
      classifyDisturbance(
        cmAlphaPerRad,
        disturbanceAlphaDeg
      )
    ).toBe("restoring");
  });

  test("behavioral case: doubling disturbance doubles delta_Cm magnitude", () => {
    const cmAlphaPerRad = -0.8;

    const deltaCm2Deg = calculateDeltaCm(
      cmAlphaPerRad,
      2.0
    );

    const deltaCm4Deg = calculateDeltaCm(
      cmAlphaPerRad,
      4.0
    );

    expect(Math.abs(deltaCm4Deg)).toBeCloseTo(
      2 * Math.abs(deltaCm2Deg),
      4
    );

    expect(deltaCm4Deg).toBeLessThan(0);

    expect(
      classifyDisturbance(
        cmAlphaPerRad,
        4.0
      )
    ).toBe("restoring");
  });

  test("boundary case: zero Cm-alpha slope", () => {
    const cm0 = 0.04;
    const cmAlphaPerRad = 0;
    const angleOfAttackDeg = 2.86;
    const disturbanceAlphaDeg = 2.0;

    const cm = calculateCm(
      cm0,
      cmAlphaPerRad,
      angleOfAttackDeg
    );

    const deltaCm = calculateDeltaCm(
      cmAlphaPerRad,
      disturbanceAlphaDeg
    );

    const trimAngleDeg = calculateTrimAngleDeg(
      cm0,
      cmAlphaPerRad
    );

    expect(cm).toBeCloseTo(0.04, 4);
    expect(deltaCm).toBeCloseTo(0, 4);
    expect(trimAngleDeg).toBeNull();
    expect(
      classifyDisturbance(
        cmAlphaPerRad,
        disturbanceAlphaDeg
      )
    ).toBe("neutral");
  });

  test("rejects non-finite numeric inputs", () => {
    expect(() =>
      calculateCm(
        0.04,
        -0.8,
        Number.NaN
      )
    ).toThrow();

    expect(() =>
      calculateTrimAngleDeg(
        0.04,
        Number.POSITIVE_INFINITY
      )
    ).toThrow();

    expect(() =>
      calculateDeltaCm(
        -0.8,
        Number.NaN
      )
    ).toThrow();
  });
});