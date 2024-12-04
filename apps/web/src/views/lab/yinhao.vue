<script setup lang="ts">
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();

const columns = [
  {
    header: '编号',
    key: 'id',
    width: 10,
  },
  {
    header: '姓名',
    key: 'name',
    width: 30
  },
  {
    header: '年龄',
    key: 'age',
    width: 10
  },
].map(column => ({
  ...column,
  style: {
    alignment: { wrapText: true, horizontal: 'left', vertical: 'middle' } as any,
  }
}));

const datas = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  name: 'This is a long description\nwith a line break.\n111111\n22222222\n33333333',
  age: Math.floor(Math.random() * 100) + 10
}))

async function download() {
  const worksheet = workbook.addWorksheet('Styled Sheet');
  // 添加多行数据并设置单元格内容换行
  worksheet.columns = columns;
  worksheet.getRow(1).font = { bold: true, size: 16, name: 'Arial' }; // 表头加粗
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFE599' },
  };

  // 合并单元格
  worksheet.addRow([[], [], []]);
  worksheet.mergeCells(2, 1, 4, columns.length);//按开始行，开始列，结束行，结束列合并
  const mergedCell = worksheet.getCell('A2');
  mergedCell.value = 'Merged Header';
  mergedCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mergedCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFCCE5FF' }, // 浅蓝色背景
  };

  datas.forEach(data => {
    worksheet.addRow(data);
  });


  // 将工作簿转换为 Blob 并下载
  const uint8Array = await workbook.xlsx.writeBuffer();
  const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${new Date().getTime()}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}


function parse() {

}
</script>

<template>
  <div class="flex justify-end gap-5">
    <RxButton label="下载" @click="download" />
    <RxButton label="解析" @click="parse" />
  </div>
</template>
