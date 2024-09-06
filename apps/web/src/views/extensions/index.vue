<script setup lang="ts">
import { API } from '/@/api'
import list from './install/index.vue'
import hub from './hub/index.vue'
const tabs = ref([
	{ title: 'Intalled', value: 'intalled' },
	{ title: 'Extension Hub', value: 'hub' },
])

const tabsValue = ref('intalled')


const categoryList = ref<any>([])

let extensionList = ref<any>([])

const userExtensionList = ref()

onBeforeMount(() => {
	getExtensionHubCategory();
	// getUserExtensionList()
})



// 获取插件列表
async function getExtensionList(params: any) {
	const { data } = await API.plugins.userGetSystemPluginList(params)
	extensionList.value = data.rows;
	getDataOfgCateGoryGroup()
	return data.rows
}

// 请求插件目录
async function getExtensionHubCategory() {
	const { data } = await API.plugins.userGetPluginCategoryList()
	categoryList.value = data.rows;
	getExtensionList({})
	return data.rows;
}

// hub 插件列表
async function getUserExtensionList() {
	const { data } = await API.plugins.userGetPluginListList({})
	userExtensionList.value = data.rows;
	return data.rows
}



// 根据分类组合数据
function getDataOfgCateGoryGroup() {
	for (let i = 0; i < categoryList.value.length; i++) {
		categoryList.value[i]['arr'] = [];
		for (let j = 0; j < extensionList.value.length; j++) {
			if (categoryList.value[i].id === extensionList.value[j].category) {
				categoryList.value[i]['arr'].push(extensionList.value[j])
			}
		}
	}
}


// 仓库触发搜索时间
function searchMethod(e: any) {
	const params = {
		pluginName: e.value
	}
	getExtensionList(params)
}

</script>


<style lang="scss" scoped>
.extensions-content {
	.account-header {

		padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
		gap: 10px;
		height: 48px;
		color: #000;
		font-family: Inter;
		font-size: 16px;
		font-style: normal;
		font-weight: 600;
		line-height: var(--Line-Height-text-xl, 24px);
		border-bottom: none;
	}

	.tabpanel {
		padding: 0 !important;
	}
}
</style>


<template>
	<div class="extensions-content h-screen">
		<div class="flex justify-between account-header">
			<div>Extensions</div>
		</div>
		<div class="flex justify-between h-full">
			<div class="flex flex-col flex-1 h-full">
				<Tabs :value="tabsValue">
					<TabList>
						<Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
							{{ tab.title }}
						</Tab>
					</TabList>

					<TabPanels class="p-0 tabpanel">
						<TabPanel value="intalled">
							<list :dataList="userExtensionList"></list>
						</TabPanel>
						<TabPanel class="p-0" value="hub">
							<hub @searchMethod="searchMethod" :dataList="categoryList"></hub>
						</TabPanel>
					</TabPanels>
				</Tabs>
			</div>
		</div>
		<!-- <router-view /> -->
	</div>
</template>
