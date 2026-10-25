export class HealthSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HealthSyncError';
  }
}

const DEV_BUILD_MESSAGE = 'Health sync needs a Mile Quest development build. It does not run inside Expo Go.';

export function friendlyHealthError(error: unknown): Error {
  if (error instanceof HealthSyncError) return error;
  const message = error instanceof Error ? error.message : '';
  if (/Cannot find native module|NitroModules|native module cannot be null|Expo Go/i.test(message)) {
    return new HealthSyncError(DEV_BUILD_MESSAGE);
  }
  if (error instanceof Error) return error;
  return new HealthSyncError('Health data could not be read.');
}
