// utils/excelReader.js
import xlsx from "xlsx";

export function readExcelFromFile(filePath:string) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  return xlsx.utils.sheet_to_json(sheet, {
    defval: null,
    raw: true,
  });
}
