# 🔥 E-Commerce API Load Testing POC

Load testing suite for testing e-commerce API performance under various load conditions.

## 📋 Prerequisites

### 1. Install k6

**Windows:**
```bash
winget install k6
# OR
choco install k6
```

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# RHEL/CentOS
sudo rpm --import https://dl.k6.io/key.gpg.asc
sudo rpm -Uvh https://dl.k6.io/rpm/repo.rpm
sudo yum install k6
```

**Verify Installation:**
```bash
k6 version
```

### 2. Start Your Server

```bash
cd ../server
npm run dev
```

Ensure server is running on `http://localhost:5000`

---

## 🚀 Quick Start

### Test 1: User Registration (100 Concurrent Users)

```bash
# Navigate to load-testing folder
cd load-testing

# Run registration test with 100 concurrent users
k6 run tests/user-registration.js --vus 100 --duration 30s
```

### Test 2: All Scenarios (Smoke Test)

```bash
k6 run tests/smoke-test.js
```

### Test 3: Stress Test

```bash
k6 run tests/stress-test.js
```

---

## 📊 Available Tests

| Test | File | Description | Recommended Load |
|------|------|-------------|------------------|
| **User Registration** | `user-registration.js` | Test concurrent user signups | 100 VUs, 30s |
| **User Login** | `user-login.js` | Test concurrent logins | 100 VUs, 30s |
| **Product Listing** | `product-listing.js` | Test product browsing | 200 VUs, 30s |
| **Order Creation** | `order-creation.js` | Test checkout flow | 50 VUs, 30s |
| **Smoke Test** | `smoke-test.js` | All endpoints light load | 10 VUs, 60s |
| **Stress Test** | `stress-test.js` | Break the system | 500 VUs, 60s |
| **Spike Test** | `spike-test.js` | Sudden traffic spike | Variable |

---

## 🎯 Test Configuration

### User Registration Test

```bash
# Light load
k6 run tests/user-registration.js

# Medium load (50 concurrent users)
k6 run tests/user-registration.js --vus 50 --duration 30s

# Heavy load (100 concurrent users)
k6 run tests/user-registration.js --vus 100 --duration 30s

# Extreme load (200 concurrent users)
k6 run tests/user-registration.js --vus 200 --duration 60s
```

### Custom Stages

Edit `tests/user-registration.js`:

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // 10 users
    { duration: '20s', target: 50 },   // 50 users
    { duration: '30s', target: 100 },  // 100 users (PEAK)
    { duration: '20s', target: 50 },   // Ramp down
    { duration: '10s', target: 0 },    // Stop
  ],
};
```

---

## 📈 Understanding Results

### Sample Output

```
╔══════════════════════════════════════════════════════════╗
║       USER REGISTRATION LOAD TEST RESULTS                ║
╠══════════════════════════════════════════════════════════╣
║  Total Requests:     1547                                ║
║  Success Rate:       98.5%                               ║
║  Avg Response Time:  245.3ms                             ║
║  P95 Response Time:  487.2ms                             ║
╚══════════════════════════════════════════════════════════╝
```

### Key Metrics

| Metric | Description | Good | Warning | Critical |
|--------|-------------|------|---------|----------|
| **Success Rate** | % of successful requests | >99% | 95-99% | <95% |
| **Avg Response** | Average response time | <200ms | 200-500ms | >500ms |
| **P95 Response** | 95th percentile time | <500ms | 500-1000ms | >1000ms |
| **Requests/sec** | Throughput | Varies | - | - |

---

## 🔧 Configuration

### Update Base URL

Edit test files if your server runs on different port:

```javascript
const BASE_URL = 'http://localhost:5000/api';
// Change to:
const BASE_URL = 'http://your-server.com/api';
```

### Update Test Data

For order creation test, update `tests/order-creation.js`:

```javascript
const TEST_EMAIL = 'your-test-user@email.com';
const TEST_PASSWORD = 'your-password';
const PRODUCT_IDS = ['actual-product-id-1', 'actual-product-id-2'];
```

---

## 📊 Results Analysis

### View Results

Results are saved in `results/` folder:

```bash
# View JSON results
cat results/registration-summary.json

# Or open in browser
start results/registration-summary.json  # Windows
open results/registration-summary.json   # macOS
```

### Performance Benchmarks

| Concurrent Users | Expected RPS | Max Response Time |
|------------------|--------------|-------------------|
| 10 | 50-100 | <200ms |
| 50 | 200-300 | <500ms |
| 100 | 400-600 | <1000ms |
| 200 | 600-800 | <2000ms |
| 500 | 800-1000 | <5000ms |

---

## 🎯 Performance Goals

### Target Metrics

```
✅ Registration Success Rate: >95%
✅ Login Success Rate: >98%
✅ Product Listing P95: <300ms
✅ Order Creation P95: <2000ms
✅ Error Rate: <2%
```

### If Tests Fail

1. **Check Server Logs**
   ```bash
   # Check server console for errors
   ```

2. **Check Rate Limiting**
   - Auth endpoints: 10 req/15min
   - Other endpoints: 100 req/15min
   - May need to adjust for load testing

3. **Database Performance**
   ```javascript
   // Check MongoDB slow queries
   db.setProfilingLevel(2)
   ```

4. **Increase Resources**
   - Add more server instances
   - Enable clustering (PM2)
   - Add Redis caching

---

## 🚨 Common Issues

### Issue: "Too many requests" (429)

**Solution:** Temporarily disable rate limiting for testing

```javascript
// Comment out rate limiters in routes during testing
// authRouter.post("/login", authLimiter, ...);
authRouter.post("/login", ...);
```

### Issue: Connection refused

**Solution:** Ensure server is running

```bash
# Check if server is running
curl http://localhost:5000/health

# Start server
npm run dev
```

### Issue: Test users not found

**Solution:** Run registration test first

```bash
# Create test users
k6 run tests/user-registration.js --vus 10 --duration 10s
```

---

## 📚 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/best-practices/)
- [Performance Testing Guide](https://k6.io/docs/using-k6/metrics/)

---

## 🎯 Next Steps

1. **Run Baseline Test**
   ```bash
   k6 run tests/user-registration.js --vus 10 --duration 10s
   ```

2. **Run Peak Load Test**
   ```bash
   k6 run tests/user-registration.js --vus 100 --duration 30s
   ```

3. **Analyze Results**
   - Check success rate
   - Check response times
   - Identify bottlenecks

4. **Optimize & Retest**
   - Apply optimizations
   - Run same test
   - Compare results

---

## 📞 Support

For issues or questions, check:
- Server logs
- k6 output
- Network tab in browser DevTools
