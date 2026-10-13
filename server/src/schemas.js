const { z } = require('zod');

const username = z
  .string()
  .trim()
  .min(3, 'Must be at least 3 characters')
  .max(30, 'Must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only');

const password = z
  .string()
  .min(8, 'Must be at least 8 characters')
  .max(100, 'Must be at most 100 characters');

const register = z.object({
  username,
  email: z.string().trim().toLowerCase().email('Invalid email address').max(255),
  password,
});

const login = z.object({
  identifier: z.string().trim().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
});

const post = z.object({
  title: z.string().trim().min(3, 'Must be at least 3 characters').max(120, 'Must be at most 120 characters'),
  body: z.string().trim().min(1, 'Required').max(10000, 'Must be at most 10,000 characters'),
});

const comment = z.object({
  body: z.string().trim().min(1, 'Required').max(1000, 'Must be at most 1,000 characters'),
});

const listPosts = z.object({
  q: z.string().trim().max(100).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(9),
  sort: z.enum(['new', 'popular']).optional().default('new'),
  author: z.string().trim().max(30).optional(),
});

module.exports = { register, login, post, comment, listPosts };
