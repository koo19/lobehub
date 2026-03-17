import { createStyles } from 'antd-style';
import { memo, useEffect, useRef } from 'react';

import { useSpotlightStore } from '../store';
import SpotlightMessage from './SpotlightMessage';

const useStyles = createStyles(({ css }) => ({
  container: css`
    scroll-behavior: smooth;

    overflow-y: auto;
    flex: 1;

    padding-block: 8px;
    padding-inline: 16px;
  `,
}));

const MessageList = memo(() => {
  const { styles } = useStyles();
  const messages = useSpotlightStore((s) => s.messages);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div className={styles.container} ref={containerRef}>
      {messages.map((msg) => (
        <SpotlightMessage
          content={msg.content}
          key={msg.id}
          loading={msg.loading}
          role={msg.role}
        />
      ))}
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
