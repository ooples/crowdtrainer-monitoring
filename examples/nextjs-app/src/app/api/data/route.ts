import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@crowdtrainer/monitoring-core';

async function handler(request: NextRequest) {
  // Simulate some processing time
  const processingTime = Math.random() * 1000 + 200;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  // Simulate occasional errors (10% chance)
  if (Math.random() < 0.1) {
    throw new Error('Simulated API error for demonstration purposes');
  }
  
  // Return mock data
  const data = {
    message: 'Data fetched successfully',
    timestamp: new Date().toISOString(),
    processingTime: Math.round(processingTime),
    data: {
      users: Math.floor(Math.random() * 1000) + 100,
      sessions: Math.floor(Math.random() * 500) + 50,
      events: Math.floor(Math.random() * 10000) + 1000,
    },
  };
  
  return NextResponse.json(data);
}

// Wrap the handler with monitoring middleware
export const GET = withMonitoring(handler, {
  name: 'get-data',
  trackPerformance: true,
  trackErrors: true,
  metadata: {
    endpoint: '/api/data',
    method: 'GET',
  },
});

export const POST = withMonitoring(async (request: NextRequest) => {
  const body = await request.json();
  
  // Simulate data processing
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return NextResponse.json({
    message: 'Data processed successfully',
    received: body,
    processed: true,
    timestamp: new Date().toISOString(),
  });
}, {
  name: 'post-data',
  trackPerformance: true,
  trackErrors: true,
  metadata: {
    endpoint: '/api/data',
    method: 'POST',
  },
});