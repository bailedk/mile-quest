/**
 * Simple router for Lambda functions
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { NotFoundError } from './lambda-handler';

export type RouteHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  params: Record<string, string>
) => Promise<any>;

interface Route {
  method: string;
  path: RegExp;
  handler: RouteHandler;
  paramNames: string[];
}

export class Router {
  private routes: Route[] = [];

  /**
   * Add a route
   */
  private addRoute(
    method: string,
    path: string,
    handler: RouteHandler
  ): void {
    // Convert path to regex and extract param names
    const paramNames: string[] = [];
    const regexPath = path.replace(/:(\w+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    
    this.routes.push({
      method,
      path: new RegExp(`^${regexPath}$`),
      handler,
      paramNames,
    });
  }

  /**
   * HTTP method handlers
   */
  get(path: string, handler: RouteHandler): void {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.addRoute('POST', path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.addRoute('PUT', path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.addRoute('PATCH', path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.addRoute('DELETE', path, handler);
  }

  /**
   * Handle incoming request
   */
  async handle(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<any> {
    const method = event.httpMethod;
    
    // Get the path from various sources
    let path = '';
    
    // First check pathParameters.proxy (API Gateway proxy integration)
    if (event.pathParameters?.proxy) {
      path = event.pathParameters.proxy;
    }
    // Then check the raw path
    else if (event.path) {
      // Remove the base path (e.g., /activities) to get the relative path
      const pathParts = event.path.split('/').filter(p => p);
      if (pathParts.length > 1) {
        // Remove the first part (e.g., 'activities') to get the subpath
        path = pathParts.slice(1).join('/');
      }
    }
    
    const normalizedPath = '/' + path.replace(/^\/+|\/+$/g, '');

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;
      
      const match = normalizedPath.match(route.path);
      if (match) {
        // Extract params
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        
        // Call handler
        return await route.handler(event, context, params);
      }
    }

    // No route found
    throw new NotFoundError(`Route not found: ${method} ${normalizedPath}`);
  }
}

/**
 * Create a new router instance
 */
export function createRouter(): Router {
  return new Router();
}