/**
 * C-MORP Main Application
 * Main application logic and state management
 */

class CMORPApp {
    constructor() {
        this.isInitialized = false;
        this.components = new Map();
        this.charts = new Map();
        this.currentData = {};
        this.settings = {
            costPriority: 70,
            greenPriority: 80,
            batteryMinSOC: 20,
            batteryMaxSOC: 85,
            peakShavingEnabled: true,
            loadShiftingEnabled: true
        };
        this.updateInterval = null;
        this.refreshRate = 5000; // 5 seconds

        this.init();
    }

    async init() {
        try {
            console.log('Initializing C-MORP application...');

            // Show loading
            showLoading('Initializing dashboard...');

            // Initialize UI components
            this.initializeUI();

            // Setup event listeners
            this.setupEventListeners();

            // Connect to WebSocket for real-time updates
            api.connectWebSocket();

            // Load initial data
            await this.loadInitialData();

            // Start periodic updates
            this.startPeriodicUpdates();

            // Initialize charts
            this.initializeCharts();

            // Hide loading
            hideLoading();

            this.isInitialized = true;
            console.log('C-MORP application initialized successfully');

            // Show welcome message
            showToast('Dashboard loaded successfully', 'success');

        } catch (error) {
            console.error('Failed to initialize application:', error);
            hideLoading();
            showToast('Failed to load dashboard', 'error');
        }
    }

    initializeUI() {
        // Initialize energy cards
        this.components.set('consumption', new EnergyCard('consumption-card', {
            title: 'Consumption',
            subtitle: 'Current Load',
            icon: 'power',
            color: 'primary',
            unit: 'kW'
        }));

        this.components.set('generation', new EnergyCard('generation-card', {
            title: 'Generation',
            subtitle: 'Solar Output',
            icon: 'wb_sunny',
            color: 'orange',
            unit: 'kW'
        }));

        this.components.set('battery', new EnergyCard('battery-card', {
            title: 'Battery',
            subtitle: 'State of Charge',
            icon: 'battery_charging_full',
            color: 'success',
            unit: '%'
        }));

        this.components.set('savings', new EnergyCard('savings-card', {
            title: 'Savings',
            subtitle: 'Daily Total',
            icon: 'savings',
            color: 'orange',
            unit: '₹'
        }));

        // Initialize battery gauge
        this.components.set('batteryGauge', new BatteryGauge('batteryGauge'));

        // Setup sidebar toggle
        this.setupSidebar();

        // Setup mobile navigation
        this.setupMobileNavigation();
    }

