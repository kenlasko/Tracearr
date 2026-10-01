import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '@tracearr/translations';
import { NotificationPreview } from '../NotificationPreview';

vi.mock('@/hooks/queries/useDestinations', () => ({
  useDestinations: () => ({
    data: [
      { id: 'd-discord', type: 'discord', name: 'My Discord' },
      { id: 'd-push', type: 'pushover', name: 'My Pushover' },
      { id: 'd-hook', type: 'json_webhook', name: 'My Webhook' },
    ],
  }),
}));

beforeAll(async () => {
  await initI18n({ lng: 'en' });
});

describe('NotificationPreview', () => {
  it('shows one tab per chosen destination type, rendered from samples', () => {
    render(<NotificationPreview title="Hi {{ user.username }}" to={['d-discord', 'd-push']} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByText('Hi alex')).toBeInTheDocument();
  });

  it('cuts the body to the chosen tab limit and counts against it', async () => {
    const user = userEvent.setup();
    render(<NotificationPreview body={'b'.repeat(1500)} to={['d-push']} />);
    await user.click(screen.getByRole('tab', { name: /Pushover/ }));
    expect(screen.getByText(/1024 of 1024 characters/)).toBeInTheDocument();
  });

  it('fits Discord text after escaping and shows it unescaped', () => {
    render(
      <NotificationPreview
        body={`{{ missing | default: "${'_'.repeat(3000)}" }}`}
        to={['d-discord']}
      />
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent(`${'_'.repeat(2047)}…`);
    expect(screen.getByText(/4096 of 4096 characters/)).toBeInTheDocument();
  });

  it('selects the first tab when the chosen destinations change under it', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NotificationPreview body="hi" to={[]} />);
    rerender(<NotificationPreview body="hi" to={['d-discord']} />);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(/Discord/);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('hi');

    rerender(<NotificationPreview body="hi" to={['d-discord', 'd-push']} />);
    await user.click(screen.getByRole('tab', { name: /Pushover/ }));
    rerender(<NotificationPreview body="hi" to={['d-discord']} />);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(/Discord/);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('hi');
  });

  it('shows the text tab without a count when only webhooks are chosen', () => {
    render(<NotificationPreview body="hi" to={['d-hook']} />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.queryByText(/ of \d+ characters/)).not.toBeInTheDocument();
  });

  it('shows default text for an empty field and one text tab with nothing chosen', () => {
    render(<NotificationPreview to={[]} />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getAllByText('Default text').length).toBeGreaterThan(0);
  });
});
