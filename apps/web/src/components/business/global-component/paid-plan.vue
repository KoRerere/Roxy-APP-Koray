<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales';

const props = defineProps({
  hideFn: Function,
})


function hide() {
  props.hideFn?.()
}
</script>

<template>
  <div class="paid-plan">
    <div class="content">
      <img class="h-[120px]" src="/banner_paid_plan.svg" alt="">
      <div class="desc">
        <div>{{ $t('亲爱的 Roxy 用户，感谢您一直以来的信任与支持！') }}</div>
        <div>
          <div>{{ $t('自最初版本上线至今8个月以来（2024.05.09 -2025.01.09）') }}</div>
          <div>{{ $t('Roxy 已完成：35次APP版本迭代、29次内核更新、若干UX/UI优化') }}</div>
          <div>{{ $t('如今，Roxy 已拥有超过17600名注册用户，累计创建窗口超过4940000个') }}</div>
          <div>{{ $t('在此期间，我们不断升级服务资源与安全策略以对抗异常行为，并持续提供完全免费的服务') }}</div>
        </div>
        <div class="bold">{{ $t('在这样的用户增长趋势及负载下，我们决定于【2025.03.26】启动商业化运营') }}</div>
        <div>
          <div>{{ $t('而在此之前，我们仍会以可控成本提供尽可能的免费服务：') }}</div>
          <ul class="list-desc">
            <li>{{ $t('普通用户：20个窗口，1个额外工作空间（受邀注册或参与推广计划）') }}</li>
            <li>{{ $t('特邀用户：60个窗口，2个额外工作空间（通过老用户特邀码兑换）') }}</li>
            <li>{{ $t('创始用户：100个窗口，3个额外工作空间（2024.11.05前注册用户自动获得）') }}</li>
            <li>{{ $t('此外，所有创始用户和特邀用户都将在未来享有永久优惠权益') }}</li>
          </ul>
          <div>{{ $t('您可以随时点击右上角【我的权益】查看详情') }}</div>
        </div>
        <div>
          <div>{{ $t('在正式推出收费方案前，我们将持续提升产品性能及功能，包括但不限于：') }}</div>
          <ol class="list-desc">
            <li>{{ $t('窗口同步及排列功能、自定义UA支持（1月）') }}</li>
            <li>{{ $t('全局交互体验一致性优化') }}</li>
            <li>{{ $t('团队、工作空间及扩展功能逻辑优化') }}</li>
          </ol>
        </div>
        <div>
          <div>{{ $t('您的建议对 Roxy 的发展至关重要，欢迎通过技术支持或在官方社群中与我们联系。') }}</div>
        </div>
        <div>
          <div>{{ $t('Roxy 官方团队') }}</div>
          <div>2025.01.09</div>
        </div>
      </div>
    </div>
    <RxButton class="w-full mt-[16px] flex-shrink-0" :label="$t('了解')" @click="hide" />
  </div>
</template>


<style lang="scss" scoped>
.paid-plan {
  display: flex;
  width: var(--width-md, 560px);
  padding: 24px;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  overflow: hidden;

  .content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-self: stretch;
    overflow: hidden;

    .desc {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;
      color: var(--Colors-Text-text-secondary, #575D61);
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: 22px;
      overflow: auto;

      .list-desc {
        margin: 8px 0px;
        padding-left: 24px;
      }

      .bold {
        color: var(--Colors-Text-text-primary, #171C1F);
        font-size: 12px;
        font-style: normal;
        font-weight: 600;
        line-height: var(--Line-Height-text-sm, 18px);
      }
    }
  }
}
</style>
