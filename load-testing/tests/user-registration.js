/**
 * User Registration Load Test
 * Tests API performance under concurrent user registration load
 *
 * Usage:
 *   k6 run tests/user-registration.js                    # Default: 10 users, 10s
 *   k6 run tests/user-registration.js --vus 50           # 50 concurrent users
 *   k6 run tests/user-registration.js --vus 100 --duration 30s  # 100 users, 30s
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const registrationSuccessRate = new Rate("registration_success");
const registrationTime = new Trend("registration_time");

// Test configuration
export const options = {
  stages: [
    { duration: "10s", target: 10 }, // Ramp up to 10 users
    { duration: "20s", target: 50 }, // Ramp up to 50 users
    { duration: "30s", target: 100 }, // Ramp up to 100 users (PEAK LOAD)
    { duration: "20s", target: 50 }, // Ramp down to 50 users
    { duration: "10s", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests should complete below 500ms
    registration_success: ["rate>0.95"], // 95% success rate required
    registration_time: ["p(95)<1000"], // 95% should complete below 1s
  },
};

// Base URL - Update this to match your server
const BASE_URL = "http://localhost:5000/api";

// Generate unique user data
function generateUserData(iteration) {
  const timestamp = Date.now();
  return {
    name: `Test User ${iteration}_${timestamp}`,
    email: `testuser${iteration}_${timestamp}@loadtest.com`,
    password: "TestPassword123!",
  };
}

export default function () {
  const userData = generateUserData(__VU * 1000 + __ITER);

  const payload = JSON.stringify(userData);
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Measure registration time
  const startTime = Date.now();

  const response = http.post(`${BASE_URL}/auth/register`, payload, params);

  const endTime = Date.now();
  const registrationDuration = endTime - startTime;

  // Record custom metrics
  registrationTime.add(registrationDuration);

  // Check response
  const success = check(response, {
    "status is 201": (r) => r.status === 201,
    "has success field": (r) => JSON.parse(r.body).success === true,
    "has message": (r) => JSON.parse(r.body).message !== undefined,
    "response time < 3000ms": (r) => registrationDuration < 3000,
  });

  registrationSuccessRate.add(success);

  // Log failed registrations for debugging
  if (!success) {
    console.log(`Registration failed: ${response.status} - ${response.body}`);
  }

  // Small delay between requests
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    "results/registration-summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  const totalRequests = metrics.http_reqs ? metrics.http_reqs.values.count : 0;
  const successRate = metrics.registration_success
    ? (metrics.registration_success.values.rate * 100).toFixed(2)
    : 0;
  const avgTime = metrics.registration_time
    ? metrics.registration_time.values.avg.toFixed(2)
    : 0;
  const p95Time = metrics.registration_time
    ? metrics.registration_time.values["p(95)"].toFixed(2)
    : 0;

  return `
╔══════════════════════════════════════════════════════════╗
║       USER REGISTRATION LOAD TEST RESULTS                ║
╠══════════════════════════════════════════════════════════╣
║  Total Requests:     ${totalRequests.toString().padEnd(36)}║
║  Success Rate:       ${successRate}%.${" ".repeat(34 - successRate.length)}║
║  Avg Response Time:  ${avgTime}ms${" ".repeat(33 - avgTime.length)}║
║  P95 Response Time:  ${p95Time}ms${" ".repeat(33 - p95Time.length)}║
╚══════════════════════════════════════════════════════════╝
`;
}
