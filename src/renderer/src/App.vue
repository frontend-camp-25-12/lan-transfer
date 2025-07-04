<script setup>
import LanTransferView from './view/LanTransferView/Index.vue';
import DeviceList from './view/LanTransferView/DeviceList/Index.vue'
import FileArea from './view/LanTransferView/FIleArea/Index.vue'
</script>

<template>
  <LanTransferView>
    <template #left>
      <DeviceList />
    </template>
    <template #right>
      <FileArea></FileArea>
    </template>
  </LanTransferView>
</template>

<style scoped></style>
