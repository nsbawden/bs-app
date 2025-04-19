const inputMappings = {
    batteryVoltage: 'batteryVoltage',
    numPulses: 'numPulses',
    pulseDuration: 'pulseDuration',
    turnsRatio: 'turnsRatio',
    primaryInductance: 'primaryInductanceInput',
    capacitance: 'capacitanceInput',
    couplingFactor: 'couplingFactor',
    secondaryResistance: 'secondaryResistance',
    primaryResistance: 'primaryResistance'
};

const defaultValues = {
    batteryVoltage: '10',
    numPulses: '16',
    pulseDuration: '0.0025',
    turnsRatio: '100',
    primaryInductance: '0.01',
    capacitance: '0.000003',
    couplingFactor: '0.9',
    secondaryResistance: '10000',
    primaryResistance: '1'
};

const paramKeys = Object.keys(inputMappings);

function toCleanPrecision(value, sigDigits) {
    const str = Number(value).toPrecision(sigDigits);
    return Number(str).toString();
}

function smartFormat(value, pre = 4) {
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0';

    const rounded = Number(value.toPrecision(pre));
    const absRounded = Math.abs(rounded);

    if (absRounded >= 10000 || absRounded < 0.0001) {
        return value.toExponential(pre - 1);
    }

    return toCleanPrecision(value, pre);
}

function getParams() {
    const params = {};
    for (const key of paramKeys) {
        const id = inputMappings[key];
        params[key] = parseFloat(document.getElementById(id).value);
    }
    return params;
}

function loadSavedValues() {
    for (const [key, id] of Object.entries(inputMappings)) {
        const input = document.getElementById(id);
        const saved = localStorage.getItem(key);
        input.value = saved && saved !== '' ? saved : defaultValues[key];
    }
}

function saveValues() {
    for (const [key, id] of Object.entries(inputMappings)) {
        const value = document.getElementById(id).value;
        localStorage.setItem(key, value);
    }
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
    const Q_pulse_battery = 0.5 * I_max * pulseDuration;
    const E_pulse_battery = 0.5 * primaryInductance * I_max * I_max;
    const E_total_battery = numPulses * E_pulse_battery;
    const P_pulse_battery = E_pulse_battery / pulseDuration;
    const Q_total_battery = numPulses * Q_pulse_battery;
    const secondaryInductance = turnsRatio * turnsRatio * primaryInductance;
    const V_sec = batteryVoltage * turnsRatio;

    let V_cap = 0;
    let E_total_cap = 0;
    let E_pulse_cap_sum = 0;
    let Q_total_cap = 0;
    let Q_pulse_cap_sum = 0;
    let total_t_off = 0;
    let pulses_delivered = 0;
    const capVoltages = [0]; // Store initial voltage

    for (let i = 0; i < numPulses; i++) {
        const V_before = V_cap;
        const V_eff = V_sec - V_cap - V_diode;
        if (V_eff <= 0) break;

        const charge_fraction = Math.min(1, V_eff / V_sec);
        const t_off = (Math.PI / 2) * Math.sqrt(secondaryInductance * capacitance);
        const damping_factor = Math.exp(-secondaryResistance * t_off / secondaryInductance);
        const Q_pulse_cap = couplingFactor * Q_pulse_battery * charge_fraction * damping_factor;

        V_cap += Q_pulse_cap / capacitance;
        capVoltages.push(V_cap); // Store voltage after each pulse
        const V_avg = (V_before + V_cap) / 2;
        const E_pulse_cap = Q_pulse_cap * V_avg;

        E_pulse_cap_sum += E_pulse_cap;
        Q_pulse_cap_sum += Q_pulse_cap;
        Q_total_cap += Q_pulse_cap;
        E_total_cap = 0.5 * capacitance * V_cap * V_cap;
        total_t_off += t_off;
        pulses_delivered++;
    }

    const Q_pulse_cap_avg = pulses_delivered > 0 ? Q_pulse_cap_sum / pulses_delivered : 0;
    const E_pulse_cap_avg = pulses_delivered > 0 ? E_pulse_cap_sum / pulses_delivered : 0;
    const P_pulse_cap_avg = E_pulse_cap_avg / pulseDuration;
    const t_off_avg = pulses_delivered > 0 ? total_t_off / pulses_delivered : 0;
    const energy_ratio = E_total_battery > 0 ? E_total_cap / E_total_battery : 0;

    return {
        battery: { Q_pulse_battery, Q_total_battery, E_pulse_battery, E_total_battery, P_pulse_battery },
        transformer: { secondaryInductance },
        capacitor: { V_cap, Q_pulse_cap_avg, Q_total_cap, E_pulse_cap_avg, E_total_cap, P_pulse_cap_avg, energy_ratio },
        switch: { t_off_avg, pulses_delivered },
        capVoltages
    };
}

function calculate() {
    blink();
    saveValues();
    const params = getParams();
    const result = simulateCircuit(params);
    const n_opt_actual = calculateOptimalPulses(params);

    document.getElementById('batteryChargePerPulse').textContent = smartFormat(result.battery.Q_pulse_battery);
    document.getElementById('batteryTotalCharge').textContent = smartFormat(result.battery.Q_total_battery);
    document.getElementById('batteryEnergyPerPulse').textContent = smartFormat(result.battery.E_pulse_battery);
    document.getElementById('batteryTotalEnergy').textContent = smartFormat(result.battery.E_total_battery);
    document.getElementById('batteryPowerPerPulse').textContent = smartFormat(result.battery.P_pulse_battery);
    document.getElementById('primaryInductanceInput').value = smartFormat(params.primaryInductance);
    document.getElementById('secondaryInductance').textContent = smartFormat(result.transformer.secondaryInductance);
    document.getElementById('pulseOffTime').textContent = smartFormat(result.switch.t_off_avg);
    document.getElementById('capacitanceInput').value = smartFormat(params.capacitance);
    document.getElementById('capVoltage').textContent = smartFormat(result.capacitor.V_cap);
    document.getElementById('capChargePerPulse').textContent = smartFormat(result.capacitor.Q_pulse_cap_avg);
    document.getElementById('capTotalCharge').textContent = smartFormat(result.capacitor.Q_total_cap);
    document.getElementById('capEnergyPerPulse').textContent = smartFormat(result.capacitor.E_pulse_cap_avg);
    document.getElementById('capTotalEnergy').textContent = smartFormat(result.capacitor.E_total_cap);
    document.getElementById('capPowerPerPulse').textContent = smartFormat(result.capacitor.P_pulse_cap_avg);
    document.getElementById('energyRatio').textContent = smartFormat(result.capacitor.energy_ratio);
    document.getElementById('optimalPulsesActual').textContent = smartFormat(n_opt_actual);

    // Clear previous graphs
    const container = document.getElementById('graphContainer');
    container.innerHTML = '';

    // Plot capacitor voltage
    const capVoltageValues = result.capVoltages.map((v, i) => ({ x: i, y: v }));

    plotGraph(
        container,
        capVoltageValues,
        0,0,0,
        'Pulse Number',
        'Capacitor Voltage (V)',
        'gold',
        'Capacitor Voltage vs Pulse Number'
    );

    // Plot user-selected graphs
    plotGraphs(result);
}

document.querySelectorAll('input[type=number]').forEach(input => {
    input.addEventListener('keypress', function (event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            calculate();
        }
    });
    // input.addEventListener('blur', function () {
    //     calculate();
    // });
});

loadSavedValues();
calculate();