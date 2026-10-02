import { isPlatformAdmin } from '../../../utils/isPlatformAdmin';

export function isTaskAdmin(user) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return user.team_role === 'CEO';
}

export function getTaskPermissions(task, currentUser) {
  const isAssignee =
    task?.executor_id != null && currentUser?.id != null && task.executor_id === currentUser.id;
  const isCreator =
    task?.creator_id != null && currentUser?.id != null && task.creator_id === currentUser.id;
  const status = task?.status || 'created';
  const admin = isTaskAdmin(currentUser);
  const canModerate = admin || isCreator;

  if (task?.permissions) {
    return {
      ...task.permissions,
      can_moderate: task.permissions.can_moderate ?? canModerate,
      can_take_task: task.permissions.can_take_task ?? false,
    };
  }

  const isAssigneeLocked =
    isAssignee && (status === 'review' || status === 'completed');

  let canEdit = false;
  if (admin || isCreator || task?.permissions?.is_department_manager || task?.permissions?.is_team_manager) {
    canEdit = true;
  } else if (isAssignee && !isAssigneeLocked && ['in_progress', 'created', 'todo'].includes(status)) {
    canEdit = true;
  } else if (
    status === 'review'
    && (task?.permissions?.is_task_reviewer || task?.permissions?.is_project_manager)
  ) {
    canEdit = true;
  }

  return {
    can_edit: canEdit,
    can_delete: admin || isCreator,
    can_moderate: canModerate,
    can_take_task: false,
    can_reassign: admin || isCreator || Boolean(
      task?.permissions?.is_department_manager
      || task?.permissions?.is_team_manager
      || task?.permissions?.is_task_reviewer
    ),
    can_submit_review: isAssignee && status === 'in_progress' && !isAssigneeLocked,
    can_approve_review: false,
    can_reject_review: false,
    is_assignee_locked: isAssigneeLocked,
    workflow_warning: null,
  };
}

export function canModerateTaskContent(task, currentUser) {
  return Boolean(getTaskPermissions(task, currentUser).can_moderate);
}

export function canDeleteTask(task, currentUser) {
  return Boolean(getTaskPermissions(task, currentUser).can_delete);
}

export function canDragTask(task, currentUser) {
  const perms = getTaskPermissions(task, currentUser);
  if (perms.is_assignee_locked && !perms.can_edit) {
    return false;
  }
  return perms.can_edit || perms.can_approve_review;
}

export function canDragTaskToStatus(task, currentUser, targetStatus) {
  const perms = getTaskPermissions(task, currentUser);
  if (!canDragTask(task, currentUser)) {
    return false;
  }
  if (perms.can_submit_review && (targetStatus === 'review' || targetStatus === 'completed')) {
    return false;
  }
  if (task?.status === 'review' && perms.can_approve_review) {
    return targetStatus === 'completed' || targetStatus === 'in_progress';
  }
  if (task?.status === 'review' && !perms.can_approve_review && !isTaskAdmin(currentUser)) {
    return false;
  }
  if (task?.status === 'completed' && !perms.can_edit) {
    return false;
  }
  return true;
}
