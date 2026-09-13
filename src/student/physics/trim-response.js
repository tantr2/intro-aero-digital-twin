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

/**
 * Inputs:
 * - cm0: dimensionless
 * - cmAlphaPerRad: 1/rad
 * - angleOfAttackDeg: deg
 *
 * Output:
 * - Cm(alpha): dimensionless
 *
 * Sign convention:
 * Positive pitching moment and positive angle of attack are nose-up.
 *
 * Assumption:
 * Linear, quasi-static Cm-alpha relationship.
 */
export function calculateCm(cm0, cmAlphaPerRad, angleOfAttackDeg) {
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(angleOfAttackDeg, "angleOfAttackDeg");

  const alphaRad = degreesToRadians(angleOfAttackDeg);
  return cm0 + cmAlphaPerRad * alphaRad;
}

/**
 * Inputs:
 * - cm0: dimensionless
 * - cmAlphaPerRad: 1/rad
 *
 * Output:
 * - trim angle: deg
 * - null when no unique trim angle exists because Cm_alpha = 0
 */
export function calculateTrimAngleDeg(cm0, cmAlphaPerRad) {
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");

  if (cmAlphaPerRad === 0) {
    return null;
  }

  const trimAlphaRad = -cm0 / cmAlphaPerRad;
  return trimAlphaRad / DEG_TO_RAD;
}

/**
 * Inputs:
 * - cmAlphaPerRad: 1/rad
 * - disturbanceAlphaDeg: deg
 *
 * Output:
 * - delta_Cm: dimensionless
 */
export function calculateDeltaCm(cmAlphaPerRad, disturbanceAlphaDeg) {
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");

  const disturbanceAlphaRad = degreesToRadians(disturbanceAlphaDeg);
  return cmAlphaPerRad * disturbanceAlphaRad;
}

/**
 * Output:
 * - true when abs(Cm(alpha)) <= 1e-6
 */
export function isTrimmed(cm) {
  assertFiniteNumber(cm, "cm");
  return Math.abs(cm) <= TRIM_TOLERANCE;
}

/**
 * Classifies disturbance tendency from:
 * delta_alpha_rad * delta_Cm
 *
 * Output:
 * - restoring
 * - destabilizing
 * - neutral
 */
export function classifyDisturbance(
  disturbanceAlphaDeg,
  deltaCm,
) {
  assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");
  assertFiniteNumber(deltaCm, "deltaCm");

  const disturbanceAlphaRad = degreesToRadians(disturbanceAlphaDeg);
  const product = disturbanceAlphaRad * deltaCm;

  if (product < 0) {
    return "restoring";
  }

  if (product > 0) {
    return "destabilizing";
  }

  return "neutral";
}

/**
 * Calculates the complete Stage 4 pitching-moment result.
 * No state is mutated.
 */
export function analyzePitchingMoment({
  cm0,
  cmAlphaPerRad,
  angleOfAttackDeg,
  disturbanceAlphaDeg,
}) {
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(angleOfAttackDeg, "angleOfAttackDeg");
  assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");

  const cm = calculateCm(
    cm0,
    cmAlphaPerRad,
    angleOfAttackDeg,
  );

  const trimAngleDeg = calculateTrimAngleDeg(
    cm0,
    cmAlphaPerRad,
  );

  const deltaCm = calculateDeltaCm(
    cmAlphaPerRad,
    disturbanceAlphaDeg,
  );

  return {
    cm,
    trimAngleDeg,
    deltaCm,
    trimmed: isTrimmed(cm),
    disturbanceTendency: classifyDisturbance(
      disturbanceAlphaDeg,
      deltaCm,
    ),
  };
}