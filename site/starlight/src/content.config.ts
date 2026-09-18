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
        // The Narrative's Act number (journey-site#81, D17): data, never in the title. Rendered
        // above the title by src/components/PageTitle.astro. Optional: the front door and the
        // colophon have none, and a chapter written before the rule may not yet carry one.
        act: z.number().int().positive().optional(),
      }),
    }),
  }),
};
