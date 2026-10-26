export type NewsStatus = "draft" | "published";

export function newsAuthorLine(post: { author: string; authorName: string | null; authorTitle: string | null }): string {
    if (!post.authorName) return post.author;
    return post.authorTitle ? `${post.authorName}, ${post.authorTitle}` : post.authorName;
}
