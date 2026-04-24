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
    image: z.string().optional(),
  }),
});

const geo = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(70),
    description: z.string().min(100).max(170),
    zone: z.string(),
    type: z.enum(['arrondissement', 'commune-92', 'occasion', 'chef-prive']),
    publishDate: z.coerce.date(),
    readingTime: z.string().optional(),
    schemaType: z.enum(['LocalBusiness', 'Service']).default('LocalBusiness'),
    ctaType: z.enum(['private', 'corporate']).optional(),
  }),
});

export const collections = { journal, geo };
