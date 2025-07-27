import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function middleware(request: NextRequest) {
  // Only handle /api/* requests (excluding internal Next.js API routes)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Skip our internal analytics route
    if (request.nextUrl.pathname.startsWith('/api/analytics/')) {
      return NextResponse.next();
    }

    // Extract the API path without the /api prefix
    const apiPath = request.nextUrl.pathname.replace('/api/', '');
    
    // Build the backend URL
    const backendUrl = `${API_URL}/${apiPath}${request.nextUrl.search}`;

    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    // If no auth header, try to get it from cookies (for browser requests)
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Copy relevant headers
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Get auth tokens from cookies if available
    const authStorage = request.cookies.get('auth-storage');
    if (authStorage && !authHeader) {
      try {
        const authData = JSON.parse(authStorage.value);
        if (authData?.state?.tokens?.accessToken) {
          headers['Authorization'] = `Bearer ${authData.state.tokens.accessToken}`;
        }
      } catch (error) {
        console.error('Failed to parse auth storage:', error);
      }
    }

    try {
      // Make the request to the backend
      const response = await fetch(backendUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' 
          ? await request.text() 
          : undefined,
      });

      // Create the response
      const responseHeaders = new Headers(response.headers);
      
      // Remove backend-specific headers
      responseHeaders.delete('access-control-allow-origin');
      responseHeaders.delete('access-control-allow-credentials');

      // Return the response from the backend
      return new NextResponse(await response.text(), {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('API proxy error:', error);
      return NextResponse.json(
        { error: 'Failed to connect to API server' },
        { status: 503 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};