import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import BlogPage from '../pages/BlogPage.vue';
import BlogDetailPage from '../pages/BlogDetailPage.vue';
import TagPage from '../pages/TagPage.vue';
import ProjectsPage from '../pages/ProjectsPage.vue';

const routes = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/projects', name: 'projects', component: ProjectsPage },
  { path: '/blog', name: 'blog', component: BlogPage },
  { path: '/blog/tag/:tag', name: 'blog-tag', component: TagPage },
  { path: '/blog/:slug', name: 'blog-detail', component: BlogDetailPage },
  { path: '/friends', name: 'friends', component: () => import('../pages/FriendsPage.vue') },
  { path: '/admin', name: 'admin', component: () => import('../pages/AdminPage.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
