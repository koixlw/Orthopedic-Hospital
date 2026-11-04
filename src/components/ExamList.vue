<template>
  <el-table :data="exams" size="small" border style="width:100%">
    <el-table-column prop="name" label="检查 / 检验项目" min-width="130" />
    <el-table-column prop="type" label="类型" width="68" align="center" />
    <el-table-column label="预约状态" width="92" align="center">
      <template #default="{ row }">
        <el-tag size="small" :type="row.bookStatus === '已完成' ? 'success' : 'info'" effect="plain">
          {{ row.bookStatus }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="bookTime" label="预约 / 执行时间" width="136">
      <template #default="{ row }"><span class="num">{{ (row.bookTime || '').slice(0, 16) }}</span></template>
    </el-table-column>
    <el-table-column label="报告状态" width="92" align="center">
      <template #default="{ row }">
        <el-tag size="small" :type="row.reportStatus === '已出' ? 'success' : 'warning'">{{ row.reportStatus }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="数据来源" width="86" align="center">
      <template #default="{ row }"><span class="tiny">{{ row.source }}</span></template>
    </el-table-column>
    <el-table-column label="操作" width="86" align="center" fixed="right">
      <template #default="{ row }">
        <el-button v-if="row.reportStatus === '已出'" link type="primary" size="small" @click="$emit('view', row)">
          查看报告
        </el-button>
        <span v-else class="tiny">报告未出</span>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
defineProps({ exams: { type: Array, default: () => [] } })
defineEmits(['view'])
</script>
