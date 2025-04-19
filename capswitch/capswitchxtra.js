function copyJson() {
    blink();
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
                pulseOffTime: parseFloat(document.getElementById('pulseOffTime').textContent),
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
    const json = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(json)
        .then(() => console.log('Graph data copied to clipboard'))
        .catch(err => console.error('Failed to copy graph data:', err));
}

function blink() {
    document.body.classList.remove('fade-in');
    setTimeout(() => {
        document.body.classList.add('fade-in');
    }, 0);
}


