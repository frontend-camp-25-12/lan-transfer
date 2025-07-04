<template>
    <div class="file-area-container">
        <div v-if="transferStore.status === 'connected'" class="main">
            <div class="main-header">
                <div class="title">{{ transferStore.name }}</div>
                <div class="filter-btn">
                    <el-button :type="transferStore.transferState === 'recv' ? 'primary' : ''"
                        @click="transferStore.transferState = 'recv'">我收到的</el-button>

                    <el-button :type="transferStore.transferState === 'send' ? 'primary' : ''"
                        @click="transferStore.transferState = 'send'">我发送的</el-button>
                </div>
                <div class="action-btn">
                    <div v-show="transferStore.transferState === 'send'" class="start-transfer-btn">
                        <el-button type="primary" @click="handleFileTransfer">开始传输</el-button>
                    </div>
                    <div v-show="transferStore.status === 'connected'" class="start-transfer-btn">
                        <el-button type="danger" @click="handleQuit">退出</el-button>
                    </div>
                </div>
            </div>
            <div class="main-content" @drop.prevent="handleFileDrop" @dragover.prevent="">
                <div v-for="item in fileTransMapList" :key="item.fileId" class="msg">
                    <div class="msg-file">
                        <i class="fa-regular fa-file"></i>
                        <div class="file-info-container">
                            <div class="file-info">
                                <div class="file-name">{{ item.filename }}</div>
                                <div class="file-size">
                                    {{ item.size }}
                                </div>
                                <div class="transfer-btn">
                                    <div class="cancel">
                                        <i class="fa-solid fa-xmark" @click="deleteFileRecv(item.fileId)"></i>
                                    </div>
                                </div>
                            </div>
                            <div class="progress"><el-progress :percentage="item.progress" /></div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="transferStore.transferState === 'send'" class="main-footer">
                <div class="footer-actions">
                    <i class="fa-solid fa-folder-open" title="文件夹" @click="invokeFileInput"></i>
                    <input ref="fileInput" style="display: none" type="file" @change="handleAddFile" />
                </div>
                <div class="tips">拖拽文件到上面空白处或点击左侧按钮进行传输</div>
            </div>
        </div>
        <div v-else class="empty">请先选择要传输文件的设备</div>
    </div>
</template>

<script setup>
import { useTransferStore } from '../../../store/transferStore'
import { useTemplateRef, computed } from 'vue'

const transferStore = useTransferStore()
const fileTransMap = transferStore.fileTransMap
const fileInput = useTemplateRef('fileInput')

function handleQuit() {
    transferStore.closeConnection()
}

const fileTransMapList = computed(() => {
    const list = []
    let transferSize
    for (const file of fileTransMap.values()) {
        if (file.type === 'send') {
            transferSize = file.offset
        } else {
            transferSize = file.receivedSize
        }
        const progress = Math.round((transferSize * 100) / file.size)
        if (transferStore.transferState === file.type) {
            list.push({
                fileId: file.fileId,
                filename: file.filename,
                size: getFileSize(file.size),
                progress
            })
        }
    }
    return list
})

const fileToTransfer = computed(() => {
    const list = []
    for (const file of fileTransMap.values()) {
        if (!file.transfered && file.type === 'send') {
            list.push(file)
        }
    }
    return list
})

function deleteFileRecv(fileId) {
    fileTransMap.delete(fileId)
}

let fileId
const MAX_BUFFERED_AMOUNT = 4 * 1024 * 1024 // 4MB
const LOW_BUFFERED_AMOUNT = 1 * 1024 * 1024 // 1MB
function sendFile(file) {
    return new Promise((resolve, reject) => {
        fileTransMap.get(fileId).resolve = resolve
        const CHUNK_SIZE = 16 * 1024 // 16KB 分片
        let offset = 0
        let paused = false

        // 1. 发送文件元数据
        transferStore.dataChannel.send(
            JSON.stringify({
                type: 'metadata',
                fileId: fileId,
                name: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream'
            })
        )

        // 2. 分片发送文件数据
        function readNext() {
            if (paused) return
            if (offset >= file.size) {
                fileTransMap.get(fileId).transfered = true
                console.log('文件发送完成')
                return
            }
            // 流控：如果缓冲区太大，暂停发送
            if (transferStore.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
                paused = true
                // 监听bufferedamountlow事件
                transferStore.dataChannel.bufferedAmountLowThreshold = LOW_BUFFERED_AMOUNT
                transferStore.dataChannel.addEventListener('bufferedamountlow', onBufferedAmountLow)
                return
            }

            const slice = file.slice(offset, offset + CHUNK_SIZE)
            const reader = new FileReader()

            reader.onload = (e) => {
                const buffer = e.target.result
                transferStore.dataChannel.send(
                    JSON.stringify({
                        type: 'chunk',
                        fileId: fileId,
                        offset: offset,
                        size: buffer.byteLength
                    })
                )
                transferStore.dataChannel.send(buffer) // 发送二进制数据

                offset += buffer.byteLength
                fileTransMap.get(fileId).offset = offset
                setTimeout(readNext, 0) // 避免阻塞
            }
            reader.readAsArrayBuffer(slice)
        }

        function onBufferedAmountLow() {
            paused = false
            transferStore.dataChannel.removeEventListener('bufferedamountlow', onBufferedAmountLow)
            readNext()
        }

        readNext()
    })
}

