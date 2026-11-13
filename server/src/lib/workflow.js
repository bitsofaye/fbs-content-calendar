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
