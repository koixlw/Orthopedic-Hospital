<template>
  <div class="app-shell">
    <TopBar />
    <div class="app-body">
      <SideNav />
      <main class="main">
        <div class="content">
          <router-view v-slot="{ Component }">
            <component :is="Component" :key="$route.fullPath" />
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import SideNav from './SideNav.vue'
import TopBar from './TopBar.vue'
</script>
