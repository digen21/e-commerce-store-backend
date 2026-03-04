# 🚀 Quick Start: Test 100 Concurrent User Registrations

## Step 1: Install k6

### Windows (PowerShell as Admin)
```powershell
winget install k6
```

### Verify Installation
```bash
k6 version
```

---

## Step 2: Start Your Server

```bash
cd E:\PROJECTS\e-commerce\server
npm run dev
```

Ensure you see: `Server started on port 5000`

---

## Step 3: Run Load Test (100 Concurrent Users)

```bash
cd E:\PROJECTS\e-commerce\server\load-testing

# Test with 100 concurrent users for 30 seconds
k6 run tests/user-registration.js --vus 100 --duration 30s
```

---

## Step 4: View Results

### Console Output
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

### Detailed Results
Check `results/registration-summary.json` for detailed metrics.

---

## Step 5: Interpret Results

### ✅ Good Results
```
Success Rate: >95%
Avg Response: <500ms
P95 Response: <1000ms
```

### ⚠️ Warning Signs
```
Success Rate: 90-95%
Avg Response: 500-1000ms
P95 Response: 1000-2000ms
```

### ❌ Critical Issues
```
Success Rate: <90%
Avg Response: >1000ms
P95 Response: >2000ms
```

---

## Different Load Levels

### Light Load (10 users)
```bash
k6 run tests/user-registration.js --vus 10 --duration 10s
```

### Medium Load (50 users)
```bash
k6 run tests/user-registration.js --vus 50 --duration 20s
```

### Heavy Load (100 users) ← **RECOMMENDED**
```bash
k6 run tests/user-registration.js --vus 100 --duration 30s
```

### Extreme Load (200 users)
```bash
k6 run tests/user-registration.js --vus 200 --duration 60s
```

---

## Troubleshooting

### Error: "Too many requests" (429)
Rate limiting is working! This is expected at high loads.

**Solution:** Temporarily disable for testing:
```javascript
// In src/routes/auth.routes.ts
// Comment out authLimiter temporarily
authRouter.post("/register", /*authLimiter,*/ validate(...), ...);
```

### Error: Connection refused
Server not running. Start it:
```bash
npm run dev
```

### Error: k6 not found
Install k6:
```bash
winget install k6
```

---

## Next Tests

After registration test, try:

### Product Browsing (200 users)
```bash
k6 run tests/product-listing.js --vus 200 --duration 30s
```

### Full Stress Test
```bash
k6 run tests/stress-test.js
```

---

## Share Results

Save and share:
1. Console output screenshot
2. `results/registration-summary.json`
3. Server logs during test

Good luck! 🎯
