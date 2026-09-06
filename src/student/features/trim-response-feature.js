import {
  calculateCm,
  calculateTrimAngleDeg,
  calculateDeltaCm,
  classifyDisturbance,
  isTrimmed,
} from "../physics/trim-response.js";

const CM_REFERENCE_TOLERANCE = 1e-4;

function hasRequiredCapability(capabilityContext) {
  const capabilities =
    capabilityContext?.capabilities ?? capabilityContext ?? {};

  if (Array.isArray(capabilities)) {
    return capabilities.some(
      (capability) =>
        capability?.id === "loads.pitch.component-sum" &&
        Number(capability?.version) >= 1
    );
  }

  const capability = capabilities["loads.pitch.component-sum"];

  if (capability == null) {
    return false;
  }

  if (typeof capability === "number") {
    return capability >= 1;
  }

  return Number(capability.version) >= 1;
}

function calculateAnalysis(aircraft) {
  const {
    cm0,
    cmAlphaPerRad,
    angleOfAttackDeg,
    disturbanceAlphaDeg,
  } = aircraft;

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

  const trimmed = isTrimmed(cm);
  const tendency = classifyDisturbance(
    cmAlphaPerRad,
    disturbanceAlphaDeg
  );

  return {
    cm,
    trimAngleDeg,
    deltaCm,
    trimmed,
    tendency,
  };
}

function runVerificationCases() {
  const numericalInputs = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const numerical = calculateAnalysis(numericalInputs);

  const behavioralInputs = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 4.0,
  };

  const behavioral = calculateAnalysis(behavioralInputs);

  const boundaryInputs = {
    cm0: 0.04,
    cmAlphaPerRad: 0,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const boundary = calculateAnalysis(boundaryInputs);

  return [
    {
      id: "numerical",
      passed:
        Math.abs(numerical.cm - 0.0001) <= CM_REFERENCE_TOLERANCE &&
        Math.abs(numerical.trimAngleDeg - 2.865) <= CM_REFERENCE_TOLERANCE &&
        Math.abs(numerical.deltaCm - -0.027) <= CM_REFERENCE_TOLERANCE &&
        numerical.trimmed === true &&
        numerical.tendency === "restoring",
    },
    {
      id: "behavioral",
      passed:
        Math.abs(
          Math.abs(behavioral.deltaCm) -
            2 * Math.abs(numerical.deltaCm)
        ) <= CM_REFERENCE_TOLERANCE &&
        behavioral.deltaCm < 0 &&
        behavioral.tendency === "restoring",
    },
    {
      id: "boundary",
      passed:
        Math.abs(boundary.cm - 0.04) <= CM_REFERENCE_TOLERANCE &&
        Math.abs(boundary.deltaCm) <= CM_REFERENCE_TOLERANCE &&
        boundary.trimAngleDeg === null &&
        boundary.tendency === "neutral",
    },
  ];
}

function buildPlot(cm0, cmAlphaPerRad, selectedAngleDeg) {
  const points = [];

  for (let angleDeg = -10; angleDeg <= 10; angleDeg += 1) {
    points.push({
      x: angleDeg,
      y: calculateCm(cm0, cmAlphaPerRad, angleDeg),
    });
  }

  if (!points.some((point) => point.x === selectedAngleDeg)) {
    points.push({
      x: selectedAngleDeg,
      y: calculateCm(
        cm0,
        cmAlphaPerRad,
        selectedAngleDeg
      ),
    });
    points.sort((a, b) => a.x - b.x);
  }

  return {
    xKey: "x",
    yKey: "y",
    xLabel: "Angle of attack (deg)",
    yLabel: "Pitching-moment coefficient",
    series: [
      {
        id: "cm-alpha",
        label: "Cm(alpha)",
        points,
      },
    ],
    regions: [],
    referenceLines: [
      {
        id: "trim-line",
        label: "Cm = 0",
        y: 0,
      },
    ],
  };
}

