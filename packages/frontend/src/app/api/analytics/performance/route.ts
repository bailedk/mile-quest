import { NextRequest, NextResponse } from 'next/server';

interface PerformanceMetric {
  metric: string;
  value: number;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json() as PerformanceMetric;
    
    // Validate required fields
    if (!body.metric || typeof body.value !== 'number' || !body.timestamp) {
      return NextResponse.json(
        { error: 'Invalid performance metric data' },
        { status: 400 }
      );
    }
    
    // In production, you would:
    // 1. Store metrics in a database or analytics service
    // 2. Aggregate data for reporting
    // 3. Set up alerting for performance regressions
    
    // For now, we'll just log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance metric received:', {
        metric: body.metric,
        value: body.value.toFixed(2),
        timestamp: new Date(body.timestamp).toISOString(),
        url: body.url
      });
    }
    
    // Return success response
    return NextResponse.json(
      { success: true, received: body.metric },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing performance metric:', error);
    
    // Return error response
    return NextResponse.json(
      { error: 'Failed to process performance metric' },
      { status: 500 }
    );
  }
}

// Support OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}