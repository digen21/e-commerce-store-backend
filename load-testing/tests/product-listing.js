/**
 * Product Listing Load Test
 * Tests API performance for product browsing
 *
 * Usage:
 *   k6 run tests/product-listing.js --vus 100 --duration 30s
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const productSuccessRate = new Rate("product_success");
const productTime = new Trend("product_time");

export const options = {
  stages: [
    { duration: "10s", target: 20 },
    { duration: "20s", target: 100 },
    { duration: "30s", target: 200 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"],
    product_success: ["rate>0.98"],
    product_time: ["p(95)<300"],
  },
};

const BASE_URL = "http://localhost:5000/api";

export default function () {
  const scenarios = [
    { url: `${BASE_URL}/products`, name: "all_products" },
    { url: `${BASE_URL}/products?page=1&limit=10`, name: "paginated" },
    { url: `${BASE_URL}/products?category=Electronics`, name: "by_category" },
    { url: `${BASE_URL}/products?minPrice=10&maxPrice=100`, name: "by_price" },
    { url: `${BASE_URL}/products?search=laptop`, name: "search" },
  ];

  const scenario = scenarios[__VU % scenarios.length];

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const startTime = Date.now();
  const response = http.get(scenario.url, params);
  const duration = Date.now() - startTime;

  productTime.add(duration);

  const success = check(response, {
    "status is 200": (r) => r.status === 200,
    "has products array": (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.data);
    },
    "response time < 500ms": (r) => duration < 500,
  });

  productSuccessRate.add(success);
  sleep(0.2);
}
