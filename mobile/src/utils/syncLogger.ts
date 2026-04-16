const TAG = '[Sync]';

export const syncLog = {
  info: (msg: string, ...args: any[]) => console.log(`${TAG} ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`${TAG} ${msg}`, ...args),
};
