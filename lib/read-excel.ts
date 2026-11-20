import Excel from "exceljs";
import JSZip from "jszip";
// Some valid workbooks qualify all spreadsheet tags with a namespace prefix.
// ExcelJS expects the default namespace; normalize that representation before reading.
export async function readExcel(buffer:ArrayBuffer|Uint8Array){
 const archive=await JSZip.loadAsync(buffer);const entries=Object.values(archive.files);if(entries.length>2000)throw Error("Ce classeur contient trop d’éléments. Importez uniquement la feuille de suivi.");let expanded=0;
 for(const entry of entries){expanded+=(entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize||0;}if(expanded>80*1024*1024)throw Error("Le classeur décompressé est trop volumineux. Importez une feuille plus petite.");
 let changed=false;
 for(const entry of entries){if(entry.dir||!(/\.xml$|\.rels$/i.test(entry.name)))continue;let xml=await entry.async("string");const original=xml;const matches=[...xml.matchAll(/xmlns:([A-Za-z_][A-Za-z0-9_.-]*)="(http:\/\/schemas\.openxmlformats\.org\/(?:spreadsheetml\/2006\/main|package\/2006\/(?:relationships|content-types)))"/g)];
  for(const match of matches){const prefix=match[1].replace(/[.*+?^${}()|[\]\\]/g,"\\$&");xml=xml.replace(new RegExp(`<(/?)${prefix}:`,"g"),"<$1").replace(match[0],`xmlns="${match[2]}"`);}
  if(xml!==original){changed=true;archive.file(entry.name,xml);}
 }
 const source=changed?await archive.generateAsync({type:"arraybuffer"}):buffer;const workbook=new Excel.Workbook();await workbook.xlsx.load(source as ArrayBuffer,{ignoreNodes:["tableParts","drawing","extLst","conditionalFormatting","dataValidations"]});return workbook;
}
