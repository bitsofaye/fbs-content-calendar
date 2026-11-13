// Same rules as the server (server/src/lib/workflow.js), so buttons and drops can say "no" before trying.
//  - Approved / Needs edit / Rejected: only the post's approver (any FBS member when no approver is set).
//  - For approval / Scheduled / Published: the person assigned, or the approver (anyone when nobody is assigned).

export const REVIEW_STATUSES = ['APPROVED', 'TO_EDIT', 'REJECTED'];
export const HANDOFF_STATUSES = ['FOR_APPROVAL', 'SCHEDULED', 'PUBLISHED'];
export const NEEDS_COMMENT = ['TO_EDIT', 'REJECTED'];

const LABEL = { APPROVED: 'Approved', TO_EDIT: 'Needs edit', REJECTED: 'Rejected', FOR_APPROVAL: 'For approval', SCHEDULED: 'Scheduled', PUBLISHED: 'Published' };

/** A message when this user may not move the post to `to`, otherwise null. */
export function statusBlock(user, post, to) {
  if (!user || user.role !== 'ADMIN' || !post) return null;
  if (REVIEW_STATUSES.includes(to) && post.approverId && post.approverId !== user.id) {
    return `Only the approver${post.approver?.name ? ` (${post.approver.name})` : ''} can set this post to ${LABEL[to]}.`;
  }
  if (HANDOFF_STATUSES.includes(to) && post.assigneeId && post.assigneeId !== user.id && post.approverId !== user.id) {
    return `Only the person assigned${post.assignee?.name ? ` (${post.assignee.name})` : ''} can move this post to ${LABEL[to]}.`;
  }
  return null;
}

/** Can this user approve / ask for edits on this post right now? */
export const canReviewPost = (user, post) => Boolean(post && post.status === 'FOR_APPROVAL' && !statusBlock(user, post, 'APPROVED'));
