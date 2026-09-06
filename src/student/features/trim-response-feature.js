import {
    calculateCm,
    calculateTrimAngleDeg,
    calculateDeltaCm,
    classifyDisturbance,
    isTrimmed,
} from "../physics/trim-response.js";

const CONTRACT_VERSION = 4;
const TRIM_TOLERANCE = 1e-6;

const REFERENCE_AIRCRAFT = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.86479,
    disturbanceAlphaDeg: 2.0,
};

function hasRequiredCapability(capabilityContext) {
    const capabilities = capabilityContext?.capabilities;

    if (!capabilities) {
        return false;
    }

    if (Array.isArray(capabilities)) {
        return capabilities.some(
            (capability) =>
                capability === "loads.pitch.component-sum" ||
                capability?.id === "loads.pitch.component-sum" ||
                capability?.name === "loads.pitch.component-sum"
        );
    }

    return Boolean(
        capabilities["loads.pitch.component-sum"] ||
        capabilities["loads.pitch.component-sum@1"]
    );
}

function validateAircraft(aircraft) {
    if (!aircraft || typeof aircraft !== "object") {
        throw new TypeError("aircraft must be an object");
    }

    const requiredKeys = [
        "cm0",
        "cmAlphaPerRad",
        "angleOfAttackDeg",
        "disturbanceAlphaDeg",
    ];

    for (const key of requiredKeys) {
        if (
            typeof aircraft[key] !== "number" ||
            !Number.isFinite(aircraft[key])
        ) {
            throw new TypeError(`${key} must be a finite number`);
        }
    }
}

function calculateAnalysis(aircraft) {
    validateAircraft(aircraft);

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

    const tendency = classifyDisturbance(
        aircraft.disturbanceAlphaDeg,
        deltaCm
    );

    const trimmed = isTrimmed(cm);

    return {
        cm,
        trimAngleDeg,
        deltaCm,
        trimmed,
        tendency,
    };
}

function makeVerificationCases() {
    const numerical = calculateAnalysis(REFERENCE_AIRCRAFT);

    const doubledDisturbanceAircraft = {
        ...REFERENCE_AIRCRAFT,
        disturbanceAlphaDeg: 4.0,
    };

    const doubledDisturbance = calculateAnalysis(
        doubledDisturbanceAircraft
    );

    const boundaryAircraft = {
        cm0: 0.04,
        cmAlphaPerRad: 0,
        angleOfAttackDeg: 2.86,
        disturbanceAlphaDeg: 2.0,
    };

    const boundary = calculateAnalysis(boundaryAircraft);

    return [
        {
            id: "numerical-reference",
            description: "Reference trimmed condition with a positive disturbance.",
            inputs: REFERENCE_AIRCRAFT,
            expected: {
                cm: 0.0001,
                trimAngleDeg: 2.86479,
                deltaCm: -0.0279253,
                trimmed: true,
                tendency: "restoring",
            },
            passed:
                Math.abs(numerical.cm - 0.0001) <= 1e-4 &&
                numerical.trimAngleDeg !== null &&
                Math.abs(numerical.trimAngleDeg - 2.86479) <= 1e-4 &&
                Math.abs(numerical.deltaCm - (-0.0279253)) <= 1e-4 &&
                numerical.trimmed === true &&
                numerical.tendency === "restoring",
        },
        {
            id: "doubled-disturbance",
            description: "Doubling disturbance angle doubles delta_Cm magnitude.",
            inputs: doubledDisturbanceAircraft,
            expected: {
                deltaCmMagnitudeRatio: 2,
                tendency: "restoring",
            },
            passed:
                Math.abs(
                    Math.abs(doubledDisturbance.deltaCm) /
                        Math.abs(numerical.deltaCm) -
                        2
                ) <= 1e-10 &&
                doubledDisturbance.tendency === "restoring",
        },
        {
            id: "zero-slope-boundary",
            description: "Zero Cm-alpha slope produces no disturbance moment change and no available trim angle.",
            inputs: boundaryAircraft,
            expected: {
                cm: 0.04,
                trimAngleDeg: null,
                deltaCm: 0,
                trimmed: false,
                tendency: "neutral",
            },
            passed:
                Math.abs(boundary.cm - 0.04) <= 1e-10 &&
                boundary.trimAngleDeg === null &&
                Math.abs(boundary.deltaCm) <= 1e-10 &&
                boundary.trimmed === false &&
                boundary.tendency === "neutral",
        },
    ];
}

