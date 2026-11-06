<template>
  <div class="patient-head">
    <div class="avatar">{{ patient.name.slice(0, 1) }}</div>
    <div>
      <div class="nm">
        {{ patient.name }}
        <el-tag size="small" :type="statusType" effect="light">{{ statusLabel }}</el-tag>
        <el-tag v-if="patient.allergy && patient.allergy !== '无'" size="small" type="danger" effect="plain">
          过敏：{{ patient.allergy }}
        </el-tag>
      </div>
      <div class="meta">
        <span>{{ patient.gender }} · {{ patient.age }} 岁</span>
        <span>住院号 <b class="mono">{{ patient.inpatientNo }}</b></span>
        <span v-if="patient.bedNo">床位 <b>{{ patient.bedNo }}</b></span>
        <span>日间手术：<b>{{ patient.surgeryName }}</b></span>
        <span v-if="patient.plannedSurgeryDate">拟手术日 <b>{{ patient.plannedSurgeryDate }}</b></span>
      </div>
    </div>
    <div class="ops">
      <el-button v-if="showBack" size="small" :icon="Back" @click="goBack">返回</el-button>
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Back } from '@element-plus/icons-vue'
import { PATIENT_STATUS } from '@/mock/dict'

const props = defineProps({
  patient: { type: Object, required: true },
  // 有明确返回目标时由页面自行提供按钮，避免出现两个「返回」
  showBack: { type: Boolean, default: true }
})
const router = useRouter()
const statusLabel = computed(() => PATIENT_STATUS[props.patient.status]?.label || props.patient.status)
const statusType = computed(() => PATIENT_STATUS[props.patient.status]?.type || 'info')

function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}
</script>
