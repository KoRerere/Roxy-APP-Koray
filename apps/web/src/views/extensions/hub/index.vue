<script setup lang="ts">
import { API } from '/@/api';
import { Item } from 'ant-design-vue/es/menu';


const props = withDefaults(defineProps<{
  dataList: Item[];
}>(), {
  dataList: () => []
});

let selCategoryIndex = ref<any>(1)
const searchValue = ref()

function addPlugin(item: Items) {
  installedPlugin(item)
}

// 安装插件
async function installedPlugin(item: Items) {
  const category = props.dataList.find((c) => c.id === item.category);
  if (category && category.arr && Array.isArray(category.arr)) {
    // 更新指定 item 的状态
    const index = category.arr.findIndex((i) => i.id === item.id);
    if (index !== -1) {
      category.arr[index].addStatus = 'installing';
    }
    console.log(category.arr[index].addStatus)
  }
  const params = {
    id: item.id
  }
  const { code, msg } = await API.plugins.userAddSystemPluginCreate(params);
  if (code === 0) {
    if (category && category.arr && Array.isArray(category.arr)) {
      // 更新指定 item 的状态
      const index = category.arr.findIndex((i) => i.id === item.id);
      if (index !== -1) {
        category.arr[index].addStatus = true;
      }
    }
  }
}
const emits = defineEmits(['searchMethod'])
function searchEmit(e: any) {
  // 触发父组件的事件
  emits('searchMethod', searchValue);
}


