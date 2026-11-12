function escapeCell(v) {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows, columns) {
  const head = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(',')).join('\r\n');
  return `${head}\r\n${body}`;
}

export function downloadCSV(filename, csv) {
  // BOM so Excel opens UTF-8 (emoji, ñ) correctly
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
