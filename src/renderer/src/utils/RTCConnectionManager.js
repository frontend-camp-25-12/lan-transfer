export class RTCConnectionManager {
  constructor(hostname, connectionName, wsServer) {
    this.pc = new RTCPeerConnection()
    this.dataChannel = this.createDataChannel()
    this.wsClient = null
    this.wsServer = wsServer
    //本机名
    this.hostname = hostname
    //连接主机名
    this.connectionName = connectionName
    this.wsServer.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress.replace(/^.*:/, '')
      console.log(`接收到了来自${ip}的连接`)
      this.onOffer(ws)
      this.onClientCandidate(ws)
    })
  }

  //与目标设备建立ws连接
  initWsClient(ip, port) {
    return new Promise((resolve, reject) => {
      this.wsClient = new WebSocket(`ws://${ip}:${port}`)
      this.wsClient.onopen = () => {
        console.log(`已与${ip}建立ws连接`)
        resolve()
      }
    })
  }

  //与目标设备建立webRTC连接
  async createP2P(ip, port) {
    await this.initWsClient(ip, port)
    this.onAnswerAndCandidate()
    this.sendOffer()
  }

  //创建数据通道
  createDataChannel() {
    return this.pc.createDataChannel('fileTransfer', {
      ordered: true // 确保数据包顺序
      // maxRetransmits: 3 // 最大重传次数
    })
  }

  //监听由其他设备发来的offer
  onOffer(ws) {
    ws.on('message', (data) => {
      const message = JSON.parse(data)
      console.log(`接收消息`, message)
      // 处理收到的offer
      if (message.type === 'offer') {
        ElMessageBox.confirm(
          `接收到一个来自${message.hostname}的设备连接请求,请选择是否接受`,
          '提示',
          {
            confirmButtonText: '接受',
            cancelButtonText: '拒绝'
          }
        )
          .then(async () => {
            this.connectionName.value = message.hostname
            const answer = await this.handleOffer(message.offer)
            ws.send(JSON.stringify(answer))
            // 给当前连接发送ICE候选
            this.sendCandidate(ws)
          })
          .catch(() => {
            const msg = {
              type: 'reject',
              msg: `设备连接请求已被${this.hostname}拒绝`
            }
            ws.send(JSON.stringify(msg))
          })
      }
    })
  }

  //监听连接设备发来的answer和candidate候选
  onAnswerAndCandidate() {
    this.wsClient.onmessage = (messageEvent) => {
      const message = JSON.parse(messageEvent.data)
      switch (message.type) {
        case 'answer': {
          console.log(`收到来自${messageEvent.origin}的answer`)
          this.pc.setRemoteDescription(
            new RTCSessionDescription({
              type: message.type,
              sdp: message.sdp
            })
          )
          break
        }
        case 'candidate': {
          console.log(`收到来自${messageEvent.origin}的candidate`)
          this.pc.addIceCandidate(new RTCIceCandidate(message.candidate))
          break
        }
        case 'reject': {
          ElMessageBox.alert(message.msg, '提示', {
            confirmButtonText: '确定',
            callback: (action) => {
              this.connectionName.value = ''
            }
          })
        }
      }
    }
  }

  //监听其他连接设备发来的candidate候选，注:是作为ws服务端接收,也就是接收连接发起方的candidate
  onClientCandidate(ws) {
    ws.on('message', async (data) => {
      const message = JSON.parse(data)
      console.log(`接收消息`, message)
      // 处理收到的candidate
      if (message.type === 'canditate') {
        this.pc.addIceCandidate(new RTCIceCandidate(message.candidate))
      }
    })
  }

  //发送candidate候选
  sendCandidate(ws) {
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        // 通过信令通道将候选发送给B
        const message = {
          type: 'candidate',
          candidate
        }
        ws.send(JSON.stringify(message))
      }
    }
  }

  //向目标设备发送offer协商
  sendOffer() {
    //生成offer并设置本地描述
    this.pc
      .createOffer()
      .then((offer) => this.pc.setLocalDescription(offer))
      .then(() => {
        const msg = {
          type: 'offer',
          hostname: this.hostname,
          offer: this.pc.localDescription
        }
        // 通过wsClient将offer发送给目标设备
        this.wsClient.send(JSON.stringify(msg))
      })
    //交换候选
    this.sendCandidate(this.wsClient)
  }

  //处理收到的offer协商
  handleOffer(message) {
    const offer = new RTCSessionDescription({
      type: message.type,
      sdp: message.sdp
    })
    return this.createAnswer(offer)
  }

  //生成answer
  async createAnswer(offer) {
    return this.pc
      .setRemoteDescription(offer)
      .then(() => this.pc.createAnswer())
      .then((answer) => {
        this.pc.setLocalDescription(answer)
        return answer
      })
  }

  //监听rtc连接变化
  onConnectionState(callback) {
    this.pc.addEventListener('connectionstatechange', () => {
      const state = this.pc.connectionState
      console.log('Peer连接状态:', state)
      callback(state)
      if (state === 'connected') {
        console.log('✅ 成功建立P2P连接！')
      }
    })
  }
}
