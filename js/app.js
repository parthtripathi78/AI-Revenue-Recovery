// app.js — Main application bootstrap and UI controller

import { generateBatch, getBatchSummary, FAILURE_TYPES } from './data.js';
import { RecoveryAgent } from './agent.js';
import { auditLogger } from './audit.js';
import { renderRecoveryDonut, renderChannelBar, renderRecoveryCurve, updateRecoveryCurve } from './charts.js';

// ── State ──────────────────────────────────────────────────────────────────────
let batch = [];
let agent = null;
let cumulativeRecovered = 0;
let recoveryCurveData = [];
let activeTab = 'dashboard';

// ── Format helpers ─────────────────────────────────────────────────────────────
function formatINR(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function humanizeType(type) {
  const map = {
    payment_failure: 'Payment Failure',
    checkout_abandoned: 'Checkout Abandoned',
    subscription_failed: 'Subscription Failed',
    b2b_overdue: 'B2B Overdue',
    mandate_failed: 'Mandate Failed',
  };
  return map[type] || type;
}

function statusBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">Pending</span>',
    in_progress: '<span class="badge badge-progress">In Progress</span>',
    recovered: '<span class="badge badge-recovered">Recovered ✓</span>',
    failed: '<span class="badge badge-failed">Failed</span>',
    escalated: '<span class="badge badge-escalated">Escalated ↑</span>',
    dnc: '<span class="badge badge-dnc">DNC ⛔</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

function typeIcon(type) {
  const icons = {
    payment_failure: '💳',
    checkout_abandoned: '🛒',
    subscription_failed: '🔄',
    b2b_overdue: '📋',
    mandate_failed: '🏦',
  };
  return icons[type] || '⚡';
}

function timeSince(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const now = new Date();
  const secs = Math.floor((now - d) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ── Metrics update ─────────────────────────────────────────────────────────────
function updateMetrics() {
  const summary = getBatchSummary(batch);

  // Top cards
  document.getElementById('metric-at-risk').textContent = formatINR(summary.totalAtRisk);
  document.getElementById('metric-recovered').textContent = formatINR(summary.totalRecovered);
  const lostAmt = batch.filter(r => r.status === 'failed').reduce((s, r) => s + r.amount, 0);
  document.getElementById('metric-lost').textContent = formatINR(lostAmt);
  document.getElementById('metric-rate').textContent = `${summary.recoveryRate}%`;

  // Status counts
  document.getElementById('cnt-pending').textContent = summary.byStatus.pending;
  document.getElementById('cnt-progress').textContent = summary.byStatus.in_progress;
  document.getElementById('cnt-recovered').textContent = summary.byStatus.recovered;
  document.getElementById('cnt-failed').textContent = summary.byStatus.failed;
  document.getElementById('cnt-escalated').textContent = summary.byStatus.escalated;
  document.getElementById('cnt-dnc').textContent = summary.byStatus.dnc;

  // Progress bar
  const processed = batch.length - summary.byStatus.pending;
  const pct = batch.length > 0 ? (processed / batch.length * 100).toFixed(1) : 0;
  document.getElementById('batch-progress-bar').style.width = `${pct}%`;
  document.getElementById('batch-progress-text').textContent = `${processed} / ${batch.length} records processed (${pct}%)`;

  // Charts
  renderRecoveryDonut(summary);
  renderChannelBar(summary);
}

// ── Records table ──────────────────────────────────────────────────────────────
function updateRecordsTable(filterStatus = 'all') {
  const tbody = document.getElementById('records-tbody');
  if (!tbody) return;
  let rows = filterStatus === 'all' ? batch : batch.filter(r => r.status === filterStatus);

  tbody.innerHTML = rows.slice(0, 100).map(r => `
    <tr class="record-row record-${r.status}" data-id="${r.id}">
      <td><span class="record-id">${r.id}</span></td>
      <td>
        <div class="customer-cell">
          <span class="customer-avatar">${r.customer.name.charAt(0)}</span>
          <div>
            <div class="customer-name">${r.customer.name}</div>
            <div class="customer-meta">${r.customer.type} · ${r.customer.tier}</div>
          </div>
        </div>
      </td>
      <td><span class="type-badge">${typeIcon(r.failureType)} ${humanizeType(r.failureType)}</span></td>
      <td class="amount-cell">
        <div class="amount-at-risk">${formatINR(r.amount)}</div>
        ${r.recoveredAmount > 0 ? `<div class="amount-recovered">+${formatINR(r.recoveredAmount)}</div>` : ''}
      </td>
      <td><span class="risk-score risk-${r.riskScore >= 70 ? 'high' : r.riskScore >= 40 ? 'med' : 'low'}">${r.riskScore}</span></td>
      <td>${statusBadge(r.status)}</td>
      <td class="attempts-cell">${r.attemptCount}/${r.maxAttempts}</td>
      <td class="time-cell">${timeSince(r.lastAttemptAt || r.createdAt)}</td>
      <td>
        <button class="btn-detail" onclick="showDetail('${r.id}')">View</button>
      </td>
    </tr>
  `).join('');
}

// ── Audit table ────────────────────────────────────────────────────────────────
function updateAuditTable() {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  const entries = auditLogger.getAll().slice(0, 200);
  tbody.innerHTML = entries.map(e => `
    <tr class="audit-row audit-${e.outcome}">
      <td class="audit-time">${new Date(e.timestamp).toLocaleTimeString()}</td>
      <td><span class="audit-record-id">${e.recordId}</span></td>
      <td>${e.customerName}</td>
      <td>${e.action}</td>
      <td><span class="channel-tag">${e.channel}</span></td>
      <td class="audit-outcome outcome-${e.outcome}">${e.outcome.toUpperCase()}</td>
      <td>${e.amount > 0 ? formatINR(e.amount) : '—'}</td>
    </tr>
  `).join('');
}

// ── Live log ───────────────────────────────────────────────────────────────────
function appendLog(msg, record) {
  const log = document.getElementById('live-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">${new Date().toLocaleTimeString()}</span>
    <span class="log-record">${record ? record.id : 'SYSTEM'}</span>
    <span class="log-msg">${msg}</span>
  `;
  log.insertBefore(entry, log.firstChild);
  // Keep max 100 entries
  while (log.children.length > 100) log.removeChild(log.lastChild);
}

// ── Record detail modal ────────────────────────────────────────────────────────
window.showDetail = function(id) {
  const record = batch.find(r => r.id === id);
  if (!record) return;
  const modal = document.getElementById('detail-modal');
  const logs = auditLogger.getByRecord(id);

  document.getElementById('modal-title').textContent = `${typeIcon(record.failureType)} ${record.id}`;
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-grid">
      <div class="modal-section">
        <h4>Customer</h4>
        <div class="detail-row"><span>Name</span><strong>${record.customer.name}</strong></div>
        <div class="detail-row"><span>Type</span><strong>${record.customer.type} · ${record.customer.tier}</strong></div>
        <div class="detail-row"><span>Email</span><strong>${record.customer.email}</strong></div>
        <div class="detail-row"><span>Phone</span><strong>${record.customer.phone}</strong></div>
      </div>
      <div class="modal-section">
        <h4>Failure Details</h4>
        <div class="detail-row"><span>Type</span><strong>${humanizeType(record.failureType)}</strong></div>
        <div class="detail-row"><span>Reason</span><strong>${record.failureReason}</strong></div>
        <div class="detail-row"><span>Payment Method</span><strong>${record.paymentMethod}</strong></div>
        <div class="detail-row"><span>Days Overdue</span><strong>${record.daysOverdue}d</strong></div>
      </div>
      <div class="modal-section">
        <h4>Recovery Status</h4>
        <div class="detail-row"><span>At Risk</span><strong class="text-danger">${formatINR(record.amount)}</strong></div>
        <div class="detail-row"><span>Recovered</span><strong class="text-success">${formatINR(record.recoveredAmount)}</strong></div>
        <div class="detail-row"><span>Status</span>${statusBadge(record.status)}</div>
        <div class="detail-row"><span>Risk Score</span><strong>${record.riskScore}/100</strong></div>
        <div class="detail-row"><span>Attempts</span><strong>${record.attemptCount}/${record.maxAttempts}</strong></div>
      </div>
    </div>
    <div class="modal-section audit-section">
      <h4>Audit Trail (${logs.length} events)</h4>
      <div class="audit-mini-table">
        ${logs.map(l => `
          <div class="audit-mini-row audit-${l.outcome}">
            <span class="audit-mini-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
            <span class="audit-mini-action">${l.action}</span>
            <span class="channel-tag">${l.channel}</span>
            <span class="outcome-tag outcome-${l.outcome}">${l.outcome}</span>
            <span class="audit-mini-decision">${l.agentDecision}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  modal.classList.add('active');
};

window.closeModal = function() {
  document.getElementById('detail-modal').classList.remove('active');
};

// ── Tab navigation ────────────────────────────────────────────────────────────
window.switchTab = function(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
  if (tab === 'records') updateRecordsTable();
  if (tab === 'audit') updateAuditTable();
};

window.filterRecords = function(status) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === status));
  updateRecordsTable(status);
};

// ── Export ────────────────────────────────────────────────────────────────────
window.exportAudit = function(format) {
  const content = format === 'json' ? auditLogger.exportJSON() : auditLogger.exportCSV();
  const mime = format === 'json' ? 'application/json' : 'text/csv';
  const ext = format;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Run batch ─────────────────────────────────────────────────────────────────
window.runBatch = async function() {
  if (agent && agent.isRunning) return;

  // Reset state
  batch = generateBatch(50);
  cumulativeRecovered = 0;
  recoveryCurveData = [];
  auditLogger.clear();

  // Update UI
  document.getElementById('run-btn').disabled = true;
  document.getElementById('run-btn').textContent = '⏳ Running...';
  document.getElementById('pause-btn').disabled = false;
  document.getElementById('stop-btn').disabled = false;
  document.getElementById('live-log').innerHTML = '';

  updateMetrics();
  renderRecoveryCurve([0]);
  appendLog('🚀 Batch recovery started — 50 at-risk records queued', null);

  agent = new RecoveryAgent({
    onRecordUpdate: (record) => {
      // Update in batch
      const idx = batch.findIndex(r => r.id === record.id);
      if (idx !== -1) batch[idx] = record;
      updateMetrics();
      if (activeTab === 'records') updateRecordsTable();
      if (activeTab === 'audit') updateAuditTable();
    },
    onProgress: (processed, total, record) => {
      cumulativeRecovered += record.recoveredAmount;
      recoveryCurveData.push(cumulativeRecovered);
      updateRecoveryCurve(cumulativeRecovered);
    },
    onBatchComplete: (records) => {
      document.getElementById('run-btn').disabled = false;
      document.getElementById('run-btn').textContent = '▶ Run New Batch';
      document.getElementById('pause-btn').disabled = true;
      document.getElementById('stop-btn').disabled = true;
      const summary = getBatchSummary(records);
      appendLog(`✅ Batch complete! Recovered ${formatINR(summary.totalRecovered)} (${summary.recoveryRate}% rate)`, null);
      updateMetrics();
      showCompletionToast(summary);
    },
    onLog: (msg, record) => {
      appendLog(msg, record);
    },
  });

  await agent.runBatch(batch);
};

window.pauseBatch = function() {
  if (!agent) return;
  if (agent.isPaused) {
    agent.resume();
    document.getElementById('pause-btn').textContent = '⏸ Pause';
    appendLog('▶️ Batch resumed', null);
  } else {
    agent.pause();
    document.getElementById('pause-btn').textContent = '▶ Resume';
    appendLog('⏸ Batch paused', null);
  }
};

window.stopBatch = function() {
  if (!agent) return;
  agent.stop();
  document.getElementById('run-btn').disabled = false;
  document.getElementById('run-btn').textContent = '▶ Run New Batch';
  document.getElementById('pause-btn').disabled = true;
  document.getElementById('stop-btn').disabled = true;
  appendLog('🛑 Batch stopped by user', null);
};

// ── Completion toast ──────────────────────────────────────────────────────────
function showCompletionToast(summary) {
  const toast = document.getElementById('completion-toast');
  document.getElementById('toast-recovered').textContent = formatINR(summary.totalRecovered);
  document.getElementById('toast-rate').textContent = `${summary.recoveryRate}%`;
  document.getElementById('toast-records').textContent = summary.byStatus.recovered;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 8000);
}

window.closeToast = function() {
  document.getElementById('completion-toast').classList.remove('active');
};

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  // Pre-load batch without running
  batch = generateBatch(50);
  updateMetrics();
  renderRecoveryCurve([0]);
  appendLog('🤖 AI Revenue Recovery Agent initialized. Click "Run Batch" to start.', null);

  // Tab default
  switchTab('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
