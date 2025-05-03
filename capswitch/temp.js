if (false) {
    // Interstage resistor energy calculations
    o.energyInterstageR = 0; // Initialize total energy in interstage resistors

    // Voltage per stage (divided across the number of stages), accounting for interstage diode drops
    o.voltagePerStage = o.outStartVoltage / p.numStages - diodeDrop; // Subtracting total diode voltage drop across interstage diodes

    // Loop through each stage to calculate energy dissipated in the interstage resistors
    for (let stage = 0; stage < p.numStages; stage++) {
        // Calculate energy dissipation in the interstage resistor for each stage
        let energyInStageR = 0.5 * (2 * p.inputCapacitor) * o.voltagePerStage ** 2;  // Use 2 * p.inputCapacitor for each stage's dual capacitors
        o.energyInterstageR += energyInStageR; // Accumulate energy dissipation
    }
}

if (true) {
    // Interstage resistor energy calculations
    o.energyInterstageR = 0; // Initialize total energy in interstage resistors

    // Voltage per stage (divided across the number of stages), accounting for interstage diode drops
    o.voltagePerStage = o.outStartVoltage / p.numStages - diodeDrop; // ~22.25 V

    // Interstage resistance (specified as 100 Ω)
    const interstageResistance = 100;

    // Time per cycle for charge transfer (half the cycle duration)
    const timePerCycle = o.cycleDuration / 2; // 0.05 / 2 = 0.025 s

    // Loop through each stage to calculate energy dissipated in the interstage resistors
    for (let stage = 0; stage < p.numStages; stage++) {
        // Charge transferred per cycle per stage (Q = C * ΔV)
        let chargePerCycle = p.inputCapacitor * o.voltagePerStage; // ~1e-6 * 22.25 ≈ 2.225e-5 C

        // Energy dissipated per cycle per stage: E = Q^2 * R / t
        let energyPerCycle = (chargePerCycle ** 2 * interstageResistance) / timePerCycle; // ~1.98e-6 J

        // Total energy for this stage over all pulses
        let energyInStageR = energyPerCycle * p.numPulses; // ~1.98e-6 * 120 ≈ 2.376e-4 J

        o.energyInterstageR += energyInStageR; // Accumulate energy dissipation
    }
}

// Optionally, you can include the total energy dissipation in the output energy calculations
o.outEnergy += o.energyInterstageR;
