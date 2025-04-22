function copyJson() {
    blink();

    // Map inputIds to inputs object
    const inputs = {};
    inputIds.forEach(id => {
        const element = document.getElementById(id);
        inputs[id] = parseFloat(element.value);
    });

    // Map outputIds to elements once
    const outputElements = {};
    outputIds.forEach(id => {
        outputElements[id] = document.getElementById(id);
    });

    // Build flat outputs object using cached elements
    const outputs = {};
    outputIds.forEach(id => {
        outputs[id] = id === 'optimalPulsesActual' ? parseInt(outputElements[id]?.textContent) : parseFloat(outputElements[id]?.textContent);
    });

    const result = { inputs, outputs };
    const json = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(json)
        .then(() => console.log('Graph data copied to clipboard'))
        .catch(err => console.error('Failed to copy graph data:', err));
}

function blink() {
    blinkStart();
    blinkEnd();
}

function blinkStart() {
    document.body.classList.remove('fade-in');
}

function blinkEnd() {
    setTimeout(() => {
        document.body.classList.add('fade-in');
    }, 0);
}
