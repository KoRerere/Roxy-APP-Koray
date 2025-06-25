const si = require('systeminformation');

async function getDeviceFingerprint() {
  console.log('UUUUU', await si.uuid())
}

getDeviceFingerprint()
