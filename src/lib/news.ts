export type NewsStatus = "draft" | "published";

export function publishedNewsAsOf<T extends { status: NewsStatus; publishedAt: string }>(posts: T[]): T[] {
    const now = Date.now();
    return posts.filter((post) => newsIsLive(post, now));
}

export function newsIsLive(post: { status: NewsStatus; publishedAt: string }, now = Date.now()): boolean {
    return post.status === "published" && new Date(post.publishedAt).getTime() <= now;
}

export function newsAuthorLine(post: { author: string; authorName: string | null; authorTitle: string | null }): string {
    if (!post.authorName) return post.author;
    return post.authorTitle ? `${post.authorName}, ${post.authorTitle}` : post.authorName;
}
