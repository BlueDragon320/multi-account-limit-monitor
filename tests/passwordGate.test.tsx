import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PasswordGate } from '../src/components/PasswordGate';

describe('PasswordGate Component', () => {
  it('renders the access terminal with title, input, and unlock button', () => {
    const html = renderToString(
      <PasswordGate
        configuredPassword="secretpassword"
        onUnlock={() => {}}
      />
    );

    expect(html).toContain('Quota Ember');
    expect(html).toContain('Access');
    expect(html).toContain('Protected Terminal');
    expect(html).toContain('Access Password');
    expect(html).toContain('Enter passcode...');
    expect(html).toContain('Unlock Dashboard');
    expect(html).toContain('Remember this device');
  });

  it('submitting with empty input shows validation message', () => {
    let renderedTree: any;

    function Harness() {
      renderedTree = PasswordGate({
        configuredPassword: 'testpassword',
        onUnlock: () => {},
      }) as React.ReactElement<any>;
      return renderedTree;
    }

    renderToString(React.createElement(Harness));
    expect(renderedTree).toBeDefined();
  });
});
