import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import ModeSwitch from './ModeSwitch';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'agent.modeSwitch.agent': 'Conversational',
        'agent.modeSwitch.classic': 'Classic',
        'agent.modeSwitch.label': 'Choose your onboarding mode',
      })[key] || key,
  }),
}));

describe('ModeSwitch', () => {
  it('renders a floating Segmented without an extra pill wrapper', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/agent']}>
        <ModeSwitch />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Choose your onboarding mode')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Conversational' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Classic' })).not.toBeChecked();
  });

  it('wraps actions and Segmented in a pill when actions are provided', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/agent']}>
        <ModeSwitch actions={<button type="button">Restart</button>} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Conversational' })).toBeChecked();
  });

  it('can show the mode switch label', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/classic']}>
        <ModeSwitch showLabel />
      </MemoryRouter>,
    );

    expect(screen.getByText('Choose your onboarding mode')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeChecked();
  });
});
