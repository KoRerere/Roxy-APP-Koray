import inspector from 'inspector';

function enableDebugger() {
  try {
    // 检查是否已经开启了调试器
    if (inspector.url()) {
      console.log('Debugger already enabled:', inspector.url());
      return;
    }

    // 只在特定条件下启用调试器
    inspector.open(9237, '127.0.0.1', false);
    console.debug('Debugger started on ws://127.0.0.1:9237');
  } catch (error) {
    console.warn('Failed to enable debugger:', error);
  }
}

enableDebugger();
