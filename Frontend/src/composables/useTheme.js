import { ref, watchEffect } from 'vue';

const theme = ref(localStorage.getItem('theme') || 'light');

export function useTheme() {
  watchEffect(() => {
    document.documentElement.classList.toggle('dark', theme.value === 'dark');
    localStorage.setItem('theme', theme.value);
  });

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  return { theme, toggle };
}
