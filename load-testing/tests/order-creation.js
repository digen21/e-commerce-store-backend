/**
 * Order Creation Load Test
 * Tests API performance for order creation
 * 
 * Prerequisites: 
 *   - Products must exist in database
 *   - Users must be registered
 * 
 * Usage:
 *   k6 run tests/order-creation.js --vus 50 --duration 30s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const orderSuccessRate = new Rate('order_success');
const orderTime = new Trend('order_time');

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    order_success: ['rate>0.95'],
    order_time: ['p(95)<2000'],
  },
};

const BASE_URL = 'http://localhost:5000/api';

// Test credentials (UPDATE THESE)
const TEST_EMAIL = 'testuser@loadtest.com';
const TEST_PASSWORD = 'TestPassword123!';

// Product IDs (UPDATE THESE with actual product IDs from your database)
const PRODUCT_IDS = [
  '64f5a1b2c3d4e5f6g7h8i9j0',
  '64f5a1b2c3d4e5f6g7h8i9j1',
];

let authToken = '';

export function setup() {
  // Login to get auth token
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginResponse.status === 200) {
    // Extract cookie from response
    const cookies = loginResponse.cookies;
    if (cookies && cookies.access_token) {
      authToken = cookies.access_token[0].value;
    }
  }
  
  return { authToken };
}

export default function (params) {
  const token = params ? params.authToken : authToken;
  
  const payload = JSON.stringify({
    items: [
      {
        productId: PRODUCT_IDS[__VU % PRODUCT_IDS.length],
        quantity: 1,
      },
    ],
    address: '64f5a1b2c3d4e5f6g7h8i9j0', // UPDATE with valid address ID
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Cookie: `access_token=${token}`,
    },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/orders`, payload, params);
  const duration = Date.now() - startTime;
  
  orderTime.add(duration);
  
  const success = check(response, {
    'status is 201': (r) => r.status === 201,
    'order created': (r) => {
      const body = JSON.parse(r.body);
      return body.success === true && body.data.order !== undefined;
    },
    'has payment link': (r) => {
      const body = JSON.parse(r.body);
      return body.data.payment !== undefined;
    },
  });
  
  orderSuccessRate.add(success);
  sleep(1);
}
