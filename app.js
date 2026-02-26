document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentPsi = 10;
    let targetPsi = 45;
    let maxPsi = 60; // Gauge max

    let isInflating = false;
    let inflationInterval = null;
    let hasManualWarning = false;
    let hasCriticalWarning = false;

    // --- DOM Elements ---
    const elCurrentPsi = document.getElementById('current-psi');
    const elTargetPsi = document.getElementById('target-psi');
    const elGaugeNeedle = document.getElementById('gauge-needle');
    const elGaugeTicks = document.getElementById('gauge-ticks');

    // Progress
    const progressPercent = document.getElementById('progress-percent');
    const barTop = document.getElementById('bar-top');
    const barBottom = document.getElementById('bar-bottom');
    const numSegments = 15;

    // Controls
    const btnIncrease = document.getElementById('btn-increase');
    const btnDecrease = document.getElementById('btn-decrease');
    const btnActivate = document.getElementById('btn-activate');
    const btnActivateText = document.getElementById('btn-activate-text');

    // Warnings
    const warningContainer = document.getElementById('warning-container');

    // Demos
    const btnDemoManual = document.getElementById('demo-manual');
    const btnDemoCritical = document.getElementById('demo-critical');
    const btnDemoReset = document.getElementById('demo-reset');

    // --- Init ---

    // Generate Gauge Ticks (Sci-fi Style)
    if (elGaugeTicks) {
        const totalAngle = 270;
        const startAngle = -135;
        const cx = 50;
        const cy = 50;
        for (let i = 0; i <= maxPsi; i += 2) {
            const angleDeg = startAngle + (i / maxPsi) * totalAngle;
            const angleRad = (angleDeg - 90) * Math.PI / 180;

            const isMajor = i % 10 === 0;
            const isOrange = i >= 40; // Danger zone orange ticks
            const innerRadius = isMajor ? 36 : 41;
            const outerRadius = 45;

            const x1 = cx + innerRadius * Math.cos(angleRad);
            const y1 = cy + innerRadius * Math.sin(angleRad);
            const x2 = cx + outerRadius * Math.cos(angleRad);
            const y2 = cy + outerRadius * Math.sin(angleRad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);

            let tickClass = isMajor ? 'gauge-tick-major' : 'gauge-tick';
            if (isOrange) tickClass = 'gauge-tick-orange';
            line.setAttribute('class', tickClass);

            elGaugeTicks.appendChild(line);

            if (isMajor) {
                const textRadius = 26;
                const tx = cx + textRadius * Math.cos(angleRad);
                const ty = cy + textRadius * Math.sin(angleRad);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', tx);
                text.setAttribute('y', ty);
                text.setAttribute('class', 'gauge-text');
                text.textContent = i;
                elGaugeTicks.appendChild(text);
            }
        }
    }

    // Generate segmented bars
    function createSegments(container) {
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < numSegments; i++) {
            const seg = document.createElement('div');
            seg.className = 'segment';
            // Sci-fi gradient logic: left is orange, right is cyan
            // Using HSL interpolation or just strict rgb mapping if we wanted, 
            // but CSS handles glowing via active class. Let's just set the base colors via JS to match the image accurately
            const ratio = i / (numSegments - 1);
            // Orange: #ff7a00, Cyan: #00f3ff
            // Easy trick: blend hue from 30 (orange) to 180 (cyan)
            const hue = 30 + (ratio * 150);
            seg.style.backgroundColor = `hsla(${hue}, 100%, 20%, 0.3)`;
            seg.style.borderColor = `hsla(${hue}, 100%, 50%, 0.5)`;
            seg.dataset.hue = hue; // Store for active state
            container.appendChild(seg);
        }
    }
    createSegments(barTop);
    createSegments(barBottom);

    updateDisplay();

    // --- Functions ---
    function updateDisplay() {
        // Readouts
        elCurrentPsi.innerText = currentPsi.toFixed(1);
        elTargetPsi.innerText = targetPsi.toFixed(1);

        // Needle
        let needleAngle = -135 + (Math.min(currentPsi, maxPsi) / maxPsi) * 270;
        if (elGaugeNeedle) elGaugeNeedle.setAttribute('transform', `rotate(${needleAngle} 50 50)`);

        // Progress Math
        const percent = Math.max(0, Math.min(100, (currentPsi / targetPsi) * 100));
        progressPercent.innerText = Math.round(percent);

        // Segment updating
        const activeSegments = Math.round((percent / 100) * numSegments);
        const updateBar = (bar) => {
            if (!bar) return;
            const children = bar.children;
            for (let i = 0; i < children.length; i++) {
                const seg = children[i];
                if (i < activeSegments) {
                    seg.classList.add('active');
                    seg.style.backgroundColor = `hsla(${seg.dataset.hue}, 100%, 50%, 0.9)`;
                    seg.style.boxShadow = `0 0 10px hsla(${seg.dataset.hue}, 100%, 50%, 0.8)`;
                } else {
                    seg.classList.remove('active');
                    seg.style.backgroundColor = `hsla(${seg.dataset.hue}, 100%, 20%, 0.3)`;
                    seg.style.boxShadow = 'none';
                }
            }
        };
        updateBar(barTop);
        updateBar(barBottom);

        // Buttons & Status
        if (hasCriticalWarning) {
            btnActivateText.innerText = "LOCKED";
            btnActivate.classList.remove('active-glow');
            elCurrentPsi.style.color = "var(--danger)";
        } else if (currentPsi >= targetPsi && isInflating) {
            elCurrentPsi.style.color = "var(--cyan)";
            stopInflation();
        } else if (isInflating) {
            btnActivateText.innerText = "DEACTIVATE";
            btnActivate.classList.add('active-glow');
        } else {
            btnActivateText.innerText = "ACTIVATE";
            btnActivate.classList.remove('active-glow');
            if (currentPsi >= targetPsi) {
                elCurrentPsi.style.color = "var(--cyan)";
            }
        }

        renderWarnings();
    }

    function renderWarnings() {
        warningContainer.innerHTML = '';
        if (hasCriticalWarning) {
            warningContainer.innerHTML += `
                <div class="alert alert-critical">
                    CRITICAL: OVER-PRESSURE
                </div>`;
            return;
        }
        if (hasManualWarning) {
            warningContainer.innerHTML += `
                <div class="alert alert-warning">
                    MANUAL OVERRIDE SYS ACTIVE
                </div>`;
            if (isInflating) stopInflation();
        }
    }

    function startInflation() {
        if (hasCriticalWarning || hasManualWarning) return;
        if (currentPsi >= targetPsi) return;

        isInflating = true;
        updateDisplay();

        inflationInterval = setInterval(() => {
            currentPsi += 0.3;
            if (currentPsi >= targetPsi) {
                currentPsi = targetPsi;
                stopInflation();
            }
            updateDisplay();
        }, 100);
    }

    function stopInflation() {
        isInflating = false;
        clearInterval(inflationInterval);
        updateDisplay();
    }

    function setTarget(newTarget) {
        targetPsi = newTarget;
        updateDisplay();
    }

    // --- Listeners ---

    // Hex Buttons
    btnIncrease.addEventListener('click', () => {
        if (targetPsi < maxPsi) setTarget(targetPsi + 1);
    });

    btnDecrease.addEventListener('click', () => {
        if (targetPsi > 0) setTarget(targetPsi - 1);
    });

    btnActivate.addEventListener('click', () => {
        if (hasCriticalWarning) return;
        if (isInflating) {
            stopInflation();
        } else {
            startInflation();
        }
    });

    // Demo Modifiers
    btnDemoManual.addEventListener('click', () => {
        hasManualWarning = !hasManualWarning;
        updateDisplay();
    });

    btnDemoCritical.addEventListener('click', () => {
        hasCriticalWarning = true;
        stopInflation();
        updateDisplay();
    });

    btnDemoReset.addEventListener('click', () => {
        hasCriticalWarning = false;
        hasManualWarning = false;
        currentPsi = 10;
        targetPsi = 45;
        stopInflation();
        updateDisplay();
    });
});
