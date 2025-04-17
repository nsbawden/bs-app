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

function showJsonPopup() {
    const result = {
        inputs: {
            batteryVoltage: parseFloat(document.getElementById('batteryVoltage').value),
            numPulses: parseInt(document.getElementById('numPulses').value),
            pulseDuration: parseFloat(document.getElementById('pulseDuration').value),
            turnsRatio: parseFloat(document.getElementById('turnsRatio').value),
            primaryInductance: parseFloat(document.getElementById('primaryInductanceInput').value),
            capacitance: parseFloat(document.getElementById('capacitanceInput').value),
            couplingFactor: parseFloat(document.getElementById('couplingFactor').value),
            secondaryResistance: parseFloat(document.getElementById('secondaryResistance').value),
            primaryResistance: parseFloat(document.getElementById('primaryResistance').value)
        },
        outputs: {
            battery: {
                chargePerPulse: parseFloat(document.getElementById('batteryChargePerPulse').textContent),
                totalCharge: parseFloat(document.getElementById('batteryTotalCharge').textContent),
                energyPerPulse: parseFloat(document.getElementById('batteryEnergyPerPulse').textContent),
                totalEnergy: parseFloat(document.getElementById('batteryTotalEnergy').textContent),
                powerPerPulse: parseFloat(document.getElementById('batteryPowerPerPulse').textContent)
            },
            switch: {
                pulseOffTime: parseFloat(document.getElementById('pulseOffTime').textContent) / 1000,
                optimalPulsesActual: parseInt(document.getElementById('optimalPulsesActual').textContent)
            },
            transformer: {
                secondaryInductance: parseFloat(document.getElementById('secondaryInductance').textContent)
            },
            capacitor: {
                finalVoltage: parseFloat(document.getElementById('capVoltage').textContent),
                chargePerPulseAvg: parseFloat(document.getElementById('capChargePerPulse').textContent),
                totalCharge: parseFloat(document.getElementById('capTotalCharge').textContent),
                energyPerPulseAvg: parseFloat(document.getElementById('capEnergyPerPulse').textContent),
                totalEnergy: parseFloat(document.getElementById('capTotalEnergy').textContent),
                powerPerPulseAvg: parseFloat(document.getElementById('capPowerPerPulse').textContent),
                energyRatio: parseFloat(document.getElementById('energyRatio').textContent)
            }
        }
    };
    const jsonString = JSON.stringify(result, null, 2);
    document.getElementById('jsonOutput').value = jsonString;
    document.getElementById('jsonPopup').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

function closeJsonPopup() {
    document.getElementById('jsonPopup').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
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
    const values = computeParameterValues('n', 1, 1000, 1);
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

function xcalculateOptimalPulses(params) {
    const { Lp, C, Vb, N, t_pulse, k, Rs, Rp } = params;
    let max_energy_ratio = 0;
    let n_opt_actual = 0;
    const Q_pulse_battery = simulateCircuit(params).battery.Q_pulse_battery;
    const E_pulse_battery = simulateCircuit(params).battery.E_pulse_battery;
    const V_sec = Vb * N;
    const V_diode = 0.7;
    const Ls = N * N * Lp;

    for (let test_n = 1; test_n <= 1000; test_n++) {
        let test_V_cap = 0;
        let test_Q_total_cap = 0;
        for (let i = 0; i < test_n; i++) {
            const test_V_eff = V_sec - test_V_cap - V_diode;
            if (test_V_eff <= 0) break;
            const test_charge_fraction = Math.min(1, test_V_eff / V_sec);
            const test_t_off = (Math.PI / 2) * Math.sqrt(Ls * C);
            const test_damping_factor = Math.exp(-Rs * test_t_off / Ls);
            const test_Q_pulse_cap = k * Q_pulse_battery * test_charge_fraction * test_damping_factor;
            test_V_cap += test_Q_pulse_cap / C;
            test_Q_total_cap += test_Q_pulse_cap;
        }
        const test_E_cap = 0.5 * C * test_V_cap * test_V_cap;
        const test_E_total_battery = test_n * E_pulse_battery;
        const test_energy_ratio = test_E_total_battery > 0 ? test_E_cap / test_E_total_battery : 0;
        if (test_energy_ratio > max_energy_ratio) {
            max_energy_ratio = test_energy_ratio;
            n_opt_actual = test_n;
        }
    }
    return n_opt_actual;
}

// General-purpose graphing function
function computeParameterValues(key, min, max, step) {
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
        params[key] = key === 'n' ? Math.round(val) : val;
        const result = simulateCircuit(params);
        values.push({
            x: val,
            y: result.capacitor.energy_ratio // Example: Plot energy ratio
        });
    }
    return values;
}

// Plot graphs on canvas
function plotGraphs() {
    const canvas = document.getElementById('graphCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const checkboxes = document.querySelectorAll('.graph-checkbox:checked');
    if (checkboxes.length === 0) {
        ctx.font = '16px Arial';
        ctx.fillText('Select parameters to graph', 10, 20);
        return;
    }

    const colors = ['blue', 'red', 'green', 'purple', 'orange', 'cyan'];
    let allValues = [];
    checkboxes.forEach((checkbox, index) => {
        const key = checkbox.getAttribute('data-key');
        // Use specific range for numPulses
        const values = key === 'numPulses'
            ? computeParameterValues(key, 1, 100, 1)
            : computeParameterValues(key, /* other ranges */);
        allValues.push({ key, values, color: colors[index % colors.length] });
    });

    checkboxes.forEach((checkbox, index) => {
        const key = checkbox.getAttribute('data-key');
        const input = document.getElementById(inputMappings[key]);
        const current = key === 'numPulses' ? parseInt(input.value) : parseFloat(input.value);
        const min = current / 10;
        const max = current * 10;
        const steps = 100;
        const step = (max - min) / steps;
        const values = computeParameterValues(key, min, max, step);
        allValues.push({ key, values, color: colors[index % colors.length] });
    });

    // Find global min/max for scaling
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    allValues.forEach(({ values }) => {
        values.forEach(({ x, y }) => {
            xMin = Math.min(xMin, x);
            xMax = Math.max(xMax, x);
            yMin = Math.min(yMin, y);
            yMax = Math.max(yMax, y);
        });
    });

    // Add padding to y-axis
    const yPadding = (yMax - yMin) * 0.1;
    yMin -= yPadding;
    yMax += yPadding;

    // Draw axes
    const margin = 50;
    const graphWidth = canvas.width - 2 * margin;
    const graphHeight = canvas.height - 2 * margin;

    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, canvas.height - margin);
    ctx.lineTo(canvas.width - margin, canvas.height - margin);
    ctx.stroke();

    // Draw labels
    ctx.font = '12px Arial';
    ctx.fillText('Energy Ratio', 10, margin - 10);
    ctx.fillText('Parameter Value', canvas.width - margin, canvas.height - margin + 20);

    // Draw ticks and labels
    const xTicks = 10;
    const yTicks = 10;
    for (let i = 0; i <= xTicks; i++) {
        const x = margin + (i / xTicks) * graphWidth;
        const xVal = xMin + (i / xTicks) * (xMax - xMin);
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - margin);
        ctx.lineTo(x, canvas.height - margin + 5);
        ctx.stroke();
        ctx.fillText(xVal.toFixed(2), x - 10, canvas.height - margin + 15);
    }
    for (let i = 0; i <= yTicks; i++) {
        const y = canvas.height - margin - (i / yTicks) * graphHeight;
        const yVal = yMin + (i / yTicks) * (yMax - yMin);
        ctx.beginPath();
        ctx.moveTo(margin - 5, y);
        ctx.lineTo(margin, y);
        ctx.stroke();
        ctx.fillText(yVal.toFixed(2), margin - 40, y + 5);
    }

    // Plot data
    allValues.forEach(({ key, values, color }) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        values.forEach(({ x, y }, i) => {
            const px = margin + ((x - xMin) / (xMax - xMin)) * graphWidth;
            const py = canvas.height - margin - ((y - yMin) / (yMax - yMin)) * graphHeight;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Add legend
        ctx.fillStyle = color;
        ctx.fillText(key, canvas.width - margin + 10, margin + 20 * allValues.indexOf({ key, values, color }));
    });
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

// Add Enter key event listeners
const inputs = [
    document.getElementById('batteryVoltage'),
    document.getElementById('numPulses'),
    document.getElementById('pulseDuration'),
    document.getElementById('turnsRatio'),
    document.getElementById('primaryInductanceInput'),
    document.getElementById('capacitanceInput'),
    document.getElementById('couplingFactor'),
    document.getElementById('secondaryResistance'),
    document.getElementById('primaryResistance')
];
inputs.forEach(input => {
    input.addEventListener('keypress', function (event) {
        if (event.keyCode === 13 || event.key === 'Enter') {
            calculate();
        }
    });
});

// Initialize
loadSavedValues();
calculate();
