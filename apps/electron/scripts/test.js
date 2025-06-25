const si = require('systeminformation');
const crypto = require('crypto');

async function getDeviceFingerprint() {

  console.log('UUUUU', await si.uuid())

}

getDeviceFingerprint() 