    setupSidebar() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');

        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Close sidebar when clicking outside
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 1024) {
                    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                        sidebar.classList.remove('open');
                    }
                }
            });
        }
    }

    setupMobileNavigation() {
        const mobileNavItems = document.querySelectorAll('.mobile-nav .nav-item');

        mobileNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Remove active class from all items
                mobileNavItems.forEach(navItem => navItem.classList.remove('active'));

                // Add active class to clicked item
                item.classList.add('active');

                // Handle navigation (scroll to section or show modal)
                const href = item.getAttribute('href');
                if (href && href !== '#') {
                    const targetSection = document.querySelector(href);
                    if (targetSection) {
                        targetSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    }

    setupEventListeners() {
        // Refresh data button
        const refreshBtn = document.getElementById('refreshDataBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Time range selector
        const timeRangeSelector = document.getElementById('timeRangeSelector');
        if (timeRangeSelector) {
            timeRangeSelector.addEventListener('change', (e) => {
                this.loadHistoricalData(e.target.value);
            });
        }

        // Control panel
        this.setupControlPanel();

        // WebSocket events
        api.on('energy:update', (data) => this.updateEnergyData(data));
        api.on('alert:new', (alert) => this.handleNewAlert(alert));
        api.on('websocket:connected', () => this.updateConnectionStatus('connected'));
        api.on('websocket:disconnected', () => this.updateConnectionStatus('disconnected'));

        // Notification button
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => this.showNotifications());
        }

        // View all alerts button
        const viewAllAlertsBtn = document.getElementById('viewAllAlertsBtn');
        if (viewAllAlertsBtn) {
            viewAllAlertsBtn.addEventListener('click', () => this.showAllAlerts());
        }
    }

    setupControlPanel() {
        // Cost priority slider
        const costPrioritySlider = document.getElementById('costPrioritySlider');
        const costPriorityValue = document.getElementById('costPriorityValue');

        if (costPrioritySlider && costPriorityValue) {
            costPrioritySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                costPriorityValue.textContent = `${value}%`;
                this.settings.costPriority = parseInt(value);
            });
        }

        // Green priority slider
        const greenPrioritySlider = document.getElementById('greenPrioritySlider');
        const greenPriorityValue = document.getElementById('greenPriorityValue');

        if (greenPrioritySlider && greenPriorityValue) {
            greenPrioritySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                greenPriorityValue.textContent = `${value}%`;
                this.settings.greenPriority = parseInt(value);
            });
        }

        // Battery range sliders
        const batteryMinSlider = document.getElementById('batteryMinSlider');
        const batteryMaxSlider = document.getElementById('batteryMaxSlider');
        const batteryRangeValue = document.getElementById('batteryRangeValue');

        if (batteryMinSlider && batteryMaxSlider && batteryRangeValue) {
            const updateBatteryRange = () => {
                const min = parseInt(batteryMinSlider.value);
                const max = parseInt(batteryMaxSlider.value);

                // Ensure min is always less than max
                if (min >= max) {
                    if (batteryMinSlider === document.activeElement) {
                        batteryMaxSlider.value = min + 5;
                    } else {
                        batteryMinSlider.value = max - 5;
                    }
                }

                const finalMin = parseInt(batteryMinSlider.value);
                const finalMax = parseInt(batteryMaxSlider.value);
                batteryRangeValue.textContent = `${finalMin}% - ${finalMax}%`;

                this.settings.batteryMinSOC = finalMin;
                this.settings.batteryMaxSOC = finalMax;
            };

            batteryMinSlider.addEventListener('input', updateBatteryRange);
            batteryMaxSlider.addEventListener('input', updateBatteryRange);
        }

        // Optimize button
        const optimizeBtn = document.getElementById('optimizeBtn');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', () => this.runOptimization());
        }

        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // Control panel toggle
        const controlPanelToggle = document.getElementById('controlPanelToggle');
        const controlPanelContent = document.getElementById('controlPanelContent');

        if (controlPanelToggle && controlPanelContent) {
            controlPanelToggle.addEventListener('click', () => {
                const isExpanded = !controlPanelContent.style.display || controlPanelContent.style.display === 'block';
                controlPanelContent.style.display = isExpanded ? 'none' : 'block';
                controlPanelToggle.querySelector('.material-icons').textContent = isExpanded ? 'expand_more' : 'expand_less';
            });
        }
    }

    initializeCharts() {
        // Energy flow chart
        this.charts.set('energyFlow', new EnergyChart('energyFlowChart', {
            type: 'line',
            title: 'Energy Flow (24 Hours)',
            height: 300,
            controls: `
                <button class="chart-control-btn active" data-chart-type="line">
                    <span class="material-icons">show_chart</span>
                </button>
                <button class="chart-control-btn" data-chart-type="area">
                    <span class="material-icons">area_chart</span>
                </button>
            `
        }));

        // Energy source chart
        this.charts.set('energySource', new EnergyChart('energySourceChart', {
            type: 'doughnut',
            title: 'Energy Sources',
            height: 300,
            controls: `
                <button class="chart-control-btn" id="refreshSourceChart">
                    <span class="material-icons">refresh</span>
                </button>
            `
        }));

        // Setup chart control buttons
        this.setupChartControls();
    }

    setupChartControls() {
        // Energy flow chart type controls
        const chartTypeButtons = document.querySelectorAll('[data-chart-type]');
        chartTypeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chartType;

                // Update active state
                chartTypeButtons.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Update chart
                const energyFlowChart = this.charts.get('energyFlow');
                if (energyFlowChart) {
                    if (chartType === 'area') {
                        energyFlowChart.chart.data.datasets.forEach(dataset => {
                            dataset.fill = true;
                        });
                    } else {
                        energyFlowChart.chart.data.datasets.forEach(dataset => {
                            dataset.fill = false;
                        });
                    }
                    energyFlowChart.chart.update();
                }
            });
        });

        // Refresh source chart button
        const refreshSourceChart = document.getElementById('refreshSourceChart');
        if (refreshSourceChart) {
            refreshSourceChart.addEventListener('click', () => {
                this.updateEnergySourceChart();
            });
        }
    }

    async loadInitialData() {
        try {
            // Load current energy data
            const energyResponse = await api.getCurrentEnergy();
            if (energyResponse.data) {
                this.updateEnergyData(energyResponse.data);
            }

            // Load historical data
            await this.loadHistoricalData('24h');

            // Load devices
            const devicesResponse = await api.getDevices();
            if (devicesResponse.data) {
                this.updateDevices(devicesResponse.data);
            }

            // Load active alerts
            const alertsResponse = await api.getActiveAlerts();
            if (alertsResponse.data) {
                this.updateAlerts(alertsResponse.data);
            }

        } catch (error) {
            console.error('Failed to load initial data:', error);
            throw error;
        }
    }

    async loadHistoricalData(period = '24h') {
        try {
            const response = await api.getEnergyHistory(period);
            if (response.data) {
                this.updateHistoricalCharts(response.data);
            }
        } catch (error) {
            console.error('Failed to load historical data:', error);
        }
    }

    updateEnergyData(data) {
        this.currentData = { ...this.currentData, ...data };

        // Update energy cards
        const consumptionCard = this.components.get('consumption');
        if (consumptionCard) {
            consumptionCard.updateValue(data.consumption_kw);
        }

        const generationCard = this.components.get('generation');
        if (generationCard) {
            generationCard.updateValue(data.generation_kw);
        }

        const batteryCard = this.components.get('battery');
        if (batteryCard) {
            batteryCard.updateValue(data.battery_soc);
        }

        const savingsCard = this.components.get('savings');
        if (savingsCard) {
            savingsCard.updateValue(data.cost_savings);
        }

        // Update battery gauge
        const batteryGauge = this.components.get('batteryGauge');
        if (batteryGauge) {
            batteryGauge.setValue(data.battery_soc);
        }

        // Update battery power display
        const batteryPowerValue = document.getElementById('batteryPowerValue');
        if (batteryPowerValue) {
            const power = data.battery_power_kw || 0;
            const direction = power > 0 ? 'Charging' : power < 0 ? 'Discharging' : 'Idle';
            batteryPowerValue.textContent = `${direction}: ${Math.abs(power).toFixed(1)} kW`;
        }

        // Update quick stats
        this.updateQuickStats(data);

        // Update charts
        this.updateRealtimeCharts(data);
    }

    updateQuickStats(data) {
        const quickBatterySOC = document.getElementById('quickBatterySOC');
        if (quickBatterySOC) {
            quickBatterySOC.textContent = `${formatNumber(data.battery_soc)}%`;
        }

        const quickCurrentLoad = document.getElementById('quickCurrentLoad');
        if (quickCurrentLoad) {
            quickCurrentLoad.textContent = `${formatNumber(data.consumption_kw)} kW`;
        }

        const quickDailySavings = document.getElementById('quickDailySavings');
        if (quickDailySavings) {
            quickDailySavings.textContent = formatCurrency(data.cost_savings);
        }

        // Update carbon savings
        const carbonSavingsValue = document.getElementById('carbonSavingsValue');
        if (carbonSavingsValue) {
            carbonSavingsValue.textContent = `${formatNumber(data.carbon_savings_kg)} kg CO₂`;
        }
    }

    updateHistoricalCharts(data) {
        const energyFlowChart = this.charts.get('energyFlow');
        if (energyFlowChart && data.consumption_data && data.generation_data) {
            const labels = this.generateTimeLabels(data.start_time, data.end_time, data.interval_minutes);

            energyFlowChart.updateData(labels, [
                {
                    label: 'Consumption',
                    data: data.consumption_data,
                    borderColor: '#1976D2',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                },
                {
                    label: 'Generation',
                    data: data.generation_data,
                    borderColor: '#FF6F00',
                    backgroundColor: 'rgba(255, 111, 0, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                },
                {
                    label: 'Battery SOC',
                    data: data.battery_soc_data,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]);

            // Add second y-axis for battery SOC
            energyFlowChart.chart.options.scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false
                },
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    text: 'Battery SOC (%)'
                }
            };
        }

        this.updateEnergySourceChart();
    }

    updateRealtimeCharts(data) {
        // Update sparkline charts in energy cards
        Object.values(this.components).forEach(component => {
            if (component instanceof EnergyCard && component.chart) {
                // Add current value to sparkline
                const currentData = component.chart.data.datasets[0].data;
                currentData.shift();
                currentData.push(this.getSparklineValue(component.config.title));
                component.chart.update('none');
            }
        });
    }

    getSparklineValue(cardTitle) {
        switch (cardTitle) {
            case 'Consumption':
                return this.currentData.consumption_kw || 0;
            case 'Generation':
                return this.currentData.generation_kw || 0;
            case 'Battery':
                return this.currentData.battery_soc || 0;
            case 'Savings':
                return this.currentData.cost_savings || 0;
            default:
                return 0;
        }
    }

    updateEnergySourceChart() {
        const energySourceChart = this.charts.get('energySource');
        if (energySourceChart && this.currentData) {
            const total = Math.max(1, this.currentData.consumption_kw || 1);
            const solar = this.currentData.generation_kw || 0;
            const battery = Math.max(0, (this.currentData.battery_power_kw || 0));
            const grid = Math.max(0, total - solar - battery);

            energySourceChart.updateData([], [
                {
                    label: 'Solar',
                    data: [solar],
                    backgroundColor: '#FF6F00',
                    borderWidth: 0
                },
                {
                    label: 'Battery',
                    data: [battery],
                    backgroundColor: '#4CAF50',
                    borderWidth: 0
                },
                {
                    label: 'Grid',
                    data: [grid],
                    backgroundColor: '#1976D2',
                    borderWidth: 0
                }
            ]);
        }
    }

    updateDevices(devices) {
        // Update device status indicators
        // This could be expanded to show device details in a separate section
        console.log('Devices updated:', devices);
    }

    updateAlerts(alerts) {
        const alertsList = document.getElementById('alertsList');
        if (alertsList) {
            alertsList.innerHTML = '';

            // Show only first 3 alerts on dashboard
            alerts.slice(0, 3).forEach(alert => {
                new AlertItem('alertsList', alert);
            });

            // Update notification badge
            const notificationBadge = document.getElementById('notificationBadge');
            const mobileAlertBadge = document.getElementById('mobileAlertBadge');

            const activeAlerts = alerts.filter(alert => !alert.acknowledged).length;

            if (notificationBadge) {
                notificationBadge.textContent = activeAlerts;
                notificationBadge.style.display = activeAlerts > 0 ? 'block' : 'none';
            }

            if (mobileAlertBadge) {
                mobileAlertBadge.textContent = activeAlerts;
                mobileAlertBadge.style.display = activeAlerts > 0 ? 'block' : 'none';
            }
        }
    }

    updateConnectionStatus(status) {
        const connectionStatus = document.getElementById('connectionStatus');
        const statusText = connectionStatus?.querySelector('.status-text');
        const statusIcon = connectionStatus?.querySelector('.status-icon');

        if (statusText && statusIcon) {
            switch (status) {
                case 'connected':
                    statusText.textContent = 'Connected';
                    statusIcon.textContent = 'wifi';
                    statusIcon.style.color = 'var(--success-green)';
                    break;
                case 'connecting':
                    statusText.textContent = 'Connecting...';
                    statusIcon.textContent = 'wifi_off';
                    statusIcon.style.color = 'var(--warning-yellow)';
                    break;
                case 'disconnected':
                    statusText.textContent = 'Disconnected';
                    statusIcon.textContent = 'wifi_off';
                    statusIcon.style.color = 'var(--error-red)';
                    break;
            }
        }

        // Update system status
        const systemStatus = document.getElementById('systemStatus');
        if (systemStatus) {
            const systemStatusText = systemStatus.querySelector('.status-text');
            const systemStatusIcon = systemStatus.querySelector('.status-icon');

            if (status === 'connected') {
                systemStatusText.textContent = 'Optimal';
                systemStatusIcon.textContent = 'check_circle';
                systemStatusIcon.className = 'material-icons status-icon success';
            } else {
                systemStatusText.textContent = 'Limited';
                systemStatusIcon.textContent = 'warning';
                systemStatusIcon.className = 'material-icons status-icon';
                systemStatusIcon.style.color = 'var(--warning-yellow)';
            }
        }
    }

    handleNewAlert(alert) {
        // Add new alert to the list
        const alertsList = document.getElementById('alertsList');
        if (alertsList) {
            new AlertItem('alertsList', alert);

            // Keep only latest 5 alerts visible
            const alertItems = alertsList.querySelectorAll('.alert-item');
            if (alertItems.length > 5) {
                alertItems[0].remove();
            }
        }

        // Show toast notification for critical alerts
        if (alert.severity === 'critical' || alert.severity === 'high') {
            showToast(alert.title, alert.severity, 10000, alert.message);
        }

        // Update notification badges
        const notificationBadge = document.getElementById('notificationBadge');
        if (notificationBadge) {
            const currentCount = parseInt(notificationBadge.textContent) || 0;
            notificationBadge.textContent = currentCount + 1;
            notificationBadge.style.display = 'block';
        }
    }

    async runOptimization() {
        const optimizeBtn = document.getElementById('optimizeBtn');
        const optimizationStatus = document.getElementById('optimizationStatus');

        try {
            // Disable button and show loading
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Optimizing...';

            if (optimizationStatus) {
                optimizationStatus.innerHTML = `
                    <div class="status-indicator">
                        <span class="material-icons status-icon">hourglass_empty</span>
                        <span class="status-text">Running optimization...</span>
                    </div>
                `;
            }

            // Run optimization
            const response = await api.optimizeEnergy(this.settings);

            if (response.data) {
                const result = response.data;

                // Show success message
                showToast('Optimization completed successfully', 'success');

                // Update status
                if (optimizationStatus) {
                    optimizationStatus.innerHTML = `
                        <div class="status-indicator">
                            <span class="material-icons status-icon success">check_circle</span>
                            <span class="status-text">Optimized! Saved ${formatPercentage(result.savings_percentage)} on costs</span>
                        </div>
                    `;
                }

                // Show detailed results in a modal
                this.showOptimizationResults(result);
            }

        } catch (error) {
            console.error('Optimization failed:', error);
            showToast('Optimization failed. Please try again.', 'error');

            if (optimizationStatus) {
                optimizationStatus.innerHTML = `
                    <div class="status-indicator">
                        <span class="material-icons status-icon">error</span>
                        <span class="status-text">Optimization failed</span>
                    </div>
                `;
            }
        } finally {
            // Restore button
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<span class="material-icons">auto_fix_high</span> Optimize Now';
        }
    }

    showOptimizationResults(result) {
        const modal = new Modal({
            title: 'Optimization Results',
            size: 'large',
            content: `
                <div class="optimization-results">
                    <div class="result-summary">
                        <div class="result-item">
                            <h4>Cost Savings</h4>
                            <div class="result-value">${formatCurrency(result.total_cost)}</div>
                            <div class="result-comparison">vs ${formatCurrency(result.baseline_cost)} baseline</div>
                        </div>
                        <div class="result-item">
                            <h4>Savings Percentage</h4>
                            <div class="result-value">${formatPercentage(result.savings_percentage)}</div>
                        </div>
                        <div class="result-item">
                            <h4>Processing Time</h4>
                            <div class="result-value">${result.solve_time_ms.toFixed(0)} ms</div>
                        </div>
                    </div>
                    <div class="result-charts">
                        <canvas id="optimizationChart"></canvas>
                    </div>
                </div>
            `
        });

        modal.open();

        // Create optimization chart
        setTimeout(() => {
            const ctx = document.getElementById('optimizationChart');
            if (ctx) {
                new Chart(ctx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                        datasets: [
                            {
                                label: 'Battery Schedule',
                                data: result.battery_schedule,
                                borderColor: '#4CAF50',
                                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                borderWidth: 2
                            },
                            {
                                label: 'Grid Schedule',
                                data: result.grid_schedule,
                                borderColor: '#1976D2',
                                backgroundColor: 'rgba(25, 118, 210, 0.1)',
                                borderWidth: 2
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: '24-Hour Energy Schedule'
                            }
                        },
                        scales: {
                            y: {
                                title: {
                                    display: true,
                                    text: 'Power (kW)'
                                }
                            }
                        }
                    }
                });
            }
        }, 100);
    }

    resetSettings() {
        // Reset to default values
        this.settings = {
            costPriority: 70,
            greenPriority: 80,
            batteryMinSOC: 20,
            batteryMaxSOC: 85,
            peakShavingEnabled: true,
            loadShiftingEnabled: true
        };

        // Update UI controls
        const costPrioritySlider = document.getElementById('costPrioritySlider');
        const costPriorityValue = document.getElementById('costPriorityValue');
        if (costPrioritySlider && costPriorityValue) {
            costPrioritySlider.value = 70;
            costPriorityValue.textContent = '70%';
        }

        const greenPrioritySlider = document.getElementById('greenPrioritySlider');
        const greenPriorityValue = document.getElementById('greenPriorityValue');
        if (greenPrioritySlider && greenPriorityValue) {
            greenPrioritySlider.value = 80;
            greenPriorityValue.textContent = '80%';
        }

        const batteryMinSlider = document.getElementById('batteryMinSlider');
        const batteryMaxSlider = document.getElementById('batteryMaxSlider');
        const batteryRangeValue = document.getElementById('batteryRangeValue');
        if (batteryMinSlider && batteryMaxSlider && batteryRangeValue) {
            batteryMinSlider.value = 20;
            batteryMaxSlider.value = 85;
            batteryRangeValue.textContent = '20% - 85%';
        }

        showToast('Settings reset to default values', 'success');
    }

    async refreshData() {
        try {
            showLoading('Refreshing data...');
            await this.loadInitialData();
            showToast('Data refreshed successfully', 'success');
        } catch (error) {
            console.error('Failed to refresh data:', error);
            showToast('Failed to refresh data', 'error');
        } finally {
            hideLoading();
        }
    }

    showNotifications() {
        // This could open a notifications modal or panel
        showToast('Notifications panel coming soon', 'info');
    }

    showAllAlerts() {
        // This could open an alerts modal or navigate to alerts page
        showToast('Alerts panel coming soon', 'info');
    }

    startPeriodicUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Set up periodic data refresh
        this.updateInterval = setInterval(async () => {
            if (this.isInitialized && api.isOnline()) {
                try {
                    const response = await api.getCurrentEnergy();
                    if (response.data) {
                        this.updateEnergyData(response.data);
                    }
                } catch (error) {
                    console.error('Failed to update data:', error);
                }
            }
        }, this.refreshRate);
    }

    generateTimeLabels(startTime, endTime, intervalMinutes) {
        const labels = [];
        const start = new Date(startTime);
        const end = new Date(endTime);
        const interval = intervalMinutes * 60 * 1000; // Convert to milliseconds

        for (let time = new Date(start); time <= end; time = new Date(time.getTime() + interval)) {
            labels.push(time.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }));
        }

        return labels;
    }

    destroy() {
        // Clean up intervals
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Disconnect WebSocket
        api.disconnectWebSocket();

        // Destroy charts
        this.charts.forEach(chart => chart.destroy());

        // Destroy components
        this.components.forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CMORPApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.app) {
        if (document.hidden) {
            // Page is hidden, reduce update frequency
            console.log('Page hidden, reducing update frequency');
        } else {
            // Page is visible, resume normal updates
            console.log('Page visible, resuming normal updates');
            window.app.refreshData();
        }
    }
});

// Handle online/offline events
window.addEventListener('online', () => {
    console.log('Application back online');
    if (window.app) {
        window.app.refreshData();
    }
});

window.addEventListener('offline', () => {
    console.log('Application offline');
    showToast('You are offline. Some features may be limited.', 'warning');
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});