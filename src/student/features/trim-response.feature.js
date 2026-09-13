import {
  analyzePitchingMoment,
  calculateCm,
  calculateDeltaCm,
  calculateTrimAngleDeg,
  classifyDisturbance,
  isTrimmed,
} from "../physics/trim-response.js";

const REQUIRED_CAPABILITY = {
  id: "loads.pitch.component-sum",
  version: 1,
};

const PLOT_MIN_DEG = -10;
const PLOT_MAX_DEG = 10;
const PLOT_STEP_DEG = 1;

const CM_TOLERANCE = 1e-6;
const DELTA_CM_TOLERANCE = 1e-4;
const TRIM_TOLERANCE = 1e-6;

function approximatelyEqual(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

function approximatelyZero(value, tolerance = CM_TOLERANCE) {
  return Math.abs(value) <= tolerance;
}

function capabilityIsAvailable(capabilityContext, required) {
  const capabilities = capabilityContext?.capabilities;

  if (Array.isArray(capabilities)) {
    return capabilities.some((capability) => (
      capability &&
      capability.id === required.id &&
      Number(capability.version) >= required.version
    ));
  }

  if (capabilities && typeof capabilities === "object") {
    const entry = capabilities[required.id];

    if (typeof entry === "number") {
      return entry >= required.version;
    }

    if (entry && typeof entry === "object") {
      return Number(entry.version) >= required.version;
    }
  }

  return false;
}

function buildPlotPoints(aircraft) {
  const points = [];

  for (
    let angleDeg = PLOT_MIN_DEG;
    angleDeg <= PLOT_MAX_DEG;
    angleDeg += PLOT_STEP_DEG
  ) {
    points.push({
      x: angleDeg,
      y: calculateCm(
        aircraft.cm0,
        aircraft.cmAlphaPerRad,
        angleDeg,
      ),
    });
  }

  if (
    aircraft.angleOfAttackDeg >= PLOT_MIN_DEG &&
    aircraft.angleOfAttackDeg <= PLOT_MAX_DEG &&
    !points.some((point) => point.x === aircraft.angleOfAttackDeg)
  ) {
    points.push({
      x: aircraft.angleOfAttackDeg,
      y: calculateCm(
        aircraft.cm0,
        aircraft.cmAlphaPerRad,
        aircraft.angleOfAttackDeg,
      ),
    });

    points.sort((a, b) => a.x - b.x);
  }

  return points;
}

function numericalVerificationCase() {
  const inputs = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.864789,
    disturbanceAlphaDeg: 2.0,
  };

  const actual = analyzePitchingMoment(inputs);

  const expectedCm = 0;
  const expectedTrimDeg = 2.864789;
  const expectedDeltaCm = -0.027925;

  return {
    id: "numerical",
    title: "Numerical case",
    inputs,
    expected: {
      cm: expectedCm,
      trimAngleDeg: expectedTrimDeg,
      deltaCm: expectedDeltaCm,
      trimmed: true,
      disturbanceTendency: "restoring",
    },
    passed:
      approximatelyEqual(actual.cm, expectedCm, CM_TOLERANCE) &&
      approximatelyEqual(
        actual.trimAngleDeg,
        expectedTrimDeg,
        TRIM_TOLERANCE,
      ) &&
      approximatelyEqual(
        actual.deltaCm,
        expectedDeltaCm,
        DELTA_CM_TOLERANCE,
      ) &&
      actual.trimmed === true &&
      actual.disturbanceTendency === "restoring",
  };
}

function behavioralVerificationCase() {
  const baseInputs = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const doubledInputs = {
    ...baseInputs,
    disturbanceAlphaDeg: 4.0,
  };

  const baseResult = analyzePitchingMoment(baseInputs);
  const doubledResult = analyzePitchingMoment(doubledInputs);

  const expectedMagnitudeRatio = 2;
  const actualMagnitudeRatio =
    Math.abs(doubledResult.deltaCm) /
    Math.abs(baseResult.deltaCm);

  return {
    id: "behavioral",
    title: "Behavioral case",
    inputs: {
      baseline: baseInputs,
      doubledDisturbance: doubledInputs,
    },
    expected: {
      magnitudeRelationship:
        "Doubling disturbanceAlphaDeg doubles the magnitude of delta_Cm",
      doubledDeltaCmMagnitudeRatio: expectedMagnitudeRatio,
      deltaCmSign: "negative",
      disturbanceTendency: "restoring",
    },
    passed:
      approximatelyEqual(
        actualMagnitudeRatio,
        expectedMagnitudeRatio,
        DELTA_CM_TOLERANCE,
      ) &&
      doubledResult.deltaCm < 0 &&
      doubledResult.disturbanceTendency === "restoring",
  };
}

