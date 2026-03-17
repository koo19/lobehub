import { createStyles } from 'antd-style';
import { memo } from 'react';

import { useSpotlightStore } from '../store';
import MessageList from './MessageList';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    overflow: hidden;
    display: flex;
    flex: 1;
    flex-direction: column;

    min-height: 0;
  `,
  expandButton: css`
    cursor: pointer;

    display: flex;
    gap: 4px;
    align-items: center;
    align-self: flex-end;

    margin-block: 4px;
    margin-inline: 12px;
    padding-block: 4px;
    padding-inline: 8px;
    border: none;
    border-radius: 4px;

    font-size: 11px;
    color: ${token.colorTextTertiary};

    background: none;

    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
}));

const ChatView = memo(() => {
  const { styles } = useStyles();
  const topicId = useSpotlightStore((s) => s.topicId);

  const handleExpandToMain = async () => {
    const { agentId, groupId } = useSpotlightStore.getState();
    if (!topicId) return;
    await window.electronAPI?.invoke?.('spotlight.expandToMain', { agentId, groupId, topicId });
  };

  return (
    <div className={styles.container}>
      {topicId && (
        <button className={styles.expandButton} onClick={handleExpandToMain}>
          ↗ Open in main window
        </button>
      )}
      <MessageList />
    </div>
  );
});

ChatView.displayName = 'ChatView';

export default ChatView;
