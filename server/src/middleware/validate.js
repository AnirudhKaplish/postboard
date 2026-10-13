/** Validates req.body (or req.query) against a zod schema. */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      return res.status(400).json({ error: 'Validation failed', fields });
    }
    // Express 5 makes req.query a getter, so stash parsed data separately.
    req.valid = { ...(req.valid || {}), [source]: result.data };
    next();
  };
}

module.exports = { validate };
