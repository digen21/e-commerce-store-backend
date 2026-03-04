/**
 * Stress Test - Break the System
 * Pushes the API to its limits to find breaking point
 *
 * Usage:
 *   k6 run tests/stress-test.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const successRate = new Rate("success_rate");
const responseTime = new Trend("response_time");

export const options = {
  stages: [
    { duration: "30s", target: 100 }, // Ramp to 100
    { duration: "30s", target: 300 }, // Ramp to 300
    { duration: "30s", target: 500 }, // Ramp to 500 (STRESS)
    { duration: "30s", target: 500 }, // Stay at 500
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    success_rate: ["rate>0.90"], // 90% success acceptable under stress
    response_time: ["p(95)<5000"], // 5s acceptable under stress
  },
};

const BASE_URL = "http://localhost:5000/api";

export default function () {
  const scenarios = [
    { method: "GET", url: `${BASE_URL}/products`, weight: 0.4 },
    { method: "GET", url: `${BASE_URL}/products?page=1&limit=10`, weight: 0.3 },
    { method: "GET", url: `${BASE_URL}/auth/profile`, weight: 0.2 },
    { method: "GET", url: `${BASE_URL}/orders`, weight: 0.1 },
  ];

  // Random scenario selection
  const rand = Math.random();
  let cumulative = 0;
  let selected = scenarios[0];

  for (const scenario of scenarios) {
    cumulative += scenario.weight;
    if (rand <= cumulative) {
      selected = scenario;
      break;
    }
  }

  const startTime = Date.now();
  const response = http.get(selected.url);
  const duration = Date.now() - startTime;

  responseTime.add(duration);

  const success = check(response, {
    "status < 500": (r) => r.status < 500,
    "response time < 5s": (r) => duration < 5000,
  });

  successRate.add(success);
  sleep(0.1);
}
