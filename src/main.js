import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import '@/styles.css'
import App from './App.vue'
import router from './router'
import { hydrate } from './store/db'

// 先装载演示数据（localStorage 有就用，没有就播种），再挂载应用
hydrate()

const app = createApp(App)
Object.entries(ElementPlusIconsVue).forEach(([key, comp]) => app.component(key, comp))
app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
