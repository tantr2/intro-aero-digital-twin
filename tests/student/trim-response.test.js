import { describe, expect, it } from "vitest";

import {
  analyzePitchingMoment,
  calculateCm,
  calculateDeltaCm,
  calculateTrimAngleDeg,
  classifyDisturbance,
  isTrimmed,
} from "../../src/student/physics/trim-response.js";

describe("trim-response physics", () => {
  describe("numerical verification case", () => {
    it("matches the assigned reference calculation", () => {
      const result = analyzePitchingMoment({
        cm0: 0.04,
        cmAlphaPerRad: -0.8,
        angleOfAttackDeg: 2.864789,
        disturbanceAlphaDeg: 2.0,
      });

      expect(result.cm).toBeCloseTo(0, 6);
      expect(result.trimAngleDeg).toBeCloseTo(2.864789, 6);
      expect(result.deltaCm).toBeCloseTo(-0.027925, 4);
      expect(result.trimmed).toBe(true);
      expect(result.disturbanceTendency).toBe("restoring");
    });
  });

  describe("behavioral verification case", () => {
    it("doubles the magnitude of delta_Cm when the disturbance doubles", () => {
      const base = analyzePitchingMoment({
        cm0: 0.04,
        cmAlphaPerRad: -0.8,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 2.0,
      });

      const doubled = analyzePitchingMoment({
        cm0: 0.04,
        cmAlphaPerRad: -0.8,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 4.0,
      });

      expect(Math.abs(doubled.deltaCm)).toBeCloseTo(
        2 * Math.abs(base.deltaCm),
        4,
      );
      expect(doubled.deltaCm).toBeLessThan(0);
      expect(doubled.disturbanceTendency).toBe("restoring");
    });
  });

  describe("boundary and sanity case", () => {
    it("handles Cm_alpha = 0 without calculating a trim angle", () => {
      const result = analyzePitchingMoment({
        cm0: 0.04,
        cmAlphaPerRad: 0,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 2.0,
      });

      expect(result.cm).toBeCloseTo(0.04, 6);
      expect(result.deltaCm).toBe(0);
      expect(result.trimAngleDeg).toBeNull();
      expect(result.disturbanceTendency).toBe("neutral");
    });
  });

  describe("pure-function checks", () => {
    it("calculates Cm using degrees converted to radians", () => {
      expect(
        calculateCm(0.04, -0.8, 2.864789),
      ).toBeCloseTo(0, 6);
    });

    it("calculates the trim angle when Cm_alpha is nonzero", () => {
      expect(
        calculateTrimAngleDeg(0.04, -0.8),
      ).toBeCloseTo(2.864789, 6);
    });

    it("returns null when no unique trim angle exists", () => {
      expect(
        calculateTrimAngleDeg(0.04, 0),
      ).toBeNull();
    });

    it("calculates disturbance moment change", () => {
      expect(
        calculateDeltaCm(-0.8, 2.0),
      ).toBeCloseTo(-0.0279253, 6);
    });

    it("classifies restoring, destabilizing, and neutral tendencies", () => {
      expect(
        classifyDisturbance(2.0, -0.02),
      ).toBe("restoring");

      expect(
        classifyDisturbance(2.0, 0.02),
      ).toBe("destabilizing");

      expect(
        classifyDisturbance(2.0, 0),
      ).toBe("neutral");
    });

    it("uses the specified trim tolerance", () => {
      expect(isTrimmed(1e-6)).toBe(true);
      expect(isTrimmed(-1e-6)).toBe(true);
      expect(isTrimmed(1.000001e-6)).toBe(false);
    });
  });

  describe("numeric input validation", () => {
    it("rejects non-finite engineering inputs", () => {
      expect(() =>
        calculateCm(NaN, -0.8, 2),
      ).toThrow();

      expect(() =>
        calculateDeltaCm(-0.8, Infinity),
      ).toThrow();

      expect(() =>
        calculateTrimAngleDeg(0.04, Number.NaN),
      ).toThrow();
    });
  });
});