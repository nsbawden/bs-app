const prefix = document.querySelector('meta[name="prefix"]').content;

const MODELS = {
    DCTS: {
        getParams: DCTS_getParams,
        simulateCircuit: DCTS_simulateCircuit,
        defaultValues: {
            batteryVoltage: '10',
            numPulses: '5',
            pulseDuration: '0.0025',
            turnsRatio: '100',
            primaryInductance: '0.01',
            capacitance: '0.0000011',
            couplingFactor: '0.9',
            secondaryResistance: '10000',
            primaryResistance: '1'
        },
        calculateOptimalPulses: DCTS_calculateOptimalPulses
    },
    VMTS: {
        getParams: VMTS_getParams,
        simulateCircuit: VMTS_simulateCircuit,
        defaultValues: {
            batteryVoltage: '10',
            numPulses: '5',
            pulseDuration: '0.0025',
            capacitancePerStage: '0.000003',
            numStages: '4'
        },
        calculateOptimalPulses: VMTS_calculateOptimalPulses
    }
};

function getModel() {
    return MODELS[prefix] ?? {};
}

const inputIds = Array.from(document.querySelectorAll('input[type=number]')).map(input => input.id);
const outputIds = Array.from(document.querySelectorAll('.output-value')).map(el => el.id);
const checkboxKeys = Array.from(document.querySelectorAll('input[type=checkbox].graph-checkbox')).map(input => input.dataset.key);

function toCleanPrecision(value, sigDigits) {
    const str = Number(value).toPrecision(sigDigits);
    return Number(str).toString();
}

function smartFormat(value, pre = 4) {
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0';
    const rounded = Number(value).toPrecision(pre);
    const absRounded = Math.abs(rounded);
    if (absRounded >= 10000 || absRounded < 0.0001) {
        return value.toExponential(pre - 1);
    }
    return toCleanPrecision(value, pre);
}

function getParams() {
    return getModel().getParams?.() ?? {};
}

function loadSavedValues() {
    const model = getModel();
    const savedInputValues = localStorage.getItem(`${prefix}_inputValues`);
    const inputValues = savedInputValues ? JSON.parse(savedInputValues) : {};
    for (const id of inputIds) {
        const input = document.getElementById(id);
        if (!input) continue;
        input.value = inputValues[id] !== undefined
            ? inputValues[id]
            : model.defaultValues?.[id] ?? '';
    }

    const savedCheckboxStates = localStorage.getItem(`${prefix}_checkboxStates`);
    const checkboxStates = savedCheckboxStates ? JSON.parse(savedCheckboxStates) : {};
    for (const key of checkboxKeys) {
        const input = document.querySelector(`input[type=checkbox][data-key="${key}"]`);
        if (!input) continue;
        input.checked = checkboxStates[key] || false;
    }
}

function saveValues() {
    const inputValues = {};
    for (const id of inputIds) {
        const input = document.getElementById(id);
        if (!input) continue;
        inputValues[id] = input.value;
    }
    localStorage.setItem(`${prefix}_inputValues`, JSON.stringify(inputValues));

    const checkboxStates = {};
    for (const key of checkboxKeys) {
        const input = document.querySelector(`input[type=checkbox][data-key="${key}"]`);
        if (!input) continue;
        checkboxStates[key] = input.checked;
    }
    localStorage.setItem(`${prefix}_checkboxStates`, JSON.stringify(checkboxStates));
}

function simulateCircuit(params) {
    return getModel().simulateCircuit?.(params) ?? {};
}

function calculateOptimalPulses(params) {
    return getModel().calculateOptimalPulses?.(params) ?? 0;
}

function DCTS_getParams() {
    const params = {};
    for (const id of inputIds) {
        const value = document.getElementById(id)?.value;
        params[id] = value ? parseFloat(value) : NaN;
    }
    return params;
}

