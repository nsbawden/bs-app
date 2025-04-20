const inputIds = Array.from(document.querySelectorAll('input[type=number]')).map(input => input.id);
const outputIds = Array.from(document.querySelectorAll('.output-value')).map(el => el.id);
const checkboxKeys = Array.from(document.querySelectorAll('input[type=checkbox].graph-checkbox')).map(input => input.dataset.key);

const defaultValues = {
    batteryVoltage: '10',
    numPulses: '5',
    pulseDuration: '0.0025',
    turnsRatio: '100',
    primaryInductance: '0.01',
    capacitance: '0.0000011',
    couplingFactor: '0.9',
    secondaryResistance: '10000',
    primaryResistance: '1'
};

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
    const params = {};
    for (const id of inputIds) {
        const value = document.getElementById(id)?.value;
        params[id] = value ? parseFloat(value) : NaN;
    }
    return params;
}

function loadSavedValues() {
    // Restore number inputs
    const savedInputValues = localStorage.getItem('inputValues');
    const inputValues = savedInputValues ? JSON.parse(savedInputValues) : {};
    for (const id of inputIds) {
        const input = document.getElementById(id);
        if (!input) continue;
        input.value = inputValues[id] !== undefined ? inputValues[id] : defaultValues[id];
    }

    // Restore checkbox states
    const savedCheckboxStates = localStorage.getItem('checkboxStates');
    const checkboxStates = savedCheckboxStates ? JSON.parse(savedCheckboxStates) : {};
    for (const key of checkboxKeys) {
        const input = document.querySelector(`input[type=checkbox][data-key="${key}"]`);
        if (!input) continue;
        input.checked = checkboxStates[key] || false;
    }
}

function saveValues() {
    // Save number inputs
    const inputValues = {};
    for (const id of inputIds) {
        const input = document.getElementById(id);
        if (!input) continue;
        inputValues[id] = input.value;
    }
    localStorage.setItem('inputValues', JSON.stringify(inputValues));

    // Save checkbox states
    const checkboxStates = {};
    for (const key of checkboxKeys) {
        const input = document.querySelector(`input[type=checkbox][data-key="${key}"]`);
        if (!input) continue;
        checkboxStates[key] = input.checked;
    }
    localStorage.setItem('checkboxStates', JSON.stringify(checkboxStates));
}

function simulateCircuit(params) {
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
    if (container) {
        container.innerHTML = '';
    }

    const capVoltageValues = result.capVoltages.map((v, i) => ({ x: i, y: v }));
    plotGraph(
        container,
        capVoltageValues,
        0, 0, 0,
        'Pulse Number',
        'Capacitor Voltage (V)',
        'gold',
        'Capacitor Voltage vs Pulse Number'
    );

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