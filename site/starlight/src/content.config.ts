// journey-site#6 bake-off v2 (Starlight). The shared content carries `date`, `tags` and `author`
// in frontmatter; Starlight's schema knows none of them, so they are declared here or they are
// silently stripped (zod strips unknown keys). This is config, not content.
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        date: z.coerce.date().optional(),
        tags: z.array(z.string()).optional(),
        author: z.string().optional(),
      }),
    }),
  }),
};
