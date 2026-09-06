const DEG_TO_RAD = Math.PI / 180;
const TRIM_TOLERANCE = 1e-6;

function assertFiniteNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TypeError(`${name} must be a finite number`);
    }
}

export function degreesToRadians(degrees) {
    assertFiniteNumber(degrees, "degrees");
    return degrees * DEG_TO_RAD;
}

export function calculateCm(cm0, cmAlphaPerRad, angleOfAttackDeg) {
    assertFiniteNumber(cm0, "cm0");
    assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
    assertFiniteNumber(angleOfAttackDeg, "angleOfAttackDeg");

    const alphaRad = degreesToRadians(angleOfAttackDeg);
    return cm0 + cmAlphaPerRad * alphaRad;
}

export function calculateTrimAngleDeg(cm0, cmAlphaPerRad) {
    assertFiniteNumber(cm0, "cm0");
    assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");

    if (cmAlphaPerRad === 0) {
        return null;
    }

    const alphaTrimRad = -cm0 / cmAlphaPerRad;
    return alphaTrimRad / DEG_TO_RAD;
}

export function calculateDeltaCm(cmAlphaPerRad, disturbanceAlphaDeg) {
    assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
    assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");

    const deltaAlphaRad = degreesToRadians(disturbanceAlphaDeg);
    return cmAlphaPerRad * deltaAlphaRad;
}

export function classifyDisturbance(
    disturbanceAlphaDeg,
    deltaCm
) {
    assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");
    assertFiniteNumber(deltaCm, "deltaCm");

    const deltaAlphaRad = degreesToRadians(disturbanceAlphaDeg);
    const product = deltaAlphaRad * deltaCm;

    if (product < 0) {
        return "restoring";
    }

    if (product > 0) {
        return "destabilizing";
    }

    return "neutral";
}

export function isTrimmed(cm) {
    assertFiniteNumber(cm, "cm");
    return Math.abs(cm) <= TRIM_TOLERANCE;
}