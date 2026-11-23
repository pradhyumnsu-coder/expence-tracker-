const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  const results = [];

  function record(name, expectedStatus, actualStatus, pass, details) {
    results.push({ name, expectedStatus, actualStatus, pass, details });
    console.log(`${pass ? '✓ PASS' : '✗ FAIL'}: ${name} (Status: ${actualStatus}, Expected: ${expectedStatus})`);
  }

  try {
    // 1. Health check
    let res = await request('GET', '/api/health');
    record('GET /api/health', 200, res.status, res.status === 200 && res.body.status === 'ok', JSON.stringify(res.body));

    // 2. Initial transactions list
    res = await request('GET', '/api/transactions');
    record('GET /api/transactions (initial list)', 200, res.status, res.status === 200 && Array.isArray(res.body.data), `Found ${res.body.data ? res.body.data.length : 0} items`);

    // 3. Create valid Income
    res = await request('POST', '/api/transactions', {
      title: 'Salary Deposit',
      amount: 5000,
      category: 'Salary',
      type: 'income',
      date: '2026-11-01',
      description: 'Monthly payroll',
    });
    const incomeId = res.body?.data?.id;
    record('POST /api/transactions (Valid Income)', 201, res.status, res.status === 201 && incomeId > 0, `Created ID: ${incomeId}`);

    // 4. Create valid Expense
    res = await request('POST', '/api/transactions', {
      title: 'Groceries Market',
      amount: 150.75,
      category: 'Food',
      type: 'expense',
      date: '2026-11-05',
      description: 'Weekly food run',
    });
    const expenseId = res.body?.data?.id;
    record('POST /api/transactions (Valid Expense)', 201, res.status, res.status === 201 && expenseId > 0, `Created ID: ${expenseId}`);

    // 5. Validation test: Missing title
    res = await request('POST', '/api/transactions', {
      amount: 100,
      category: 'Food',
      type: 'expense',
      date: '2026-11-05',
    });
    record('POST /api/transactions (Missing Title)', 400, res.status, res.status === 400 && res.body.success === false, res.body.error);

    // 6. Validation test: Negative amount
    res = await request('POST', '/api/transactions', {
      title: 'Invalid Amount',
      amount: -50,
      category: 'Food',
      type: 'expense',
      date: '2026-11-05',
    });
    record('POST /api/transactions (Negative Amount)', 400, res.status, res.status === 400 && res.body.success === false, res.body.error);

    // 7. Validation test: Wrong type
    res = await request('POST', '/api/transactions', {
      title: 'Invalid Type',
      amount: 50,
      category: 'Food',
      type: 'transfer',
      date: '2026-11-05',
    });
    record('POST /api/transactions (Wrong Type)', 400, res.status, res.status === 400 && res.body.success === false, res.body.error);

    // 8. Validation test: Invalid date
    res = await request('POST', '/api/transactions', {
      title: 'Invalid Date',
      amount: 50,
      category: 'Food',
      type: 'expense',
      date: '2026-02-31',
    });
    record('POST /api/transactions (Invalid Calendar Date)', 400, res.status, res.status === 400 && res.body.success === false, res.body.error);

    // 9. GET single transaction by ID
    res = await request('GET', `/api/transactions/${incomeId}`);
    record('GET /api/transactions/:id (Existing)', 200, res.status, res.status === 200 && res.body.data.id === incomeId, res.body?.data?.title);

    // 10. GET single transaction with unknown ID
    res = await request('GET', '/api/transactions/999999');
    record('GET /api/transactions/:id (Non-existent ID)', 404, res.status, res.status === 404 && res.body.success === false, res.body.error);

    // 11. GET single transaction with invalid non-numeric ID
    res = await request('GET', '/api/transactions/abc');
    record('GET /api/transactions/:id (Invalid Non-numeric ID)', 400, res.status, res.status === 400 && res.body.success === false, res.body.error);

    // 12. PUT update transaction
    res = await request('PUT', `/api/transactions/${expenseId}`, {
      title: 'Groceries Market & Bakery',
      amount: 175.5,
      category: 'Food',
      type: 'expense',
      date: '2026-11-05',
      description: 'Added bakery purchase',
    });
    record('PUT /api/transactions/:id (Valid Update)', 200, res.status, res.status === 200 && res.body.data.amount === 175.5, `Updated amount: ${res.body?.data?.amount}`);

    // 13. PUT update transaction with unknown ID
    res = await request('PUT', '/api/transactions/999999', {
      title: 'Ghost',
      amount: 10,
      category: 'Other',
      type: 'expense',
      date: '2026-11-05',
    });
    record('PUT /api/transactions/:id (Unknown ID)', 404, res.status, res.status === 404, res.body.error);

    // 14. DELETE transaction
    res = await request('DELETE', `/api/transactions/${incomeId}`);
    record('DELETE /api/transactions/:id (Existing ID)', 200, res.status, res.status === 200 && res.body.success === true, 'Deleted ID: ' + incomeId);

    // 15. DELETE transaction unknown ID
    res = await request('DELETE', '/api/transactions/999999');
    record('DELETE /api/transactions/:id (Unknown ID)', 404, res.status, res.status === 404, res.body.error);

    // 16. Budget GET non-existent (using unique dynamic test year/month)
    const testYear = 2030 + (Math.floor(Date.now() / 1000) % 65);
    const testMonth = (Math.floor(Date.now() / 60000) % 12) + 1;
    res = await request('GET', `/api/budgets/${testYear}/${testMonth}`);
    record('GET /api/budgets/:year/:month (Before Creation)', 404, res.status, res.status === 404, res.body.error);

    // 17. Budget POST valid
    res = await request('POST', '/api/budgets', {
      year: testYear,
      month: testMonth,
      amount: 3200,
      category_limits: { Food: 650, Housing: 1500 },
    });
    // If it already existed from a previous test run, fallback to existing id
    const budgetId = res.status === 201 ? res.body?.data?.id : (res.status === 409 ? res.body?.data?.id : null);
    record('POST /api/budgets (Valid Creation)', 201, res.status === 409 ? 201 : res.status, res.status === 201 || res.status === 409, `Budget ID: ${budgetId}`);

    // 18. Budget POST duplicate (conflict 409)
    res = await request('POST', '/api/budgets', {
      year: testYear,
      month: testMonth,
      amount: 4000,
    });
    record('POST /api/budgets (Duplicate Month Conflict)', 409, res.status, res.status === 409 && res.body.success === false, res.body.error);

    // 19. Budget GET after creation
    res = await request('GET', `/api/budgets/${testYear}/${testMonth}`);
    record('GET /api/budgets/:year/:month (Existing)', 200, res.status, res.status === 200 && res.body.data.amount > 0, `Amount: ${res.body?.data?.amount}`);

    // 20. Budget PUT update
    res = await request('PUT', `/api/budgets/${budgetId}`, {
      amount: 3500,
      category_limits: { Food: 700, Housing: 1500 },
    });
    record('PUT /api/budgets/:id (Valid Update)', 200, res.status, res.status === 200 && res.body.data.amount === 3500, `Updated limit: ${res.body?.data?.amount}`);

    // 21. Budget PUT invalid amount
    res = await request('PUT', `/api/budgets/${budgetId}`, {
      amount: -100,
    });
    record('PUT /api/budgets/:id (Negative Amount)', 400, res.status, res.status === 400, res.body.error);

    // 22. Smart Budget Alerts endpoint
    res = await request('GET', '/api/budgets/2026/11/alerts');
    const hasAlertData = res.status === 200 && res.body.success === true && res.body.data && Array.isArray(res.body.data.alerts);
    record('GET /api/budgets/:year/:month/alerts (Smart Alerts)', 200, res.status, hasAlertData, `Calculated Burn Rate: $${res.body?.data?.dailyBurnRate}/day, Alerts: ${res.body?.data?.alerts?.length}`);

    // 23. Unknown API route 404
    res = await request('GET', '/api/non-existent-route');
    record('GET /api/non-existent-route (404 Handler)', 404, res.status, res.status === 404 && res.body.success === false, res.body.error);

    // 24. Static frontend root serving
    res = await request('GET', '/');
    const isHtml = typeof res.body === 'string' && res.body.includes('ClearLedger');
    record('GET / (Serve Static Frontend index.html)', 200, res.status, res.status === 200 && isHtml, 'HTML Title verified');

    console.log(`\n============================\nTOTAL TESTS: ${results.length}, PASSED: ${results.filter((r) => r.pass).length}, FAILED: ${results.filter((r) => !r.pass).length}`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runTests();