export const feature = {
  contractVersion: 4,
  id: "trim-response",
  title: "Live Cm–alpha relationship and trim",
  description:
    "Checks trim and small-disturbance pitching-moment tendency using the linear Cm-alpha model.",
  category: "Stability · Student feature",
  learningMode: "concept",
  topicId: "stability",
  inputKeys: [
    "cm0",
    "cmAlphaPerRad",
    "angleOfAttackDeg",
    "disturbanceAlphaDeg",
  ],
  requiresCapabilities: [
    {
      id: "loads.pitch.component-sum",
      version: 1,
    },
  ],
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
    if (!hasRequiredCapability(capabilityContext)) {
      return {
        results: [],
        verificationCases: [],
        decision: {
          question:
            "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
          interpretation:
            "The Stage 4 analysis is locked because the required loads.pitch.component-sum capability is not available.",
          status: "caution",
        },
        plots: [],
        scene: null,
      };
    }

    const {
      cm,
      trimAngleDeg,
      deltaCm,
      trimmed,
      tendency,
    } = calculateAnalysis(aircraft);

    const verificationCases = runVerificationCases();

    const allVerificationPassed = verificationCases.every(
      (testCase) => testCase.passed
    );

    let decisionStatus = "neutral";

    if (tendency === "restoring" && trimmed) {
      decisionStatus = "pass";
    } else if (
      tendency === "destabilizing" ||
      !trimmed ||
      !allVerificationPassed
    ) {
      decisionStatus = "caution";
    }

    return {
      results: [
        {
          id: "cm-alpha",
          label: "Pitching-moment coefficient, Cm(alpha)",
          value: cm,
          unit: "",
          precision: 6,
          emphasis: true,
        },
        {
          id: "trim-angle",
          label: "Trim angle",
          value: trimAngleDeg === null
            ? "not available"
            : trimAngleDeg,
          unit: trimAngleDeg === null ? "" : "deg",
          precision: 3,
          emphasis: false,
        },
        {
          id: "delta-cm",
          label: "Disturbance moment-coefficient change, delta_Cm",
          value: deltaCm,
          unit: "",
          precision: 6,
          emphasis: false,
        },
        {
          id: "trim-status",
          label: "Selected condition",
          value: trimmed ? "trimmed" : "not trimmed",
          unit: "",
          precision: 0,
          emphasis: false,
        },
        {
          id: "disturbance-tendency",
          label: "Disturbance tendency",
          value: tendency,
          unit: "",
          precision: 0,
          emphasis: false,
        },
      ],
      verificationCases,
      decision: {
        question:
          "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
        interpretation:
          `The selected condition is ${trimmed ? "trimmed" : "not trimmed"}, and the disturbance has a ${tendency} tendency according to the linear, quasi-static Cm-alpha model. This does not establish flight safety, controllability, or real-world flightworthiness.`,
        status: decisionStatus,
      },
      plots: [
        buildPlot(
          aircraft.cm0,
          aircraft.cmAlphaPerRad,
          aircraft.angleOfAttackDeg
        ),
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
      return {
        values: {},
      };
    }

    const cm = calculateCm(
      aircraft.cm0,
      aircraft.cmAlphaPerRad,
      aircraft.angleOfAttackDeg
    );

    const trimAngleDeg = calculateTrimAngleDeg(
      aircraft.cm0,
      aircraft.cmAlphaPerRad
    );

    const deltaCm = calculateDeltaCm(
      aircraft.cmAlphaPerRad,
      aircraft.disturbanceAlphaDeg
    );

    return {
      values: {
        cm,
        trimAngleDeg,
        deltaCm,
        trimmed: isTrimmed(cm),
        tendency: classifyDisturbance(
          aircraft.cmAlphaPerRad,
          aircraft.disturbanceAlphaDeg
        ),
      },
    };
  },
};