function boundaryVerificationCase() {
  const inputs = {
    cm0: 0.04,
    cmAlphaPerRad: 0,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const actual = analyzePitchingMoment(inputs);

  return {
    id: "boundary-sanity",
    title: "Boundary or sanity case",
    inputs,
    expected: {
      cm: 0.04,
      deltaCm: 0,
      trimAngleDeg: "not available",
      disturbanceTendency: "neutral",
    },
    passed:
      approximatelyEqual(actual.cm, 0.04, CM_TOLERANCE) &&
      approximatelyZero(actual.deltaCm) &&
      actual.trimAngleDeg === null &&
      actual.disturbanceTendency === "neutral",
  };
}

function buildDecision(results) {
  if (!results.trimmed) {
    return {
      status: "caution",
      interpretation:
        "The selected condition is not trimmed under the specified " +
        "linear quasi-static model.",
    };
  }

  if (results.disturbanceTendency === "destabilizing") {
    return {
      status: "caution",
      interpretation:
        "The selected condition is trimmed, but the specified disturbance " +
        "has a destabilizing tendency in this model.",
    };
  }

  if (results.disturbanceTendency === "neutral") {
    return {
      status: "neutral",
      interpretation:
        "The selected condition is trimmed and the specified disturbance " +
        "has a neutral tendency in this model.",
    };
  }

  return {
    status: "pass",
    interpretation:
      "The selected condition is trimmed and the specified small " +
      "disturbance has a restoring tendency in this model.",
  };
}

function buildResults(results) {
  return [
    {
      id: "cm-alpha",
      label: "Cm(alpha)",
      value: results.cm,
      unit: "",
      precision: 6,
      emphasis: true,
    },
    {
      id: "trim-angle",
      label: "Trim angle",
      value:
        results.trimAngleDeg === null
          ? "not available"
          : results.trimAngleDeg,
      unit: results.trimAngleDeg === null ? "" : "deg",
      precision: 6,
      emphasis: false,
    },
    {
      id: "delta-cm",
      label: "delta_Cm",
      value: results.deltaCm,
      unit: "",
      precision: 6,
      emphasis: false,
    },
    {
      id: "trim-status",
      label: "Selected condition",
      value: results.trimmed ? "trimmed" : "not trimmed",
      unit: "",
      precision: 0,
      emphasis: false,
    },
    {
      id: "disturbance-tendency",
      label: "Disturbance tendency",
      value: results.disturbanceTendency,
      unit: "",
      precision: 0,
      emphasis: false,
    },
  ];
}

export const feature = {
  contractVersion: 4,
  id: "trim-response",
  title: "Live Cm–alpha relationship and trim",
  description:
    "Checks trim and small-disturbance pitching-moment tendency using " +
    "a linear quasi-static Cm-alpha model.",
  category: "Stability · Student feature",
  learningMode: "concept",
  topicId: "stability",
  inputKeys: [
    "cm0",
    "cmAlphaPerRad",
    "angleOfAttackDeg",
    "disturbanceAlphaDeg",
  ],
  requiresCapabilities: [REQUIRED_CAPABILITY],
  providesCapabilities: [
    {
      id: "stability.pitch.cm-alpha",
      version: 1,
    },
  ],
  assumptions: [
    "The Cm-alpha relationship is linear over the investigated range.",
    "The model is quasi-static and represents a small disturbance about the selected condition.",
    "Cm0 and Cm_alpha represent the same aircraft configuration and flight condition.",
    "Positive pitching moment and positive angle of attack are nose-up.",
  ],
  validityLimits: [
    "Do not use this linear relationship at stall, at large angle of attack, or where aerodynamic coefficients are strongly nonlinear.",
    "This model does not calculate a time history, damping, control motion, or handling quality.",
    "A restoring tendency in this model is not proof of acceptable safety, controllability, or flightworthiness.",
    "The calculated trim angle is meaningful only when the linear model remains valid at that angle.",
  ],
  simulation: {
    display: "analysis-only",
    durationS: 1,
    initialState: {},
    controls: {},
    disturbance: {},
  },

  analyze(aircraft, capabilityContext) {
    const capabilityAvailable = capabilityIsAvailable(
      capabilityContext,
      REQUIRED_CAPABILITY,
    );

    if (!capabilityAvailable) {
      return {
        results: [],
        verificationCases: [],
        decision: {
          question:
            "At the selected angle of attack, is the simplified " +
            "pitching-moment model trimmed, and does a small angle-of-" +
            "attack disturbance create a restoring moment tendency?",
          interpretation:
            "The required loads.pitch.component-sum capability is not " +
            "available at the required version, so Stage 4 cannot be evaluated.",
          status: "caution",
        },
        plots: [],
        scene: null,
      };
    }

    const calculated = analyzePitchingMoment(aircraft);

    const verificationCases = [
      numericalVerificationCase(),
      behavioralVerificationCase(),
      boundaryVerificationCase(),
    ];

    const decision = buildDecision(calculated);

    return {
      results: buildResults(calculated),
      verificationCases,
      decision: {
        question:
          "At the selected angle of attack, is the simplified " +
          "pitching-moment model trimmed, and does a small angle-of-" +
          "attack disturbance create a restoring moment tendency?",
        interpretation: decision.interpretation,
        status: decision.status,
      },
      plots: [
        {
          id: "cm-alpha",
          title: "Cm–alpha relationship",
          xAxis: {
            label: "Angle of attack",
            unit: "deg",
            min: PLOT_MIN_DEG,
            max: PLOT_MAX_DEG,
          },
          yAxis: {
            label: "Pitching-moment coefficient",
            unit: "",
          },
          series: [
            {
              id: "cm-alpha-model",
              label: "Cm(alpha)",
              points: buildPlotPoints(aircraft),
            },
          ],
          regions: [],
          referenceLines: [
            {
              id: "trim-line",
              label: "Cm = 0",
              axis: "y",
              value: 0,
            },
          ],
        },
      ],
      scene: null,
    };
  },
};

export const model = {
  kind: "derived",

  evaluate(runtimeContext) {
    const aircraft = runtimeContext?.aircraft;

    if (!aircraft) {
      throw new TypeError("runtimeContext.aircraft is required");
    }

    const calculated = analyzePitchingMoment(aircraft);

    return {
      values: {
        cm: calculated.cm,
        trimAngleDeg: calculated.trimAngleDeg,
        deltaCm: calculated.deltaCm,
        trimmed: calculated.trimmed,
        disturbanceTendency: calculated.disturbanceTendency,
      },
    };
  },
};