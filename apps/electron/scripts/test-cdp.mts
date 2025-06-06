import CDP from 'chrome-remote-interface'

async function example() {
  let client;
  try {
    // connect to endpoint
    client = await CDP({ target: 'ws://localhost:9222/devtools/browser' });
    // extract domains
    const { Page } = client;
    // setup handlers
    // enable events then start!
    // await Page.enable();
    // await Page.navigate({ url: 'https://github.com' });
    // await Page.loadEventFired();

    // const { targetId } = await client.Target.createTarget({ url: 'https://baidu.com', })
    // const { targetInfo } = await client.Target.getTargetInfo({ targetId })

  } catch (err) {
    console.error(err);
  } finally {
    if (client) {
      // await client.close();
    }
  }
}

example();