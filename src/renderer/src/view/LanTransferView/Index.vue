<template>
    <div class="lan-transfer-view-container">
        <div class="left">
            <slot name="left"></slot>
        </div>
        <div class="right">
            <slot name="right"></slot>
        </div>
    </div>
</template>

<script setup></script>

<style scoped>
.lan-transfer-view-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    min-width: 800px;
    color: #409eff;
    background-color: #f2f2f2;
}

.left {
    width: 260px;
}

.right {
    flex: 1;
}
</style>
