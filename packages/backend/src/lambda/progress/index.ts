import { createHandler } from '../../utils/lambda-handler';
import { handler } from '../../handlers/progress';

// Export Lambda handler wrapped with error handling and monitoring
export const progressHandler = createHandler({
  handler,
  name: 'progress',
  tags: {
    service: 'mile-quest',
    function: 'progress',
  },
});