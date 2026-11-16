import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../lib/api';

const clean = (params) => Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));

// ---------- queries ----------

export const useClients = (opts = {}) =>
  useQuery({
    queryKey: ['clients', opts],
    queryFn: async () => (await api.get('/clients', { params: clean(opts) })).data.clients,
  });

export const useClient = (key) =>
  useQuery({
    queryKey: ['client', key],
    enabled: Boolean(key),
    queryFn: async () => (await api.get(`/clients/${key}`)).data.client,
  });

export const usePosts = (params, options = {}) =>
  useQuery({
    queryKey: ['posts', clean(params)],
    enabled: Boolean(params?.clientId) && options.enabled !== false,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get('/posts', { params: clean(params) })).data.posts,
  });

// Posts across every client (FBS team only), e.g. everything going out on one day
export const useAllPosts = (params, options = {}) =>
  useQuery({
    queryKey: ['posts', 'all', clean(params)],
    enabled: options.enabled !== false,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get('/posts', { params: clean(params) })).data.posts,
  });

export const usePost = (id) =>
  useQuery({
    queryKey: ['post', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get(`/posts/${id}`)).data.post,
  });

export const useUserOptions = (clientId) =>
  useQuery({
    queryKey: ['userOptions', clientId],
    queryFn: async () => (await api.get('/users/options', { params: clean({ clientId }) })).data.users,
  });

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data.users });

export const usePillars = (clientId) =>
  useQuery({
    queryKey: ['pillars', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => (await api.get('/pillars', { params: { clientId } })).data.pillars,
  });

export const useThemes = (clientId, year) =>
  useQuery({
    queryKey: ['themes', clientId, year],
    enabled: Boolean(clientId),
    queryFn: async () => (await api.get('/themes', { params: clean({ clientId, year }) })).data.themes,
  });

export const useClientDashboard = (key, range) =>
  useQuery({
    queryKey: ['dashboard', key, range],
    enabled: Boolean(key),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get(`/dashboard/client/${key}`, { params: clean(range) })).data,
  });

export const useOverview = (options = {}) =>
  useQuery({ queryKey: ['overview'], enabled: options.enabled !== false, queryFn: async () => (await api.get('/dashboard/overview')).data });

// posts where I was recently made the approver or the person assigned
export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], refetchInterval: 60000, queryFn: async () => (await api.get('/dashboard/notifications')).data.assigned });

// clients in the Trash (admins); deleted for good after `days`
export const useClientTrash = (options = {}) =>
  useQuery({ queryKey: ['clientTrash'], enabled: options.enabled !== false, queryFn: async () => (await api.get('/clients/trash')).data });

// a client's shared Google Drive folders / files
// The files inside a shared Drive folder (Google Drive API on the server; configured:false when it has no key)
export const useDriveFolder = (clientId, folderId) =>
  useQuery({
    queryKey: ['driveFolder', clientId, folderId],
    enabled: Boolean(clientId && folderId),
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async () => (await api.get('/drive-links/browse', { params: { clientId, folderId } })).data,
  });

export const useDriveLinks = (clientId) =>
  useQuery({
    queryKey: ['driveLinks', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => (await api.get('/drive-links', { params: { clientId } })).data.links,
  });

// ---------- mutations ----------

function useInvalidatePosts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['posts'] });
    qc.invalidateQueries({ queryKey: ['post'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['overview'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
}

function useApiMutation(fn, { success, invalidate = true } = {}) {
  const invalidatePosts = useInvalidatePosts();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (invalidate) invalidatePosts();
      if (success) toast.success(typeof success === 'function' ? success(data) : success);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export const useCreatePost = () => useApiMutation(async (body) => (await api.post('/posts', body)).data.post, { success: 'Post created' });
export const useUpdatePost = (opts = {}) =>
  useApiMutation(async ({ id, ...data }) => (await api.patch(`/posts/${id}`, data)).data.post, { success: opts.quiet ? undefined : 'Saved' });
export const useBulkUpdate = () => useApiMutation(async (updates) => (await api.post('/posts/bulk', { updates })).data.posts);
const plural = (n) => `${n} post${n === 1 ? '' : 's'}`;
export const useBulkArchive = () =>
  useApiMutation(async ({ ids, archived = true }) => ({ ...(await api.post('/posts/bulk-archive', { ids, archived })).data, archived }), {
    success: (d) => `${plural(d.count)} ${d.archived ? 'archived' : 'restored'}`,
  });
export const useBulkDelete = () =>
  useApiMutation(async (ids) => (await api.post('/posts/bulk-delete', { ids })).data, { success: (d) => `${plural(d.count)} deleted` });
export const useDeletePost = () => useApiMutation(async (id) => (await api.delete(`/posts/${id}`)).data, { success: 'Post deleted' });
export const useDuplicatePost = () =>
  useApiMutation(async ({ id, date }) => (await api.post(`/posts/${id}/duplicate`, date !== undefined ? { date } : {})).data.post, {
    success: 'Post duplicated',
  });
export const useSubmitPost = () =>
  useApiMutation(async ({ id, ...body }) => (await api.post(`/posts/${id}/submit`, body)).data.post, { success: 'Sent for approval' });
export const useReviewPost = () =>
  useApiMutation(async ({ id, ...body }) => (await api.post(`/posts/${id}/review`, body)).data.post, {
    success: (p) => (p.status === 'APPROVED' ? 'Approved ✔' : p.status === 'TO_EDIT' ? 'Changes requested' : 'Rejected'),
  });
export const useAddComment = () => useApiMutation(async ({ id, body }) => (await api.post(`/posts/${id}/comments`, { body })).data.comment);
export const useGenerateMonth = () =>
  useApiMutation(async (body) => (await api.post('/posts/generate-month', body)).data, {
    success: (d) => (d.created ? `Created ${d.created} empty slots` : 'Every pillar slot already has a post'),
  });

// AI drafts: generating can take a few minutes for a whole month, so allow up to 10
export const useGenerateContent = () =>
  useApiMutation(async (body) => (await api.post('/posts/generate-content', body, { timeout: 10 * 60 * 1000 })).data, { invalidate: false });
// is one-click (API) generation set up on the server? If not, the copy-paste way through claude.ai is used
export const useGenerateStatus = (enabled = true) =>
  useQuery({ queryKey: ['generateStatus'], enabled, staleTime: 5 * 60 * 1000, queryFn: async () => (await api.get('/posts/generate-content/status')).data });
export const useContentRequest = () => useApiMutation(async (body) => (await api.post('/posts/generate-content/request', body)).data, { invalidate: false });
export const useReadClaudeReply = () => useApiMutation(async (body) => (await api.post('/posts/generate-content/read', body)).data, { invalidate: false });
export const useSaveGeneratedContent = () =>
  useApiMutation(async (body) => (await api.post('/posts/generate-content/save', body)).data, {
    success: (d) => `Added ${d.created} post${d.created === 1 ? '' : 's'} to the calendar`,
  });

// Generic admin CRUD helper for clients / pillars / themes / users
export function useAdminMutation(fn, keys, success) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === 'function' ? success(data) : success);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
