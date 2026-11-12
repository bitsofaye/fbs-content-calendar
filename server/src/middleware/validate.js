import { badRequest } from '../lib/http.js';

/** Validates req[where] with a zod schema and stores the parsed result in req.valid[where]. */
export const validate =
  (schema, where = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[where] ?? {});
    if (!result.success) throw badRequest('Validation failed', result.error.flatten());
    req.valid = { ...(req.valid || {}), [where]: result.data };
    next();
  };
