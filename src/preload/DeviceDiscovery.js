import dgram from 'dgram'
import os from 'os'

export class DeviceDiscovery {
  constructor(devices, wsPort) {
    this.devices = devices
    this.udpSocket = dgram.createSocket('udp4')
    this.localDeviceInfo = {
      name: os.hostname(),
      ip: this.getLocalIP(),
      port: wsPort
    }
  }

  // 启动设备发现服务
  start() {
    // 启动UDP广播
    this.startUDPBroadcast()
  }

  // 获取本地IP地址
  getLocalIP() {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }
    return '127.0.0.1'
  }

  // UDP广播设备存在
  startUDPBroadcast() {
    console.log('开始UPD广播')
    const port = 41234
    const broadcastAddress = '255.255.255.255'

    this.udpSocket.bind(port, () => {
      this.udpSocket.setBroadcast(true)

      // 定期发送广播
      setInterval(() => {
        const message = JSON.stringify({
          type: 'announce',
          device: this.localDeviceInfo
        })
        this.udpSocket.send(message, port, broadcastAddress)
      }, 5000)
    })

    // 监听广播消息
    this.udpSocket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg)
        if (data.type === 'announce' && data.device.ip !== this.localDeviceInfo.ip) {
          this.addDevice(data.device)
        }
      } catch (e) {
        console.error('Parse error:', e)
      }
    })

    // 定期清理不在线的设备
    setInterval(() => {
      for (const device of this.devices.value.values()) {
        const now = Date.now()
        if (now - device.lastSeen > 5000) {
          this.removeDevice(device)
        }
      }
    }, 6000)
  }

  // 添加设备到列表，更新设备在线状态
  addDevice(device) {
    if (!this.devices.value.has(device.ip)) {
      this.devices.value.set(device.ip, {
        ...device,
        lastSeen: Date.now()
      })
      console.log('添加设备')
    } else {
      const ds = this.devices.value.get(device.ip)
      ds.lastSeen = Date.now()
    }
  }

  //删除设备
  removeDevice(device) {
    this.devices.value.delete(device.ip)
    console.log('删除设备')
  }
}
