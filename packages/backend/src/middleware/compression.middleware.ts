/**
 * Response Compression Middleware - BE-701
 * Optimizes API responses with compression, minification, and payload optimization
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { gzip, deflate } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);

interface CompressionOptions {
  threshold?: number;           // Minimum bytes to compress (default: 1024)
  level?: number;              // Compression level 1-9 (default: 6)
  enableMinification?: boolean; // Enable JSON minification (default: true)
  enableImageOptimization?: boolean; // Enable image response optimization (default: false)
  excludeContentTypes?: string[]; // Content types to exclude from compression
  includeContentTypes?: string[]; // Content types to include (if specified, only these will be compressed)
}

interface OptimizationResult {
  body: string;
  headers: Record<string, string>;
  isCompressed: boolean;
  compressionRatio: number;
  originalSize: number;
  compressedSize: number;
}

export class CompressionMiddleware {
  private options: Required<CompressionOptions>;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      threshold: options.threshold || 1024,
      level: Math.max(1, Math.min(9, options.level || 6)),
      enableMinification: options.enableMinification !== false,
      enableImageOptimization: options.enableImageOptimization || false,
      excludeContentTypes: options.excludeContentTypes || [
        'image/*',
        'video/*',
        'audio/*',
        'application/pdf',
        'application/zip',
        'application/gzip',
        'application/x-compressed',
      ],
      includeContentTypes: options.includeContentTypes || [],
    };
  }

  /**
   * Compress and optimize API Gateway response
   */
  async compressResponse(
    event: APIGatewayProxyEvent,
    response: APIGatewayProxyResult
  ): Promise<APIGatewayProxyResult> {
    // Skip compression for non-success responses or empty bodies
    if (!response.body || response.statusCode >= 400) {
      return response;
    }

    const originalSize = Buffer.byteLength(response.body, 'utf8');
    
    // Skip compression if below threshold
    if (originalSize < this.options.threshold) {
      return this.addCompressionHeaders(response, {
        body: response.body,
        headers: response.headers || {},
        isCompressed: false,
        compressionRatio: 1,
        originalSize,
        compressedSize: originalSize,
      });
    }

    const contentType = this.getContentType(response);
    const acceptEncoding = event.headers['Accept-Encoding'] || event.headers['accept-encoding'] || '';

    // Check if content type should be compressed
    if (!this.shouldCompress(contentType)) {
      return response;
    }

    try {
      let optimizedBody = response.body;

      // Apply content-specific optimizations
      if (this.options.enableMinification) {
        optimizedBody = this.minifyContent(optimizedBody, contentType);
      }

      // Determine compression algorithm
      const compression = this.selectCompressionAlgorithm(acceptEncoding);
      if (!compression) {
        return this.addCompressionHeaders(response, {
          body: optimizedBody,
          headers: response.headers || {},
          isCompressed: false,
          compressionRatio: 1,
          originalSize,
          compressedSize: Buffer.byteLength(optimizedBody, 'utf8'),
        });
      }

      // Compress the response
      const result = await this.compressContent(optimizedBody, compression);
      
      return this.addCompressionHeaders(response, {
        ...result,
        headers: {
          ...response.headers,
          'Content-Encoding': compression,
        },
      });
    } catch (error) {
      console.error('Compression failed:', error);
      return response; // Return original response on compression failure
    }
  }

  /**
   * Compress content using specified algorithm
   */
  private async compressContent(content: string, algorithm: string): Promise<OptimizationResult> {
    const originalBuffer = Buffer.from(content, 'utf8');
    const originalSize = originalBuffer.length;

    let compressedBuffer: Buffer;
    
    switch (algorithm) {
      case 'gzip':
        compressedBuffer = await gzipAsync(originalBuffer, { level: this.options.level });
        break;
      case 'deflate':
        compressedBuffer = await deflateAsync(originalBuffer, { level: this.options.level });
        break;
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }

    const compressedSize = compressedBuffer.length;
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

    return {
      body: compressedBuffer.toString('base64'),
      headers: {},
      isCompressed: true,
      compressionRatio,
      originalSize,
      compressedSize,
    };
  }

  /**
   * Minify content based on content type
   */
  private minifyContent(content: string, contentType: string): string {
    try {
      if (contentType.includes('application/json')) {
        return this.minifyJSON(content);
      }
      
      if (contentType.includes('text/html')) {
        return this.minifyHTML(content);
      }
      
      if (contentType.includes('text/css')) {
        return this.minifyCSS(content);
      }
      
      if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
        return this.minifyJavaScript(content);
      }
    } catch (error) {
      console.warn('Minification failed, using original content:', error);
    }
    
    return content;
  }

  /**
   * Minify JSON content
   */
  private minifyJSON(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed);
    } catch {
      return content; // Return original if parsing fails
    }
  }

  /**
   * Basic HTML minification
   */
  private minifyHTML(content: string): string {
    return content
      .replace(/\s+/g, ' ')                    // Collapse whitespace
      .replace(/>\s+</g, '><')                 // Remove whitespace between tags
      .replace(/<!--[\s\S]*?-->/g, '')         // Remove comments
      .trim();
  }

  /**
   * Basic CSS minification
   */
  private minifyCSS(content: string): string {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '')        // Remove comments
      .replace(/\s+/g, ' ')                    // Collapse whitespace
      .replace(/;\s*}/g, '}')                  // Remove unnecessary semicolons
      .replace(/\s*{\s*/g, '{')                // Clean up braces
      .replace(/;\s*/g, ';')                   // Clean up semicolons
      .trim();
  }

  /**
   * Basic JavaScript minification
   */
  private minifyJavaScript(content: string): string {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '')        // Remove block comments
      .replace(/\/\/.*$/gm, '')                // Remove line comments
      .replace(/\s+/g, ' ')                    // Collapse whitespace
      .replace(/;\s*}/g, '}')                  // Clean up semicolons before braces
      .trim();
  }

  /**
   * Select the best compression algorithm based on Accept-Encoding header
   */
  private selectCompressionAlgorithm(acceptEncoding: string): string | null {
    const encodings = acceptEncoding.toLowerCase().split(',').map(s => s.trim());
    
    // Priority: gzip > deflate
    if (encodings.some(e => e.includes('gzip'))) {
      return 'gzip';
    }
    
    if (encodings.some(e => e.includes('deflate'))) {
      return 'deflate';
    }
    
    return null;
  }

  /**
   * Check if content type should be compressed
   */
  private shouldCompress(contentType: string): boolean {
    const type = contentType.toLowerCase();
    
    // If includeContentTypes is specified, only compress those types
    if (this.options.includeContentTypes.length > 0) {
      return this.options.includeContentTypes.some(included => 
        this.matchesContentType(type, included)
      );
    }
    
    // Check if content type is excluded
    if (this.options.excludeContentTypes.some(excluded => 
        this.matchesContentType(type, excluded)
    )) {
      return false;
    }
    
    // Compress text-based content types by default
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/x-javascript',
      'application/x-web-app-manifest+json',
    ];
    
    return compressibleTypes.some(compressible => type.includes(compressible));
  }

  /**
   * Check if content type matches pattern (supports wildcards)
   */
  private matchesContentType(contentType: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(contentType);
    }
    return contentType.includes(pattern);
  }

  /**
   * Get content type from response headers
   */
  private getContentType(response: APIGatewayProxyResult): string {
    const headers = response.headers || {};
    return headers['Content-Type'] || headers['content-type'] || 'application/octet-stream';
  }

  /**
   * Add compression-related headers to response
   */
  private addCompressionHeaders(
    response: APIGatewayProxyResult,
    result: OptimizationResult
  ): APIGatewayProxyResult {
    const headers = {
      ...response.headers,
      ...result.headers,
    };

    // Add compression metadata for monitoring
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_COMPRESSION_HEADERS === 'true') {
      headers['X-Original-Size'] = result.originalSize.toString();
      headers['X-Compressed-Size'] = result.compressedSize.toString();
      headers['X-Compression-Ratio'] = result.compressionRatio.toFixed(3);
      headers['X-Compression-Enabled'] = result.isCompressed.toString();
    }

    // Update content length if compressed
    if (result.isCompressed) {
      headers['Content-Length'] = result.compressedSize.toString();
      // Mark as base64 encoded for API Gateway
      response.isBase64Encoded = true;
    }

    return {
      ...response,
      body: result.body,
      headers,
    };
  }
}

/**
 * Create compression middleware with default options
 */
export function createCompressionMiddleware(options?: CompressionOptions): CompressionMiddleware {
  return new CompressionMiddleware(options);
}

/**
 * Helper function to wrap Lambda handler with compression
 */
export function withCompression(
  handler: (event: APIGatewayProxyEvent, context: any) => Promise<APIGatewayProxyResult>,
  options?: CompressionOptions
) {
  const compression = new CompressionMiddleware(options);
  
  return async (event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> => {
    const response = await handler(event, context);
    return compression.compressResponse(event, response);
  };
}