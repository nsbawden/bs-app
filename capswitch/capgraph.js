// capgraph.js

function computeGraph({ key, min, max, step }) {
    const baseParams = getParams();
    const values = [];

    for (let val = min; val <= max; val += step) {
        const params = { ...baseParams, [key]: val };
        const result = simulateCircuit(params);
        values.push({ x: val, y: result.energyRatio });
    }

    return values;
}

function plotGraph(config) {
    const { container, values, min, max, step, xLabel, yLabel, color, title } = config;

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '30px';
    wrapper.style.position = 'relative';
    wrapper.style.width = '600px';
    wrapper.style.margin = '0 auto';
    wrapper.style.display = 'block';
    wrapper.style.overflow = 'visible';
    container.appendChild(wrapper);

    const bgCanvas = document.createElement('canvas');
    bgCanvas.setAttribute('width', '600');
    bgCanvas.setAttribute('height', '300');
    bgCanvas.width = 600;
    bgCanvas.height = 300;
    bgCanvas.style.display = 'block';
    bgCanvas.style.position = 'absolute';
    bgCanvas.style.top = '0';
    bgCanvas.style.left = '0';
    wrapper.appendChild(bgCanvas);

    const fgCanvas = document.createElement('canvas');
    fgCanvas.setAttribute('width', '600');
    fgCanvas.setAttribute('height', '300');
    fgCanvas.width = 600;
    fgCanvas.height = 300;
    fgCanvas.style.display = 'block';
    fgCanvas.style.position = 'absolute';
    fgCanvas.style.top = '0';
    fgCanvas.style.left = '0';
    wrapper.appendChild(fgCanvas);

    const spacer = document.createElement('div');
    spacer.style.height = '300px';
    wrapper.appendChild(spacer);

    let slider;
    if (step !== 0) {
        slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = 50;
        slider.style.width = '600px';
        slider.style.marginBottom = '24px';
        slider.style.display = 'block';
        wrapper.appendChild(slider);
    }

    let currentValues = values;

    function drawGraphCanvas(values) {
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

        const ctx = bgCanvas.getContext('2d');
        ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        ctx.fillStyle = 'rgb(31, 31, 31)';
        ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

        const marginLeft = 50;
        const marginRight = 0;
        const marginTop = 50;
        const marginBottom = 50;
        const graphWidth = bgCanvas.width - marginLeft - marginRight;
        const graphHeight = bgCanvas.height - marginTop - marginBottom;

        ctx.strokeStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(marginLeft, marginTop);
        ctx.lineTo(marginLeft, bgCanvas.height - marginBottom);
        ctx.lineTo(bgCanvas.width - marginRight, bgCanvas.height - marginBottom);
        ctx.stroke();

        ctx.font = '12px Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`${yLabel} (peak ${smartFormat(peakX, 2)}, ${smartFormat(peakY, 2)})`, 0, 15);
        ctx.fillText(xLabel, (bgCanvas.width / 2) - marginLeft, bgCanvas.height - 10);
        ctx.fillText(title, marginLeft, marginTop - 10);

        const xTicks = 10;
        const yTicks = 10;

        for (let i = 0; i <= xTicks; i++) {
            const x = marginLeft + (i / xTicks) * graphWidth;
            const xVal = xMin + (i / xTicks) * (xMax - xMin);
            const xLabelText = smartFormat(xVal, 2);
            const xLabelSz = ctx.measureText(xLabelText).width;

            ctx.strokeStyle = '#aaa';
            ctx.beginPath();
            ctx.moveTo(x, bgCanvas.height - marginBottom);
            ctx.lineTo(x, bgCanvas.height - marginBottom + 5);
            ctx.stroke();

            ctx.fillText(xLabelText, x - xLabelSz, bgCanvas.height - marginBottom + 18);

            ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(x, marginTop);
            ctx.lineTo(x, bgCanvas.height - marginBottom);
            ctx.stroke();
        }

        for (let i = 0; i <= yTicks; i++) {
            const y = bgCanvas.height - marginBottom - (i / yTicks) * graphHeight;
            const yVal = yMin + (i / yTicks) * (yMax - yMin);
            const yLabelText = smartFormat(yVal, 2);
            const yLabelSz = ctx.measureText(yLabelText).width;

            ctx.strokeStyle = '#aaa';
            ctx.beginPath();
            ctx.moveTo(marginLeft - 5, y);
            ctx.lineTo(marginLeft, y);
            ctx.stroke();

            ctx.fillText(yLabelText, marginLeft - 10 - yLabelSz, y);

            ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(bgCanvas.width - marginRight, y);
            ctx.stroke();
        }

        if (yMin < 0 && yMax > 0) {
            const yZero = bgCanvas.height - marginBottom - ((0 - yMin) / (yMax - yMin)) * graphHeight;
            ctx.strokeStyle = '#bbb';
            ctx.setLineDash([1, 4]);
            ctx.beginPath();
            ctx.moveTo(marginLeft, yZero);
            ctx.lineTo(bgCanvas.width - marginRight, yZero);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (yLabel === 'Energy Ratio' && yMin < 1 && yMax > 1) {
            const yOne = bgCanvas.height - marginBottom - ((1 - yMin) / (yMax - yMin)) * graphHeight;
            ctx.strokeStyle = 'gold';
            ctx.setLineDash([1, 4]);
            ctx.beginPath();
            ctx.moveTo(marginLeft, yOne);
            ctx.lineTo(bgCanvas.width - marginRight, yOne);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.strokeStyle = color;
        values.forEach(({ x, y }, i) => {
            const px = marginLeft + ((x - xMin) / (xMax - xMin)) * graphWidth;
            const py = bgCanvas.height - marginBottom - ((y - yMin) / (yMax - yMin)) * graphHeight;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
    }

    function drawMousingCanvas(cursorX, values) {
        const ctx = fgCanvas.getContext('2d');
        ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
        const marginLeft = 50;
        const marginRight = 0;
        const marginTop = 50;
        const marginBottom = 50;
        const graphWidth = fgCanvas.width - marginLeft - marginRight;

        if (cursorX !== null && cursorX >= marginLeft && cursorX <= fgCanvas.width - marginRight) {
            let xMin = Infinity, xMax = -Infinity;
            values.forEach(({ x }) => {
                xMin = Math.min(xMin, x);
                xMax = Math.max(xMax, x);
            });

            const xVal = xMin + ((cursorX - marginLeft) / graphWidth) * (xMax - xMin);
            let closest = values.reduce((prev, curr) => {
                return Math.abs(curr.x - xVal) < Math.abs(prev.x - xVal) ? curr : prev;
            });
            const yVal = closest.y;

            ctx.strokeStyle = '#888';
            ctx.setLineDash([1, 1]);
            ctx.beginPath();
            ctx.moveTo(cursorX, marginTop);
            ctx.lineTo(cursorX, fgCanvas.height - marginBottom);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#ddd';
            ctx.font = '12px Arial';
            const text = `${smartFormat(xVal, 2)}, ${smartFormat(yVal, 2)}`;
            const textWidth = ctx.measureText(text).width;
            let textX = cursorX + 5;
            if (textX + textWidth > fgCanvas.width - marginRight) {
                textX = cursorX - textWidth - 5;
            }
            ctx.fillText(text, textX, marginTop + 20);
        }
    }

    drawGraphCanvas(currentValues);

    fgCanvas.addEventListener('mousemove', (event) => {
        const rect = fgCanvas.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        drawMousingCanvas(cursorX, currentValues);
    });

    fgCanvas.addEventListener('mouseleave', () => {
        drawMousingCanvas(null, currentValues);
    });

    fgCanvas.addEventListener('click', () => {
        blink();
        const graphData = { title, xLabel, yLabel, color, values: currentValues };
        const json = JSON.stringify(graphData, null, 2);
        navigator.clipboard.writeText(json)
            .then(() => console.log('Graph data copied to clipboard'))
            .catch(err => console.error('Failed to copy graph data:', err));
    });

    if (slider) {
        slider.addEventListener('input', () => {
            const percent = (slider.value - 50) / 50;
            const scale = Math.pow(2, percent);
            const center = (min + max) / 2;
            const range = (max - min) * scale / 2;
            let newMin = center - range;
            let newMax = center + range;

            if (newMin < 0) {
                const offset = 0 - newMin;
                newMin = 0;
                newMax += offset;
            }

            currentValues = computeGraph({ key: xLabel, min: newMin, max: newMax, step });
            drawGraphCanvas(currentValues);
            drawMousingCanvas(null, currentValues);
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
        const input = document.getElementById(key);
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

        plotGraph({
            container,
            values,
            min,
            max,
            step,
            xLabel: key,
            yLabel: 'Energy Ratio',
            color: colors[index % colors.length],
            title: `${key} vs Energy Ratio`
        });
    });
}