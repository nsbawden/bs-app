const prefix = document.querySelector('meta[name="prefix"]').content;
Math.PHI = (1 + Math.sqrt(5)) / 2;

function buildCircuitTable(jsonObj) {
    let html = '';
    window.params = {};

    // Map units to label classes
    const getLabelClass = (units) => {
        switch (units.toUpperCase()) {
            case "V": return "volt-label";
            case "F": return "cap-label";
            case "Ω": return "ohm-label";
            case "C": return "charge-label";
            case "J": return "energy-label";
            case "W": return "watt-label";
            case "S": return "time-label";
            case "H": return "henry-label";
            case "HZ": return "hz-label";
            case " ": return "ratio-label";
            default: return "";
        }
    };

    const createInputField = (key, row) => {
        const valueAttrs = [
            row.value !== undefined && `value="${row.value}"`,
            row.min !== undefined && `min="${row.min}"`,
            row.step !== undefined && `step="${row.step}"`,
            row.max !== undefined && `max="${row.max}"`
        ].filter(Boolean).join(' ');

        return `<input type="number" id="${key}" ${valueAttrs}>`;
    };

    const createLabelCell = (row) => {
        return `<td><label>${row.label}</label></td>`;
    };

    const createUnitsCell = (row) => {
        const labelClass = getLabelClass(row.units);
        return `<td class="units ${labelClass || ''}">${row.units || ''}</td>`;
    };

    Object.entries(jsonObj.components).forEach(([_, component]) => {
        html += `<div class="component">
                    <h3>${component.name}</h3>
                    <table>`;

        Object.keys(component.properties).forEach(key => {
            const row = component.properties[key];
            if (row.image) {
                html += `<tr class="image-row">
                            <td colspan="4" style="text-align: center">
                                <img src="${row.image}" width="90%">
                            </td>
                          </tr>`;
            } else if (key === 'label') {
                html += `<tr class="label-row">
                            <td colspan="4" style="text-align: center">${row.text}</td>
                          </tr>`;

            } else {
                window.params[key] = row;
                html += `<tr${row.class ? ` class="${row.class}"` : ''}>
                            <td class="checkbox">
                                ${row.direction === 'input' && row.checkbox !== false ? `<input type="checkbox" class="graph-checkbox" data-key="${key}">` : ''}
                            </td>
                            ${createLabelCell(row)}
                            <td class="value">
                                ${row.direction === 'input' ? createInputField(key, row) : `<span id="${key}" class="output-value ${getLabelClass(row.units)}">${row.value || 0}</span>`}
                            </td>
                            ${createUnitsCell(row)}
                        </tr>`;
            }
        });

        html += `</table></div>`;
    });

    const el = document.getElementById('circuitContainer');
    el.innerHTML = html;
}


if (typeof window.circuitComponents === 'object') {
    buildCircuitTable(window.circuitComponents);
}

// No longer used, just for reference if lost
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
//             numPulses: '50',
//             pulseDuration: '0.527',
//             inputCapacitor: '0.00068',
//             numStages: '4',
//             outputResistance: '100'
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

function xpageOutput(o) {
    console.log('-----------------------------------------------------------------------');

    // Check for outputIds with no corresponding entry in o
    const ids = window.outputIds.sort();
    for (const id of ids) {
        if (o[id] === undefined) {
            console.warn(`No value found for ID '${id}' in result`);
        }
    }

    // Iterate through own keys of o
    for (const key of Object.keys(o)) {
        const value = o[key];
        if (Number.isNaN(value)) {
            console.warn(`Value for key '${key}' is NaN`);
        } else {
            const el = document.getElementById(key);
            if (el && window.outputIds.includes(key)) {
                el.textContent = smartFormat(value);
                if (typeof value === 'number') {
                    console.log(`${key} = ${value}`);
                }
            } else if (typeof value === 'number') {
                console.log(`${key} = ${value}`);
            }
        }
    }
}

function pageOutput(o) {
    // Convert outputIds to a Set for O(1) lookups
    const outputIdsSet = new Set(window.outputIds);

    // Check for outputIds with no corresponding entry in o
    for (const id of window.outputIds) {
        if (o[id] === undefined) {
            console.warn(`No value found for ID '${id}' in result`);
        }
    }

    // Iterate through sorted keys of o
    for (const key of Object.keys(o)) {
        const value = o[key];
        if (Number.isNaN(value)) {
            console.warn(`Value for key '${key}' is NaN`);
        } else {
            const el = document.getElementById(key);
            if (el && outputIdsSet.has(key)) {
                el.textContent = smartFormat(value);
                // if (typeof value === 'number') {
                //     console.log(`  ${key} = ${smartFormat(value)}`);
                // }
            } else if (typeof value === 'number') {
                console.log(`* ${key} = ${smartFormat(value)}`);
            }
        }
    }
}

function calculate() {
    console.clear();
    blinkStart();
    setTimeout(() => {
        adjustValues();
        saveValues();
        const params = getParams();
        params.primary = true; // differentiate between primary and graphing runs
        const result = simulateCircuit(params);

        if (document.getElementById('optimalPulsesActual')) {
            result.optimalPulsesActual = calculateOptimalPulses(params);
        }

        pageOutput(result);

        capVoltages = result.capVoltages;
        delete result.capVoltages;

        const container = document.getElementById('graphContainer');
        if (container) container.innerHTML = '';

        const capVoltageValues = capVoltages?.map((v, i) => ({ x: i, y: v })) ?? [];
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

