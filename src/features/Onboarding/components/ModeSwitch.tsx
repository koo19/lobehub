'use client';

import { Flexbox, Segmented, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import type { CSSProperties, ReactNode } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

const useStyles = createStyles(({ css, token }) => ({
  anchor: css`
    position: fixed;
    z-index: 10;
    inset-block-end: 24px;
    inset-inline-end: 24px;

    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  `,
  anchorWithLabel: css`
    align-items: stretch;
  `,
  pill: css`
    display: flex;
    flex-flow: row wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;

    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 999px;

    background: ${token.colorBgElevated};
    backdrop-filter: blur(12px);
    box-shadow: ${token.boxShadowSecondary};
  `,
}));

interface ModeSwitchProps {
  actions?: ReactNode;
  className?: string;
  showLabel?: boolean;
  style?: CSSProperties;
}

const ModeSwitch = memo<ModeSwitchProps>(({ actions, className, showLabel = false, style }) => {
  const { t } = useTranslation('onboarding');
  const { styles, cx } = useStyles();
  const location = useLocation();
  const navigate = useNavigate();

  const mode = useMemo(() => {
    return location.pathname.startsWith('/onboarding/agent') ? 'agent' : 'classic';
  }, [location.pathname]);

  const options = useMemo(
    () => [
      { label: t('agent.modeSwitch.agent'), value: 'agent' as const },
      { label: t('agent.modeSwitch.classic'), value: 'classic' as const },
    ],
    [t],
  );

  const segmented = (
    <Segmented
      options={options}
      size={'small'}
      value={mode}
      onChange={(value) => {
        navigate(value === 'agent' ? '/onboarding/agent' : '/onboarding/classic');
      }}
    />
  );

  return (
    <Flexbox
      style={style}
      className={cx(styles.anchor, showLabel && styles.anchorWithLabel, className)}
    >
      {showLabel && (
        <Text style={{ paddingInline: 4 }} type={'secondary'}>
          {t('agent.modeSwitch.label')}
        </Text>
      )}
      {actions ? (
        <div className={styles.pill}>
          {actions}
          {segmented}
        </div>
      ) : (
        segmented
      )}
    </Flexbox>
  );
});

ModeSwitch.displayName = 'OnboardingModeSwitch';

export default ModeSwitch;
