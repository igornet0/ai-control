import React from 'react';
import StrategyWorkspace from './StrategyWorkspace';

export default function EmployeeStrategyView({ context }) {
  return <StrategyWorkspace mode="employee" context={context} />;
}
