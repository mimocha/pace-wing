class PaceWing {
    constructor() {
        this.fixedModal = null;
        this.targetModal = null;
        this.calculatedModal = null;
        this.splitData = [];
        this.chart = null;
        
        this.init();
    }

    init() {
        this.setupModalButtons();
        this.setupSplitControls();
        this.setupUnitsDropdowns();
        this.setupCalculateButton();
    }

    setupModalButtons() {
        const modalButtons = document.querySelectorAll('.modal-button');
        
        modalButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleModalButtonClick(e.target);
            });
        });
    }

    handleModalButtonClick(button) {
        const modal = button.closest('.input-modal');
        const modalType = modal.dataset.type;
        const buttonType = button.classList.contains('left') ? 'fix' : 'target';
        
        if (buttonType === 'fix') {
            this.fixedModal = (this.fixedModal === modalType) ? null : modalType;
        } else {
            this.targetModal = (this.targetModal === modalType) ? null : modalType;
        }

        // Determine calculated modal
        const modals = ['distance', 'pace', 'time'];
        if (this.fixedModal && this.targetModal) {
            this.calculatedModal = modals.find(m => m !== this.fixedModal && m !== this.targetModal);
        } else {
            this.calculatedModal = null;
        }
        
        this.updateButtonHighlights();
        this.updateModalStates();
    }

    updateButtonHighlights() {
        document.querySelectorAll('.input-modal').forEach(modalEl => {
            const type = modalEl.dataset.type;
            const leftButton = modalEl.querySelector('.modal-button.left');
            const rightButton = modalEl.querySelector('.modal-button.right');

            leftButton.classList.remove('selected', 'fix');
            rightButton.classList.remove('selected', 'target');

            if (type === this.fixedModal) {
                leftButton.classList.add('selected', 'fix');
            }
            if (type === this.targetModal) {
                rightButton.classList.add('selected', 'target');
            }
        });
    }

    updateModalStates() {
        const modals = document.querySelectorAll('.input-modal');
        
        modals.forEach(modal => {
            const modalType = modal.dataset.type;
            const inputField = modal.querySelector('.input-field');
            const unitDropdown = modal.querySelector('.unit-dropdown');
            
            if (modalType === this.calculatedModal) {
                inputField.disabled = true;
                if (unitDropdown) unitDropdown.disabled = true; // Check if unitDropdown exists
                modal.style.opacity = '0.6';
            } else {
                inputField.disabled = false;
                if (unitDropdown) unitDropdown.disabled = false; // Check if unitDropdown exists
                modal.style.opacity = '1';
            }
        });
    }

    showError(containerElement, message) {
        const errorPopup = containerElement.querySelector('.error-popup');
        errorPopup.textContent = message;
        errorPopup.classList.add('show');

        setTimeout(() => {
            errorPopup.classList.remove('show');
        }, 3000);
    }

    setupCalculateButton() {
        const calculateButton = document.getElementById('calculate-btn');
        const calculateButtonContainer = calculateButton.closest('.calculate-button-container');

        calculateButton.addEventListener('click', () => {
            // Validation 1: Check if fixedModal and targetModal are selected
            if (!this.fixedModal || !this.targetModal) {
                this.showError(calculateButtonContainer, "Please select a fixed and a target variable.");
                return;
            }

            // Validation 2: Check if fixedModal and targetModal are different
            if (this.fixedModal === this.targetModal) {
                this.showError(calculateButtonContainer, "Fixed and target variables must be different.");
                return;
            }

            // Validation 3: Check for valid input values
            const fixedValueObj = this.getModalValue(this.fixedModal);
            const targetValueObj = this.getModalValue(this.targetModal);

            if (isNaN(fixedValueObj.value) || (this.fixedModal !== 'time' && fixedValueObj.value <= 0) || (this.fixedModal === 'time' && fixedValueObj.value < 0)) { // Allow 0 for time if needed, but generally positive
                this.showError(calculateButtonContainer, `Please enter a valid value for ${this.fixedModal}.`);
                return;
            }
            if (isNaN(targetValueObj.value) || (this.targetModal !== 'time' && targetValueObj.value <= 0) || (this.targetModal === 'time' && targetValueObj.value < 0)) {
                this.showError(calculateButtonContainer, `Please enter a valid value for ${this.targetModal}.`);
                return;
            }
            
            // If all validations pass
            this.calculateMissingValue();
            this.updateSplitPlanner();
        });
    }

    calculateMissingValue() {
        if (!this.fixedModal || !this.targetModal || !this.calculatedModal) return;

        const fixedValue = this.getModalValue(this.fixedModal);
        const targetValue = this.getModalValue(this.targetModal);
        
        // Validate parsed values again, especially for time format
        if (fixedValue === null || isNaN(fixedValue.value)) {
            this.showError(document.querySelector(`.input-modal[data-type="${this.fixedModal}"]`), `Invalid ${this.fixedModal} input.`);
            return;
        }
        if (targetValue === null || isNaN(targetValue.value)) {
            this.showError(document.querySelector(`.input-modal[data-type="${this.targetModal}"]`), `Invalid ${this.targetModal} input.`);
            return;
        }
        
        if (!fixedValue || !targetValue) return;

        let calculatedValue;
        
        // Convert to standard units (meters, seconds)
        const fixedStandard = this.convertToStandard(fixedValue, this.fixedModal);
        const targetStandard = this.convertToStandard(targetValue, this.targetModal);

        // Calculate missing value
        if (this.calculatedModal === 'distance') {
            calculatedValue = this.calculateDistance(fixedStandard, targetStandard);
        } else if (this.calculatedModal === 'time') {
            calculatedValue = this.calculateTime(fixedStandard, targetStandard);
        } else if (this.calculatedModal === 'pace') {
            calculatedValue = this.calculatePace(fixedStandard, targetStandard);
        }

        this.setModalValue(this.calculatedModal, calculatedValue);
    }

    getModalValue(modalType) {
        const modal = document.querySelector(`.input-modal[data-type="${modalType}"]`);
        const input = modal.querySelector('.input-field');
        const unitDropdown = modal.querySelector('.unit-dropdown');
        
        let unitValue;
        let parsedValue;

        if (modalType === 'time') {
            unitValue = 's'; // Internally, time is handled in seconds
            const timeString = input.value;
            const parts = timeString.split(':').map(Number);
            let seconds = 0;
            if (parts.some(isNaN) || parts.length === 0 || parts.length > 3) {
                parsedValue = NaN;
            } else {
                if (parts.length === 1) { // SS
                    seconds = parts[0];
                } else if (parts.length === 2) { // MM:SS
                    seconds = parts[0] * 60 + parts[1];
                } else if (parts.length === 3) { // HH:MM:SS
                    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                }
                if (parts.some(p => p < 0) || (parts.length > 1 && parts[1] >= 60) || (parts.length > 2 && parts[2] >= 60)) {
                    parsedValue = NaN; // Invalid minute or second values
                } else {
                    parsedValue = seconds;
                }
            }
        } else {
            unitValue = unitDropdown ? unitDropdown.value : null;
            parsedValue = parseFloat(input.value);
        }

        return {
            value: parsedValue,
            unit: unitValue
        };
    }

    setModalValue(modalType, standardValue) {
        const modal = document.querySelector(`.input-modal[data-type="${modalType}"]`);
        const input = modal.querySelector('.input-field');
        
        if (modalType === 'time') {
            input.value = this.formatTime(standardValue); // standardValue is in seconds
        } else {
            const unitDropdown = modal.querySelector('.unit-dropdown');
            const unit = unitDropdown ? unitDropdown.value : null;
            const convertedValue = this.convertFromStandard(standardValue, modalType, unit);
            input.value = convertedValue.toFixed(2);
        }
    }

    convertToStandard(valueObj, modalType) {
        const { value, unit } = valueObj;
        
        switch (modalType) {
            case 'distance':
                switch (unit) {
                    case 'km': return value * 1000;
                    case 'm': return value;
                    case 'mi': return value * 1609.34;
                    default: return value;
                }
            case 'time':
                // value is already in total seconds from getModalValue
                return value;
            case 'pace':
                switch (unit) {
                    case 'min/km': return value * 60 / 1000; // seconds per meter
                    case 'min/mi': return value * 60 / 1609.34;
                    case 'km/h': return 3600 / (value * 1000); // convert to s/m
                    case 'mi/h': return 3600 / (value * 1609.34);
                    case 'm/s': return 1 / value; // seconds per meter
                    case 's/100m': return value / 100;
                    default: return value;
                }
            default: return value;
        }
    }

    convertFromStandard(standardValue, modalType, unit) {
        switch (modalType) {
            case 'distance':
                switch (unit) {
                    case 'km': return standardValue / 1000;
                    case 'm': return standardValue;
                    case 'mi': return standardValue / 1609.34;
                    default: return standardValue;
                }
            case 'time':
                // standardValue is in seconds. setModalValue will format it.
                return standardValue;
            case 'pace':
                switch (unit) {
                    case 'min/km': return (standardValue * 1000) / 60;
                    case 'min/mi': return (standardValue * 1609.34) / 60;
                    case 'km/h': return 3600 / (standardValue * 1000);
                    case 'mi/h': return 3600 / (standardValue * 1609.34);
                    case 'm/s': return 1 / standardValue;
                    case 's/100m': return standardValue * 100;
                    default: return standardValue;
                }
            default: return standardValue;
        }
    }

    calculateDistance(timeStandard, paceStandard) {
        // If time is fixed and pace is target, calculate distance
        if (this.fixedModal === 'time' && this.targetModal === 'pace') {
            return timeStandard / paceStandard;
        }
        // If pace is fixed and time is target, calculate distance
        if (this.fixedModal === 'pace' && this.targetModal === 'time') {
            return timeStandard / paceStandard;
        }
        return 0;
    }

    calculateTime(distanceStandard, paceStandard) {
        // Time = Distance × Pace (in seconds per meter)
        return distanceStandard * paceStandard;
    }

    calculatePace(distanceStandard, timeStandard) {
        // Pace = Time / Distance (seconds per meter)
        if (distanceStandard === 0) return Infinity; // Avoid division by zero
        return timeStandard / distanceStandard;
    }

    _updateRadioSelectionVisuals() {
        const splitRadioLabels = document.querySelectorAll('.split-type-button');
        splitRadioLabels.forEach(label => {
            const input = label.querySelector('input[type="radio"]');
            if (input.checked) {
                label.classList.add('selected');
            } else {
                label.classList.remove('selected');
            }
        });
    }

    setupSplitControls() {
        const splitRadios = document.querySelectorAll('input[name="split-type"]');
        const splitNumberInput = document.getElementById('split-number');
        const decrementButton = document.getElementById('decrement-split');
        const incrementButton = document.getElementById('increment-split');

        splitRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this._updateRadioSelectionVisuals();
                this.updateSplitPlanner();
            });
        });
        this._updateRadioSelectionVisuals(); // Initial call to set style

        splitNumberInput.addEventListener('input', () => {
            // Ensure value is within min/max if typed manually
            let value = parseInt(splitNumberInput.value);
            const min = parseInt(splitNumberInput.min);
            const max = parseInt(splitNumberInput.max);
            if (isNaN(value)) value = min; // Default to min if invalid
            if (value < min) value = min;
            if (value > max) value = max;
            splitNumberInput.value = value;
            
            this.updateSplitPlanner();
        });

        decrementButton.addEventListener('click', () => {
            let currentValue = parseInt(splitNumberInput.value);
            const minValue = parseInt(splitNumberInput.min);
            if (currentValue > minValue) {
                splitNumberInput.value = currentValue - 1;
                splitNumberInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        incrementButton.addEventListener('click', () => {
            let currentValue = parseInt(splitNumberInput.value);
            const maxValue = parseInt(splitNumberInput.max);
            if (currentValue < maxValue) {
                splitNumberInput.value = currentValue + 1;
                splitNumberInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    updateSplitPlanner() {
        const splitType = document.querySelector('input[name="split-type"]:checked')?.value;
        const splitNumber = parseInt(document.getElementById('split-number').value) || 0;
        
        if (!splitType || splitNumber <= 0) {
            // Clear chart and table if inputs are invalid for splits
            if (this.chart) this.chart.destroy();
            document.querySelector('#split-table tbody').innerHTML = '';
            return;
        }
        // Ensure calculatedModal is set, implies fixed and target are also set and valid.
        if (!this.calculatedModal) return; 


        this.generateSplitData(splitType, splitNumber);
        this.updateChart();
        this.updateTable();
    }

    generateSplitData(splitType, splitNumber) {
        const distance = this.getStandardValue('distance');
        const time = this.getStandardValue('time');
        const pace = time / distance;

        this.splitData = [];

        for (let i = 1; i <= splitNumber; i++) {
            let splitDistance, splitTime;
            
            if (splitType === 'distance') {
                splitDistance = distance / splitNumber;
                splitTime = splitDistance * pace;
            } else if (splitType === 'time') {
                splitTime = time / splitNumber;
                splitDistance = splitTime / pace;
            }

            const cumulativeDistance = splitDistance * i;
            const cumulativeTime = splitTime * i;
            const avgPace = cumulativeTime / cumulativeDistance;

            this.splitData.push({
                split: i,
                splitTime: splitTime,
                splitDistance: splitDistance,
                splitPace: splitTime / splitDistance,
                cumulativeTime: cumulativeTime,
                cumulativeDistance: cumulativeDistance,
                avgPace: avgPace,
                difference: 0 // Placeholder
            });
        }
    }

    getStandardValue(modalType) {
        const valueObj = this.getModalValue(modalType);
        return this.convertToStandard(valueObj, modalType);
    }

    updateChart() {
        const ctx = document.getElementById('pace-chart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        const labels = this.splitData.map(d => `Split ${d.split}`);
        const paceData = this.splitData.map(d => (d.splitPace * 1000 / 60).toFixed(2)); // Convert to min/km

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pace (min/km)',
                    data: paceData,
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#f0f6fc'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#f0f6fc' },
                        grid: { color: '#30363d' }
                    },
                    y: {
                        ticks: { color: '#f0f6fc' },
                        grid: { color: '#30363d' }
                    }
                }
            }
        });
    }

    updateTable() {
        const tbody = document.querySelector('#split-table tbody');
        tbody.innerHTML = '';

        this.splitData.forEach(data => {
            const row = tbody.insertRow();
            
            row.insertCell(0).textContent = data.split;
            row.insertCell(1).textContent = this.formatTime(data.splitTime);
            row.insertCell(2).textContent = (data.splitDistance / 1000).toFixed(2) + ' km';
            row.insertCell(3).textContent = this.formatPace(data.splitPace);
            row.insertCell(4).textContent = this.formatTime(data.cumulativeTime);
            row.insertCell(5).textContent = (data.cumulativeDistance / 1000).toFixed(2) + ' km';
            row.insertCell(6).textContent = this.formatPace(data.avgPace);
            row.insertCell(7).textContent = '+0:00'; // Placeholder
        });
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    formatPace(secondsPerMeter) {
        if (isNaN(secondsPerMeter) || !isFinite(secondsPerMeter)) return "N/A";
        const minutesPerKm = (secondsPerMeter * 1000) / 60;
        const minutes = Math.floor(minutesPerKm);
        const seconds = Math.floor((minutesPerKm - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    setupUnitsDropdowns() {
        // Setup unit options for each dropdown
        const distanceUnits = ['km', 'm', 'mi'];
        const paceUnits = ['min/km', 'min/mi', 'km/h', 'mi/h', 'm/s', 's/100m'];
        
        const distanceDropdown = document.querySelector('.input-modal[data-type="distance"] .unit-dropdown');
        const paceDropdown = document.querySelector('.input-modal[data-type="pace"] .unit-dropdown');
        
        this.populateDropdown(distanceDropdown, distanceUnits);
        this.populateDropdown(paceDropdown, paceUnits);
    }

    populateDropdown(dropdown, options) {
        dropdown.innerHTML = '';
        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option;
            optElement.textContent = option;
            dropdown.appendChild(optElement);
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PaceWing();
});