function DCTS_simulateCircuit(params) {
    const {
        primaryInductance,
        capacitance,
        batteryVoltage,
        turnsRatio,
        numPulses,
        pulseDuration,
        couplingFactor,
        secondaryResistance,
        primaryResistance
    } = params;

    const V_diode = 0.7;
    const tau = primaryInductance / primaryResistance;
    const I_max = (batteryVoltage / primaryResistance) * (1 - Math.exp(-pulseDuration / tau));
    const batteryChargePerPulse = 0.5 * I_max * pulseDuration;
    const batteryEnergyPerPulse = 0.5 * primaryInductance * I_max * I_max;
    const batteryTotalEnergy = numPulses * batteryEnergyPerPulse;
    const batteryPowerPerPulse = batteryEnergyPerPulse / pulseDuration;
    const batteryTotalCharge = numPulses * batteryChargePerPulse;
    const secondaryInductance = turnsRatio * turnsRatio * primaryInductance;
    const V_sec = batteryVoltage * turnsRatio;

    let capVoltage = 0;
    let capChargePerPulseSum = 0;
    let capTotalCharge = 0;
    let capEnergyPerPulseSum = 0;
    let totalPulseOffTime = 0;
    let pulsesDelivered = 0;
    const capVoltages = [0];

    for (let i = 0; i < numPulses; i++) {
        const V_before = capVoltage;
        const V_eff = V_sec - capVoltage - V_diode;
        if (V_eff <= 0) break;

        const chargeFraction = Math.min(1, V_eff / V_sec);
        const pulseOffTime = (Math.PI / 2) * Math.sqrt(secondaryInductance * capacitance);
        const dampingFactor = Math.exp(-secondaryResistance * pulseOffTime / secondaryInductance);
        const capChargePerPulse = couplingFactor * batteryChargePerPulse * chargeFraction * dampingFactor;

        capVoltage += capChargePerPulse / capacitance;
        capVoltages.push(capVoltage);
        const V_avg = (V_before + capVoltage) / 2;
        const capEnergyPerPulse = capChargePerPulse * V_avg;

        capEnergyPerPulseSum += capEnergyPerPulse;
        capChargePerPulseSum += capChargePerPulse;
        capTotalCharge += capChargePerPulse;
        totalPulseOffTime += pulseOffTime;
        pulsesDelivered++;
    }

    const capChargePerPulse = pulsesDelivered > 0 ? capChargePerPulseSum / pulsesDelivered : 0;
    const capEnergyPerPulse = pulsesDelivered > 0 ? capEnergyPerPulseSum / pulsesDelivered : 0;
    const capPowerPerPulse = capEnergyPerPulse / pulseDuration;
    const pulseOffTime = pulsesDelivered > 0 ? totalPulseOffTime / pulsesDelivered : 0;
    const capTotalEnergy = 0.5 * capacitance * capVoltage * capVoltage;
    const energyRatio = batteryTotalEnergy > 0 ? capTotalEnergy / batteryTotalEnergy : 0;

    return {
        batteryChargePerPulse,
        batteryTotalCharge,
        batteryEnergyPerPulse,
        batteryTotalEnergy,
        batteryPowerPerPulse,
        secondaryInductance,
        pulseOffTime,
        capVoltage,
        capChargePerPulse,
        capTotalCharge,
        capEnergyPerPulse,
        capTotalEnergy,
        capPowerPerPulse,
        energyRatio,
        pulsesDelivered,
        capVoltages
    };
}

function DCTS_calculateOptimalPulses({ key = 'numPulses', min = 1, max = 1000, step = 1 }) {
    const values = computeGraph({ key, min, max, step });
    let maxY = 0;
    let optimal = 0;
    values.forEach(({ x, y }) => {
        console.log(`numPulses=${x}, energyRatio=${y.toFixed(3)}`);
        if (y > maxY) {
            maxY = y;
            optimal = x;
        }
    });
    return optimal;
}

function VMTS_getParams() {
    const params = {};
    for (const id of inputIds) {
        const value = document.getElementById(id)?.value;
        params[id] = value ? parseFloat(value) : NaN;
    }
    return params;
}

/*
 * VMTS_simulateCircuit models a Cockcroft-Walton voltage multiplier circuit driven by an H-bridge
 * producing a square wave from a DC battery voltage. The circuit consists of `numStages` stages,
 * each with a charging and doubling capacitor. The model simulates the incremental voltage buildup
 * across capacitors over `numPulses` pulses, each with duration `pulseDuration`.
 *
 */
