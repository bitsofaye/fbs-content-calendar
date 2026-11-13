import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, RotateCcw, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBulkUpdate, useReviewPost } from '../api/hooks';
import { NEEDS_COMMENT, REVIEW_STATUSES, statusBlock } from '../lib/workflow';
import { Modal } from './ui';

const ASK = {
  APPROVED: {
    action: 'APPROVE', title: 'Approve this post?', button: 'Approve', icon: Check, cls: 'btn-success',
    label: 'Comment (optional)', placeholder: 'Anything the team should know?',
  },
  TO_EDIT: {
    action: 'REQUEST_CHANGES', title: 'What needs to be edited?', button: 'Send for edits', icon: RotateCcw, cls: 'btn-primary',
    label: 'Comment *', placeholder: 'Tell the team what to change before this post can be approved…',
  },
  REJECTED: {
    action: 'REJECT', title: 'Why is this post rejected?', button: 'Reject post', icon: XCircle, cls: 'btn-danger',
    label: 'Reason *', placeholder: 'Explain why this post should not go out…',
  },
};

/**
 * One way to change a post's status everywhere (board, content plan, post window, daily view).
 * Approve / Needs edit / Reject open a pop-up first; Needs edit and Reject need a comment.
 * Returns { change(post, status, { onDone }), dialog, open }; render `dialog` once in the page.
 */
export function useStatusChange() {
  const { user } = useAuth();
  const bulk = useBulkUpdate();
  const review = useReviewPost();
  const [pending, setPending] = useState(null); // { post, status, onDone }
  const [comment, setComment] = useState('');

  const change = (post, status, { onDone } = {}) => {
    if (!post || post.status === status) return false;
    const block = statusBlock(user, post, status);
    if (block) {
      toast.error(block);
      return false;
    }
    if (REVIEW_STATUSES.includes(status)) {
      setComment('');
      setPending({ post, status, onDone });
      return true;
    }
    bulk.mutate([{ id: post.id, data: { status } }], { onSuccess: () => onDone?.(status) });
    return true;
  };

  const close = () => setPending(null);
  const ask = pending ? ASK[pending.status] : null;
  const needsComment = pending && NEEDS_COMMENT.includes(pending.status);

  const confirm = async () => {
    const { post, status, onDone } = pending;
    await review.mutateAsync({ id: post.id, action: ask.action, comment: comment.trim() || undefined });
    close();
    onDone?.(status);
  };

  const dialog = (
    <Modal
      open={Boolean(pending)}
      onClose={close}
      title={ask?.title}
      footer={
        ask && (
          <>
            <button className="btn-secondary" onClick={close}>Cancel</button>
            <button className={ask.cls} disabled={review.isPending || (needsComment && !comment.trim())} onClick={confirm}>
              <ask.icon className="h-4 w-4" /> {review.isPending ? 'Sending…' : ask.button}
            </button>
          </>
        )
      }
    >
      {pending && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{pending.post.title}</span>
          </p>
          <div>
            <label className="label" htmlFor="review-comment">{ask.label}</label>
            <textarea
              id="review-comment"
              autoFocus
              className="input"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={ask.placeholder}
            />
            {needsComment && <p className="mt-1 text-xs text-slate-500">A comment is required before you can continue. It is added to the post’s discussion.</p>}
          </div>
        </div>
      )}
    </Modal>
  );

  return { change, dialog, open: Boolean(pending) };
}
