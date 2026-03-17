import { createStyles } from 'antd-style';
import { memo } from 'react';

import { CustomMDX } from '@/components/mdx';

const useStyles = createStyles(({ css, token }) => ({
  assistant: css`
    color: ${token.colorText};
  `,
  container: css`
    padding-block: 8px;
    padding-inline: 0;
    font-size: 13px;
    line-height: 1.6;
  `,
  cursor: css`
    display: inline-block;

    width: 2px;
    height: 1em;
    margin-inline-start: 2px;

    vertical-align: text-bottom;

    background: ${token.colorPrimary};

    animation: blink 1s step-end infinite;

    @keyframes blink {
      50% {
        opacity: 0;
      }
    }
  `,
  user: css`
    padding-block: 8px;
    padding-inline: 12px;
    border-radius: 12px;

    color: ${token.colorText};

    background: ${token.colorFillTertiary};
  `,
}));

interface SpotlightMessageProps {
  content: string;
  loading?: boolean;
  role: 'user' | 'assistant';
}

const SpotlightMessage = memo<SpotlightMessageProps>(({ content, loading, role }) => {
  const { styles } = useStyles();

  if (role === 'user') {
    return (
      <div className={styles.container}>
        <div className={styles.user}>{content}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.assistant}>
        <CustomMDX source={content} />
        {loading && <span className={styles.cursor} />}
      </div>
    </div>
  );
});

SpotlightMessage.displayName = 'SpotlightMessage';

export default SpotlightMessage;
