/**
 * User Login Load Test
 * Tests API performance under concurrent login attempts
 * 
 * Prerequisites: Run user-registration test first to create test users
 * 
 * Usage:
 *   k6 run tests/user-login.js --vus 50 --duration 30s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const loginSuccessRate = new Rate('login_success');
const loginTime = new Trend('login_time');

export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '15s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    login_success: ['rate>0.95'],
    login_time: ['p(95)<500'],
  },
};

const BASE_URL = 'http://localhost:5000/api';

// Pre-created test users (update these after running registration test)
const TEST_USERS = [
  { email: 'testuser1@loadtest.com', password: 'TestPassword123!' },
  { email: 'testuser2@loadtest.com', password: 'TestPassword123!' },
  { email: 'testuser3@loadtest.com', password: 'TestPassword123!' },
];

export default function () {
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/auth/login`, payload, params);
  const duration = Date.now() - startTime;
  
  loginTime.add(duration);
  
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'login successful': (r) => {
      const body = JSON.parse(r.body);
      return body.success === true;
    },
    'has user data': (r) => {
      const body = JSON.parse(r.body);
      return body.user !== undefined;
    },
  });
  
  loginSuccessRate.add(success);
  sleep(0.3);
}
