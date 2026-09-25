(function () {
  'use strict';
  const cfg=window.TUKIN_CONFIG;
  const rules=window.TukinRules;

  function monthLabel(period){return cfg.MONTHS[period.month-1];}
  function recapFileName(period){return `(${monthLabel(period)}) Rekap Potongan Tunjangan Kinerja CPNS ${period.year}.xlsx`;}
  function zipFileName(period){return `Tunjangan Kinerja ${monthLabel(period)} ${period.year}.zip`;}
  function cloneCellStyle(source,target){
    target.style=JSON.parse(JSON.stringify(source.style||{}));
    target.numFmt=source.numFmt;target.font=JSON.parse(JSON.stringify(source.font||{}));
    target.alignment=JSON.parse(JSON.stringify(source.alignment||{}));
    target.border=JSON.parse(JSON.stringify(source.border||{}));
    target.fill=JSON.parse(JSON.stringify(source.fill||{}));
    target.protection=JSON.parse(JSON.stringify(source.protection||{}));
  }
  function ensureRowStyle(ws,rowNumber){
    if(rowNumber<=cfg.DATA_START_ROW+cfg.TEMPLATE_DATA_ROWS-1)return;
    const sourceRow=ws.getRow(cfg.DATA_START_ROW+cfg.TEMPLATE_DATA_ROWS-1), targetRow=ws.getRow(rowNumber);
    targetRow.height=sourceRow.height;
    for(let c=1;c<=15;c++) cloneCellStyle(sourceRow.getCell(c),targetRow.getCell(c));
  }
  async function loadTemplate(){
    const res=await fetch(cfg.TEMPLATE_URL,{cache:'no-store'});
    if(!res.ok) throw new Error(`Template rekap tidak dapat dimuat (${res.status}).`);
    const wb=new ExcelJS.Workbook();await wb.xlsx.load(await res.arrayBuffer());return wb;
  }
  async function generateRecap(employees,period){
    if(!window.ExcelJS)throw new Error('Library ExcelJS belum termuat.');
    const wb=await loadTemplate();const ws=wb.getWorksheet('PUSDATIN')||wb.worksheets[0];
    const range=rules.attendancePeriod(period);const dayAfter=rules.addDays(range.end,1);
    ws.getCell('C3').value=`: ${monthLabel(period)}`;
    ws.getCell('C4').value=`: Tanggal 11 Bulan ${cfg.MONTHS[range.start.getMonth()]} s/d 10 Bulan ${cfg.MONTHS[range.end.getMonth()]}`;
    ws.getCell('C5').value=`: ${cfg.UNIT_WORK}`;ws.getCell('C6').value=`: ${cfg.UNIT_ORGANIZATION}`;
    const sorted=[...employees].sort((a,b)=>(a.masterOrder-b.masterOrder)||a.name.localeCompare(b.name,'id'));
    const lastNeeded=cfg.DATA_START_ROW+Math.max(cfg.TEMPLATE_DATA_ROWS,sorted.length)-1;
    for(let row=cfg.DATA_START_ROW;row<=lastNeeded;row++){
      ensureRowStyle(ws,row);for(let c=1;c<=15;c++)ws.getCell(row,c).value=null;
    }
    sorted.forEach((emp,i)=>{
      const row=cfg.DATA_START_ROW+i;ensureRowStyle(ws,row);const s=rules.summarizeEmployee(emp);
      const values=[i+1,emp.satker||cfg.SATKER,String(emp.anakSatker||'').padStart(2,'0'),rules.pad2(period.month),period.year,String(emp.nip||''),cfg.SKP_SCORE,rules.formatDate(dayAfter,false),s.attendancePercent/100,s.skpPercent/100,null,s.tukin,null,emp.name,cfg.UNIT_LABEL];
      values.forEach((v,idx)=>ws.getCell(row,idx+1).value=v);
      ws.getCell(row,11).value={formula:`(30%*I${row})+(70%*J${row})`,result:s.finalPercent/100};
      ws.getCell(row,13).value={formula:`K${row}*L${row}`,result:s.cutAmount};
    });
    wb.calcProperties.fullCalcOnLoad=true;wb.calcProperties.forceFullCalc=true;
    const buffer=await wb.xlsx.writeBuffer();
    return {name:recapFileName(period),blob:new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};
  }
  function uniqueName(used,name){
    let base=String(name||'file').replace(/[\\/]/g,'-'),candidate=base,n=2;
    while(used.has(candidate.toLowerCase())){const p=base.lastIndexOf('.');candidate=p>0?`${base.slice(0,p)} (${n++})${base.slice(p)}`:`${base} (${n++})`;}
    used.add(candidate.toLowerCase());return candidate;
  }
  async function generateZip(employees,period){
    if(!window.JSZip)throw new Error('Library JSZip belum termuat.');
    const recap=await generateRecap(employees,period);const zip=new JSZip();zip.file(recap.name,recap.blob);
    const root=zip.folder(`PNS ${period.year}`);
    for(const emp of employees){
      const folder=root.folder(rules.safeFolderName(emp.name));const used=new Set();
      for(const source of emp.sourceFiles||[]){if(source)folder.file(uniqueName(used,source.name),source);}
      for(const rec of Object.values(emp.records||{})){
        for(const ev of rec.evidence||[]){if(ev?.file)folder.file(uniqueName(used,ev.name||ev.file.name),ev.file);}
      }
    }
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    return {name:zipFileName(period),blob,recap};
  }
  function download(file){saveAs(file.blob,file.name);}
  window.TukinGenerator=Object.freeze({generateRecap,generateZip,download,recapFileName,zipFileName});
})();
