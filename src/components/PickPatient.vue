<template>
  <div class="card">
    <div class="empty" style="padding:40px 0 18px">
      <div class="big">⇢</div>
      {{ title }}
      <div class="tiny mt8">{{ desc }}</div>
    </div>
    <div class="pick-wrap">
      <div class="tiny" style="color:#8a94a6">可直接选择一位患者进入本页（演示环境不会产生新患者）</div>
      <div class="pick-grid">
        <div v-for="p in list" :key="p.patientId" class="pick-card" @click="go(p)">
          <div class="pick-top">
            <b>{{ p.name }}</b>
            <span class="mono tiny">{{ p.inpatientNo }}</span>
            <el-tag size="small" :type="tagType(p.status)" effect="light">{{ labelOf(p.status) }}</el-tag>
          </div>
          <div class="pick-sub">{{ p.surgeryName }}</div>
          <div class="tiny" style="color:#8a94a6">{{ p.surgeon }} · {{ p.surgeryRoom }} · 拟 {{ p.plannedSurgeryDate }}</div>
        </div>
        <div v-if="!list.length" class="tiny" style="color:#8a94a6">当前没有可操作的患者</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '@/store/db'
import { PATIENT_STATUS } from '@/mock/dict'

const props = defineProps({
  title: { type: String, default: '请先选择患者' },
  desc: { type: String, default: '本页按患者维度展示，请从上方列表选择或返回工作台选择患者。' },
  to: { type: String, required: true },
  statuses: { type: Array, default: () => ['ADMITTED', 'IN_SURGERY', 'SCHEDULED'] }
})

const router = useRouter()
const list = computed(() => state.patients.filter((p) => props.statuses.includes(p.status)))
const labelOf = (s) => PATIENT_STATUS[s]?.label || s
const tagType = (s) => ({ SCHEDULED: 'warning', ADMITTED: 'success', IN_SURGERY: 'danger' }[s] || 'info')

function go(p) {
  router.push(`${props.to}/${p.patientId}`)
}
</script>

<style scoped>
.pick-wrap { border-top: 1px dashed var(--line); padding: 14px 2px 6px; }
.pick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
.pick-card {
  border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; cursor: pointer;
  background: #fff; transition: all .16s;
}
.pick-card:hover { border-color: #9dc4e8; background: #f7fbff; box-shadow: 0 2px 8px rgba(31, 106, 176, .08); }
.pick-top { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.pick-sub { font-size: 12.5px; color: #46536a; margin: 6px 0 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
