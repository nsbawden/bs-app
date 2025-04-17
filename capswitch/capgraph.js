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
        const input = document.getElementById(inputMappings[key]);
        const current = parseFloat(input.value);
        const min = current / 10;
        const max = current * 10;
        const steps = 100;
        const step = (max - min) / steps;
        const values = computeGraph(key, min, max, step);
        debugger;
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
