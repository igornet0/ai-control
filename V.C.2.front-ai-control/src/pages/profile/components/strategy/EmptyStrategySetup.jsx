import React from 'react';
import { StrategyEmptyState } from './StrategyPrimitives';

/** @deprecated Prefer StrategyEmptyState via StrategyWorkspace */
export default function EmptyStrategySetup({ onStart }) {
  return (
    <StrategyEmptyState
      canEdit={Boolean(onStart)}
      onCreateAi={onStart}
      onCreateManual={onStart}
    />
  );
}
