// Who may move a post to which status (FBS team rules).
//  - Approved / Needs edit / Rejected: only the post's approver (any FBS member when no approver is set).
//  - For approval / Scheduled / Published: the person assigned to it, or the approver (anyone when nobody is assigned).
// Client logins keep their own rules (they review posts of their own company through /review).

export const REVIEW_STATUSES = ['APPROVED', 'TO_EDIT', 'REJECTED'];
export const HANDOFF_STATUSES = ['FOR_APPROVAL', 'SCHEDULED', 'PUBLISHED'];
// moving to these needs a written reason, so they go through /review with a comment
export const NEEDS_COMMENT = ['TO_EDIT', 'REJECTED'];

const LABEL = { APPROVED: 'Approved', TO_EDIT: 'Needs edit', REJECTED: 'Rejected', FOR_APPROVAL: 'For approval', SCHEDULED: 'Scheduled', PUBLISHED: 'Published' };

/** Returns a message when the user may not move the post to `to`, otherwise null. */
export function statusBlock(user, post, to) {
  if (!user || user.role !== 'ADMIN') return null;
  if (REVIEW_STATUSES.includes(to) && post.approverId && post.approverId !== user.id) {
    return `Only the approver of this post can set it to ${LABEL[to]}`;
  }
  if (HANDOFF_STATUSES.includes(to) && post.assigneeId && post.assigneeId !== user.id && post.approverId !== user.id) {
    return `Only the person assigned to this post can move it to ${LABEL[to]}`;
  }
  return null;
}

// statuses that notify the people working on a post
export const NOTIFY_STATUSES = ['APPROVED', 'TO_EDIT', 'REJECTED'];
// activity rows that only feed the bell (not shown in a post's History)
export const NOTICE_ACTIONS = ['NOTIFY', 'MENTIONED'];

/**
 * Activity rows that tell the people working on a post that it was approved / needs edits / was rejected:
 * the person assigned, whoever created it, and whoever sent it for approval (never the one who made the change).
 */
export function statusNoticeLogs(before, to, postId, actorId, submitterId) {
  if (!NOTIFY_STATUSES.includes(to) || to === before.status) return [];
  const ids = new Set([before.assigneeId, before.createdById, submitterId].filter(Boolean));
  ids.delete(actorId);
  return [...ids].map((userId) => ({ postId, userId: actorId, action: 'NOTIFY', meta: { userId, status: to } }));
}

/** Activity rows that notify people newly set as approver / assignee (never yourself). */
export function assignmentLogs(before, data, postId, actorId) {
  const logs = [];
  for (const [key, as] of [['approverId', 'approver'], ['assigneeId', 'assignee']]) {
    const to = data[key];
    if (!to || to === actorId || to === before?.[key]) continue;
    logs.push({ postId, userId: actorId, action: 'ASSIGNED', meta: { userId: to, as } });
  }
  return logs;
}
