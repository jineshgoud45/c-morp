/**
 * UI Components for C-MORP
 * Reusable components for energy cards, charts, and other UI elements
 */

class EnergyCard {
    constructor(containerId, config = {}) {
        this.container = document.getElementById(containerId);
        this.config = {
            title: config.title || 'Energy Metric',
            subtitle: config.subtitle || 'Current Status',
            unit: config.unit || 'kW',
            icon: config.icon || 'bolt',
            color: config.color || 'primary',
            showTrend: config.showTrend !== false,
            showChart: config.showChart !== false,
            ...config
        };
        this.chart = null;
        this.render();
    }

    render() {
        const cardHTML = `
            <div class="energy-card ${this.config.color}-card">
                <div class="card-header">
                    <div class="card-icon">
                        <span class="material-icons">${this.config.icon}</span>
                    </div>
                    <div class="card-title">
                        <h3>${this.config.title}</h3>
                        <p class="card-subtitle">${this.config.subtitle}</p>
                    </div>
                </div>
                <div class="card-content">
                    <div class="metric-value" id="${this.container}-value">--</div>
                    <div class="metric-unit">${this.config.unit}</div>
                    <div class="metric-trend" id="${this.container}-trend" style="display: none;">
                        <span class="material-icons trend-icon">trending_up</span>
                        <span class="trend-value">+0%</span>
                    </div>
                </div>
                ${this.config.showChart ? `
                    <div class="card-chart">
                        <canvas id="${this.container}-sparkline"></canvas>
                    </div>
                ` : ''}
            </div>
        `;

        this.container.innerHTML = cardHTML;

        if (this.config.showChart) {
            this.initSparkline();
        }
    }

