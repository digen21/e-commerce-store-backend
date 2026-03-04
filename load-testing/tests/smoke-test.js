/**
 * Smoke Test - All Endpoints
 * Light load test to verify all endpoints are working
 * 
 * Usage:
 *   k6 run tests/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const successRate = new Rate('success_rate');

export const options = {
  vus: 10,
  duration: '60s',
  thresholds: {
    success_rate: ['rate>0.95'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = 'http://localhost:5000/api';

export default function () {
  let success = true;

  // Test 1: Health Check
  const healthRes = http.get(`${BASE_URL}/health`);
  success &= check(healthRes, { 'health ok': (r) => r.status === 200 });

  sleep(0.5);

  // Test 2: Register User
  const userData = {
    name: `Smoke Test User ${__VU}`,
    email: `smoke${__VU}${Date.now()}@test.com`,
    password: 'Test123!',
  };
  
  const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify(userData), {
    headers: { 'Content-Type': 'application/json' },
  });
  success &= check(registerRes, { 'register ok': (r) => r.status === 201 });

  sleep(0.5);

  // Test 3: Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: userData.email,
    password: userData.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  success &= check(loginRes, { 'login ok': (r) => r.status === 200 });

  sleep(0.5);

  // Test 4: Get Products
  const productsRes = http.get(`${BASE_URL}/products?page=1&limit=5`);
  success &= check(productsRes, { 'products ok': (r) => r.status === 200 });

  sleep(0.5);

  // Test 5: Get Product by ID
  const productRes = http.get(`${BASE_URL}/products/64f5a1b2c3d4e5f6g7h8i9j0`);
  // May return 404 if product doesn't exist, that's ok for smoke test
  success &= check(productRes, { 'product endpoint reachable': (r) => r.status !== 500 });

  sleep(0.5);

  successRate.add(success);
}
