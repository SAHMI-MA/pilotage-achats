// lib/read-excel.ts
import Excel from "exceljs";
import JSZip from "jszip";
async function readExcel(buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const entries = Object.values(archive.files);
  if (entries.length > 2e3) throw Error("Ce classeur contient trop d\u2019\xE9l\xE9ments. Importez uniquement la feuille de suivi.");
  let expanded = 0;
  for (const entry of entries) {
    expanded += entry._data?.uncompressedSize || 0;
  }
  if (expanded > 80 * 1024 * 1024) throw Error("Le classeur d\xE9compress\xE9 est trop volumineux. Importez une feuille plus petite.");
  let changed = false;
  for (const entry of entries) {
    if (entry.dir || !/\.xml$|\.rels$/i.test(entry.name)) continue;
    let xml = await entry.async("string");
    const original = xml;
    const matches = [...xml.matchAll(/xmlns:([A-Za-z_][A-Za-z0-9_.-]*)="(http:\/\/schemas\.openxmlformats\.org\/(?:spreadsheetml\/2006\/main|package\/2006\/(?:relationships|content-types)))"/g)];
    for (const match of matches) {
      const prefix = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      xml = xml.replace(new RegExp(`<(/?)${prefix}:`, "g"), "<$1").replace(match[0], `xmlns="${match[2]}"`);
    }
    if (xml !== original) {
      changed = true;
      archive.file(entry.name, xml);
    }
  }
  const source = changed ? await archive.generateAsync({ type: "arraybuffer" }) : buffer;
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(source, { ignoreNodes: ["tableParts", "drawing", "extLst", "conditionalFormatting", "dataValidations"] });
  return workbook;
}
export {
  readExcel
};