    initSparkline() {
        const canvas = document.getElementById(`${this.container}-sparkline`);
        const ctx = canvas.getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(24).fill(''),
                datasets: [{
                    data: Array(24).fill(0),
                    borderColor: this.getChartColor(),
                    backgroundColor: this.getChartColor() + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: { display: false }
                    },
                    y: {
                        display: false,
                        grid: { display: false }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    getChartColor() {
        const colors = {
            primary: '#1976D2',
            success: '#4CAF50',
            warning: '#FFC107',
            error: '#F44336',
            orange: '#FF6F00'
        };
        return colors[this.config.color] || colors.primary;
    }

    updateValue(value, trend = null) {
        const valueElement = document.getElementById(`${this.container}-value`);
        if (valueElement) {
            valueElement.textContent = typeof value === 'number' ? value.toFixed(1) : value;
        }

        if (trend && this.config.showTrend) {
            const trendElement = document.getElementById(`${this.container}-trend`);
            const trendIcon = trendElement.querySelector('.trend-icon');
            const trendValue = trendElement.querySelector('.trend-value');

            trendElement.style.display = 'flex';
            trendIcon.textContent = trend >= 0 ? 'trending_up' : 'trending_down';
            trendIcon.className = `material-icons trend-icon ${trend >= 0 ? 'up' : 'down'}`;
            trendValue.textContent = `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`;
        }
    }

    updateChart(data) {
        if (this.chart && data) {
            this.chart.data.datasets[0].data = data.slice(-24); // Keep last 24 points
            this.chart.update('none'); // Update without animation for performance
        }
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
        }
    }
}

class BatteryGauge {
    constructor(containerId, config = {}) {
        this.container = document.getElementById(containerId);
        this.config = {
            min: config.min || 0,
            max: config.max || 100,
            thresholds: config.thresholds || {
                low: 20,
                medium: 50,
                high: 80
            },
            ...config
        };
        this.currentValue = 0;
        this.render();
    }

    render() {
        const gaugeHTML = `
            <div class="battery-gauge" id="${this.container}-gauge">
                <div class="gauge-fill" id="${this.container}-fill"></div>
                <div class="gauge-text" id="${this.container}-text">--%</div>
            </div>
        `;
        this.container.innerHTML = gaugeHTML;
    }

    setValue(value) {
        this.currentValue = Math.max(this.config.min, Math.min(this.config.max, value));
        const percentage = ((this.currentValue - this.config.min) / (this.config.max - this.config.min)) * 100;

        const fillElement = document.getElementById(`${this.container}-fill`);
        const textElement = document.getElementById(`${this.container}-text`);

        if (fillElement) {
            fillElement.style.width = `${percentage}%`;
            fillElement.style.backgroundColor = this.getGaugeColor(percentage);
        }

        if (textElement) {
            textElement.textContent = `${Math.round(this.currentValue)}%`;
        }
    }

    getGaugeColor(percentage) {
        if (percentage < this.config.thresholds.low) {
            return '#F44336'; // Red
        } else if (percentage < this.config.thresholds.medium) {
            return '#FFC107'; // Yellow
        } else if (percentage < this.config.thresholds.high) {
            return '#FF9800'; // Orange
        } else {
            return '#4CAF50'; // Green
        }
    }
}

class EnergyChart {
    constructor(containerId, config = {}) {
        this.container = document.getElementById(containerId);
        this.config = {
            type: config.type || 'line',
            title: config.title || 'Energy Chart',
            height: config.height || 300,
            showLegend: config.showLegend !== false,
            showGrid: config.showGrid !== false,
            ...config
        };
        this.chart = null;
        this.render();
    }

    render() {
        const chartHTML = `
            <div class="chart-container">
                <div class="chart-header">
                    <h3 class="chart-title">${this.config.title}</h3>
                    <div class="chart-controls">
                        ${this.config.controls || ''}
                    </div>
                </div>
                <div class="chart-content">
                    <canvas id="${this.container}-chart"></canvas>
                </div>
            </div>
        `;

        this.container.innerHTML = chartHTML;

        this.initChart();
    }

    initChart() {
        const canvas = document.getElementById(`${this.container}-chart`);
        const ctx = canvas.getContext('2d');

        this.chart = new Chart(ctx, {
            type: this.config.type,
            data: this.getDefaultData(),
            options: this.getChartOptions()
        });
    }

    getDefaultData() {
        return {
            labels: [],
            datasets: []
        };
    }

    getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            height: this.config.height,
            plugins: {
                legend: {
                    display: this.config.showLegend,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#333',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: this.config.showGrid,
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    display: true,
                    grid: {
                        display: this.config.showGrid,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    beginAtZero: true
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            animation: {
                duration: 750
            }
        };
    }

    updateData(labels, datasets) {
        if (this.chart) {
            this.chart.data.labels = labels;
            this.chart.data.datasets = datasets;
            this.chart.update();
        }
    }

    addDataset(dataset) {
        if (this.chart) {
            this.chart.data.datasets.push(dataset);
            this.chart.update();
        }
    }

    removeDataset(index) {
        if (this.chart && this.chart.data.datasets[index]) {
            this.chart.data.datasets.splice(index, 1);
            this.chart.update();
        }
    }

    updateType(type) {
        if (this.chart) {
            this.chart.config.type = type;
            this.chart.update();
        }
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
        }
    }
}

class AlertItem {
    constructor(containerId, alert) {
        this.container = document.getElementById(containerId);
        this.alert = alert;
        this.render();
    }

    render() {
        const alertHTML = `
            <div class="alert-item" data-alert-id="${this.alert.id}">
                <div class="alert-icon ${this.alert.severity}">
                    <span class="material-icons">${this.getSeverityIcon()}</span>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${this.alert.title}</div>
                    <div class="alert-message">${this.alert.message}</div>
                    <div class="alert-time">${this.formatTime(this.alert.timestamp)}</div>
                </div>
                <div class="alert-actions">
                    ${this.alert.acknowledged ?
                        '<span class="acknowledged-badge">Acknowledged</span>' :
                        `<button class="btn btn-sm btn-secondary acknowledge-btn" data-alert-id="${this.alert.id}">
                            <span class="material-icons">check</span>
                            Acknowledge
                        </button>`
                    }
                </div>
            </div>
        `;

        const element = document.createElement('div');
        element.innerHTML = alertHTML;
        const alertElement = element.firstElementChild;

        // Add event listeners
        const acknowledgeBtn = alertElement.querySelector('.acknowledge-btn');
        if (acknowledgeBtn) {
            acknowledgeBtn.addEventListener('click', () => this.onAcknowledge());
        }

        this.container.appendChild(alertElement);
        this.element = alertElement;
    }

    getSeverityIcon() {
        const icons = {
            low: 'info',
            medium: 'warning',
            high: 'error',
            critical: 'dangerous'
        };
        return icons[this.alert.severity] || 'info';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMinutes = Math.floor((now - date) / (1000 * 60));

        if (diffMinutes < 1) {
            return 'Just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
    }

    async onAcknowledge() {
        try {
            await api.acknowledgeAlert(this.alert.id);
            this.markAcknowledged();
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
            showToast('Failed to acknowledge alert', 'error');
        }
    }

    markAcknowledged() {
        const actionsDiv = this.element.querySelector('.alert-actions');
        actionsDiv.innerHTML = '<span class="acknowledged-badge">Acknowledged</span>';
        this.alert.acknowledged = true;
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

class ToastNotification {
    static show(message, type = 'info', duration = 5000, title = null) {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.error('Toast container not found');
            return;
        }

        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div class="toast ${type}" id="${toastId}">
                <div class="toast-icon">
                    <span class="material-icons">${this.getIcon(type)}</span>
                </div>
                <div class="toast-content">
                    ${title ? `<div class="toast-title">${title}</div>` : ''}
                    <div class="toast-message">${message}</div>
                </div>
                <button class="toast-close" aria-label="Close">
                    <span class="material-icons">close</span>
                </button>
            </div>
        `;

        const toastElement = document.createElement('div');
        toastElement.innerHTML = toastHTML;
        const toast = toastElement.firstElementChild;

        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toastId));

        container.appendChild(toast);

        // Auto remove after duration
        setTimeout(() => {
            this.remove(toastId);
        }, duration);
    }

    static getIcon(type) {
        const icons = {
            success: 'check_circle',
            warning: 'warning',
            error: 'error',
            info: 'info'
        };
        return icons[type] || 'info';
    }

    static remove(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
}

class LoadingSpinner {
    static show(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            const messageElement = overlay.querySelector('p');
            if (messageElement) {
                messageElement.textContent = message;
            }
            overlay.style.display = 'flex';
        }
    }

    static hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

class Modal {
    constructor(config = {}) {
        this.config = {
            title: config.title || 'Modal',
            content: config.content || '',
            size: config.size || 'medium',
            closable: config.closable !== false,
            ...config
        };
        this.isOpen = false;
        this.element = null;
        this.render();
    }

    render() {
        const modalHTML = `
            <div class="modal-overlay" id="modal-${Date.now()}">
                <div class="modal ${this.config.size}">
                    <div class="modal-header">
                        <h3 class="modal-title">${this.config.title}</h3>
                        ${this.config.closable ? '<button class="modal-close" aria-label="Close"><span class="material-icons">close</span></button>' : ''}
                    </div>
                    <div class="modal-content">
                        ${this.config.content}
                    </div>
                    <div class="modal-footer">
                        ${this.config.footer || ''}
                    </div>
                </div>
            </div>
        `;

        const element = document.createElement('div');
        element.innerHTML = modalHTML;
        this.element = element.firstElementChild;

        // Add event listeners
        if (this.config.closable) {
            const closeBtn = this.element.querySelector('.modal-close');
            closeBtn.addEventListener('click', () => this.close());

            // Close on overlay click
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) {
                    this.close();
                }
            });
        }

        // Add to body
        document.body.appendChild(this.element);
    }

    open() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.isOpen = true;
            document.body.style.overflow = 'hidden';
        }
    }

    close() {
        if (this.element) {
            this.element.style.display = 'none';
            this.isOpen = false;
            document.body.style.overflow = '';
        }
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Utility functions
function showToast(message, type = 'info', duration = 5000, title = null) {
    ToastNotification.show(message, type, duration, title);
}

function showLoading(message = 'Loading...') {
    LoadingSpinner.show(message);
}

function hideLoading() {
    LoadingSpinner.hide();
}

function formatNumber(num, decimals = 1) {
    if (typeof num !== 'number') return '--';
    return num.toFixed(decimals);
}

function formatCurrency(amount, currency = '₹') {
    if (typeof amount !== 'number') return '--';
    return `${currency}${amount.toFixed(2)}`;
}

function formatPower(kw) {
    if (typeof kw !== 'number') return '--';
    if (kw >= 1000) {
        return `${(kw / 1000).toFixed(2)} MW`;
    }
    return `${kw.toFixed(1)} kW`;
}

function formatEnergy(kwh) {
    if (typeof kwh !== 'number') return '--';
    if (kwh >= 1000) {
        return `${(kwh / 1000).toFixed(2)} MWh`;
    }
    return `${kwh.toFixed(1)} kWh`;
}

function formatPercentage(value) {
    if (typeof value !== 'number') return '--';
    return `${value.toFixed(1)}%`;
}

// Export components
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EnergyCard,
        BatteryGauge,
        EnergyChart,
        AlertItem,
        ToastNotification,
        LoadingSpinner,
        Modal,
        showToast,
        showLoading,
        hideLoading,
        formatNumber,
        formatCurrency,
        formatPower,
        formatEnergy,
        formatPercentage
    };
} else {
    window.EnergyCard = EnergyCard;
    window.BatteryGauge = BatteryGauge;
    window.EnergyChart = EnergyChart;
    window.AlertItem = AlertItem;
    window.ToastNotification = ToastNotification;
    window.LoadingSpinner = LoadingSpinner;
    window.Modal = Modal;
    window.showToast = showToast;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.formatNumber = formatNumber;
    window.formatCurrency = formatCurrency;
    window.formatPower = formatPower;
    window.formatEnergy = formatEnergy;
    window.formatPercentage = formatPercentage;
}