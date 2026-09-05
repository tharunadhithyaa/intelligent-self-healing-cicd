"""
CivicPulseAI — Resource Predictor & Proactive Scaling Engine
============================================================
Queries Prometheus metric time-series and applies linear regression forecasting (y = m*x + c)
to trigger proactive SCALE remediations before hard alert thresholds (80%/85%) are breached.

MATHEMATICAL MODEL & DESIGN RATIONALE:
- Simple Linear Regression (via NumPy/SciPy `polyfit`) was chosen over complex deep learning:
  1. High Interpretability: Deterministic linear slope (m) and offset (c) allow exact operational auditing.
  2. Zero Cold-Start Overhead: No offline dataset training, GPUs, or heavy model weight files required.
  3. Real-Time Latency: Microsecond evaluation fitting 15-minute sliding Prometheus metrics windows.
- Filters noise by requiring >= 5 time-series data points and sustained positive slope trends.
- Supports conservative scale-down when CPU/Memory load stays consistently low for >10 minutes.
"""

import logging
import os
import time
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False
    import urllib.request
    import urllib.parse
    import json

from typing import Optional, Dict, Any, List, Tuple

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

logger = logging.getLogger("ml_decision_controller.predictor")

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://civicpulse-prometheus:9090")
MIN_DATA_POINTS = 5
PROACTIVE_CPU_THRESHOLD = 0.75     # 75% forecasted CPU
PROACTIVE_MEM_BYTES = 360 * 1024 * 1024  # 360MB forecasted memory
CONSERVATIVE_SCALE_DOWN_MINUTES = 10

