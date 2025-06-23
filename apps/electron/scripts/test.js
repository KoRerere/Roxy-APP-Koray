const si = require('systeminformation');
const crypto = require('crypto');

async function getDeviceFingerprint() {
  try {
    const uuid = (await si.system()).uuid || '';
    const bios = (await si.bios()).serial || '';
    const baseboard = (await si.baseboard()).serial || '';
    const cpu = (await si.cpu()).processorId || '';
    const disk = ((await si.diskLayout())[0]?.serialNum || '').trim();
    const mac = ((await si.networkInterfaces()).find(iface => iface.mac && iface.mac !== '00:00:00:00:00:00')?.mac || '').trim();
    console.log('uuid', uuid)
    console.log('bios', bios)
    console.log('baseboard', baseboard)
    console.log('cpu', cpu)
    console.log('disk', disk)
    console.log('mac', mac)
    console.log('UUUUU', await si.uuid())
    const raw = `${uuid}|${bios}|${baseboard}|${cpu}|${disk}|${mac}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');

    return {
      raw,
      fingerprint: hash
    };
  } catch (err) {
    console.error('Failed to get hardware info:', err);
    return null;
  }
}

getDeviceFingerprint().then(result => {
  if (result) {
    console.log('Raw Data:', result.raw);
    console.log('Fingerprint (SHA256):', result.fingerprint);
  }
});