function buildPlot() {
    const points = [];

    for (let angleDeg = -10; angleDeg <= 10; angleDeg += 1) {
        points.push({
            x: angleDeg,
            y: calculateCm(
                REFERENCE_AIRCRAFT.cm0,
                REFERENCE_AIRCRAFT.cmAlphaPerRad,
                angleDeg
            ),
        });
    }

    return {
        id: "cm-alpha",
        title: "Cm–Alpha Relationship",
        x: {
            label: "Angle of attack",
            unit: "deg",
        },
        y: {
            label: "Pitching moment coefficient",
            unit: "",
        },
        points,
        lines: [
            {
                id: "cm-zero",
                type: "horizontal",
                value: 0,
                label: "Cm = 0",
            },
        ],
        regions: [],
    };
}

export const trimResponseFeature = {
    contractVersion: CONTRACT_VERSION,

    id: "trim-response",

    title: "Live Cm–Alpha Relationship and Trim",

    description:
        "Evaluates the simplified pitching-moment model at the selected angle of attack and classifies the response to a small angle-of-attack disturbance.",

    category: "stability",

    learningMode: "analysis",

    topicId: "pitch-stability",

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
        "Linear Cm-alpha relationship.",
        "Small quasi-static angle-of-attack disturbance.",
        "Same aircraft configuration and flight condition.",
        "Positive pitching moment and positive angle of attack are nose-up.",
    ],

    validityLimits: [
        "Not intended for stall or large-angle nonlinear behavior.",
        "Does not model time history or damping.",
        "Does not assess control authority or handling qualities.",
        "Restoring tendency alone does not establish safety, controllability, or flightworthiness.",
        "Trim is meaningful only when the linear model is valid.",
    ],

    simulation: {
        analysisOnly: true,
        duration: 1,
        initialState: {},
        controls: {},
        disturbance: {},
    },

    analyze(aircraft, capabilityContext = {}) {
        const analysis = calculateAnalysis(aircraft);
        const capabilityAvailable =
            hasRequiredCapability(capabilityContext);

        return {
            results: [
                {
                    key: "cm",
                    label: "Cm(alpha)",
                    value: analysis.cm,
                    unit: "",
                    precision: 6,
                    emphasis: "primary",
                },
                {
                    key: "trimAngleDeg",
                    label: "Trim angle",
                    value: analysis.trimAngleDeg,
                    unit: "deg",
                    precision: 3,
                },
                {
                    key: "deltaCm",
                    label: "Delta Cm",
                    value: analysis.deltaCm,
                    unit: "",
                    precision: 6,
                },
                {
                    key: "trimmed",
                    label: "Selected condition trimmed",
                    value: analysis.trimmed,
                    unit: "",
                    precision: 0,
                },
                {
                    key: "tendency",
                    label: "Disturbance tendency",
                    value: analysis.tendency,
                    unit: "",
                    precision: 0,
                },
                {
                    key: "requiredCapabilityAvailable",
                    label: "Required load capability available",
                    value: capabilityAvailable,
                    unit: "",
                    precision: 0,
                },
            ],

            verificationCases: makeVerificationCases(),

            decision: {
                status: analysis.trimmed
                    ? analysis.tendency === "restoring"
                        ? "pass"
                        : "caution"
                    : "caution",
                label: analysis.trimmed
                    ? analysis.tendency === "restoring"
                        ? "Trimmed with restoring tendency"
                        : "Trimmed but disturbance tendency is not restoring"
                    : "Selected condition is not trimmed",
            },

            plots: [buildPlot()],

            scene: null,
        };
    },

    model: {
        evaluate(runtimeContext = {}) {
            const aircraft = runtimeContext.aircraft;

            if (!aircraft) {
                throw new TypeError("runtimeContext.aircraft is required");
            }

            const values = calculateAnalysis(aircraft);

            return {
                values,
            };
        },
    },
};

export default trimResponseFeature;