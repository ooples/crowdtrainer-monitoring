const API_URL = 'http://localhost:4001';
const API_KEY = 'msk_admin_ca59f583e49d188262a53049aa8974184e20bbe83707d6b11b117d59125263d9';

async function testEndpoint(name, method, path, body = null) {
  console.log(`\nTesting: ${name}`);
  console.log(`${method} ${API_URL}${path}`);
  
  try {
    const options = {
      method,
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${path}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS:', JSON.stringify(data, null, 2).substring(0, 100) + '...');
      return { success: true, data };
    } else {
      console.log('❌ FAILED:', response.status, JSON.stringify(data, null, 2));
      return { success: false, data };
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('ADMIN PANEL BUTTON TESTS - FIXED VERSION');
  console.log('='.repeat(50));
  
  const results = [];
  
  // Test 1: Send Test Event (single)
  console.log('\n1. SEND TEST EVENT');
  const testEvent = await testEndpoint(
    'Send Test Event',
    'POST',
    '/api/v1/events/bulk',
    {
      events: [{
        type: 'info',
        level: 'info',
        source: 'admin-panel',
        message: 'This is a test event generated from the admin panel for verification purposes.',
        metadata: {
          category: 'system',
          test: true,
          timestamp: Date.now()
        }
      }]
    }
  );
  results.push({ name: 'Send Test Event', ...testEvent });
  
  // Test 2: Send Test Error
  console.log('\n2. SEND TEST ERROR');
  const testError = await testEndpoint(
    'Send Test Error',
    'POST',
    '/api/v1/events/bulk',
    {
      events: [{
        type: 'error',
        level: 'critical',
        source: 'admin-panel',
        message: 'Test TypeError: This is a test error generated for monitoring verification',
        metadata: {
          intentional: true,
          errorType: 'TypeError',
          category: 'system'
        },
        stack: 'TypeError: Test error\\n    at sendTestError (AdminPanel.tsx:95:15)'
      }]
    }
  );
  results.push({ name: 'Send Test Error', ...testError });
  
  // Test 3: Send Test Metric
  console.log('\n3. SEND TEST METRIC');
  const testMetric = await testEndpoint(
    'Send Test Metric',
    'POST',
    '/api/v1/metrics',
    {
      name: 'test.admin_panel.metric',
      value: 42,
      source: 'admin-panel',
      unit: 'count',
      dimensions: {
        test: 'true',
        environment: 'admin_panel'
      }
    }
  );
  results.push({ name: 'Send Test Metric', ...testMetric });
  
  // Test 4: Send Bulk Events (10 events)
  console.log('\n4. SEND BULK EVENTS');
  const bulkEvents = [];
  for (let i = 0; i < 10; i++) {
    bulkEvents.push({
      type: 'info',
      level: 'info',
      source: 'admin-panel',
      message: `Bulk test event number ${i}`,
      metadata: {
        index: i,
        batch: true,
        category: 'system',
        bulkTest: true
      }
    });
  }
  const testBulk = await testEndpoint(
    'Send 10 Events',
    'POST',
    '/api/v1/events/bulk',
    { events: bulkEvents }
  );
  results.push({ name: 'Send 10 Events', ...testBulk });
  
  // Test 5: Simulate User Session
  console.log('\n5. SIMULATE USER SESSION');
  const userId = `user_${Math.random().toString(36).substr(2, 9)}`;
  const userSession = await testEndpoint(
    'Simulate User Session',
    'POST',
    '/api/v1/events/bulk',
    {
      events: [
        {
          type: 'user_action',
          level: 'info',
          source: 'admin-panel',
          message: `User ${userId} successfully registered`,
          metadata: {
            userId,
            email: `${userId}@example.com`,
            category: 'auth',
            action: 'signup'
          },
          userId
        },
        {
          type: 'user_action',
          level: 'info',
          source: 'admin-panel',
          message: 'User viewed dashboard page',
          metadata: {
            userId,
            path: '/dashboard',
            category: 'system',
            action: 'page_view'
          },
          userId
        },
        {
          type: 'business',
          level: 'info',
          source: 'admin-panel',
          message: 'User initiated purchase flow',
          metadata: {
            userId,
            button: 'purchase',
            category: 'payment',
            action: 'button_click',
            value: 75
          },
          userId
        }
      ]
    }
  );
  results.push({ name: 'Simulate User Session', ...userSession });
  
  // Test 6: Load Test (50 events)
  console.log('\n6. GENERATE LOAD TEST');
  const loadTestEvents = [];
  const levels = ['info', 'low', 'medium', 'high', 'critical'];
  const eventTypes = ['info', 'error', 'performance', 'user_action'];
  const categories = ['api', 'database', 'auth', 'payment', 'system'];
  
  for (let i = 0; i < 50; i++) {
    loadTestEvents.push({
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      level: levels[Math.floor(Math.random() * levels.length)],
      source: 'admin-panel',
      message: `Load test event number ${i} generated for performance testing`,
      metadata: {
        loadTest: true,
        index: i,
        batch: Math.floor(i / 10),
        category: categories[Math.floor(Math.random() * categories.length)],
        responseTime: Math.floor(Math.random() * 500) + 50
      }
    });
  }
  const loadTest = await testEndpoint(
    'Load Test (50 events)',
    'POST',
    '/api/v1/events/bulk',
    { events: loadTestEvents }
  );
  results.push({ name: 'Load Test', ...loadTest });
  
  // Test 7: Run Diagnostics (just checking server health)
  console.log('\n7. RUN DIAGNOSTICS');
  const diagnostics = await testEndpoint(
    'Server Health Check',
    'GET',
    '/health'
  );
  results.push({ name: 'Run Diagnostics', ...diagnostics });
  
  // Test 8: Clear All Data
  console.log('\n8. CLEAR ALL DATA');
  const clearData = await testEndpoint(
    'Clear All Data',
    'POST',
    '/api/v1/admin/clear',
    {
      confirmAction: true,
      tables: ['all']
    }
  );
  results.push({ name: 'Clear All Data', ...clearData });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.name}`);
  });
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(passed === results.length ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED');
  
  return results;
}

// Run tests
runTests().catch(console.error);