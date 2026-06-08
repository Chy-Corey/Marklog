import { Router } from 'express';
import { getHomeConfig } from '../content/contentService.js';

const router = Router();

// GET /api/site — 返回主页配置（home.md 的 frontmatter 数据）
router.get('/', (req, res) => {
  res.json(getHomeConfig());
});

export default router;
