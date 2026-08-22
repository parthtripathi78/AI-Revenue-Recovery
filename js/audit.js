// audit.js — Audit trail logger for every recovery action

class AuditLogger {
  constructor() {
    this.entries = [];
  }

  log({ recordId, customerId, customerName, action, channel, amount, outcome, details, agentDecision }) {
    const entry = {
      id: 'AUD-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
      timestamp: new Date().toISOString(),
      recordId,
      customerId: customerId || 'N/A',
      customerName: customerName || 'Unknown',
      action,
      channel: channel || 'system',
      amount: amount || 0,
      outcome, // success | failed | escalated | skipped | stopped
      details: details || '',
      agentDecision: agentDecision || '',
    };
    this.entries.unshift(entry); // newest first
    return entry;
  }

  getAll() {
    return [...this.entries];
  }

  getByRecord(recordId) {
    return this.entries.filter(e => e.recordId === recordId);
  }

  getByOutcome(outcome) {
    return this.entries.filter(e => e.outcome === outcome);
  }

  getStats() {
    return {
      total: this.entries.length,
      successful: this.entries.filter(e => e.outcome === 'success').length,
      failed: this.entries.filter(e => e.outcome === 'failed').length,
      escalated: this.entries.filter(e => e.outcome === 'escalated').length,
      skipped: this.entries.filter(e => e.outcome === 'skipped').length,
      stopped: this.entries.filter(e => e.outcome === 'stopped').length,
    };
  }

  exportJSON() {
    return JSON.stringify(this.entries, null, 2);
  }

  exportCSV() {
    const headers = ['ID', 'Timestamp', 'Record ID', 'Customer', 'Action', 'Channel', 'Amount (INR)', 'Outcome', 'Agent Decision', 'Details'];
    const rows = this.entries.map(e => [
      e.id,
      e.timestamp,
      e.recordId,
      e.customerName,
      e.action,
      e.channel,
      e.amount,
      e.outcome,
      e.agentDecision,
      e.details,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  clear() {
    this.entries = [];
  }
}

export const auditLogger = new AuditLogger();
