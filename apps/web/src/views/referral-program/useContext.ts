interface ReferralProgramContext {
  getPromotionInfo: () => Promise<void>
}

const injectionKey = Symbol('referralProgram') as InjectionKey<ReferralProgramContext>

export function provideReferralProgram(params: ReferralProgramContext) {
  provide(injectionKey, params)
}

export function useReferralProgram() {
  return inject(injectionKey)!
}
