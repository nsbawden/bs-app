function calculateOptimalPulses({ key = 'numPulses', min = 1, max = 1000, step = 1 }) {
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

function computeGraph({ key, min, max, step }) {
    const baseParams = getParams();
    const values = [];

    for (let val = min; val <= max; val += step) {
        const params = { ...baseParams, [key]: val };
        const result = simulateCircuit(params);
        values.push({ x: val, y: result.capacitor.energy_ratio });
    }

    return values;
}

function plotGraph(container, values, min, max, step, xLabel, yLabel, color, title) {

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '30px';
    container.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    canvas.style.display = 'block';
    wrapper.appendChild(canvas);

    let slider;
    if (step !== 0) {
        slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = 50;
        slider.style.width = '600px';
        wrapper.appendChild(slider);
    }

    function draw(values) {

        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        let peakX = -Infinity, peakY = -Infinity;

        values.forEach(({ x, y }) => {
            xMin = Math.min(xMin, x);
            xMax = Math.max(xMax, x);
            yMin = Math.min(yMin, y);
            yMax = Math.max(yMax, y);
            if (y > peakY) {
                peakY = y;
                peakX = x;
            }
        });

        const yPadding = (yMax - yMin) * 0.1;
        yMin -= yPadding;
        yMax += yPadding;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const margin = 50;
        const graphWidth = canvas.width - 2 * margin;
        const graphHeight = canvas.height - 2 * margin;

        ctx.fillStyle = 'rgb(31, 31, 31)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(margin, margin);
        ctx.lineTo(margin, canvas.height - margin);
        ctx.lineTo(canvas.width - margin, canvas.height - margin);
        ctx.stroke();

        ctx.font = '12px Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`${yLabel} (peak ${smartFormat(peakX, 2)}, ${smartFormat(peakY, 2)})`, 0, 15);
        ctx.fillText(xLabel, (canvas.width / 2) - margin, canvas.height - 10);
        ctx.fillText(title, margin, margin - 10);

        const xTicks = 10;
        const yTicks = 10;

        for (let i = 0; i <= xTicks; i++) {
            const x = margin + (i / xTicks) * graphWidth;
            const xVal = xMin + (i / xTicks) * (xMax - xMin);

            ctx.strokeStyle = '#aaa';
            ctx.beginPath();
            ctx.moveTo(x, canvas.height - margin);
            ctx.lineTo(x, canvas.height - margin + 5);
            ctx.stroke();

            ctx.fillText(smartFormat(xVal, 2), x - 10, canvas.height - margin + 15);

            ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(x, margin);
            ctx.lineTo(x, canvas.height - margin);
            ctx.stroke();
        }

        for (let i = 0; i <= yTicks; i++) {
            const y = canvas.height - margin - (i / yTicks) * graphHeight;
            const yVal = yMin + (i / yTicks) * (yMax - yMin);

            ctx.strokeStyle = '#aaa';
            ctx.beginPath();
            ctx.moveTo(margin - 5, y);
            ctx.lineTo(margin, y);
            ctx.stroke();

            ctx.fillText(smartFormat(yVal, 2), margin - 45, y + 4);

            ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(canvas.width - margin, y);
            ctx.stroke();
        }

        if (yMin < 0 && yMax > 0) {
            const yZero = canvas.height - margin - ((0 - yMin) / (yMax - yMin)) * graphHeight;
            ctx.strokeStyle = '#bbb';
            ctx.setLineDash([1, 4]);
            ctx.beginPath();
            ctx.moveTo(margin, yZero);
            ctx.lineTo(canvas.width - margin, yZero);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.strokeStyle = color;
        values.forEach(({ x, y }, i) => {
            const px = margin + ((x - xMin) / (xMax - xMin)) * graphWidth;
            const py = canvas.height - margin - ((y - yMin) / (yMax - yMin)) * graphHeight;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
    }

    draw(values);

    canvas.addEventListener('click', () => {
        blink();
        const graphData = { title, xLabel, yLabel, color, values };
        const json = JSON.stringify(graphData, null, 2);
        navigator.clipboard.writeText(json)
            .then(() => console.log('Graph data copied to clipboard'))
            .catch(err => console.error('Failed to copy graph data:', err));
    });

    if (slider) {
        slider.addEventListener('input', () => {
            const percent = (slider.value - 50) / 50; // range from -1 to 1
            const scale = Math.pow(2, percent); // exponential for better control
            const center = (min + max) / 2;
            const range = (max - min) * scale / 2;
            const newMin = center - range;
            const newMax = center + range;
            const newValues = computeGraph({ key: xLabel, min: newMin, max: newMax, step: step });
            draw(newValues);
        });
    }

}

function plotGraphs(result) {
    const container = document.getElementById('graphContainer');
    const checkboxes = document.querySelectorAll('.graph-checkbox:checked');
    if (checkboxes.length === 0) return;

    const colors = ['orange', 'cyan', 'blue', 'red', 'green', 'purple'];

    checkboxes.forEach((checkbox, index) => {
        const key = checkbox.getAttribute('data-key');
        const input = document.getElementById(inputMappings[key]);
        let current = parseFloat(input.value);
        let min, max;
        switch (key) {
            case 'pulseDuration':
            case 'capacitance':
                min = current / 4;
                max = current * 4;
                break;
            default:
                min = current / 10;
                max = current * 10;
                break;
        }
        const steps = 500;
        const step = (max - min) / steps;
        const values = computeGraph({ key, min, max, step });

        plotGraph(
            container,
            values,
            min, max, step,
            key,
            'Energy Ratio',
            colors[index % colors.length],
            `${key} vs Energy Ratio`
        );
    });
}
