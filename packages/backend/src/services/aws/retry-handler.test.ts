import { RetryHandler } from './retry-handler';

describe('RetryHandler', () => {
  const config = {
    maxRetries: 2,
    baseDelay: 0,
    maxDelay: 0,
    retryableErrors: ['ThrottlingException'],
    jitterType: 'none' as const,
  };

  it('returns the value when the operation succeeds', async () => {
    const handler = new RetryHandler(config);
    await expect(handler.execute(async () => 'ok')).resolves.toBe('ok');
  });

  it('retries a retryable error and then succeeds', async () => {
    const handler = new RetryHandler(config);
    let attempts = 0;
    const result = await handler.execute(async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('slow down');
        error.name = 'ThrottlingException';
        throw error;
      }
      return attempts;
    });

    expect(result).toBe(3);
    expect(attempts).toBe(3);
  });

  it('does not retry an error outside the retry list', async () => {
    const handler = new RetryHandler(config);
    let attempts = 0;

    await expect(handler.execute(async () => {
      attempts += 1;
      const error = new Error('bad input');
      error.name = 'ValidationException';
      throw error;
    })).rejects.toThrow('bad input');

    expect(attempts).toBe(1);
  });
});
