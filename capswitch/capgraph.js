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
        values.push({ x: val, y: result.energyRatio });
    }

    return values;
}

function plotGraph(container, values, min, max, step, xLabel, yLabel, color, title) {

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '30px';
    wrapper.style.position = 'relative'; // For absolute positioning of canvases
    wrapper.style.width = '600px'; // Match canvas width
    wrapper.style.margin = '0 auto'; // Center horizontally
    wrapper.style.display = 'block'; // Ensure wrapper is a block element
    wrapper.style.overflow = 'visible'; // Prevent clipping
    container.appendChild(wrapper);

    // Background canvas for the graph
    const bgCanvas = document.createElement('canvas');
    bgCanvas.setAttribute('width', '600'); // DOM attribute for size
    bgCanvas.setAttribute('height', '300');
    bgCanvas.width = 600; // Rendering context resolution
    bgCanvas.height = 300;
    bgCanvas.style.display = 'block';
    bgCanvas.style.position = 'absolute';
    bgCanvas.style.top = '0';
    bgCanvas.style.left = '0';
    wrapper.appendChild(bgCanvas);

    // Foreground canvas for cursor line and text
    const fgCanvas = document.createElement('canvas');
    fgCanvas.setAttribute('width', '600'); // DOM attribute for size
    fgCanvas.setAttribute('height', '300');
    fgCanvas.width = 600; // Rendering context resolution
    fgCanvas.height = 300;
    fgCanvas.style.display = 'block';
    fgCanvas.style.position = 'absolute';
    fgCanvas.style.top = '0';
    fgCanvas.style.left = '0';
    wrapper.appendChild(fgCanvas);

    // Spacer div to push slider below canvases
    const spacer = document.createElement('div');
    spacer.style.height = '300px'; // 300px canvas height + 10px gap
    wrapper.appendChild(spacer);

    let slider;
    if (step !== 0) {
        slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = 50;
        slider.style.width = '600px'; // Match canvas width
        slider.style.marginBottom = '24px';
        slider.style.display = 'block'; // Ensure slider is a block element
        wrapper.appendChild(slider);
    }

    // Store current values to ensure all event listeners use the updated data
    let currentValues = values;

    // Draw the static graph on the background canvas
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
            const xLabel = smartFormat(xVal, 2);
            const xLabelSz = ctx.measureText(xLabel).width;

            ctx.strokeStyle = '#aaa';
            ctx.beginPath();
            ctx.moveTo(x, bgCanvas.height - marginBottom);
            ctx.lineTo(x, bgCanvas.height - marginBottom + 5);
            ctx.stroke();

            ctx.fillText(xLabel, x - xLabelSz, bgCanvas.height - marginBottom + 18);

            ctx.strokeStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(x, marginTop);
            ctx.lineTo(x, bgCanvas.height - marginBottom);
            ctx.stroke();
        }

        for (let i = 0; i <= yTicks; i++) {
            const y = bgCanvas.height - marginBottom - (i / yTicks) * graphHeight;
            const yVal = yMin + (i / yTicks) * (yMax - yMin);
            const yLabel = smartFormat(yVal, 2);
            const yLabelSz = ctx.measureText(yLabel).width;

            ctx.strokeStyle = '#aaa';
            ctx.beginPath();
            ctx.moveTo(marginLeft - 5, y);
            ctx.lineTo(marginLeft, y);
            ctx.stroke();

            ctx.fillText(yLabel, marginLeft - 10 - yLabelSz, y);

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

    // Draw the cursor line and text on the foreground canvas
    function drawMousingCanvas(cursorX, values) {
        const ctx = fgCanvas.getContext('2d');
        ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height); // Clear previous cursor
        const marginLeft = 50;
        const marginRight = 0;
        const marginTop = 50;
        const marginBottom = 50;
        const graphWidth = fgCanvas.width - marginLeft - marginRight;

        if (cursorX !== null && cursorX >= marginLeft && cursorX <= fgCanvas.width - marginRight) {
            // Calculate min and max x for scaling
            let xMin = Infinity, xMax = -Infinity;
            values.forEach(({ x }) => {
                xMin = Math.min(xMin, x);
                xMax = Math.max(xMax, x);
            });

            // Calculate the x-value corresponding to cursor position
            const xVal = xMin + ((cursorX - marginLeft) / graphWidth) * (xMax - xMin);
            // Find the closest x value in the values array
            let closest = values.reduce((prev, curr) => {
                return Math.abs(curr.x - xVal) < Math.abs(prev.x - xVal) ? curr : prev;
            });
            const yVal = closest.y;

            // Draw vertical line
            ctx.strokeStyle = '#888';
            ctx.setLineDash([1, 1]);
            ctx.beginPath();
            ctx.moveTo(cursorX, marginTop);
            ctx.lineTo(cursorX, fgCanvas.height - marginBottom);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw x,y-value text
            ctx.fillStyle = '#ddd';
            ctx.font = '12px Arial';
            const text = `${smartFormat(xVal, 2)}, ${smartFormat(yVal, 2)}`;
            const textWidth = ctx.measureText(text).width;
            // Position text to the right of the line, ensuring it stays within canvas
            let textX = cursorX + 5;
            if (textX + textWidth > fgCanvas.width - marginRight) {
                textX = cursorX - textWidth - 5; // Place text to the left if it would go off canvas
            }
            ctx.fillText(text, textX, marginTop + 20);
        }
    }

    // Initial draw
    drawGraphCanvas(currentValues);

    // Add mousemove event listener for cursor tracking
    fgCanvas.addEventListener('mousemove', (event) => {
        const rect = fgCanvas.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        drawMousingCanvas(cursorX, currentValues);
    });

    // Clear foreground and restore background opacity when cursor leaves
    fgCanvas.addEventListener('mouseleave', () => {
        drawMousingCanvas(null, currentValues); // Clear cursor line
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
            const percent = (slider.value - 50) / 50; // range from -1 to 1
            const scale = Math.pow(2, percent); // exponential for better control
            const center = (min + max) / 2;
            const range = (max - min) * scale / 2;
            let newMin = center - range;
            let newMax = center + range;

            if (newMin < 0) {
                const offset = 0 - newMin;
                newMin = 0;
                newMax += offset; // extend the max to maintain the full range
            }

            currentValues = computeGraph({ key: xLabel, min: newMin, max: newMax, step: step });
            drawGraphCanvas(currentValues);
            drawMousingCanvas(null, currentValues); // Clear cursor line
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
