const si = require('systeminformation');

async function getDeviceFingerprint() {
  console.log('uuid', await si.uuid())
}

getDeviceFingerprint()