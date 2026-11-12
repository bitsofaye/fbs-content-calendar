import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../api/hooks';

// The client record (with pillars) a page works on: the one in the URL when given,
// otherwise the signed-in client user's own. Also holds the "open post" state so the
// page can show the post window without leaving.
export function useMyClient(slugOverride) {
  const { user } = useAuth();
  const slug = slugOverride || user?.client?.slug;
  const { data: client, isLoading } = useClient(slug);
  const [openId, setOpenId] = useState(null);
  return { user, client, isLoading, openId, open: (p) => setOpenId(p.id), close: () => setOpenId(null) };
}