// 点击滚动事件
function scrollToCategory(item: Item) {
  const element: any = document.querySelector(`[data-category-id="${item.id}"]`);

  if (element) {
    // 如果没有容器，则针对整个文档
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  // if (element) {
  //   const offsetTop = getOffsetTop(element);
  //   element.scrollTo(0, offsetTop)
  // }
}


// 计算元素的偏移量
// function getOffsetTop(element: any): number {
//   let offsetTop = 0;
//   while (element) {
//     offsetTop += element.offsetTop;
//     element = element.offsetParent;
//   }
//   console.log(offsetTop)
//   return offsetTop;
// }


// 点击层级
function selCategoryClick(item: any) {
  selCategoryIndex.value = item.id;
  scrollToCategory(item)
}

// 过滤数据列表
const filteredDataList = computed(() => {
  return props.dataList.filter((item: any) => {
    if (item.arr && Array.isArray(item.arr)) {
      return item.arr.length > 0;
    }
    return false;
  });
});

interface Item {
  id: number
  categoryName: string,
  arr?: any[] | Items[] | undefined
}


interface Items {
  pluginName: string,
  pluginVersion: string,
  pluginDesc: string,
  pluginIcon: string,
  provider: string,
  category: number,
  addStatus: any,
  id: number
}


</script>

<template>
  <div class="flex w-full h-screen hub-box">
    <div class="h-full flex flex-col hub-content">
      <div class="search">
        <InputGroup>
          <InputGroupAddon>
            <img src="/@/assets/image/extension/rx_ic_magnify.svg" alt="">
          </InputGroupAddon>
          <InputText v-model="searchValue" @input="searchEmit" placeholder="Search your most used chrome extensions">

          </InputText>

          <!-- <InputGroupAddon> -->

          <!-- </InputGroupAddon> -->
        </InputGroup>
      </div>


      <div class="container">
        <div class="content w-full flex flex-col" v-for="item in filteredDataList" :key="item.id">
          <div class="title flex item-cneter" :data-category-id="item.id">
            {{ item.categoryName }}
            <!-- ROXY CRAFTED -->
          </div>

          <div class="list-box">
            <div class="list-item flex flex-col" v-for="items in item.arr" :key="items.id">
              <div class="item-title-box flex">
                <div class="title-icon">
                  <img :src="items.pluginIcon" alt="">
                </div>
                <div class="title-text-box flex flex-col">
                  <div class="plugin-title">
                    {{ items.pluginName }}
                  </div>
                  <div class="plugin-version">
                    {{ items.pluginVersion }}
                  </div>
                </div>
              </div>

              <div class="item-desc">
                {{ items.pluginDesc }}
              </div>

              <div class="item-foot flex">
                <div class="item-provider">
                  By <span>{{ items.provider }}</span>
                </div>

                <div class="item-intall-box flex" @click="addPlugin(items)" v-if="!items.addStatus">
                  <img class="item-install-icon" src="/@/assets/image/extension/rx_ic_download_cloud.svg" alt="">
                  <div class="item-install-item">Install</div>
                </div>


                <div class="item-intalled-box flex" v-else-if="items.addStatus === 'installing'">
                  <div class="item-install-item">Installing...</div>
                </div>


                <div class="item-intalled-box flex" v-else>
                  <img class="item-install-icon" src="/@/assets/image/extension/rx_ic_check_line.svg" alt="">
                  <div class="item-install-item">Installed</div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>



      <!-- 查询无结果 -->
      <div class="search-nodata-box">

      </div>

    </div>

    <div class="flex flex-col hub-category">
      <div class="category-content">
        <div class="category-item" @click="selCategoryClick(item)" :class="{ 'active': selCategoryIndex === item.id }"
          v-for="item in dataList" :key="item.id">
          {{ item.categoryName }}
        </div>
      </div>
    </div>

  </div>
</template>

<style lang="scss" scoped>
.hub-box {
  padding: var(--spacing-4xl, 24px) var(--spacing-4xl, 24px) 0 var(--spacing-4xl, 24px);
  display: grid;
  grid-template-columns: 82% 18%;


  .hub-content {
    flex: 1;
    display: flex;
    margin-right: var(--spacing-4xl, 48px);

    .search {
      height: var(--spacing-4xl, 36px);
      margin-bottom: 40px;

      .input {
        width: 100%;
      }
    }


    .content:first-child {
      margin-top: 0;
    }

    .container {

      height: calc(100vh - 290px);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      overflow: hidden;
      overflow-y: scroll;

      .content:first-child {
        margin-top: 0;
      }

      .content {
        margin-top: 40px;

        .title {
          color: var(--Colors-Text-text-tertiary, #7C8387);
          font-family: Inter;
          font-size: 12px;
          font-style: normal;
          font-weight: 600;
          line-height: var(--Line-Height-text-xs, 16px);
          /* 133.333% */
          text-transform: uppercase;
        }

        .list-box {
          display: flex;
          padding: var(--spacing-none, 0px);
          align-items: flex-start;
          align-content: flex-start;
          gap: 24px var(--spacing-4xl, 24px);
          // grid-template-columns: repeat(3, 1fr);
          align-self: stretch;
          flex-wrap: wrap;
          margin-top: 8px;

          .list-item {
            border-radius: var(--radius-md, 6px);
            border: 0.5px solid var(--Colors-Border-border-container, #C7CDD1);
            background: var(--Color-neutrals-50, #FAFBFC);

            /* shadow-sm */
            box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);

            // flex: 1;
            // display: flex;
            width: calc((100% - 3 * var(--spacing-4xl, 8px) * 2) / 3);
            padding: var(--spacing-xl, 12px);
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-xl, 12px);

            .item-title-box {
              width: 100%;
              justify-content: flex-start;
              align-items: center;
              gap: var(--spacing-lg, 8px);
              flex: 1;

              .title-icon {
                display: flex;
                padding: var(--spacing-md, 6px);
                align-items: center;
                gap: 10px;
                border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
                border: 0.5px solid var(--Colors-Border-border-container, #C7CDD1);
                background: var(--Colors-Background-bg-body, #FFF);

                img {
                  display: flex;
                  width: 24px;
                  height: 24px;
                  padding: 1px;
                  justify-content: center;
                  align-items: center;
                }
              }

              .title-text-box {
                flex: 1;

                overflow: hidden;


                .plugin-title {

                  color: var(--Colors-Text-text-primary, #171C1F);
                  text-overflow: ellipsis;
                  overflow: hidden;
                  white-space: nowrap;
                  font-family: Inter;
                  font-size: 13px;
                  font-style: normal;
                  font-weight: 500;
                  line-height: var(--Line-Height-text-xs, 16px);
                  /* 123.077% */
                }

                .plugin-version {
                  color: var(--Colors-Text-text-tertiary, #7C8387);
                  font-family: Inter;
                  font-size: 12px;
                  font-style: normal;
                  font-weight: 400;
                  line-height: var(--Line-Height-text-xs, 16px);
                  /* 133.333% */
                }
              }
            }

            .item-desc {
              overflow: hidden;
              color: var(--Colors-Text-text-secondary, #575D61);
              text-overflow: ellipsis;
              font-family: Inter;
              font-size: 12px;
              font-style: normal;
              font-weight: 400;
              line-height: 16px;
              min-height: 90px;
              max-height: 90px;
              /* 133.333% */
            }

            .item-foot {
              width: 100%;
              justify-content: space-between;
              align-items: center;
              color: var(--Colors-Text-text-tertiary, #7C8387);
              font-family: Inter;
              font-size: 12px;
              font-style: normal;
              font-weight: 400;
              line-height: var(--Line-Height-text-xs, 16px);
              /* 133.333% */


              .item-provider {

                span {
                  text-decoration: underline;
                }
              }

              .item-intall-box {
                border-radius: var(--radius-sm, 4px);
                border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #C7CDD1);
                background: var(--Component-Colors-Buttons-Secondary-bg, #FFF);
                box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
                display: flex;
                min-width: 24px;
                padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
                justify-content: center;
                align-items: center;
                gap: var(--spacing-sm, 4px);
                cursor: pointer;
              }

              .item-intalled-box {
                border-radius: var(--radius-sm, 4px);
                border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #C7CDD1);
                background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #F0F3F5);
                box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
                display: flex;
                min-width: 24px;
                padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
                justify-content: center;
                align-items: center;
                gap: var(--spacing-sm, 4px);
                cursor: pointer;
              }
            }


          }


        }
      }
    }




  }

  .hub-category {
    width: 126px;
    margin-top: 100px;

    .category-content {
      border-left: 2px solid var(--Color-blue-100, #E8F5FC);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-xl, 12px);

      .category-item {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-2xl, 16px);
        align-self: stretch;
        padding-left: var(--spacing-2xl, 16px);
        color: var(--Colors-Text-text-secondary, #575D61);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 16px;
        cursor: pointer;
        /* 133.333% */
      }

      .active {
        box-sizing: border-box;
        border-left: 2px solid var(--p-tabs-tab-active-border-color);
        color: var(--Colors-Text-text-primary, #171C1F);
        font-family: Inter;
        font-weight: 600;
        margin-left: -2px;
        /* 133.333% */
      }
    }

  }
}
</style>
