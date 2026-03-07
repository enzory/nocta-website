import { defineCollection, z } from 'astro:content';

const journal = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    category: z.string(),
    readTime: z.number(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { journal };