function VMTS_simulateCircuit(params) {
    const {
        batteryVoltage,
        numPulses,
        capacitancePerStage,
        numStages,
        pulseDuration,
        diodeDrop = 0.4 // forward voltage drop per diode
    } = params;

    const capVoltages = [];
    let capVoltage = 0; // initial voltage on input capacitor
    let batteryTotalCharge = 0;
    let batteryTotalEnergy = 0;

    const diodeDropPerStage = 2 * diodeDrop; // 2 diodes per stage (one per half-cycle)
    const effectiveVoltagePerStage = batteryVoltage - diodeDropPerStage;
    const effectiveVoltageTotal = numStages * effectiveVoltagePerStage;

    for (let i = 0; i < numPulses; i++) {
        // Voltage across the input capacitor in this pulse
        const deltaV = Math.max(effectiveVoltagePerStage - capVoltage, 0);

        // Charge drawn from battery this pulse
        const deltaQ = capacitancePerStage * deltaV;

        // Energy drawn this pulse
        const deltaE = batteryVoltage * deltaQ;

        // Update input capacitor voltage
        capVoltage += deltaV;

        // Save cumulative charge and energy
        batteryTotalCharge += deltaQ;
        batteryTotalEnergy += deltaE;

        // Total output voltage from CW multiplier
        const idealMax = 2 * numStages * effectiveVoltagePerStage;
        const outputVoltage = idealMax * (1 - Math.exp(-i / numStages));
        capVoltages.push(outputVoltage);
    }

    const capVoltageFinal = capVoltages.at(-1);
    const totalCapacitance = capacitancePerStage / numStages;
    const capTotalCharge = totalCapacitance * capVoltageFinal;
    const capTotalEnergy = 0.5 * totalCapacitance * capVoltageFinal ** 2;
    const energyRatio = capTotalEnergy / batteryTotalEnergy;

    const batteryEnergyPerPulseAvg = batteryTotalEnergy / numPulses;
    const batteryPowerPerPulseAvg = batteryEnergyPerPulseAvg / pulseDuration;

    return {
        batteryTotalCharge,
        batteryTotalEnergy,
        batteryEnergyPerPulseAvg,
        batteryPowerPerPulseAvg,
        totalCapacitance,
        capVoltage: capVoltageFinal,
        capTotalCharge,
        capTotalEnergy,
        energyRatio,
        capVoltages
    };
}


function VMTS_calculateOptimalPulses({ key = 'numPulses', min = 1, max = 20, step = 1 }) {
    const values = computeGraph({ key, min, max, step });
    let maxY = 0;
    let optimal = 0;
    values.forEach(({ x, y }) => {
        if (y > maxY) {
            maxY = y;
            optimal = x;
        }
    });
    return optimal;
}

function calculate() {
    blink();
    saveValues();
    const params = getParams();
    const result = simulateCircuit(params);
    const optimalPulsesActual = calculateOptimalPulses(params);

    for (const id of outputIds.concat(inputIds)) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID ${id} not found`);
            continue;
        }
        const value = id === 'optimalPulsesActual' ? optimalPulsesActual : (result[id] ?? params[id]);
        const formattedValue = smartFormat(value);
        if (element.tagName === 'INPUT') {
            element.value = formattedValue;
        } else {
            element.textContent = formattedValue;
        }
    }

    const container = document.getElementById('graphContainer');
    if (container) container.innerHTML = '';

    const capVoltageValues = result.capVoltages?.map((v, i) => ({ x: i, y: v })) ?? [];
    plotGraph({
        container,
        values: capVoltageValues,
        min: 0,
        max: 0,
        step: 0,
        xLabel: 'Pulse Number',
        yLabel: 'Output Voltage (V)',
        color: 'gold',
        title: 'Output Voltage vs Pulse Number'
    });
    plotGraphs(result);
}

document.querySelectorAll('input[type=number]').forEach(input => {
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' || event.keyCode === 13) {
            event.preventDefault();
            calculate();
        }
    });
});

document.querySelectorAll('input[type=checkbox].graph-checkbox').forEach(input => {
    input.addEventListener('change', () => {
        calculate();
    });
});

loadSavedValues();
calculate();