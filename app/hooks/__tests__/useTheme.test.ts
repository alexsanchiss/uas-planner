import { getStoredTheme } from '../useTheme';

describe('stored app theme precedence', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it.each([
    ['light', true, 'light'], ['light', false, 'light'],
    ['dark', true, 'dark'], ['dark', false, 'dark'],
    [null, true, 'light'], [null, false, 'dark'],
  ])('saved %s, system light %s selects %s', (saved, systemLight, expected) => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      matchMedia: () => ({ matches: systemLight }),
    } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => saved,
    } });
    expect(getStoredTheme()).toBe(expected);
  });
});
