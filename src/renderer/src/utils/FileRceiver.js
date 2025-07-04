export class FileReceiver {
  constructor(fileId, name, filePath, size, mimeType, fileTransMap) {
    this.fileId = fileId
    this.name = name
    this.filePath = filePath
    this.receivedSize = 0
    this.size = size
    this.mimeType = mimeType
    this.offset = 0
    this.fileTransMap = fileTransMap
    // 创建写入流
    try {
      this.writeStream = window.fs.createWriteStream(filePath, { flags: 'w' })
    } catch (e) {
      console.log('创建文件失败', e)
    }
  }

  writeBuffer(buffer) {
    if (this.writeStream) {
      this.writeStream.write(buffer)
      this.receivedSize += buffer.length
      this.fileTransMap.value.get(this.fileId).receivedSize = this.receivedSize
      // 检查是否完成
      if (this.receivedSize >= this.size) {
        this.writeStream.end()
        return true
      }
    }
    return false
  }
}
