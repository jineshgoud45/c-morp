/**
 * API Client for C-MORP
 * Handles HTTP requests and WebSocket connections to the backend
 */

class ApiClient {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.eventListeners = new Map();
    }

    getBaseURL() {
        // In production, this should be configurable
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:5000/api';
        }
        return '/api';
    }

    /**
     * Generic HTTP request method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url);
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    // Energy Data APIs

    /**
     * Get current energy measurements
     */
    async getCurrentEnergy() {
        return this.get('/energy/current');
    }

    /**
     * Get historical energy data
     */
    async getEnergyHistory(period = '24h') {
        return this.get('/energy/history', { period });
    }

    /**
     * Get list of devices
     */
    async getDevices() {
        return this.get('/energy/devices');
    }

    /**
     * Run energy optimization
     */
    async optimizeEnergy(settings) {
        return this.post('/energy/optimize', settings);
    }

    /**
     * Get energy forecast
     */
    async getEnergyForecast(horizonHours = 24, resolutionMinutes = 60) {
        return this.post('/forecast', {
            horizon_hours: horizonHours,
            resolution_minutes: resolutionMinutes
        });
    }

    // Alert APIs

    /**
     * Get active alerts
     */
    async getActiveAlerts() {
        return this.get('/alerts/active');
    }

    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId) {
        return this.post('/alerts/acknowledge', { alert_id: alertId });
    }

    // User APIs

    /**
     * Get user profile
     */
    async getUserProfile() {
        return this.get('/user/profile');
    }

    /**
     * Update user settings
     */
    async updateUserSettings(settings) {
        return this.put('/user/settings', settings);
    }

    // WebSocket Connection

    /**
     * Connect to WebSocket for real-time updates
     */
    connectWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        const wsURL = this.baseURL.replace(/^http/, 'ws') + '/ws';

        try {
            this.ws = new WebSocket(wsURL);
            this.setupWebSocketHandlers();
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('websocket:connected');

            // Send ping periodically to keep connection alive
            this.pingInterval = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            this.emit('websocket:disconnected');

            // Clear ping interval
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
            }

            // Schedule reconnect if not intentionally closed
            if (event.code !== 1000) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('websocket:error', error);
        };
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(message) {
        const { type, data } = message;

        switch (type) {
            case 'energy_update':
                this.emit('energy:update', data);
                break;
            case 'alert':
                this.emit('alert:new', data);
                break;
            case 'device_status':
                this.emit('device:status', data);
                break;
            case 'optimization_result':
                this.emit('optimization:complete', data);
                break;
            case 'pong':
                // Server responded to ping
                break;
            default:
                console.log('Unknown WebSocket message type:', type, data);
        }
    }

    /**
     * Schedule WebSocket reconnection
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max WebSocket reconnection attempts reached');
            this.emit('websocket:max_reconnect');
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

        setTimeout(() => {
            this.reconnectAttempts++;
            this.connectWebSocket();
        }, delay);
    }

    /**
     * Disconnect WebSocket
     */
    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.isConnected = false;
    }

    // Event System

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Utility Methods

    /**
     * Check if online
     */
    isOnline() {
        return navigator.onLine && this.isConnected;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        if (!navigator.onLine) {
            return 'offline';
        }
        if (this.isConnected) {
            return 'connected';
        }
        return 'connecting';
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
            if (response.ok) {
                return await response.json();
            }
            throw new Error('Health check failed');
        } catch (error) {
            console.error('Health check failed:', error);
            throw error;
        }
    }
}

// Create global API client instance
const api = new ApiClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient, api };
} else {
    window.ApiClient = ApiClient;
    window.api = api;
}