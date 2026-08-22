// agent.js — AI Recovery Agent core engine

import { workflowMap } from './workflows.js';
import { auditLogger } from './audit.js';

export class RecoveryAgent {
  constructor({ onRecordUpdate, onBatchComplete, onProgress, onLog }) {
    this.onRecordUpdate = onRecordUpdate || (() => {});
    this.onBatchComplete = onBatchComplete || (() => {});
    this.onProgress = onProgress || (() => {});
    this.onLog = onLog || (() => {});
    this.isRunning = false;
    this.isPaused = false;
    this.currentBatch = [];
    this.processedCount = 0;
  }

  // ── Main entry: run full batch ──────────────────────────────────────────────
  async runBatch(records) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.currentBatch = records;
    this.processedCount = 0;

    auditLogger.log({
      recordId: 'BATCH',
      customerName: 'System',
      action: 'Batch recovery started',
      channel: 'agent',
      outcome: 'success',
      agentDecision: `Starting recovery batch of ${records.length} at-risk records. Processing in risk-score order.`,
      details: `Batch initiated at ${new Date().toISOString()}`,
    });

    for (let i = 0; i < records.length; i++) {
      // Pause support
      while (this.isPaused) {
        await new Promise(r => setTimeout(r, 200));
      }
      if (!this.isRunning) break;

      const record = records[i];
      await this.processRecord(record);
      this.processedCount++;
      this.onProgress(this.processedCount, records.length, record);
    }

    this.isRunning = false;

    auditLogger.log({
      recordId: 'BATCH',
      customerName: 'System',
      action: 'Batch recovery completed',
      channel: 'agent',
      outcome: 'success',
      agentDecision: `Batch complete. Processing summary generated.`,
      details: `Processed ${this.processedCount} records.`,
    });

    this.onBatchComplete(records);
  }

  // ── Process a single record ─────────────────────────────────────────────────
  async processRecord(record) {
    // STOPPING RULE 1: Do-Not-Contact list
    if (record.isDNC) {
      record.status = 'dnc';
      this.logAndUpdate(record, '⛔ DNC — skipped per compliance rules', {
        action: 'Skip — DNC list',
        channel: 'compliance',
        outcome: 'skipped',
        agentDecision: 'Customer on Do-Not-Contact list. Skipping all outreach per compliance policy.',
        details: 'Compliance stop rule applied.',
      });
      return;
    }

    // STOPPING RULE 2: Amount too small and already retried
    if (record.amount < 100 && record.attemptCount > 0) {
      record.status = 'failed';
      this.logAndUpdate(record, '⚠️ Micro-amount — recovery cost exceeds value', {
        action: 'Skip — low ROI',
        channel: 'system',
        outcome: 'stopped',
        agentDecision: `Amount ₹${record.amount} is below recovery cost threshold. Stopping per ROI rule.`,
        details: 'Low-value stopping rule applied.',
      });
      return;
    }

    // AGENT DECISION: Select workflow
    record.status = 'in_progress';
    const workflowFn = workflowMap[record.failureType];

    this.logAndUpdate(record, `🤖 Agent analyzing: ${this.humanizeType(record.failureType)}`, {
      action: 'Select recovery workflow',
      channel: 'agent',
      outcome: 'success',
      agentDecision: this.getAgentRationale(record),
      details: `Risk score: ${record.riskScore}/100. Days overdue: ${record.daysOverdue}. Customer tier: ${record.customer.tier}`,
    });

    await new Promise(r => setTimeout(r, 200));

    if (workflowFn) {
      await workflowFn(record, (rec, msg) => {
        this.onLog(msg, rec);
        this.onRecordUpdate({ ...rec });
      });
    } else {
      record.status = 'failed';
    }

    this.onRecordUpdate({ ...record });
  }

  getAgentRationale(record) {
    const rationales = {
      payment_failure: `Payment failure detected. Root cause: "${record.failureReason}". Strategy: silent retry → alternate gateway → fresh payment link.`,
      checkout_abandoned: `Checkout abandoned at ${record.product.name}. Likely cause: "${record.failureReason}". Strategy: cart email → discount nudge.`,
      subscription_failed: `Subscription charge failed. Reason: "${record.failureReason}". Strategy: dunning sequence with grace period and plan-downgrade fallback.`,
      b2b_overdue: `B2B invoice ${record.daysOverdue}d overdue. Contact: ${record.customer.name}. Strategy: soft reminder → escalation → legal.`,
      mandate_failed: `NACH mandate bounced: "${record.failureReason}". Strategy: smart retry windows aligned to salary cycles.`,
    };
    return rationales[record.failureType] || 'General recovery workflow selected.';
  }

  humanizeType(type) {
    const map = {
      payment_failure: 'Payment Failure',
      checkout_abandoned: 'Checkout Abandonment',
      subscription_failed: 'Failed Subscription',
      b2b_overdue: 'B2B Overdue Invoice',
      mandate_failed: 'NACH Mandate Failure',
    };
    return map[type] || type;
  }

  logAndUpdate(record, msg, auditData) {
    auditLogger.log({ recordId: record.id, customerName: record.customer.name, amount: 0, ...auditData });
    this.onLog(msg, record);
    this.onRecordUpdate({ ...record });
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }
  stop() { this.isRunning = false; this.isPaused = false; }
}
