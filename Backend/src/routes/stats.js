import { Router } from 'express';
import db from '../content/db.js';

const router = Router();

// 预编译插入语句
const stmtTrack = db.prepare('INSERT INTO page_views (path) VALUES (?)');

// POST /api/stats/track - 记录首页访问
router.post('/track', (req, res) => {
  const { path } = req.body;
  if (path === '/') {
    stmtTrack.run('/');
  }
  res.json({ ok: true });
});

// GET /api/stats - 获取统计数据
router.get('/', (req, res) => {
  const week = db.prepare(
    "SELECT COUNT(*) as count FROM page_views WHERE visited_at >= datetime('now', '-7 days', 'localtime')"
  ).get().count;

  const month = db.prepare(
    "SELECT COUNT(*) as count FROM page_views WHERE visited_at >= datetime('now', '-30 days', 'localtime')"
  ).get().count;

  res.json({ week, month });
});

export default router;
