import { describe, expect, it } from 'vitest';
import {
  canUserCreateTeam,
  canUserManageTeam,
  isUserTeamManager,
} from './teamPermissions';

describe('teamPermissions', () => {
  const team = {
    id: 1,
    creator_id: 10,
    members: [
      { user_id: 10, role: 'manager', is_active: true },
      { user_id: 20, role: 'member', is_active: true },
    ],
  };

  it('detects team manager membership', () => {
    expect(isUserTeamManager(team, 10)).toBe(true);
    expect(isUserTeamManager(team, 20)).toBe(false);
  });

  it('allows manage only for team manager', () => {
    expect(canUserManageTeam(team, { id: 20, team_role: 'Developer' })).toBe(false);
    expect(canUserManageTeam(team, { id: 10, team_role: 'Developer' })).toBe(true);
  });

  it('allows create team for org management roles', () => {
    expect(canUserCreateTeam({ id: 20, team_role: 'Developer' })).toBe(false);
    expect(canUserCreateTeam({ id: 20, team_role: 'Manager' })).toBe(true);
  });
});
