// graph-simulator.js

// Compute a sweep range for a given value
function computeSweepRange(current, minMult = 0.1, maxMult = 10, steps = 100) {
    const min = current * minMult;
    const max = current * maxMult;
    const step = (max - min) / steps;
    return { min, max, step };
}

// General-purpose graphing function for a given property key
function graphSimulatedProperty(key, min, max, step, updateInputCallback, simulateCallback, plotCallback) {
    const results = [];
    for (let val = min; val <= max; val += step) {
        updateInputCallback(key, val); // update the input
        const sim = simulateCallback();
        results.push({ x: val, y: sim[key] });
    }
    plotCallback(key, results);
}

// Simple console plot function (replace with canvas drawing as needed)
function consolePlot(key, data) {
    console.log(`Plot for ${key}:`);
    data.forEach(({ x, y }) => console.log(`${x}, ${y}`));
}

// Adds checkboxes and integrates with HTML
function attachGraphingUI(inputs, updateInputCallback, simulateCallback) {
    const graphArea = document.getElementById("graph-area");

    inputs.forEach((input) => {
        const { key, value } = input;
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `graph-${key}`;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` Graph ${key}`));
        graphArea.appendChild(label);
        graphArea.appendChild(document.createElement("br"));

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                const { min, max, step } = computeSweepRange(value);
                graphSimulatedProperty(
                    key,
                    min,
                    max,
                    step,
                    updateInputCallback,
                    simulateCallback,
                    consolePlot // Replace this with a real canvas function
                );
            }
        });
    });
}
