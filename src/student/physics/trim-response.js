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
  // cm0: dimensionless, cmAlphaPerRad: 1/rad, angleOfAttackDeg: deg.
  // Positive angle of attack and pitching moment are nose-up.
  // Linear, quasi-static model.
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(angleOfAttackDeg, "angleOfAttackDeg");

  const alphaRad = degreesToRadians(angleOfAttackDeg);
  return cm0 + cmAlphaPerRad * alphaRad;
}

export function calculateTrimAngleDeg(cm0, cmAlphaPerRad) {
  // Output: trim angle in degrees. No unique trim exists when slope is zero.
  assertFiniteNumber(cm0, "cm0");
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");

  if (cmAlphaPerRad === 0) {
    return null;
  }

  const alphaTrimRad = -cm0 / cmAlphaPerRad;
  return alphaTrimRad / DEG_TO_RAD;
}

export function calculateDeltaCm(cmAlphaPerRad, disturbanceAlphaDeg) {
  // cmAlphaPerRad: 1/rad, disturbanceAlphaDeg: deg.
  // Output delta_Cm: dimensionless.
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");

  const disturbanceAlphaRad = degreesToRadians(disturbanceAlphaDeg);
  return cmAlphaPerRad * disturbanceAlphaRad;
}

export function classifyDisturbance(cmAlphaPerRad, disturbanceAlphaDeg) {
  // Negative delta_alpha_rad * delta_Cm: restoring.
  // Positive: destabilizing. Zero: neutral.
  assertFiniteNumber(cmAlphaPerRad, "cmAlphaPerRad");
  assertFiniteNumber(disturbanceAlphaDeg, "disturbanceAlphaDeg");

  const disturbanceAlphaRad = degreesToRadians(disturbanceAlphaDeg);
  const deltaCm = calculateDeltaCm(
    cmAlphaPerRad,
    disturbanceAlphaDeg
  );
  const product = disturbanceAlphaRad * deltaCm;

  if (product < 0) {
    return "restoring";
  }

  if (product > 0) {
    return "destabilizing";
  }

  return "neutral";
}

export function isTrimmed(cm) {
  // Output: Boolean. Trim tolerance is |Cm| <= 1e-6.
  assertFiniteNumber(cm, "cm");
  return Math.abs(cm) <= TRIM_TOLERANCE;
}