globalThis.onmessage = (event) => {
  const { duration, remainingTime, interval } = event.data
  let elapsed = duration - remainingTime

  const timer = setInterval(() => {
    elapsed += interval / 1000
    const progress = (elapsed / duration).toFixed(10)

    // 向主线程发送进度
    globalThis.postMessage({ progress })

    if (elapsed >= duration) {
      clearInterval(timer)
      globalThis.postMessage({ completed: true })
    }
  }, interval)
}
