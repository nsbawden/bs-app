const prefix = document.querySelector('meta[name="prefix"]').content;
Math.PHI = (1 + Math.sqrt(5)) / 2;

function buildCircuitTable(jsonObj) {
    // Map units to label classes
    const getLabelClass = (units) => {
        switch (units) {
            case "C": return "charge-label";
            case "J": return "energy-label";
            case "W": return "watt-label";
            case "": return "ratio-label";
            default: return "";
        }
    };

    let html = '';
    window.params = {};

    Object.entries(jsonObj.components).forEach(([_, component]) => {
        html += `
            <div class="component">
            <h3>${component.name}</h3>
            <table>
            `;

        Object.keys(component.properties).forEach(key => {
            const row = component.properties[key];
            if (row.image) {
                html += `
                <tr class="image-row">
                    <td colspan="4" style="text-align: center">
                    <img src="${row.image}" width="90%">
                    </td>
                </tr>
                `;
            } else {
                window.params[key] = row;
                html += `<tr${row.class ? ` class="${row.class}"` : ''}>`;

                // Checkbox cell
                html += '<td class="checkbox">';
                if (row.direction === 'input') {
                    html += `<input type="checkbox" class="graph-checkbox" data-key="${key}">`;
                }
                html += '</td>';

                // Label cell
                html += `<td><label>${row.label}</label></td>`;

                // Value cell
                html += '<td class="value">';
                if (row.direction === 'input') {
                    html += `<input type="number" id="${key}"`;
                    if (row.value !== undefined) html += ` value="${row.value}"`;
                    if (row.min !== undefined) html += ` min="${row.min}"`;
                    if (row.step !== undefined) html += ` step="${row.step}"`;
                    if (row.max !== undefined) html += ` max="${row.max}"`;
                    html += '>';
                } else {
                    const labelClass = getLabelClass(row.units);
                    const classes = ['output-value'];
                    if (labelClass) classes.push(labelClass);
                    html += `<span id="${key}" class="${classes.join(' ')}">${row.value || 0}</span>`;
                }
                html += '</td>';

                // Units cell
                html += '<td class="units';
                const labelClass = getLabelClass(row.units);
                if (labelClass) html += ` ${labelClass}`;
                html += `">${row.units || ''}</td>`;

                html += '</tr>';
            }
        });

        html += `
            </table>
            </div>
            `;
    });

    const el = document.getElementById('circuitContainer');
    el.innerHTML = html;
}

if (typeof window.circuitComponents === 'object') {
    buildCircuitTable(window.circuitComponents);
}

// No longer used
// const MODELS = {
//     DCTS: {
//         defaultValues: {
//             batteryVoltage: '10',
//             numPulses: '5',
//             pulseDuration: '0.0025',
//             turnsRatio: '100',
//             primaryInductance: '0.01',
//             capacitance: '0.0000011',
//             couplingFactor: '0.9',
//             secondaryResistance: '10000',
//             primaryResistance: '1'
//         }
//     },
//     VMTS: {
//         defaultValues: {
//             batteryVoltage: '10',
//             numPulses: '5',
//             pulseDuration: '0.0025',
//             inputCapacitor: '0.000003',
//             numStages: '4'
//         }
//     }
// };

setTimeout(() => {
    window.inputIds = Array.from(document.querySelectorAll('input[type=number]'))
        .map(input => {
            input.setAttribute('title', input.id);
            return input.id;
        });
    window.outputIds = Array.from(document.querySelectorAll('.output-value'))
        .map(el => {
            el.setAttribute('title', el.id);
            return el.id;
        });
    window.checkboxKeys = Array.from(document.querySelectorAll('input[type=checkbox].graph-checkbox')).map(input => input.dataset.key);
    loadSavedValues();
    calculate();
}, 0);


function toCleanPrecision(value, sigDigits) {
    const str = Number(value).toPrecision(sigDigits);
    return Number(str).toString();
}

function smartFormat(value, pre = 4) {
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0';
    const rounded = Number(value).toPrecision(pre);
    const absRounded = Math.abs(rounded);
    if (absRounded >= 999999 || absRounded < 0.00001) {
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

function simulateCircuit(params) {
    switch (prefix) {
        case 'DCTS':
            return DCTS_simulateCircuit(params);
        case 'VMTS':
            return VMTS_simulateCircuit(params);
    }
    return {};
}

function calculateOptimalPulses(params) {
    switch (prefix) {
        case 'DCTS':
            return DCTS_calculateOptimalPulses(params);
        case 'VMTS':
            return VMTS_calculateOptimalPulses(params);
    }
    return 0;
}

function adjustValues() {
    switch (prefix) {
        case 'DCTS':
            return typeof DCTS_adjustValues === 'function' ? DCTS_adjustValues() : null;
        case 'VMTS':
            return typeof VMTS_adjustValues === 'function' ? VMTS_adjustValues() : null;
    }
    return null;
}

function loadSavedValues() {
    const savedInputValues = localStorage.getItem(`${prefix}_inputValues`);
    const inputValues = savedInputValues ? JSON.parse(savedInputValues) : {};
    for (const id of inputIds) {
        const input = document.getElementById(id);
        if (!input) continue;
        // Input sanity checks
        switch (id) {
            case 'inputResistance':
                inputValues[id] = Math.max(inputValues[id] ?? 0, 0.01);
                break;
        }
        input.value = inputValues[id] !== undefined && inputValues[id] !== ''
            ? inputValues[id]
            : window.params[id]?.default ?? '';
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

function calculate() {
    blinkStart();
    setTimeout(() => {
        adjustValues();
        saveValues();
        const params = getParams();
        const result = simulateCircuit(params);

        if (document.getElementById('optimalPulsesActual')) {
            result.optimalPulsesActual = calculateOptimalPulses(params);
        }
        capVoltages = result.capVoltages;
        delete result.capVoltages;

        // Load page variables with output values
        const ids = Object.keys(result);
        const combined = [...new Set([...ids, ...outputIds, ...inputIds])];

        for (const id of combined) {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Element with ID ${id} not found`);
                continue;
            }

            if (!(id in result) && !(id in params)) {
                console.warn(`No value found for ID '${id}' in result or params`);
                continue;
            }

            const value = result[id] ?? params[id];
            if (isNaN(value)) {
                console.warn(`Value for ID '${id}' is NaN`);
                continue;
            }

            const formattedValue = smartFormat(value);
            if (element.tagName === 'INPUT') {
                element.value = formattedValue;
            } else {
                element.textContent = formattedValue;
            }
        }

        const container = document.getElementById('graphContainer');
        if (container) container.innerHTML = '';

        const capVoltageValues = capVoltages?.map((v, i) => ({ x: i, y: v })) ?? [];
        if (window.noGraphs !== true) {
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
        blinkEnd();
    });
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

function calcC1(C2, V1, V2) {
    // Calculate C1 using the formula: C1 = (C2 * V2) / (V1 - V2)
    return (C2 * V2) / (V1 - V2);
}

