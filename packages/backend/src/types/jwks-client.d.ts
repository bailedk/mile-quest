declare module 'jwks-client' {
  interface JwksClient {
    getSigningKey(kid: string, callback: (err: any, key?: any) => void): void;
  }

  interface ClientOptions {
    jwksUri: string;
    requestHeaders?: Record<string, string>;
    timeout?: number;
    cache?: boolean;
    rateLimit?: boolean;
  }

  function jwksClient(options: ClientOptions): JwksClient;
  export = jwksClient;
}