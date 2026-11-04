<template>
  <el-drawer :model-value="modelValue" size="520px" :title="title" @update:model-value="$emit('update:modelValue', $event)">
    <template v-if="report">
      <div class="flex" style="justify-content:space-between;align-items:baseline">
        <div>
          <div style="font-size:15px;font-weight:700">{{ report.reportName || report.name }}</div>
          <div class="muted mt8">报告时间：{{ (report.reportTime || '').slice(0, 16) }}</div>
        </div>
        <el-tag size="small" type="success" effect="plain">已审核</el-tag>
      </div>

      <el-table :data="report.items || []" size="small" border class="mt12" style="width:100%">
        <el-table-column prop="itemName" label="项目" min-width="140" />
        <el-table-column label="结果" width="100" align="right">
          <template #default="{ row }">
            <span :class="{ 'amount-red': row.abnormal }" class="num">{{ row.result }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="82" />
        <el-table-column prop="refRange" label="参考区间" width="110" />
        <el-table-column label="提示" width="72" align="center">
          <template #default="{ row }">
            <span :class="row.abnormal ? 'amount-red' : 'tiny'">{{ row.abnormal ? '异常' : '正常' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="divider-h"></div>
      <div class="kv">
        <div class="k">报告医师</div><div class="v">{{ report.doctor || '—' }}</div>
        <div class="k">审核医师</div><div class="v">{{ report.reviewer || '—' }}</div>
        <div class="k">数据来源</div>
        <div class="v">{{ report.source === 'LIS' ? 'LIS（模拟）' : 'PACS（模拟）' }}</div>
      </div>
      <div class="notice-bar mt12">
        <el-icon><Lock /></el-icon>
        报告由医技系统出具，本系统只读展示，不支持修改或重新上传。
      </div>
    </template>
    <div v-else class="empty"><div class="big">—</div>请选择一份报告</div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  report: { type: Object, default: null }
})
defineEmits(['update:modelValue'])
const title = computed(() => (props.report ? `${props.report.reportName || props.report.name} 报告详情` : '检查报告'))
</script>
