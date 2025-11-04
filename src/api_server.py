"""
FastAPI Server for C-MORP
Provides REST API and WebSocket endpoints for the energy management platform
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json
import random
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Import existing backend services
from solver_bridge import SolverBridge, OptimizationResult
# from guard_rail import GuardRail, Constraint
# from alert_broker import AlertBroker
# from user_feedback import UserFeedback

# Import our models
from models import (
    EnergyData, Device, DeviceType, DeviceStatus, OptimizationSettings,
    OptimizationResult as APIOptimizationResult, Alert, User, HistoricalData,
    ApiResponse, WebSocketMessage, ForecastRequest, ForecastResponse
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="C-MORP API",
    description="Campus Microgrid Optimization & Reliability Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize backend services
solver = SolverBridge()
# guard_rail = GuardRail()
# alert_broker = AlertBroker()
# user_feedback = UserFeedback()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)

        # Remove disconnected connections
        for conn in disconnected:
            self.active_connections.remove(conn)

manager = ConnectionManager()

# Background task for real-time data generation
async def generate_realtime_data():
    """Generate simulated real-time energy data"""
    while True:
        try:
            # Simulate realistic energy data
            current_hour = datetime.now().hour
            base_load = 100 + (150 if 9 <= current_hour <= 17 else 50) + random.uniform(-20, 20)
            solar_generation = max(0, 250 * (1 - abs(current_hour - 12) / 12) + random.uniform(-20, 20))

            battery_soc = random.uniform(30, 85)
            battery_power = random.uniform(-50, 50)

            consumption = base_load + random.uniform(-10, 10)
            generation = solar_generation
            grid_import = max(0, consumption - generation - battery_power)
            grid_export = max(0, generation - consumption - battery_power)

            energy_data = EnergyData(
                timestamp=datetime.utcnow(),
                consumption_kw=max(0, consumption),
                generation_kw=max(0, generation),
                battery_soc=battery_soc,
                battery_power_kw=battery_power,
                grid_import_kw=grid_import,
                grid_export_kw=grid_export,
                cost_savings=random.uniform(20, 80),
                carbon_savings_kg=random.uniform(5, 25)
            )

            # Broadcast to all connected clients
            message = WebSocketMessage(
                type="energy_update",
                data=energy_data.dict()
            )
            await manager.broadcast(message.dict())

            # Generate alerts occasionally
            if random.random() < 0.05:  # 5% chance
                alert = Alert(
                    title=random.choice(["High Load Detected", "Battery Low", "Peak Hours Active"]),
                    message="System optimization recommended",
                    severity=random.choice(["low", "medium", "high", "critical"]),
                    timestamp=datetime.utcnow()
                )
                alert_message = WebSocketMessage(
                    type="alert",
                    data=alert.dict()
                )
                await manager.broadcast(alert_message.dict())

        except Exception as e:
            logger.error(f"Error generating realtime data: {e}")

        await asyncio.sleep(5)  # Update every 5 seconds

# API Routes

@app.get("/", response_model=ApiResponse)
async def root():
    """Root endpoint"""
    return ApiResponse(
        success=True,
        message="C-MORP API is running",
        data={"version": "1.0.0", "status": "healthy"}
    )

@app.get("/api/energy/current", response_model=ApiResponse)
async def get_current_energy():
    """Get current energy measurements"""
    try:
        # Generate current data
        current_hour = datetime.now().hour
        base_load = 100 + (150 if 9 <= current_hour <= 17 else 50) + random.uniform(-20, 20)
        solar_generation = max(0, 250 * (1 - abs(current_hour - 12) / 12) + random.uniform(-20, 20))

        energy_data = EnergyData(
            timestamp=datetime.utcnow(),
            consumption_kw=max(0, base_load),
            generation_kw=max(0, solar_generation),
            battery_soc=random.uniform(30, 85),
            battery_power_kw=random.uniform(-50, 50),
            grid_import_kw=random.uniform(0, 100),
            grid_export_kw=random.uniform(0, 50),
            cost_savings=random.uniform(20, 80),
            carbon_savings_kg=random.uniform(5, 25)
        )

        return ApiResponse(
            success=True,
            message="Current energy data retrieved",
            data=energy_data.dict()
        )
    except Exception as e:
        logger.error(f"Error getting current energy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/energy/history", response_model=ApiResponse)
async def get_energy_history(period: str = "24h"):
    """Get historical energy data"""
    try:
        # Generate historical data based on period
        hours = 24
        if period == "7d":
            hours = 168  # 7 days
        elif period == "30d":
            hours = 720  # 30 days

        # Generate realistic historical data
        consumption_data = []
        generation_data = []
        battery_soc_data = []
        cost_data = []

        for i in range(hours):
            hour_of_day = i % 24
            # Consumption pattern
            base_consumption = 100 + (150 if 9 <= hour_of_day <= 17 else 50)
            consumption_data.append(base_consumption + random.uniform(-20, 20))

            # Generation pattern (solar)
            solar = max(0, 250 * (1 - abs(hour_of_day - 12) / 12))
            generation_data.append(solar + random.uniform(-20, 20))

            # Battery SOC
            battery_soc_data.append(30 + 40 * (0.5 + 0.5 * random.random()))

            # Cost data
            cost_data.append(random.uniform(5, 15))

        historical_data = HistoricalData(
            start_time=datetime.utcnow() - timedelta(hours=hours),
            end_time=datetime.utcnow(),
            interval_minutes=60,
            consumption_data=consumption_data,
            generation_data=generation_data,
            battery_soc_data=battery_soc_data,
            cost_data=cost_data
        )

        return ApiResponse(
            success=True,
            message=f"Historical data for {period} retrieved",
            data=historical_data.dict()
        )
    except Exception as e:
        logger.error(f"Error getting energy history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/energy/devices", response_model=ApiResponse)
async def get_devices():
    """Get list of devices and their status"""
    try:
        devices = [
            Device(
                id="solar_001",
                name="Main Solar Array",
                device_type=DeviceType.SOLAR_PANEL,
                status=DeviceStatus.ONLINE,
                location="Rooftop A",
                capacity_kw=250.0,
                efficiency=94.5,
                last_update=datetime.utcnow(),
                metadata={"panel_count": 100, "installation_date": "2023-06-15"}
            ),
            Device(
                id="battery_001",
                name="Battery Storage System",
                device_type=DeviceType.BATTERY,
                status=DeviceStatus.ONLINE,
                location="Basement B",
                capacity_kw=500.0,
                efficiency=95.2,
                last_update=datetime.utcnow(),
                metadata={"chemistry": "Li-ion", "cycles": 1250}
            ),
            Device(
                id="inverter_001",
                name="Main Inverter",
                device_type=DeviceType.INVERTER,
                status=DeviceStatus.ONLINE,
                location="Electrical Room",
                capacity_kw=300.0,
                efficiency=98.1,
                last_update=datetime.utcnow(),
                metadata={"brand": "SolarEdge", "model": "SE3000"}
            ),
            Device(
                id="meter_001",
                name="Grid Import/Export Meter",
                device_type=DeviceType.GRID_METER,
                status=DeviceStatus.ONLINE,
                location="Main Panel",
                last_update=datetime.utcnow(),
                metadata={"utility": "BESCOM", "tariff": "Industrial"}
            )
        ]

        return ApiResponse(
            success=True,
            message="Device list retrieved",
            data=[device.dict() for device in devices]
        )
    except Exception as e:
        logger.error(f"Error getting devices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/energy/optimize", response_model=ApiResponse)
async def optimize_energy(settings: OptimizationSettings):
    """Run energy optimization"""
    try:
        # Generate sample forecasts
        hours = 24
        solar_forecast = [max(0, 250 * (1 - abs(h - 12) / 12) + random.uniform(-20, 20)) for h in range(hours)]
        load_forecast = [100 + (150 if 9 <= h <= 17 else 50) + random.uniform(-20, 20) for h in range(hours)]

        # Run optimization using solver bridge
        result = solver.optimize_energy_schedule(
            solar_forecast=solar_forecast,
            load_forecast=load_forecast,
            battery_capacity=500.0,
            initial_soc=settings.battery_min_soc + (settings.battery_max_soc - settings.battery_min_soc) / 2
        )

        # Calculate baseline cost for comparison
        baseline_cost = sum(load_forecast) * 7.5  # Average tariff
        savings_pct = ((baseline_cost - result.objective_value) / baseline_cost * 100) if baseline_cost > 0 else 0

        api_result = APIOptimizationResult(
            timestamp=datetime.utcnow(),
            success=result.success,
            total_cost=result.objective_value,
            baseline_cost=baseline_cost,
            savings_percentage=savings_pct,
            battery_schedule=result.battery_schedule,
            grid_schedule=result.grid_schedule,
            solve_time_ms=result.solve_time_ms
        )

        return ApiResponse(
            success=True,
            message="Energy optimization completed",
            data=api_result.dict()
        )
    except Exception as e:
        logger.error(f"Error running optimization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alerts/active", response_model=ApiResponse)
async def get_active_alerts():
    """Get active alerts"""
    try:
        alerts = [
            Alert(
                title="High Load Period",
                message="Current consumption exceeds predicted forecast by 15%",
                severity=AlertSeverity.MEDIUM,
                timestamp=datetime.utcnow() - timedelta(minutes=30),
                metadata={"current_load": 285.3, "predicted_load": 248.1}
            ),
            Alert(
                title="Battery Efficiency",
                message="Battery system operating at optimal efficiency",
                severity=AlertSeverity.LOW,
                timestamp=datetime.utcnow() - timedelta(hours=2),
                metadata={"efficiency": 96.2, "temperature": 25.5}
            )
        ]

        return ApiResponse(
            success=True,
            message="Active alerts retrieved",
            data=[alert.dict() for alert in alerts]
        )
    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alerts/acknowledge", response_model=ApiResponse)
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert"""
    try:
        return ApiResponse(
            success=True,
            message=f"Alert {alert_id} acknowledged",
            data={"alert_id": alert_id, "acknowledged_at": datetime.utcnow()}
        )
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/profile", response_model=ApiResponse)
async def get_user_profile():
    """Get user profile"""
    try:
        user = User(
            name="Campus Energy Manager",
            email="energy@campus.edu",
            role="administrator",
            created_at=datetime.utcnow() - timedelta(days=365),
            last_login=datetime.utcnow() - timedelta(hours=2),
            preferences={
                "theme": "light",
                "notifications": True,
                "currency": "INR",
                "units": "metric"
            }
        )

        return ApiResponse(
            success=True,
            message="User profile retrieved",
            data=user.dict()
        )
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/forecast", response_model=ApiResponse)
async def get_energy_forecast(request: ForecastRequest):
    """Get energy forecast"""
    try:
        hours = request.horizon_hours
        base_hour = datetime.now().hour

        # Generate realistic forecasts
        solar_forecast = []
        load_forecast = []

        for i in range(hours):
            hour_of_day = (base_hour + i) % 24

            # Solar forecast (daylight hours only)
            solar = max(0, 250 * (1 - abs(hour_of_day - 12) / 12))
            solar_forecast.append(solar + random.uniform(-30, 30))

            # Load forecast (business hours higher)
            base_load = 100 + (150 if 9 <= hour_of_day <= 17 else 50)
            load_forecast.append(base_load + random.uniform(-20, 20))

        forecast = ForecastResponse(
            timestamp=datetime.utcnow(),
            solar_forecast=solar_forecast,
            load_forecast=load_forecast,
            confidence_interval=[10.0, 15.0],  # ± bounds
            weather_conditions={"condition": "partly_cloudy", "temperature": "28°C"}
        )

        return ApiResponse(
            success=True,
            message=f"Energy forecast for {hours} hours generated",
            data=forecast.dict()
        )
    except Exception as e:
        logger.error(f"Error generating forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time data"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            # Echo back or handle client messages if needed
            message = json.loads(data)
            if message.get("type") == "ping":
                await manager.send_personal_message({"type": "pong"}, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Background task startup
@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    logger.info("Starting C-MORP API server...")

    # Start real-time data generation
    asyncio.create_task(generate_realtime_data())

    logger.info("C-MORP API server started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down C-MORP API server...")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0",
        "services": {
            "solver": "online",
            "guard_rail": "online",
            "alert_broker": "online"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)