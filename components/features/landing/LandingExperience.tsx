'use client';

import { useEffect } from 'react';
import { initializeLanding } from './landingInteractions';

export function LandingExperience() {
  useEffect(() => {
    const root = document.getElementById('landing-root');
    if (root) return initializeLanding(root);
  }, []);

  return null;
}
