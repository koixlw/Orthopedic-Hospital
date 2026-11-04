<template>
  <div class="slot-card" :class="cls" @click="$emit('click', schedule)">
    <span v-if="schedule.isChanged" class="badge">变更 {{ schedule.changeCount }} 次</span>
    <div class="who">
      {{ patient ? patient.name : '—' }}
      <span class="tiny mono">{{ patient ? patient.inpatientNo : '' }}</span>
    </div>
    <div class="op">{{ patient ? patient.surgeryName : '' }}</div>
    <div class="sub">{{ schedule.surgeon }} · {{ schedule.anesthesiaType }}</div>
    <div class="sub flex gap6" style="margin-top:4px">
      <el-tag size="small" :type="tagType" effect="light">{{ tagLabel }}</el-tag>
      <span v-if="schedule.status !== 'CANCELLED'" class="tiny">第 {{ schedule.seq }} 台</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  schedule: { type: Object, required: true },
  patient: { type: Object, default: null }
})
defineEmits(['click'])

const tagLabel = computed(() => ({
  SCHEDULED: '已预约', CHANGED: '已变更', CHECKED_IN: '已报到', COMPLETED: '已完成', CANCELLED: '已取消'
}[props.schedule.status] || props.schedule.status))
const tagType = computed(() => ({
  SCHEDULED: 'primary', CHANGED: 'warning', CHECKED_IN: 'success', COMPLETED: 'info', CANCELLED: 'info'
}[props.schedule.status] || 'info'))
const cls = computed(() => ({
  changed: props.schedule.status === 'CHANGED',
  checkin: props.schedule.status === 'CHECKED_IN',
  done: props.schedule.status === 'COMPLETED'
}))
</script>
