if (!Promise.withResolvers) {
  // @ts-expect-error 不需要检测
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// vite 将 CJS 依赖打包为 ESM 时，绝大多数 CJS 模块的 __dirname 会被静态替换为
// import.meta.dirname；但极少数（如 node-cron 的 background-scheduled-task）顶层
// 裸用 __dirname 却未被替换，导致 ESM 运行时 ReferenceError，模块求值阶段直接崩溃。
// 这里补一个全局兜底。值无关紧要：node-cron 仅在实例化 BackgroundScheduledTask
// （fork daemon 子进程执行任务）时才使用该路径，而我们只用进程内的 cron.schedule，
// 从不实例化 BackgroundScheduledTask，故 daemonPath 永不被实际使用，仅需赋值不抛错。
if (typeof (globalThis as any).__dirname === 'undefined') {
  try {
    (globalThis as any).__dirname = import.meta.dirname ?? process.cwd()
  }
  catch {
    (globalThis as any).__dirname = process.cwd()
  }
}
