<template>
  <div class="app-shell">
    <SideNav />
    <div class="main">
      <TopBar />
      <div class="content">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="$route.fullPath" />
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import SideNav from './SideNav.vue'
import TopBar from './TopBar.vue'
</script>
