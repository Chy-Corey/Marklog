<script setup>
// 主页：由五个独立区块组成，区块间用分割线隔开
// 每个区块独立请求各自需要的数据
import BaseLayout from '../layouts/BaseLayout.vue';
import HeroSection from '../components/home/HeroSection.vue';
import ExperienceSection from '../components/home/ExperienceSection.vue';
import ProjectsSection from '../components/home/ProjectsSection.vue';
import BlogSection from '../components/home/BlogSection.vue';
import StatsSection from '../components/home/StatsSection.vue';
</script>

<template>
  <BaseLayout>
    <HeroSection />
    <hr class="section-divider my-4" />
    <ExperienceSection />
    <hr class="section-divider my-4" />
    <ProjectsSection />
    <hr class="section-divider my-4" />
    <BlogSection />
    <hr class="section-divider my-4" />
    <StatsSection />
  </BaseLayout>
</template>
