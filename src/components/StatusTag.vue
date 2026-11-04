<template>
  <el-tag :type="type" size="small" :effect="effect" round>{{ text }}</el-tag>
</template>

<script setup>
defineProps({
  text: { type: String, default: '—' },
  type: { type: String, default: 'info' },
  effect: { type: String, default: 'light' }
})
</script>
