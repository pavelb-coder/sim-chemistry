/**
 * Формирование честного лабораторного отчёта для учителя (HTML / Печать в PDF / JSON-протокол)
 */
export function buildReportHTML({ studentName, studentClass, completedIds, tasks, log, currentEq, snapshotUrl }) {
  const dateStr = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const realTasks = tasks.filter((t) => t.id !== 'free');
  const doneList = realTasks.filter((t) => completedIds[t.id]);

  const rowsHtml = realTasks.map((t) => {
    const ok = !!completedIds[t.id];
    return `
      <tr>
        <td style="font-weight:700;color:#475569">${t.num}</td>
        <td><b>${escapeHtml(t.title)}</b><div style="font-size:12px;color:#64748b">${escapeHtml(t.grade)}</div></td>
        <td style="text-align:center">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${ok ? '#dcfce7' : '#f1f5f9'};color:${ok ? '#166534' : '#64748b'}">
            ${ok ? '✓ Выполнено' : '— Не сдано'}
          </span>
        </td>
      </tr>`;
  }).join('');

  const logHtml = (log || []).slice(0, 30).map((item) => `
    <div style="padding:4px 0;border-bottom:1px dashed #e2e8f1;font-size:13px">
      <b style="color:#2563eb;font-family:monospace;margin-right:8px">${escapeHtml(item.time)}</b>
      <span>${escapeHtml(item.text)}</span>
    </div>`).join('') || '<div style="color:#64748b;font-size:13px">Журнал действий пуст.</div>';

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Лабораторный отчёт — ХимЛаб 3D</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 32px; }
  .sheet { max-width: 820px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 12px 32px rgba(15,23,42,0.06); }
  h1 { margin: 0 0 6px; font-size: 24px; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; padding: 16px; background: #f1f5f9; border-radius: 12px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; font-size: 14px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
  th { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .snap { margin: 18px 0; text-align: center; }
  .snap img { max-width: 100%; max-height: 280px; border-radius: 12px; border: 1px solid #cbd5e1; }
  @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border: none; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="sheet">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div>
        <h1>Отчёт о лабораторной работе · ХимЛаб 3D</h1>
        <div style="color:#64748b;font-size:14px">Виртуальный физико-химический практикум</div>
      </div>
      <button class="no-print" onclick="window.print()" style="padding:10px 16px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-weight:700;cursor:pointer">Печать / Сохранить PDF</button>
    </div>

    <div class="meta">
      <div><span style="color:#64748b">Ученик:</span><br><b>${escapeHtml(studentName || 'Не указано')}</b></div>
      <div><span style="color:#64748b">Класс / Группа:</span><br><b>${escapeHtml(studentClass || 'Не указан')}</b></div>
      <div><span style="color:#64748b">Дата и время:</span><br><b>${escapeHtml(dateStr)}</b></div>
      <div><span style="color:#64748b">Итог практикума:</span><br><b style="color:#16a34a">${doneList.length} из ${realTasks.length} работ</b></div>
    </div>

    ${currentEq ? `<div style="padding:12px 16px;background:#eff6ff;border-radius:10px;margin-bottom:16px;font-size:14px">Последнее собранное уравнение: <b style="font-family:monospace;font-size:15px">${escapeHtml(currentEq)}</b></div>` : ''}

    ${snapshotUrl ? `<div class="snap"><div style="font-size:12px;color:#64748b;margin-bottom:6px">Снимок рабочего стола 3D-сцены в момент формирования отчёта:</div><img src="${snapshotUrl}" alt="Снимок 3D-лаборатории"></div>` : ''}

    <h3 style="margin:20px 0 8px;font-size:16px">Ведомость выполнения лабораторных опытов</h3>
    <table>
      <thead><tr><th style="width:48px">№</th><th>Название работы</th><th style="width:140px;text-align:center">Статус</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <h3 style="margin:20px 0 8px;font-size:16px">Протокол действий на лабораторном столе</h3>
    <div>${logHtml}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
