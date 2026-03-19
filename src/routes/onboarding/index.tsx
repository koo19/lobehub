'use client';

import { memo } from 'react';
import { Navigate } from 'react-router-dom';

const OnboardingPage = memo(() => {
  return <Navigate replace to={'/onboarding/agent'} />;
});

OnboardingPage.displayName = 'OnboardingPage';

export default OnboardingPage;
