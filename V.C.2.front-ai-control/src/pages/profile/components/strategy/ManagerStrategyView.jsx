import React from 'react';
import StrategyWorkspace from './StrategyWorkspace';

export default function ManagerStrategyView({ context }) {
  return <StrategyWorkspace mode="manager" context={context} />;
}
