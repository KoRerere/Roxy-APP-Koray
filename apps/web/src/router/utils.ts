import router from "/@/router"

export function getBackRoute() {
  const backUrl = String(router.options.history.state.back)
  const search = new URLSearchParams(backUrl.split('?')[1])
  const query = Object.assign(Object.fromEntries(search.entries()), router.currentRoute.value.query)
  return { path: backUrl.split('?')[0], query }
}
