const MAX_BUFFERED_AMOUNT = 4 * 1024 * 1024 // 4MB
const LOW_BUFFERED_AMOUNT = 1 * 1024 * 1024 // 1MB
const CHUNK_SIZE = 8 * 1024

export class FileSender {
  constructor(fileId, file, dataChannel, fileTransMap) {
    this.fileId = fileId
    this.dataChannel = dataChannel
    this.file = file
    this.offset = 0
    this.paused = false
    this.fileTransMap = fileTransMap
  }

  sendFile() {
    return new Promise((resolve, reject) => {
      this.fileTransMap.value.get(this.fileId).resolve = resolve
      // 1. 发送文件元数据
      this.dataChannel.send(
        JSON.stringify({
          type: 'metadata',
          fileId: this.fileId,
          name: this.file.name,
          size: this.file.size,
          mimeType: this.file.type || 'application/octet-stream'
        })
      )

      this.readNext()
    })
  }

  //移除监听器
  onBufferedAmountLow() {
    this.paused = false
    this.dataChannel.removeEventListener('bufferedamountlow', this.onBufferedAmountLow)
    this.readNext()
  }

  //分片发送文件数据
  readNext() {
    if (this.paused) return
    if (this.offset >= this.file.size) {
      this.fileTransMap.value.get(this.fileId).transfered = true
      //   this.fileTrans.transfered = true
      console.log('文件发送完成')
      return
    }
    // 流控：如果缓冲区太大，暂停发送
    if (this.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      this.paused = true
      // 监听bufferedamountlow事件
      this.dataChannel.bufferedAmountLowThreshold = LOW_BUFFERED_AMOUNT
      this.dataChannel.addEventListener('bufferedamountlow', this.onBufferedAmountLow.bind(this))
      return
    }

    const slice = this.file.slice(this.offset, this.offset + CHUNK_SIZE)
    const reader = new FileReader()

    reader.onload = (e) => {
      const buffer = e.target.result
      this.dataChannel.send(
        JSON.stringify({
          type: 'chunk',
          fileId: this.fileId,
          offset: this.offset,
          size: buffer.byteLength
        })
      )
      this.dataChannel.send(buffer) // 发送二进制数据

      this.offset += buffer.byteLength
      this.fileTransMap.value.get(this.fileId).offset = this.offset
      setTimeout(this.readNext.bind(this), 0) // 避免阻塞
    }
    reader.readAsArrayBuffer(slice)
  }
}
