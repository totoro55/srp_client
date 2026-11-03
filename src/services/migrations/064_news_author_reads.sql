INSERT INTO news_reads (post_id, username, read_at)
SELECT id, lower(author), published_at
FROM news_posts
WHERE status = 'published'
ON CONFLICT (post_id, username) DO NOTHING;
