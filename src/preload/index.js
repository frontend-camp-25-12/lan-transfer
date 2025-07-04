// const ws = require('./node_modules/ws/index.js')
// const bufferUtil = require('./node_modules/ws/lib/buffer-util.js')

// const fs = require('fs')
// const os = require('os')
// const dgram = require('dgram')
// const path = require('path')
import ws from 'ws'
import fs from 'fs'
import os from 'os'
import dgram from 'dgram'
import path from 'path'
// window.bufferUtil = bufferUtil // 可选，暴露给渲染进程
window.os = os
window.dgram = dgram
window.ws = ws
window.wsPort = 8080
window.hostname = os.hostname()
window.BufferFrom = Buffer.from
let platform
window.fs = fs
window.path = path

if (process.platform === 'darwin') {
  platform = 'mac'
} else if (process.platform === 'win32') {
  platform = 'win32'
}

window.platform = platform
window.defaultSaveDir = path.join(os.homedir(), 'Desktop')
