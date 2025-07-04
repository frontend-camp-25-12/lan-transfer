import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DeviceDiscovery } from '../utils/DeviceDiscovery'
import { RTCConnectionManager } from '../utils/RTCConnectionManager'
import { FileReceiver } from '../utils/FileRceiver'
import { FileSender } from '../utils/FileSender'

export const useTransferStore = defineStore('transferStore', () => {
  //附近的设备
  const devices = ref(new Map())
  //当前建立连接的主机
  const device = ref()
  //本机主机名
  const hostname = window.hostname
  //从preload.js注入的node模块以及一些全局属性
  const ws = window.ws
  const path = window.path
  const wsPort = window.wsPort
  let wsServer
  const receiveDir = window.receiveDir
  //连接的设备名
  const name = ref('')
  //当前连接状态
  const status = ref('')
  //设备发现类，只有一个实例
  let deviceDiscovery
  //传输状态，用于标识当前是在接收文件还是在发送文件
  const transferState = ref('recv')
  //RTC连接管理类
  let connectionManager
  //所有传输文件，包括当前传输和接收到的文件
  const fileTransMap = ref(new Map())

  //清理连接
  function clear() {
    name.value = ''
    status.value = ''
    if (connectionManager && connectionManager.dataChannel) {
      connectionManager.dataChannel.onmessage = null
      connectionManager.dataChannel.close()
    }
    if (connectionManager && connectionManager.pc) {
      connectionManager.pc.close()
    }
    device.value = null
    fileTransMap.value.clear()
  }

  //连接状态同步
  function changeState(newState) {
    status.value = newState
  }

  //UDP广播
  function startUDOBroadcast() {
    deviceDiscovery = new DeviceDiscovery(devices, wsPort)
    deviceDiscovery.start()
  }

  //websocket服务，用于接收连接
  function startWebSocketServer() {
    wsServer = new ws.Server({ port: wsPort }, () => {
      console.log(`websocket opened at port ${wsPort}`)
    })
  }

  //当前正在接收的文件
  let fileRceiver

  //dataChannel消息处理
  function handleMessage(e) {
    const data = e.data
    if (typeof data === 'string') {
      const msg = JSON.parse(data)
      if (msg.type === 'metadata') {
        console.log(`接收消息 `, msg)
        //记录当前接收文件的元数据
        const fileRecv = {
          fileId: msg.fileId,
          filename: msg.name,
          receivedSize: 0,
          size: msg.size,
          mimeType: msg.mimeType,
          type: 'recv'
        }
        fileTransMap.value.set(msg.fileId, fileRecv)
        const filePath = path.join(receiveDir, msg.name)
        fileRceiver = new FileReceiver(
          msg.fileId,
          msg.name,
          filePath,
          msg.size,
          msg.mimeType,
          fileTransMap
        )
        transferState.value = 'recv'
        console.log(`开始接收文件：${msg.name}`)
      } else if (msg.type === 'chunk') {
        //更新当前分片的偏移量
        fileRceiver.offset = msg.offset
      } else if (msg.type === 'confirm') {
        console.log(msg.fileId)
        console.log(fileTransMap.value.get(msg.fileId))
        fileTransMap.value.get(msg.fileId).resolve()
      } else if (msg.type === 'quit') {
        //连接已断开，将当前连接的传输信息全部清空
        ElMessageBox.alert('对方已将连接断开', '提示', {
          confirmButtonText: '确定',
          callback: (action) => {
            clear()
            connectionManager.dataChannel.close()
            createConnectionManager()
          }
        })
      }
    } else if (data instanceof ArrayBuffer) {
      try {
        const buffer = window.BufferFrom(data)
        if (fileRceiver.writeBuffer(buffer)) {
          const msg = {
            type: 'confirm',
            fileId: fileRceiver.fileId
          }
          connectionManager.dataChannel.send(JSON.stringify(msg))
          console.log(`文件保存完成：${fileRceiver.filePath}`)
        }
      } catch (err) {
        console.error('写入文件失败:', err)
      }
    }
  }

  //创建连接管理类
  function createConnectionManager() {
    connectionManager = new RTCConnectionManager(hostname, name, wsServer)
    //监听连接状态
    connectionManager.onConnectionState((state) => {
      if (status.value === 'connected' && state !== 'connected') {
        //连接已断开，将当前连接的传输信息全部清空
        ElMessageBox.alert('当前连接已断开，请稍后再试', '提示', {
          confirmButtonText: '确定',
          callback: (action) => {}
        })
        clear()
        //创建新的连接管理实例
        createConnectionManager()
      } else {
        status.value = state
      }
    })
    connectionManager.dataChannel.onopen = () => {
      connectionManager.pc.ondatachannel = ({ channel }) => {
        channel.onmessage = handleMessage
      }
    }
  }
  //发起webRTC连接
  async function connectionToDevice(ip, port) {
    await connectionManager.createP2P(ip, port)
  }
  //设置当前连接设备
  function setDevice(dev) {
    device.value = dev
  }
  //当前正在发送的文件
  let fileSender
  //发送文件函数
  async function sendFile(fileId, file) {
    fileSender = new FileSender(fileId, file, connectionManager.dataChannel, fileTransMap)
    await fileSender.sendFile()
  }

  //主动关闭连接时调用的函数
  function closeConnection() {
    const message = {
      type: 'quit'
    }
    connectionManager.dataChannel.send(JSON.stringify(message))
    clear()
    //创建新的连接管理类
    createConnectionManager()
  }

  return {
    name,
    deviceDiscovery,
    startUDOBroadcast,
    fileTransMap,
    status,
    transferState,
    connectionManager,
    clear,
    changeState,
    hostname,
    wsServer,
    startWebSocketServer,
    createConnectionManager,
    devices,
    device,
    setDevice,
    connectionToDevice,
    sendFile,
    closeConnection
  }
})
