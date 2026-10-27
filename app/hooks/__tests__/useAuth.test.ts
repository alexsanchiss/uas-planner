/**
 * useAuth reads the ONE state owned by AuthProvider (F5b). Before, every useAuth() call ran its own
 * fetch of /api/user and its own listeners. Rendered with react-dom/server (no DOM needed): effects do
 * not run, so only the context contract is exercised.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthContext, useAuth } from '../useAuth';
import type { AuthState } from '../useAuth';

function Probe({ onValue }: { onValue: (v: AuthState) => void }) {
  onValue(useAuth());
  return null;
}

describe('useAuth', () => {
  it('throws outside an AuthProvider (a missing provider must not silently fall back to own state)', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderToString(React.createElement(Probe, { onValue: () => {} }))).toThrow(
        'useAuth must be used within an AuthProvider'
      );
    } finally {
      err.mockRestore();
    }
  });

  it('returns exactly the provider value, shared by every consumer', () => {
    const value = {
      user: { id: 1, username: 'u' },
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
    } as unknown as AuthState;
    const seen: AuthState[] = [];
    const tree = React.createElement(
      AuthContext.Provider,
      { value },
      React.createElement(Probe, { onValue: (v) => seen.push(v) }),
      React.createElement(Probe, { onValue: (v) => seen.push(v) })
    );

    renderToString(tree);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(value);
    expect(seen[1]).toBe(value);
  });
});
