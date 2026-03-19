import fm from 'front-matter';

export interface BlogPost {
  title: string;
  description: string;
  date: string;
  slug: string;
  keywords: string;
  relatedTool: string;
  tags: string[];
  content: string;
}

interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  slug: string;
  keywords: string;
  relatedTool: string;
  tags?: string[];
}

const modules: Record<string, string> = import.meta.glob('../content/blog/*.md', {
  query: '?raw',
  eager: true,
  import: 'default',
});

function parsePosts(): BlogPost[] {
  return Object.values(modules).map((raw) => {
    const { attributes, body } = fm<BlogFrontmatter>(raw);
    const { tags, ...rest } = attributes;
    return { ...rest, tags: tags ?? [], content: body };
  });
}

let cachedPosts: BlogPost[] | undefined;

export function getAllPosts(): BlogPost[] {
  cachedPosts ??= parsePosts().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return cachedPosts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

export function getPostsByTag(tag: string): BlogPost[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}
