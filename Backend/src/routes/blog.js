import { Router } from 'express';
import { getPosts, getPostBySlug, getAllTags } from '../content/contentService.js';

const router = Router();

// GET /api/blog/tags — 返回所有标签，按字母排序
router.get('/tags', (req, res) => {
  res.json(getAllTags());
});

// GET /api/blog — 返回博客列表
// 支持 ?tag=xxx 按标签过滤、?featured=true 只取精选、?limit=N 限制数量、?offset=N 偏移量
router.get('/', (req, res) => {
  res.json(getPosts({ tag: req.query.tag, featured: req.query.featured, limit: req.query.limit, offset: req.query.offset }));
});

// GET /api/blog/:slug — 返回单篇文章的完整内容（含 markdown 正文）
router.get('/:slug', (req, res) => {
  const post = getPostBySlug(req.params.slug);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
});

export default router;
