<template>
    <div class="sidebar">
        <div class="sidebar-header">
            <div class="logo"><i class="fa-solid fa-bolt"></i> FlashTransfer</div>
        </div>
        <div class="sidebar-device"><i class="fa-solid fa-laptop"></i> {{ hostname }}</div>
        <div v-if="deviceList.length === 0" class="empty">
            <div class="empty-msg">附近暂无设备</div>
        </div>
        <div v-else class="sidebar-list">
            <div v-for="item in deviceList" class="device-item" :class="{ selected: item.name === transferStore.name }"
                @click="handleConnect(item)">
                <div class="device-avatar"><i class="fa-solid fa-laptop"></i></div>
                <div>{{ item.name }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTransferStore } from '../../../store/transferStore'

const transferStore = useTransferStore()
const hostname = transferStore.hostname
//开始udp广播
transferStore.startUDOBroadcast()
//初始化wsServer
transferStore.startWebSocketServer()
//创建连接管理类
transferStore.createConnectionManager()

//向目标设备发起rtc连接
async function handleConnect(item) {
    transferStore.name = item.name
    transferStore.setDevice(item)
    transferStore.transferState = 'send'
    transferStore.connectionToDevice(item.ip, item.port)
}

const deviceList = computed(() => {
    const deviceList = []
    for (const device of transferStore.devices.values()) {
        deviceList.push(device)
    }
    return deviceList
})
</script>

<style scoped>
.header {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 20px;
}

.device-list-item {
    background-color: pink;
    padding: 10px;
    cursor: pointer;
}

.device-list-item:hover {
    background-color: #fff;
}

.sidebar {
    position: relative;
    width: 260px;
    background: var(--sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 0;
    height: 100%;
}

.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 20px 12px 20px;
}

.sidebar-header .logo {
    font-size: 1.5em;
    font-weight: bold;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.sidebar-header .logo i {
    color: var(--primary);
}

.sidebar-header .sidebar-actions {
    display: flex;
    gap: 10px;
}

.sidebar-device {
    padding: 0 20px 8px 20px;
    font-size: 0.98em;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 8px;
}

.empty {
    color: var(--primary);
    flex: 1;
}

.empty-msg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.sidebar-list {
    flex: 1;
    padding: 0 8px;
    margin-top: 12px;
}

.device-item {
    display: flex;
    align-items: center;
    background: var(--card);
    border-radius: var(--radius);
    margin-bottom: 8px;
    padding: 12px 16px;
    cursor: pointer;
    border: 2px solid transparent;
    transition:
        border 0.2s,
        background 0.2s;
}

.selected {
    border: 2px solid var(--primary);
    background: #e8f0fe;
}

.device-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #e0e7ef;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2em;
    margin-right: 12px;
}

.sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 0 18px 0;
    align-items: center;
    border-top: 1px solid var(--border);
}

.sidebar-nav i {
    color: var(--muted);
    font-size: 1.2em;
    cursor: pointer;
    transition: color 0.2s;
}

.sidebar-nav i:hover {
    color: var(--primary);
}

.config-header {
    display: flex;
    justify-content: space-between;
}

.hostname-config {
    display: flex;
    height: 30px;
}

.hostname {
    line-height: 30px;
}

.hostname-input {
    margin-left: 10px;
    width: 80%;
}

.save-directory-config {
    display: flex;
    height: 30px;
}

.path {
    margin-left: 5px;
}

.dir-edit {
    color: var(--primary);
    cursor: pointer;
}
</style>
