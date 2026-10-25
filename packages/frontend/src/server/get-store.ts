import { PrismaStore } from './prisma-store';
import type { Store } from './store';

let store: Store | undefined;

export function getStore(): Store {
  if (!store) store = new PrismaStore();
  return store;
}
