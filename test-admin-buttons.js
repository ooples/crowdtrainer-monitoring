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
      console.log('✅ SUCCESS:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ FAILED:', response.status, JSON.stringify(data, null, 2));
    }
    
    return { success: response.ok, data };
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('ADMIN PANEL BUTTON TESTS');
  console.log('='.repeat(50));
  
  // Test Event Creation
  await testEndpoint(
    'Send Test Event',
    'POST',
    '/api/v1/events',
    {
      type: 'info',
      source: 'admin-test',
      message: 'Test event from admin panel',
      level: 'info',
      metadata: { test: true }
    }
  );
  
  // Test Bulk Events
  await testEndpoint(
    'Send Bulk Events',
    'POST',
    '/api/v1/events/bulk',
    {
      events: [
        { type: 'info', source: 'admin-test', message: 'Bulk event 1' },
        { type: 'warning', source: 'admin-test', message: 'Bulk event 2' },
        { type: 'error', source: 'admin-test', message: 'Bulk event 3' }
      ]
    }
  );
  
  // Test Metrics
  await testEndpoint(
    'Send Test Metric',
    'POST',
    '/api/v1/metrics',
    {
      name: 'test_metric',
      value: 42.5,
      source: 'admin-test',
      tags: { test: 'true' }
    }
  );
  
  // Test Dashboard Endpoints
  await testEndpoint(
    'Dashboard Realtime',
    'GET',
    '/api/v1/dashboard/realtime'
  );
  
  await testEndpoint(
    'Dashboard Overview',
    'GET',
    '/api/v1/dashboard/overview'
  );
  
  // Test Alerts
  await testEndpoint(
    'Get Alerts',
    'GET',
    '/api/v1/alerts'
  );
  
  // Test Admin Functions
  await testEndpoint(
    'Export Data',
    'GET',
    '/api/v1/admin/export?format=json&tables=events,metrics'
  );
  
  await testEndpoint(
    'Reset Metrics',
    'POST',
    '/api/v1/admin/reset-metrics',
    {
      resetCounters: true,
      resetCache: true
    }
  );
  
  // Test Clear Data (last as it removes everything)
  await testEndpoint(
    'Clear All Data',
    'POST',
    '/api/v1/admin/clear',
    {
      confirmAction: true,
      tables: ['all']
    }
  );
  
  console.log('\n' + '='.repeat(50));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(50));
}

// Run tests
runTests().catch(console.error);