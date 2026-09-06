import { describe, expect, test } from "vitest";

import {
    calculateCm,
    calculateTrimAngleDeg,
    calculateDeltaCm,
    classifyDisturbance,
    isTrimmed,
} from "../../src/student/physics/trim-response.js";

describe("trim-response physics", () => {
    test("numerical case", () => {
        const cm = calculateCm(0.04, -0.8, 2.86479);
        const trimAngleDeg = calculateTrimAngleDeg(0.04, -0.8);
        const deltaCm = calculateDeltaCm(-0.8, 2.0);
        const tendency = classifyDisturbance(2.0, deltaCm);

        expect(cm).toBeCloseTo(0, 5);
        expect(trimAngleDeg).toBeCloseTo(2.86479, 4);
        expect(deltaCm).toBeCloseTo(-0.0279253, 5);
        expect(isTrimmed(cm)).toBe(true);
        expect(tendency).toBe("restoring");
    });

    test("behavioral case: doubling disturbance angle doubles delta_Cm magnitude", () => {
        const deltaCm2Deg = calculateDeltaCm(-0.8, 2.0);
        const deltaCm4Deg = calculateDeltaCm(-0.8, 4.0);

        expect(Math.abs(deltaCm4Deg)).toBeCloseTo(
            2 * Math.abs(deltaCm2Deg),
            10
        );

        expect(deltaCm2Deg).toBeLessThan(0);
        expect(deltaCm4Deg).toBeLessThan(0);

        expect(
            classifyDisturbance(2.0, deltaCm2Deg)
        ).toBe("restoring");

        expect(
            classifyDisturbance(4.0, deltaCm4Deg)
        ).toBe("restoring");
    });

    test("boundary case: zero Cm-alpha slope", () => {
        const cm = calculateCm(0.04, 0, 2.86);
        const trimAngleDeg = calculateTrimAngleDeg(0.04, 0);
        const deltaCm = calculateDeltaCm(0, 2.0);
        const tendency = classifyDisturbance(2.0, deltaCm);

        expect(cm).toBeCloseTo(0.04, 10);
        expect(trimAngleDeg).toBeNull();
        expect(deltaCm).toBe(0);
        expect(isTrimmed(cm)).toBe(false);
        expect(tendency).toBe("neutral");
    });

    test("negative slope with positive disturbance is restoring", () => {
        const deltaCm = calculateDeltaCm(-0.8, 2.0);

        expect(deltaCm).toBeLessThan(0);
        expect(
            classifyDisturbance(2.0, deltaCm)
        ).toBe("restoring");
    });

    test("positive slope with positive disturbance is destabilizing", () => {
        const deltaCm = calculateDeltaCm(0.8, 2.0);

        expect(deltaCm).toBeGreaterThan(0);
        expect(
            classifyDisturbance(2.0, deltaCm)
        ).toBe("destabilizing");
    });

    test("zero disturbance is neutral", () => {
        const deltaCm = calculateDeltaCm(-0.8, 0);

        expect(deltaCm).toBe(0);
        expect(
            classifyDisturbance(0, deltaCm)
        ).toBe("neutral");
    });

    test("invalid numeric input is rejected", () => {
        expect(() => calculateCm(NaN, -0.8, 2.0)).toThrow();
        expect(() => calculateCm(0.04, Infinity, 2.0)).toThrow();
        expect(() => calculateDeltaCm(-0.8, "2")).toThrow();
        expect(() => calculateTrimAngleDeg(0.04, NaN)).toThrow();
        expect(() => isTrimmed(Infinity)).toThrow();
    });
});