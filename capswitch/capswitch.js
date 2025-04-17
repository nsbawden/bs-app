// capswitch.js

// Load saved values from local storage or set defaults
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
    numPulses: '5',
    pulseDuration: '1',
    turnsRatio: '30',
    primaryInductance: '0.01',
    capacitance: '0.000003',
    couplingFactor: '0.9',
    secondaryResistance: '10000',
    primaryResistance: '1'
};

function getParams() {
    return {
        Lp: parseFloat(document.getElementById('primaryInductanceInput').value),
        C: parseFloat(document.getElementById('capacitanceInput').value),
        Vb: parseFloat(document.getElementById('batteryVoltage').value),
        N: parseFloat(document.getElementById('turnsRatio').value),
        n: parseInt(document.getElementById('numPulses').value),
        t_pulse: parseFloat(document.getElementById('pulseDuration').value) * 0.001,
        k: parseFloat(document.getElementById('couplingFactor').value),
        Rs: parseFloat(document.getElementById('secondaryResistance').value),
        Rp: parseFloat(document.getElementById('primaryResistance').value)
    };
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

// Core simulation function (extracted for reuse)
function simulateCircuit(params) {
    const {
        Lp, C, Vb, N, n, t_pulse, k, Rs, Rp
    } = params;
    const V_diode = 0.7;
    const tau = Lp / Rp;
    const I_max = (Vb / Rp) * (1 - Math.exp(-t_pulse / tau));
    const Q_pulse_battery = 0.5 * I_max * t_pulse;
    const E_pulse_battery = 0.5 * Lp * I_max * I_max;
    const E_total_battery = n * E_pulse_battery;
    const P_pulse_battery = E_pulse_battery / t_pulse;
    const Q_total_battery = n * Q_pulse_battery;
    const Ls = N * N * Lp;
    const V_sec = Vb * N;

    let V_cap = 0;
    let E_total_cap = 0;
    let E_pulse_cap_sum = 0;
    let Q_total_cap = 0;
    let Q_pulse_cap_sum = 0;
    let total_t_off = 0;
    let pulses_delivered = 0;

    for (let i = 0; i < n; i++) {
        const V_before = V_cap;
        const V_eff = V_sec - V_cap - V_diode;
        if (V_eff <= 0) break;
        const charge_fraction = Math.min(1, V_eff / V_sec);
        const t_off = (Math.PI / 2) * Math.sqrt(Ls * C);
        const damping_factor = Math.exp(-Rs * t_off / Ls);
        const Q_pulse_cap = k * Q_pulse_battery * charge_fraction * damping_factor;
        V_cap += Q_pulse_cap / C;
        const V_avg = (V_before + V_cap) / 2;
        const E_pulse_cap = Q_pulse_cap * V_avg;
        E_pulse_cap_sum += E_pulse_cap;
        Q_pulse_cap_sum += Q_pulse_cap;
        Q_total_cap += Q_pulse_cap;
        E_total_cap = 0.5 * C * V_cap * V_cap;
        total_t_off += t_off;
        pulses_delivered++;
    }

    const Q_pulse_cap_avg = pulses_delivered > 0 ? Q_pulse_cap_sum / pulses_delivered : 0;
    const E_pulse_cap_avg = pulses_delivered > 0 ? E_pulse_cap_sum / pulses_delivered : 0;
    const P_pulse_cap_avg = E_pulse_cap_avg / t_pulse;
    const t_off_avg = pulses_delivered > 0 ? total_t_off / pulses_delivered : 0;
    const energy_ratio = E_total_battery > 0 ? E_total_cap / E_total_battery : 0;

    return {
        battery: { Q_pulse_battery, Q_total_battery, E_pulse_battery, E_total_battery, P_pulse_battery },
        transformer: { Ls },
        capacitor: { V_cap, Q_pulse_cap_avg, Q_total_cap, E_pulse_cap_avg, E_total_cap, P_pulse_cap_avg, energy_ratio },
        switch: { t_off_avg, pulses_delivered }
    };
}

// General-purpose function to compute optimal pulses
function calculateOptimalPulses(params) {
    const values = computeGraph('n', 1, 1000, 1);
    let max = 0;
    let n_opt = 0;
    values.forEach(({ x, y }) => {
        if (y > max) {
            max = y;
            n_opt = x;
        }
    });
    return n_opt;
}

// General-purpose graph creation function
function computeGraph(key, min, max, step) {
    const params = {
        Lp: parseFloat(document.getElementById('primaryInductanceInput').value),
        C: parseFloat(document.getElementById('capacitanceInput').value),
        Vb: parseFloat(document.getElementById('batteryVoltage').value),
        N: parseFloat(document.getElementById('turnsRatio').value),
        n: parseInt(document.getElementById('numPulses').value),
        t_pulse: parseFloat(document.getElementById('pulseDuration').value) * 0.001,
        k: parseFloat(document.getElementById('couplingFactor').value),
        Rs: parseFloat(document.getElementById('secondaryResistance').value),
        Rp: parseFloat(document.getElementById('primaryResistance').value)
    };

    const values = [];
    for (let val = min; val <= max; val += step) {
        params[key] = val;
        const result = simulateCircuit(params);
        values.push({
            x: val,
            y: result.capacitor.energy_ratio // Example: Plot energy ratio
        });
    }
    return values;
}

function calculate() {
    saveValues();
    const params = getParams();

    const result = simulateCircuit(params);
    const n_opt_actual = calculateOptimalPulses(params);

    // Update outputs
    document.getElementById('batteryChargePerPulse').textContent = result.battery.Q_pulse_battery.toExponential(2);
    document.getElementById('batteryTotalCharge').textContent = result.battery.Q_total_battery.toExponential(2);
    document.getElementById('batteryEnergyPerPulse').textContent = result.battery.E_pulse_battery.toFixed(6);
    document.getElementById('batteryTotalEnergy').textContent = result.battery.E_total_battery.toFixed(6);
    document.getElementById('batteryPowerPerPulse').textContent = result.battery.P_pulse_battery.toFixed(2);
    document.getElementById('primaryInductanceInput').value = params.Lp.toFixed(4);
    document.getElementById('secondaryInductance').textContent = result.transformer.Ls.toFixed(2);
    document.getElementById('pulseOffTime').textContent = (result.switch.t_off_avg * 1000).toPrecision(4);
    document.getElementById('capacitanceInput').value = params.C.toExponential(2);
    document.getElementById('capVoltage').textContent = result.capacitor.V_cap.toFixed(2);
    document.getElementById('capChargePerPulse').textContent = result.capacitor.Q_pulse_cap_avg.toExponential(2);
    document.getElementById('capTotalCharge').textContent = result.capacitor.Q_total_cap.toExponential(2);
    document.getElementById('capEnergyPerPulse').textContent = result.capacitor.E_pulse_cap_avg.toFixed(6);
    document.getElementById('capTotalEnergy').textContent = result.capacitor.E_total_cap.toFixed(6);
    document.getElementById('capPowerPerPulse').textContent = result.capacitor.P_pulse_cap_avg.toFixed(2);
    document.getElementById('energyRatio').textContent = result.capacitor.energy_ratio.toFixed(2);
    document.getElementById('optimalPulsesActual').textContent = n_opt_actual;
}

// Add Enter key event listeners to all number inputs
document.querySelectorAll('input[type=number]').forEach(input => {
    input.addEventListener('keypress', function (event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            calculate();
        }
    });
});


// Initialize
loadSavedValues();
calculate();