class ResourcePredictor:
    def __init__(self, prometheus_url: str = PROMETHEUS_URL):
        self.prometheus_url = prometheus_url.rstrip("/")
        # Store history of low-load observations for scale-down guard
        self.low_load_timestamps: Dict[str, float] = {}

    def _query_prometheus_range(self, query: str, duration_minutes: int = 15) -> List[Tuple[float, float]]:
        """Queries Prometheus range data over past duration_minutes."""
        end_time = time.time()
        start_time = end_time - (duration_minutes * 60)
        step = 30  # 30s step

        url = f"{self.prometheus_url}/api/v1/query_range"
        params = {
            "query": query,
            "start": str(start_time),
            "end": str(end_time),
            "step": str(step)
        }

        try:
            if HAS_HTTPX:
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                    else:
                        data = {}
            else:
                encoded_params = urllib.parse.urlencode(params)
                full_url = f"{url}?{encoded_params}"
                req = urllib.request.Request(full_url)
                with urllib.request.urlopen(req, timeout=4.0) as resp:
                    data = json.loads(resp.read().decode('utf-8'))

            results = data.get("data", {}).get("result", [])
            if results:
                values = results[0].get("values", [])
                return [(float(v[0]), float(v[1])) for v in values if v[1] != "NaN"]
        except Exception as e:
            logger.debug(f"Prometheus query range failed: {e}")
        return []


    def fit_linear_trend(self, data_points: List[Tuple[float, float]], forecast_seconds: int = 300) -> Tuple[float, float, float]:
        """
        Fits linear regression y = m*x + c.
        Returns: (current_val, predicted_val, slope)
        """
        if len(data_points) < MIN_DATA_POINTS:
            return 0.0, 0.0, 0.0

        if HAS_NUMPY:
            timestamps = np.array([p[0] for p in data_points])
            values = np.array([p[1] for p in data_points])
            # Normalize timestamps relative to start
            t_norm = timestamps - timestamps[0]

            slope, intercept = np.polyfit(t_norm, values, 1)
            future_t = (timestamps[-1] - timestamps[0]) + forecast_seconds
            pred_val = slope * future_t + intercept
            return float(values[-1]), max(0.0, float(pred_val)), float(slope)
        else:
            # Fallback pure python least squares
            n = len(data_points)
            t0 = data_points[0][0]
            xs = [p[0] - t0 for p in data_points]
            ys = [p[1] for p in data_points]

            mean_x = sum(xs) / n
            mean_y = sum(ys) / n

            num = sum((xs[i] - mean_x) * (ys[i] - mean_y) for i in range(n))
            den = sum((xs[i] - mean_x) ** 2 for i in range(n))

            slope = num / den if den != 0 else 0.0
            intercept = mean_y - slope * mean_x

            future_t = (data_points[-1][0] - t0) + forecast_seconds
            pred_val = slope * future_t + intercept
            return ys[-1], max(0.0, pred_val), slope

    def evaluate_predictive_scaling(self, target_workload: str = "civicpulse-backend") -> Optional[Dict[str, Any]]:
        """
        Evaluates proactive scale-up or conservative scale-down for target_workload.
        """
        # 1. Evaluate Proactive Scale-Up (CPU & Memory Forecasts)
        cpu_query = f'rate(container_cpu_usage_seconds_total{{pod=~"{target_workload}.*"}}[5m])'
        cpu_points = self._query_prometheus_range(cpu_query, duration_minutes=15)

        if len(cpu_points) >= MIN_DATA_POINTS:
            curr_cpu, pred_cpu, cpu_slope = self.fit_linear_trend(cpu_points, forecast_seconds=300)
            if cpu_slope > 0 and pred_cpu >= PROACTIVE_CPU_THRESHOLD:
                reason = f"Proactive Scale: CPU usage trend (slope={cpu_slope:.4f}) forecasts {pred_cpu*100:.1f}% CPU in 5m (Threshold: {PROACTIVE_CPU_THRESHOLD*100:.0f}%)"
                logger.info(reason)
                return {
                    "action": "SCALE",
                    "reason": reason,
                    "metric": "cpu",
                    "current_value": curr_cpu,
                    "predicted_value": pred_cpu,
                    "slope": cpu_slope
                }

        mem_query = f'container_memory_working_set_bytes{{pod=~"{target_workload}.*"}}'
        mem_points = self._query_prometheus_range(mem_query, duration_minutes=15)

        if len(mem_points) >= MIN_DATA_POINTS:
            curr_mem, pred_mem, mem_slope = self.fit_linear_trend(mem_points, forecast_seconds=300)
            if mem_slope > 0 and pred_mem >= PROACTIVE_MEM_BYTES:
                reason = f"Proactive Scale: Memory trend (slope={mem_slope:.2f}) forecasts {pred_mem/(1024*1024):.1f}MB memory in 5m"
                logger.info(reason)
                return {
                    "action": "SCALE",
                    "reason": reason,
                    "metric": "memory",
                    "current_value": curr_mem,
                    "predicted_value": pred_mem,
                    "slope": mem_slope
                }

        # 2. Evaluate Conservative Scale-Down (Sustained Low Load)
        # Low load: CPU < 20% (0.2) AND Memory < 150MB sustained for >10 mins
        if len(cpu_points) >= MIN_DATA_POINTS and len(mem_points) >= MIN_DATA_POINTS:
            curr_cpu, _, _ = self.fit_linear_trend(cpu_points, 0)
            curr_mem, _, _ = self.fit_linear_trend(mem_points, 0)

            if curr_cpu < 0.20 and curr_mem < (150 * 1024 * 1024):
                now = time.time()
                if target_workload not in self.low_load_timestamps:
                    self.low_load_timestamps[target_workload] = now

                duration = (now - self.low_load_timestamps[target_workload]) / 60.0
                if duration >= CONSERVATIVE_SCALE_DOWN_MINUTES:
                    reason = f"Conservative Scale-Down: Low CPU ({curr_cpu*100:.1f}%) and Memory ({curr_mem/(1024*1024):.1f}MB) sustained for {duration:.1f} minutes."
                    logger.info(reason)
                    return {
                        "action": "SCALE_DOWN",
                        "reason": reason,
                        "metric": "low_load",
                        "current_cpu": curr_cpu,
                        "current_mem": curr_mem,
                        "low_duration_minutes": duration
                    }
            else:
                self.low_load_timestamps.pop(target_workload, None)

        return None
