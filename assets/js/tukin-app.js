(function () {
  'use strict';

  const cfg=window.TUKIN_CONFIG, rules=window.TukinRules, parser=window.TukinParser, generator=window.TukinGenerator;
  const app=document.getElementById('app');
  const now=new Date();
  const state={
    step:'period',period:{month:now.getMonth()+1,year:now.getFullYear()},settings:{holidays:[],ramadanEnabled:false,ramadanStart:'',ramadanEnd:''},
    files:[],validationResults:[],employees:[],busy:false,drawerEmployeeKey:null,editRecordKey:null,editDraft:null,editEmployeeKey:null,
    generated:null,search:''
  };

  function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function money(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0));}
  function pct(v){return `${Number(v||0).toFixed(2).replace('.',',')}%`;}
  function bytes(v){if(v<1024)return`${v} B`;if(v<1048576)return`${Math.round(v/1024)} KB`;return`${(v/1048576).toFixed(1)} MB`;}
  function periodLabel(){return `${cfg.MONTHS[state.period.month-1]} ${state.period.year}`;}
  function range(){return rules.attendancePeriod(state.period);}
  function dateInputBounds(){const rg=range();return{min:rules.dateKey(rg.start),max:rules.dateKey(rg.end)};}
  function employeeByKey(key){return state.employees.find(e=>rules.employeeKey(e)===key)||null;}
  function recordByKey(emp,key){return emp?.records?.[key]||null;}
  function calcAll(){state.employees.forEach(e=>parser.recalculateEmployee(e,state.settings));state.generated=null;}

  function icon(name){
    const icons={home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',process:'<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 18v3h14v-3"/>',history:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>',tukin:'<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',plus:'<path d="M12 5v14M5 12h14"/>'};
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.tukin}</svg>`;
  }

  function shell(content){return `<div class="app-shell"><aside class="sidebar"><div class="sidebar-brand"><img src="assets/img/logo-pkp.png" alt="Kementerian PKP"></div><nav class="nav" aria-label="Navigasi utama">
    <a class="nav-button" href="index.html"><span class="nav-icon">${icon('home')}</span><span class="nav-label">Dashboard</span></a>
    <a class="nav-button" href="index.html"><span class="nav-icon">${icon('process')}</span><span class="nav-label">Proses Lembur</span></a>
    <a class="nav-button active" href="tukin.html"><span class="nav-icon">${icon('tukin')}</span><span class="nav-label">Tunjangan Kinerja</span></a>
    <a class="nav-button" href="index.html"><span class="nav-icon">${icon('history')}</span><span class="nav-label">Riwayat Lembur</span></a>
    </nav><div class="sidebar-footer"><div class="sidebar-avatar">PD</div><div class="sidebar-footer-copy"><strong>Pusdatin</strong>Kementerian PKP</div></div></aside>
    <main class="main"><header class="topbar"><div class="topbar-label"><strong>Generator Dokumen</strong><span>/ Tunjangan Kinerja</span></div></header><section class="content">${content}</section></main></div>${renderDrawer()}${renderEditModal()}${renderEmployeeModal()}`;}

  function stepper(){const steps=[['period','Periode'],['upload','Upload'],['validation','Validasi'],['result','Hasil']];const idx=steps.findIndex(x=>x[0]===state.step);return `<div class="card tukin-stepper">${steps.map((s,i)=>`${i?'<div class="tukin-step-line"></div>':''}<div class="tukin-step ${i<idx?'done':i===idx?'active':''}"><span class="tukin-step-dot">${i<idx?'✓':i+1}</span><span>${s[1]}</span></div>`).join('')}</div>`;}

  function render(){let body='';if(state.step==='period')body=renderPeriod();else if(state.step==='upload')body=renderUpload();else if(state.step==='validation')body=renderValidation();else body=renderResult();app.innerHTML=shell(`${stepper()}${body}`);bind();}

  function renderPeriod(){
    const months=cfg.MONTHS.map((m,i)=>`<option value="${i+1}" ${state.period.month===i+1?'selected':''}>${m}</option>`).join('');
    const years=Array.from({length:8},(_,i)=>now.getFullYear()-3+i).map(y=>`<option value="${y}" ${state.period.year===y?'selected':''}>${y}</option>`).join('');
    const rg=range(), b=dateInputBounds();
    const chips=state.settings.holidays.length?state.settings.holidays.map(k=>`<span class="tukin-chip">${esc(rules.formatDate(rules.dateFromKey(k),true))}<button data-remove-holiday="${esc(k)}" type="button">×</button></span>`).join(''):'<span class="card-subtitle">Belum ada tanggal merah tambahan.</span>';
    return `<div class="page-title"><div><h2>Periode Tunjangan Kinerja</h2><p>Pilih bulan Tukin. Sistem otomatis menggunakan absensi tanggal 11 dua bulan sebelumnya sampai tanggal 10 bulan sebelumnya.</p></div></div>
    <div class="card card-pad"><div class="card-title">Periode Pembayaran</div><div class="form-grid section-gap"><div class="field"><label>Bulan Tukin</label><select id="tukin-month">${months}</select></div><div class="field"><label>Tahun</label><select id="tukin-year">${years}</select></div></div>
    <div class="tukin-period-box"><div class="tukin-readonly"><span class="card-subtitle">Periode Tukin</span><strong>${esc(periodLabel())}</strong></div><div class="tukin-readonly"><span class="card-subtitle">Dasar Absensi</span><strong>${esc(rules.formatPeriodRange(rg))}</strong></div></div>
    <div class="tukin-setting"><div class="card-title">Tanggal Merah Tambahan</div><div class="card-subtitle">Tambahkan manual bila hari libur tidak tercatat pada file presensi.</div><div class="tukin-date-row"><div class="field"><label>Tanggal</label><input id="holiday-date" type="date" min="${b.min}" max="${b.max}"></div><button class="btn btn-secondary" data-action="add-holiday" type="button">+ Tambah Tanggal Merah</button></div><div class="tukin-chip-list">${chips}</div></div>
    <div class="tukin-setting"><div class="tukin-setting-head"><div><div class="card-title">Jam Kerja Ramadan</div><div class="card-subtitle">Senin–Kamis 08.00–15.00, Jumat 08.00–15.30. Fleksibilitas tetap 60 menit dan kategori TL bergeser mengikuti jam masuk Ramadan.</div></div><label class="tukin-toggle"><input id="ramadan-enabled" type="checkbox" ${state.settings.ramadanEnabled?'checked':''}> Aktifkan</label></div>
      <div class="tukin-date-row ${state.settings.ramadanEnabled?'':'hidden'}" id="ramadan-range"><div class="field"><label>Mulai Ramadan</label><input id="ramadan-start" type="date" min="${b.min}" max="${b.max}" value="${esc(state.settings.ramadanStart)}"></div><div class="field"><label>Selesai Ramadan</label><input id="ramadan-end" type="date" min="${b.min}" max="${b.max}" value="${esc(state.settings.ramadanEnd)}"></div></div></div>
    <div class="actions"><span></span><button class="btn btn-primary" data-action="period-next" type="button">${state.employees.length?'Kembali ke Validasi →':'Lanjut Upload →'}</button></div></div>`;
  }

  function renderUpload(){return `<div class="page-title"><div><h2>Upload Absensi Pegawai</h2><p>Tukin ${esc(periodLabel())} · dasar absensi ${esc(rules.formatPeriodRange(range()))}.</p></div></div>
    <div class="card card-pad"><div id="tukin-dropzone" class="dropzone"><div class="drop-icon">⇧</div><h3>Tarik file Excel absensi per pegawai ke sini</h3><p>Dapat memilih banyak file .xlsx/.xls sekaligus.</p><div style="margin-top:14px"><button class="btn btn-secondary btn-sm" data-action="choose-files" type="button">Pilih File</button></div><input id="tukin-files" class="file-input" type="file" multiple accept=".xlsx,.xls"></div>
    ${state.files.length?`<div class="section-gap table-wrap"><table class="file-table"><thead><tr><th>No.</th><th>Nama File</th><th>Ukuran</th><th>Status</th><th></th></tr></thead><tbody>${state.files.map((f,i)=>`<tr><td>${i+1}</td><td>${esc(f.name)}</td><td>${bytes(f.size)}</td><td><span class="status ok">● Siap</span></td><td class="text-right"><button class="btn btn-secondary btn-sm" data-remove-file="${i}" type="button">Hapus</button></td></tr>`).join('')}</tbody></table></div>`:''}
    <div class="actions"><button class="btn btn-secondary" data-action="back-period" type="button">← Kembali</button><div class="actions-right">${state.files.length?'<button class="btn btn-secondary" data-action="choose-files" type="button">+ Tambah File</button><button class="btn btn-primary" data-action="calculate" type="button">Hitung & Validasi →</button>':''}</div></div></div>`;}

  function renderValidation(){
    const errors=state.validationResults.filter(x=>!x.ok);const summaries=state.employees.map(e=>({e,s:rules.summarizeEmployee(e)}));
    const totalCut=summaries.reduce((a,x)=>a+x.s.cutAmount,0), totalNeed=summaries.reduce((a,x)=>a+x.s.flaggedRecords,0), adjusted=summaries.reduce((a,x)=>a+x.s.adjustedRecords,0);
    const q=state.search.trim().toLowerCase();const rows=summaries.filter(x=>!q||x.e.name.toLowerCase().includes(q)||String(x.e.nip).includes(q));
    return `<div class="page-title"><div><h2>Validasi & Verifikasi Perhitungan</h2><p>Periksa hasil perhitungan otomatis. Buka Detail untuk menelusuri tanggal, alasan potongan, koreksi dan bukti dukung.</p></div></div>
    ${errors.length?`<div class="alert alert-danger"><div class="alert-title">${errors.length} file bermasalah</div>File bermasalah harus diperbaiki/dihapus sebelum generate final.</div>`:''}
    <div class="tukin-kpi section-gap"><div class="card"><span>Pegawai</span><strong>${state.employees.length}</strong></div><div class="card"><span>Perlu Diverifikasi</span><strong>${totalNeed}</strong></div><div class="card"><span>Sudah Dikoreksi</span><strong>${adjusted}</strong></div><div class="card"><span>Total Potongan Rp</span><strong>${money(totalCut)}</strong></div></div>
    <div class="toolbar"><div class="search"><input id="tukin-search" placeholder="Cari nama atau NIP" value="${esc(state.search)}"></div><div class="card-subtitle">% SKP sementara 0% untuk seluruh pegawai</div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>No</th><th>Nama / NIP</th><th>Anak Satker</th><th>Hari Kerja</th><th>% Pot. Absensi</th><th>% Pot. SKP</th><th>% Pot. Final</th><th>Besaran Tukin</th><th>Potongan Tukin</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map((x,i)=>`<tr class="${x.e.masterMatched?'':'tukin-master-miss'}"><td>${i+1}</td><td><strong>${esc(x.e.name)}</strong><div class="card-subtitle">${esc(x.e.nip||'-')}</div></td><td>${esc(x.e.anakSatker||'-')}</td><td>${x.s.workDays}</td><td class="tukin-pct ${x.s.attendancePercent?'tukin-danger':''}">${pct(x.s.attendancePercent)}</td><td>${pct(x.s.skpPercent)}</td><td class="tukin-pct">${pct(x.s.finalPercent)}</td><td class="tukin-money">${money(x.s.tukin)}</td><td class="tukin-money">${money(x.s.cutAmount)}</td><td>${x.s.flaggedRecords?`<span class="tukin-badge warn">${x.s.flaggedRecords} perlu cek</span>`:'<span class="tukin-badge">Tidak ada isu</span>'}${x.s.adjustedRecords?` <span class="tukin-badge edit">${x.s.adjustedRecords} koreksi</span>`:''}${x.e.masterMatched?'':' <span class="tukin-badge warn">Master belum cocok</span>'}</td><td><button class="btn btn-secondary btn-sm" data-detail-employee="${esc(rules.employeeKey(x.e))}" type="button">Detail</button></td></tr>`).join('')||'<tr><td colspan="11" class="text-center">Tidak ada data.</td></tr>'}</tbody></table></div>
    ${state.validationResults.length?`<div class="section-gap card"><div class="table-wrap" style="border:0"><table class="file-table"><thead><tr><th>File</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>${state.validationResults.map(r=>`<tr><td>${esc(r.fileName)}</td><td><span class="status ${r.ok?'ok':'error'}">${r.ok?'● Berhasil':'● Gagal'}</span></td><td>${esc(r.ok?(r.warnings?.join(' · ')||`Pegawai: ${r.employee}`):r.error)}</td></tr>`).join('')}</tbody></table></div></div>`:''}
    <div class="actions"><button class="btn btn-secondary" data-action="back-upload" type="button">← Kembali ke Upload</button><div class="actions-right"><button class="btn btn-secondary" data-action="settings" type="button">Atur Periode/Tanggal Merah</button><button class="btn btn-primary" data-action="generate" type="button" ${errors.length||!state.employees.length||state.busy?'disabled':''}>${state.busy?'Menyiapkan ZIP...':'Generate ZIP Final'}</button></div></div>`;
  }

  function renderResult(){
    const total=state.employees.reduce((a,e)=>a+rules.summarizeEmployee(e).cutAmount,0);
    return `<div class="page-title"><div><h2>Dokumen Tunjangan Kinerja Siap</h2><p>Paket ZIP sudah dibuat dari hasil verifikasi terakhir.</p></div></div><div class="card result-hero"><div class="success-mark">✓</div><h3>Generate selesai</h3><p>${esc(state.generated?.name||generator.zipFileName(state.period))}</p><div class="tukin-result-grid"><div><span>Periode Tukin</span><strong>${esc(periodLabel())}</strong></div><div><span>Dasar Absensi</span><strong>${esc(rules.formatPeriodRange(range()))}</strong></div><div><span>Jumlah Pegawai</span><strong>${state.employees.length}</strong></div><div><span>Total Potongan Tukin</span><strong>${money(total)}</strong></div></div><div class="download-list"><div class="download-row"><div class="file-icon">ZIP</div><div><div class="download-name">${esc(state.generated?.name||'Paket Tunjangan Kinerja.zip')}</div><div class="download-meta">Berisi rekap Excel, folder pegawai, file absensi asli dan bukti dukung koreksi.</div></div><button class="btn btn-primary btn-sm" data-action="download-again" type="button">Unduh Lagi</button></div></div><div class="actions"><button class="btn btn-secondary" data-action="edit-again" type="button">← Edit / Verifikasi Kembali</button><button class="btn btn-primary" data-action="new-process" type="button">Proses Periode Baru</button></div></div>`;
  }

  function renderDrawer(){
    if(!state.drawerEmployeeKey)return'';const emp=employeeByKey(state.drawerEmployeeKey);if(!emp)return'';const s=rules.summarizeEmployee(emp);
    const recs=Object.values(emp.records||{}).filter(r=>r.needsVerification||r.adjustedPercent!==null||(r.evidence||[]).length||r.adjustmentNote).sort((a,b)=>a.key.localeCompare(b.key));
    return `<div class="drawer-backdrop" data-action="close-drawer"></div><aside class="drawer tukin-drawer"><div class="tukin-drawer-header"><div class="drawer-header"><div><h3>Detail Potongan Pegawai</h3><div class="card-subtitle">Log tanggal yang menyebabkan potongan atau memerlukan verifikasi.</div></div><button class="icon-btn" data-action="close-drawer" type="button">×</button></div><div class="profile"><div class="profile-avatar">${esc(emp.name.charAt(0).toUpperCase())}</div><div><div class="profile-name">${esc(emp.name)}</div><div class="profile-meta">NIP ${esc(emp.nip||'-')} · Anak Satker ${esc(emp.anakSatker||'-')}</div></div><button class="btn btn-secondary btn-sm" style="margin-left:auto" data-edit-employee="${esc(rules.employeeKey(emp))}" type="button">Data Pegawai</button></div></div>
      <div class="tukin-detail-summary"><div><span>Pot. Absensi</span><strong>${pct(s.attendancePercent)}</strong></div><div><span>Pot. SKP</span><strong>${pct(s.skpPercent)}</strong></div><div><span>Pot. Final</span><strong>${pct(s.finalPercent)}</strong></div><div><span>Potongan Rupiah</span><strong>${money(s.cutAmount)}</strong></div></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Status</th><th>TL</th><th>PSW</th><th>Otomatis</th><th>Final</th><th>Alasan / Bukti</th><th>Aksi</th></tr></thead><tbody>${recs.map(rec=>`<tr><td class="nowrap">${esc(rules.formatDate(rec.date,true))}</td><td>${esc(rules.formatMinutes(rec.inMinutes))}</td><td>${esc(rules.formatMinutes(rec.outMinutes))}</td><td>${esc(rec.status||'-')}${rec.flags?.length?`<div class="card-subtitle">${esc(rec.flags.join(', '))}</div>`:''}</td><td>${esc(rec.tlCategory)}<div class="card-subtitle">${pct(rec.tlPercent)}</div></td><td>${esc(rec.pswCategory)}<div class="card-subtitle">${pct(rec.pswPercent)}</div></td><td class="tukin-pct">${pct(rec.autoTotalPercent)}</td><td class="tukin-pct ${rec.adjustedPercent!==null?'tukin-ok':''}">${pct(rules.recordFinalPercent(rec))}${rec.adjustedPercent!==null?'<div class="card-subtitle">disesuaikan</div>':''}</td><td><div class="tukin-reason">${esc(rec.adjustmentNote||rec.reason||'-')}</div>${(rec.evidence||[]).length?`<div class="tukin-files">${rec.evidence.map(e=>esc(e.name)).join('<br>')}</div>`:''}</td><td><button class="btn btn-secondary btn-sm" data-edit-record="${esc(rec.key)}" data-employee="${esc(rules.employeeKey(emp))}" type="button">Edit</button></td></tr>`).join('')||'<tr><td colspan="10" class="text-center">Tidak ada tanggal yang menghasilkan potongan atau memerlukan verifikasi.</td></tr>'}</tbody></table></div></aside>`;
  }

  function renderEditModal(){
    if(!state.editRecordKey||!state.editDraft)return'';const emp=employeeByKey(state.editDraft.employeeKey),rec=recordByKey(emp,state.editRecordKey);if(!emp||!rec)return'';
    return `<div class="tukin-modal-backdrop"><div class="tukin-modal"><div class="tukin-modal-head"><div><h3>Koreksi Perhitungan</h3><p>${esc(emp.name)} · ${esc(rules.formatDate(rec.date,true))}</p></div><button class="icon-btn" data-action="close-edit" type="button">×</button></div><div class="alert alert-warning"><div class="alert-title">Hasil otomatis ${pct(rec.autoTotalPercent)}</div>${esc(rec.reason||'')}</div>
      <div class="tukin-form-grid section-gap"><div class="field"><label>% Potongan Hasil Penyesuaian</label><input id="edit-percent" type="number" min="0" max="2.5" step="0.01" value="${esc(state.editDraft.percent)}"></div><div class="field"><label>Bukti Dukung</label><input id="edit-evidence" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp"></div><div class="full field"><label>Keterangan</label><textarea id="edit-note" placeholder="Contoh: Dinas berdasarkan Surat Tugas ...">${esc(state.editDraft.note)}</textarea></div></div>
      <div class="tukin-evidence-list">${state.editDraft.evidence.length?state.editDraft.evidence.map((e,i)=>`<div class="tukin-evidence"><span>${esc(e.name)} · ${bytes(e.size||0)}</span><button data-remove-evidence="${i}" type="button">Hapus</button></div>`).join(''):'<div class="card-subtitle">Belum ada bukti dukung.</div>'}</div>
      <div class="actions"><button class="btn btn-secondary" data-action="reset-auto" type="button">Gunakan Hasil Otomatis</button><div class="actions-right"><button class="btn btn-secondary" data-action="close-edit" type="button">Batal</button><button class="btn btn-primary" data-action="save-edit" type="button">Simpan Koreksi</button></div></div></div></div>`;
  }

  function renderEmployeeModal(){
    if(!state.editEmployeeKey)return'';const emp=employeeByKey(state.editEmployeeKey);if(!emp)return'';
    return `<div class="tukin-modal-backdrop"><div class="tukin-modal"><div class="tukin-modal-head"><div><h3>Data Pegawai</h3><p>${esc(emp.name)} · ${esc(emp.nip||'-')}</p></div><button class="icon-btn" data-action="close-employee-edit" type="button">×</button></div><div class="tukin-form-grid"><div class="field"><label>Anak Satker</label><input id="employee-anak" value="${esc(emp.anakSatker||'')}" maxlength="2"></div><div class="field"><label>Besaran Tukin</label><input id="employee-tukin" type="number" min="0" step="1000" value="${Number(emp.tukin||cfg.DEFAULT_TUKIN)}"></div></div><div class="actions"><span></span><div class="actions-right"><button class="btn btn-secondary" data-action="close-employee-edit" type="button">Batal</button><button class="btn btn-primary" data-action="save-employee" type="button">Simpan</button></div></div></div></div>`;
  }

  function validateRamadan(){if(!state.settings.ramadanEnabled)return true;const b=dateInputBounds();const s=state.settings.ramadanStart,e=state.settings.ramadanEnd;if(!s||!e){alert('Isi tanggal mulai dan selesai Ramadan.');return false;}if(s>e||s<b.min||e>b.max){alert('Rentang Ramadan harus berada di dalam periode absensi.');return false;}return true;}
  function resetDownstream(){state.files=[];state.validationResults=[];state.employees=[];state.generated=null;state.drawerEmployeeKey=null;}
  function addFiles(fileList){for(const file of Array.from(fileList||[])){if(!/\.xlsx?$/i.test(file.name)&&!/\.xls$/i.test(file.name))continue;if(!state.files.some(f=>f.name===file.name&&f.size===file.size))state.files.push(file);}state.validationResults=[];state.employees=[];state.generated=null;render();}

  async function calculate(){if(!state.files.length)return;if(!validateRamadan())return;state.busy=true;render();try{const result=await parser.parseFiles(state.files,state.period,state.settings);state.validationResults=result.results;state.employees=result.employees;state.step='validation';}catch(e){alert(`Gagal memproses data: ${e.message||e}`);}finally{state.busy=false;render();}}
  async function generate(){if(state.busy||!state.employees.length)return;state.busy=true;render();try{state.generated=await generator.generateZip(state.employees,state.period);generator.download(state.generated);state.step='result';}catch(e){alert(`Gagal membuat paket ZIP: ${e.message||e}`);}finally{state.busy=false;render();}}

  function openRecordEdit(empKey,recKey){const emp=employeeByKey(empKey),rec=recordByKey(emp,recKey);if(!rec)return;state.editRecordKey=recKey;state.editDraft={employeeKey:empKey,percent:rules.recordFinalPercent(rec),note:rec.adjustmentNote||'',evidence:[...(rec.evidence||[])]};render();}
  function syncDraftFromForm(){if(!state.editDraft)return;const p=document.getElementById('edit-percent'),n=document.getElementById('edit-note');if(p)state.editDraft.percent=p.value;if(n)state.editDraft.note=n.value;}
  function saveRecordEdit(){const emp=employeeByKey(state.editDraft.employeeKey),rec=recordByKey(emp,state.editRecordKey);if(!rec)return;const val=Number(document.getElementById('edit-percent')?.value);if(!Number.isFinite(val)||val<0||val>2.5){alert('Persentase penyesuaian harus antara 0% sampai 2,5%.');return;}rec.adjustedPercent=Number(val.toFixed(2));rec.adjustmentNote=String(document.getElementById('edit-note')?.value||'').trim();rec.evidence=[...state.editDraft.evidence];state.generated=null;state.editRecordKey=null;state.editDraft=null;render();}
  function resetRecordAuto(){const emp=employeeByKey(state.editDraft.employeeKey),rec=recordByKey(emp,state.editRecordKey);if(!rec)return;rec.adjustedPercent=null;rec.adjustmentNote='';rec.evidence=[];state.generated=null;state.editRecordKey=null;state.editDraft=null;render();}

  function bind(){
    document.getElementById('tukin-month')?.addEventListener('change',e=>{const old=state.period.month;state.period.month=Number(e.target.value);if(old!==state.period.month){state.settings.holidays=[];state.settings.ramadanStart='';state.settings.ramadanEnd='';resetDownstream();}render();});
    document.getElementById('tukin-year')?.addEventListener('change',e=>{const old=state.period.year;state.period.year=Number(e.target.value);if(old!==state.period.year){state.settings.holidays=[];state.settings.ramadanStart='';state.settings.ramadanEnd='';resetDownstream();}render();});
    document.querySelector('[data-action="add-holiday"]')?.addEventListener('click',()=>{const key=document.getElementById('holiday-date')?.value||'';const b=dateInputBounds();if(!key||key<b.min||key>b.max){alert('Pilih tanggal yang berada pada periode absensi.');return;}state.settings.holidays=rules.normalizeHolidays([...state.settings.holidays,key]);calcAll();render();});
    document.querySelectorAll('[data-remove-holiday]').forEach(b=>b.addEventListener('click',()=>{state.settings.holidays=state.settings.holidays.filter(k=>k!==b.dataset.removeHoliday);calcAll();render();}));
    document.getElementById('ramadan-enabled')?.addEventListener('change',e=>{state.settings.ramadanEnabled=e.target.checked;calcAll();render();});
    document.getElementById('ramadan-start')?.addEventListener('change',e=>{state.settings.ramadanStart=e.target.value;calcAll();});
    document.getElementById('ramadan-end')?.addEventListener('change',e=>{state.settings.ramadanEnd=e.target.value;calcAll();});
    document.querySelector('[data-action="period-next"]')?.addEventListener('click',()=>{if(!validateRamadan())return;state.step=state.employees.length?'validation':'upload';render();});
    document.querySelector('[data-action="back-period"]')?.addEventListener('click',()=>{state.step='period';render();});
    document.querySelectorAll('[data-action="choose-files"]').forEach(b=>b.addEventListener('click',()=>document.getElementById('tukin-files')?.click()));
    document.getElementById('tukin-files')?.addEventListener('change',e=>addFiles(e.target.files));
    const dz=document.getElementById('tukin-dropzone');if(dz){['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover')}));dz.addEventListener('drop',e=>addFiles(e.dataTransfer.files));}
    document.querySelectorAll('[data-remove-file]').forEach(b=>b.addEventListener('click',()=>{state.files.splice(Number(b.dataset.removeFile),1);state.validationResults=[];state.employees=[];render();}));
    document.querySelector('[data-action="calculate"]')?.addEventListener('click',calculate);
    document.querySelector('[data-action="back-upload"]')?.addEventListener('click',()=>{state.step='upload';render();});
    document.querySelector('[data-action="settings"]')?.addEventListener('click',()=>{state.step='period';render();});
    document.getElementById('tukin-search')?.addEventListener('input',e=>{state.search=e.target.value;clearTimeout(window.__tukinSearch);window.__tukinSearch=setTimeout(render,160);});
    document.querySelectorAll('[data-detail-employee]').forEach(b=>b.addEventListener('click',()=>{state.drawerEmployeeKey=b.dataset.detailEmployee;render();}));
    document.querySelectorAll('[data-action="close-drawer"]').forEach(b=>b.addEventListener('click',()=>{state.drawerEmployeeKey=null;render();}));
    document.querySelectorAll('[data-edit-record]').forEach(b=>b.addEventListener('click',()=>openRecordEdit(b.dataset.employee,b.dataset.editRecord)));
    document.querySelector('[data-action="close-edit"]')?.addEventListener('click',()=>{state.editRecordKey=null;state.editDraft=null;render();});
    document.getElementById('edit-evidence')?.addEventListener('change',e=>{syncDraftFromForm();for(const file of Array.from(e.target.files||[])){if(!/^application\/pdf$|^image\//i.test(file.type)){alert(`File ${file.name} bukan PDF/image.`);continue;}state.editDraft.evidence.push({id:`${Date.now()}-${Math.random()}`,name:file.name,size:file.size,type:file.type,file});}render();});
    document.querySelectorAll('[data-remove-evidence]').forEach(b=>b.addEventListener('click',()=>{syncDraftFromForm();state.editDraft.evidence.splice(Number(b.dataset.removeEvidence),1);render();}));
    document.querySelector('[data-action="save-edit"]')?.addEventListener('click',saveRecordEdit);
    document.querySelector('[data-action="reset-auto"]')?.addEventListener('click',resetRecordAuto);
    document.querySelectorAll('[data-edit-employee]').forEach(b=>b.addEventListener('click',()=>{state.editEmployeeKey=b.dataset.editEmployee;render();}));
    document.querySelector('[data-action="close-employee-edit"]')?.addEventListener('click',()=>{state.editEmployeeKey=null;render();});
    document.querySelector('[data-action="save-employee"]')?.addEventListener('click',()=>{const emp=employeeByKey(state.editEmployeeKey);if(!emp)return;const anak=String(document.getElementById('employee-anak')?.value||'').replace(/\D/g,'').padStart(2,'0').slice(-2),tukin=Number(document.getElementById('employee-tukin')?.value);if(!anak||!Number.isFinite(tukin)||tukin<0){alert('Anak Satker dan besaran Tukin harus valid.');return;}emp.anakSatker=anak;emp.tukin=tukin;emp.masterMatched=true;state.editEmployeeKey=null;state.generated=null;render();});
    document.querySelector('[data-action="generate"]')?.addEventListener('click',generate);
    document.querySelector('[data-action="download-again"]')?.addEventListener('click',()=>state.generated&&generator.download(state.generated));
    document.querySelector('[data-action="edit-again"]')?.addEventListener('click',()=>{state.step='validation';render();});
    document.querySelector('[data-action="new-process"]')?.addEventListener('click',()=>{state.step='period';state.files=[];state.validationResults=[];state.employees=[];state.generated=null;state.drawerEmployeeKey=null;state.search='';state.settings={holidays:[],ramadanEnabled:false,ramadanStart:'',ramadanEnd:''};render();});
  }

  render();
})();
