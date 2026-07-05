import os
import sys
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.telemetry_mock")

app = FastAPI(title="Vigil IoT Telemetry Mock Server")

# Add CORS middleware to support Next.js and backend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryDataPoint(BaseModel):
    timestamp: str
    temperature_celsius: float
    pressure_bar: float
    vibration_mm_s: float
    motor_rpm: float

@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "telemetry_mock_server"}

@app.get("/api/telemetry/{equipment_tag}")
def get_telemetry(equipment_tag: str) -> List[TelemetryDataPoint]:
    """
    Generates and returns 24 hours of mock sensor telemetry data for the specified equipment tag.
    Simulates a gradual pressure, temperature, and vibration anomaly on P-101 over the last 4 hours.
    """
    tag = equipment_tag.upper().strip()
    logger.info(f"Generating telemetry data for equipment tag: {tag}")
    
    # Verify valid tag shape (e.g. P-101, V-202, T-301)
    if not tag:
        raise HTTPException(status_code=400, detail="Invalid equipment tag format.")

    now = datetime.now()
    data_points: List[TelemetryDataPoint] = []

    # Generate 24 hours of hourly data points (from 23 hours ago to current time)
    for hour in range(23, -1, -1):
        point_time = now - timedelta(hours=hour)
        timestamp_str = point_time.isoformat()

        # Default normal baselines for a standard industrial pump
        temp = 45.0
        press = 30.0
        vib = 1.4
        rpm = 1450.0

        # Inject noise parameters to simulate real-world fluctuation
        # Using deterministic offsets based on hour index for consistency
        noise_factor = (hour % 5) - 2
        temp += noise_factor * 0.4
        press += noise_factor * 0.2
        vib += noise_factor * 0.05
        rpm += noise_factor * 2.0

        # Inject anomaly on P-101 over the last 4 hours (hours 20 to 23 in our sequence, corresponding to hour <= 3)
        if tag == "P-101" and hour <= 3:
            # Gradual climb over the last 4 hours (hour = 3, 2, 1, 0)
            severity_mult = 4 - hour  # 1 at 3 hours ago, 4 at current hour
            
            # Pressure climbs from ~30 bar to ~48 bar (exceeding critical 45 bar threshold)
            press += severity_mult * 4.5
            # Temperature climbs from ~45C to ~67C
            temp += severity_mult * 5.5
            # Vibration climbs from ~1.4 mm/s to ~5.2 mm/s (exceeding alert limits)
            vib += severity_mult * 0.95
            # RPM dips slightly under load stress
            rpm -= severity_mult * 8.0

        data_points.append(
            TelemetryDataPoint(
                timestamp=timestamp_str,
                temperature_celsius=round(temp, 2),
                pressure_bar=round(press, 2),
                vibration_mm_s=round(vib, 2),
                motor_rpm=round(rpm, 1)
            )
        )

    return data_points

if __name__ == "__main__":
    import uvicorn
    # Serve mock telemetry API on port 8001 to prevent conflicts with api.py on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8001)
