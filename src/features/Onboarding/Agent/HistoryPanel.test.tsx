import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ChatTopic } from '@/types/topic';

import HistoryPanel from './HistoryPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'agent.history.current': 'Current',
          'agent.history.title': 'History Topics',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

const createTopic = (id: string, title: string, updatedAt: number): ChatTopic => ({
  createdAt: updatedAt,
  id,
  title,
  updatedAt,
});

describe('HistoryPanel', () => {
  it('renders the current topic marker and notifies topic selection', () => {
    const onSelectTopic = vi.fn();

    render(
      <HistoryPanel
        activeTopicId="topic-2"
        selectedTopicId="topic-1"
        topics={[
          createTopic('topic-1', 'Earlier Topic', 100),
          createTopic('topic-2', 'Latest Topic', 200),
        ]}
        onSelectTopic={onSelectTopic}
      />,
    );

    expect(screen.getByText('History Topics')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Latest Topic/i }));

    expect(onSelectTopic).toHaveBeenCalledWith('topic-2');
  });

  it('renders topics in updatedAt descending order', () => {
    render(
      <HistoryPanel
        activeTopicId="topic-2"
        selectedTopicId="topic-2"
        topics={[
          createTopic('topic-1', 'Earlier Topic', 100),
          createTopic('topic-2', 'Latest Topic', 200),
        ]}
        onSelectTopic={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole('button');

    expect(buttons[0]).toHaveTextContent('Latest Topic');
    expect(buttons[1]).toHaveTextContent('Earlier Topic');
  });
});