function invokeFileInput() {
    fileInput.value.click()
}

function handleAddFile(e) {
    const file = e.target.files[0]
    const transferInfo = initTransferInfo(file)
    fileTransMap.set(transferInfo.fileId, transferInfo)
}

async function handleFileTransfer() {
    if (fileToTransfer.value.length === 0) {
        ElMessage({
            message: '当前没有可发送的文件',
            type: 'warning'
        })
        return
    }
    for (const file of fileToTransfer.value) {
        if (!file.transfered) {
            fileId = file.fileId
            await transferStore.sendFile(fileId, file.file)
            // sendFile(file.file)
        }
    }
    ElMessage({
        message: '文件传输成功！',
        type: 'success'
    })
    return
}

function handleFileDrop(e) {
    if (transferStore.transferState === 'recv') {
        return
    }
    for (const item of e.dataTransfer.items) {
        const entry = item.webkitGetAsEntry()
        parseDirectoryEntry(entry)
    }
}

function parseDirectoryEntry(entry, path = '') {
    if (entry.isFile) {
        //文件
        entry.file((file) => {
            file.path = path
            const transferInfo = initTransferInfo(file)
            fileTransMap.set(transferInfo.fileId, transferInfo)
        })
    }
    if (entry.isDirectory) {
        //文件夹
        const reader = entry.createReader()
        reader.readEntries((entries) => {
            for (const item of entries) {
                parseDirectoryEntry(item, `${path}${entry.name}/`)
            }
        })
    }
}

function initTransferInfo(file) {
    const path = file.path !== '' ? file.path : ''
    const fileId = Date.now()
    return {
        fileId,
        filename: file.name,
        size: file.size,
        offset: 0,
        file: file,
        type: 'send',
        transfered: false
    }
}
function getFileSize(size) {
    const unit = ['B', 'KB', 'MB', 'GB', 'TB']
    let idx = 0
    while (size / 1024 > 1) {
        size /= 1024
        idx++
    }
    return `${Math.ceil(size)}${unit[idx]}`
}
</script>

<style scoped>
.file-area-container {
    position: relative;
    flex: 1;
    height: 100%;
    background: var(--bg);
}

.main {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.empty {
    color: var(--primary);
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}

.main-header {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
}

.main-header .title {
    font-size: 1.1em;
    font-weight: 500;
}

.filter-btn {
    display: flex;
    gap: 10px;
}

button:focus {
    outline: none;
}

.action-btn {
    display: flex;
    gap: 10px;
}

.main-content {
    flex: 1;
    padding: 24px 32px 0 32px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.msg {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    margin-bottom: 8px;
}

.msg .msg-bubble {
    background: var(--card);
    border-radius: var(--radius);
    padding: 12px 16px;
    box-shadow: var(--shadow);
    max-width: 340px;
    word-break: break-all;
    font-size: 1em;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.msg .msg-meta {
    color: var(--muted);
    font-size: 0.85em;
    margin-bottom: 2px;
    align-self: flex-end;
}

.msg-file {
    background: var(--card);
    border-radius: var(--radius);
    padding: 10px 16px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--shadow);
    /* min-width: 130px; */
    width: 100%;
    font-size: 0.98em;
    box-sizing: border-box;
}

.msg-file .fa-file {
    color: var(--primary);
    font-size: 1.5em;
}

.msg-file .file-info-container {
    flex: 1;
}

.msg-file .file-info {
    display: flex;
    justify-content: space-between;
}

.msg-file .file-name {
    font-weight: 500;
    margin-bottom: 2px;
}

.msg-file .file-size {
    margin-left: -200px;
    color: var(--muted);
    font-size: 0.9em;
}

.msg-file .transfer-btn {
    display: flex;
}

.msg-file .file-action {
    color: var(--primary);
    cursor: pointer;
    font-size: 1.2em;
    margin-left: 8px;
}

.msg-file .file-action:hover {
    color: #1746a2;
}

.main-footer {
    height: 55px;
    background: var(--card);
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 0 24px;
    gap: 12px;
}

.main-footer .footer-actions {
    display: flex;
    gap: 16px;
}

.main-footer .footer-actions i {
    color: var(--muted);
    font-size: 1.2em;
    cursor: pointer;
    transition: color 0.2s;
}

.main-footer .footer-actions i:hover {
    color: var(--primary);
}

.main-footer input {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 14px;
    font-size: 1em;
    background: #f9f9fb;
    margin-right: 8px;
}

.main-footer button {
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 1.2em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.main-footer button:active {
    background: #1746a2;
}

.tips {
    text-align: center;
    color: var(--muted);
}

/* 滚动条美化 */
/* ::-webkit-scrollbar {
    width: 8px;
    background: #f3f4f6;
}

::-webkit-scrollbar-thumb {
    background: #e0e7ef;
    border-radius: 8px;
} */
</style>
