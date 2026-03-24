'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    padding: 20px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 20px;

    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowTertiary};
  `,
}));

const Welcome = memo(() => {
  const { t } = useTranslation('onboarding');
  const { styles } = useStyles();

  return (
    <Flexbox className={styles.card} gap={8}>
      <Text fontSize={20} weight={'bold'}>
        {t('agent.title')}
      </Text>
      <Text type={'secondary'}>{t('agent.welcome')}</Text>
    </Flexbox>
  );
});

Welcome.displayName = 'AgentOnboardingWelcome';

export default Welcome;
