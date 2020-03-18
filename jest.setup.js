import {installMockStorage, ensureMocksReset, requestIdleCallback} from '@shopify/jest-dom-mocks';

installMockStorage();
requestIdleCallback.mock()

beforeEach(() => {
  ensureMocksReset();
});
