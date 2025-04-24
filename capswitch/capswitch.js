const prefix = document.querySelector('meta[name="prefix"]').content;

const MODELS = {
    DCTS: {
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
        }
    },
    VMTS: {
        defaultValues: {
            batteryVoltage: '10',
            numPulses: '5',
            pulseDuration: '0.0025',
            inputCapacitor: '0.000003',
            numStages: '4'
        }
    }
};

function getModel() {
    return MODELS[prefix] ?? {};
}

const inputIds = Array.from(document.querySelectorAll('input[type=number]'))
    .map(input => {
        input.setAttribute('title', input.id);
        return input.id;
    });
const outputIds = Array.from(document.querySelectorAll('.output-value'))
    .map(el => {
        el.setAttribute('title', el.id);
        return el.id;
    });
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
    if (absRounded >= 999999 || absRounded < 0.00001) {
        return value.toExponential(pre - 1);
    }
    return toCleanPrecision(value, pre);
}

function getParams() {
    // const params = getModel().getParams?.() ?? {};
    switch (prefix) {
        case 'DCTS':
            return DCTS_getParams();
        case 'VMTS':
            return VMTS_getParams();
    }
    return {};
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
    const model = getModel();
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

function calculate() {
    blinkStart();
    setTimeout(() => {
        adjustValues();
        saveValues();
        const params = getParams();
        const result = simulateCircuit(params);
        result.optimalPulsesActual = calculateOptimalPulses(params);

        // Load page variables with output values
        for (const id of outputIds.concat(inputIds)) {
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

loadSavedValues();
calculate();