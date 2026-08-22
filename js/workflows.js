// workflows.js — Recovery workflow definitions for each failure type

import { auditLogger } from './audit.js';

// Simulate async delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Recovery probability model based on attempt number and type
function getRecoveryProbability(failureType, attemptNumber, record) {
  const baseProbabilities = {
    payment_failure:     [0.52, 0.34, 0.18],
    checkout_abandoned:  [0.38, 0.22],
    subscription_failed: [0.45, 0.30, 0.18, 0.10],
    b2b_overdue:         [0.30, 0.40, 0.28, 0.15, 0.08],
    mandate_failed:      [0.48, 0.28, 0.15],
  };

  const probs = baseProbabilities[failureType] || [0.3, 0.2];
  let prob = probs[Math.min(attemptNumber, probs.length - 1)] || 0.08;

  // Boost for high-value or premium customers
  if (record.customer.tier === 'Premium' || record.customer.tier === 'Enterprise') prob *= 1.15;
  if (record.daysOverdue <= 3) prob *= 1.20; // Early intervention
  if (record.daysOverdue > 30) prob *= 0.70;  // Stale

  return Math.min(prob, 0.85);
}

// --- PAYMENT FAILURE WORKFLOW ---
export async function paymentFailureWorkflow(record, onUpdate) {
  const steps = [
    {
      action: 'Analyze failure reason',
      channel: 'system',
      agentDecision: `Root cause identified: "${record.failureReason}". Checking alternate payment methods.`,
    },
    {
      action: 'Retry with alternate gateway',
      channel: 'payment_gateway',
      agentDecision: `Switching from ${record.paymentMethod} to alternate gateway. Initiating silent retry.`,
    },
    {
      action: 'Send payment link via SMS/Email',
      channel: 'sms_email',
      agentDecision: `Silent retry failed. Sending fresh payment link to ${record.customer.email} with 24hr expiry.`,
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    record.attemptCount++;
    record.lastAttemptAt = new Date().toISOString();
    record.interventions.push({ ...step, attempt: record.attemptCount, timestamp: new Date().toISOString() });

    onUpdate(record, `💳 Attempt ${record.attemptCount}: ${step.action}...`);
    await delay(randomBetween(300, 700));

    const prob = getRecoveryProbability('payment_failure', i, record);
    const succeeded = Math.random() < prob;

    if (succeeded) {
      record.recoveredAmount = record.amount;
      record.status = 'recovered';
      record.resolvedAt = new Date().toISOString();
      auditLogger.log({
        recordId: record.id, customerName: record.customer.name,
        action: step.action, channel: step.channel,
        amount: record.amount, outcome: 'success',
        agentDecision: step.agentDecision,
        details: `Payment recovered via ${step.channel} on attempt ${record.attemptCount}`,
      });
      return record;
    }

    auditLogger.log({
      recordId: record.id, customerName: record.customer.name,
      action: step.action, channel: step.channel,
      amount: 0, outcome: 'failed',
      agentDecision: step.agentDecision,
      details: `Attempt ${record.attemptCount} unsuccessful for ${record.failureReason}`,
    });

    if (record.attemptCount >= record.maxAttempts) break;
  }

  // Escalate if high value
  if (record.amount >= 10000) {
    record.status = 'escalated';
    auditLogger.log({
      recordId: record.id, customerName: record.customer.name,
      action: 'Escalate to human agent', channel: 'phone',
      amount: 0, outcome: 'escalated',
      agentDecision: `High-value (₹${record.amount.toLocaleString('en-IN')}) payment failure. Escalating to human recovery team.`,
      details: 'Automated recovery exhausted. Handed off to team.',
    });
  } else {
    record.status = 'failed';
    auditLogger.log({
      recordId: record.id, customerName: record.customer.name,
      action: 'Mark as unrecovered', channel: 'system',
      amount: 0, outcome: 'stopped',
      agentDecision: 'Max retries reached. Low-value record marked as unrecovered.',
      details: 'Recovery workflow terminated per stopping rules.',
    });
  }
  return record;
}

// --- CHECKOUT ABANDONMENT WORKFLOW ---
export async function checkoutAbandonedWorkflow(record, onUpdate) {
  const steps = [
    {
      action: 'Send abandoned cart reminder email',
      channel: 'email',
      agentDecision: `Cart abandoned: ${record.failureReason}. Sending personalized recovery email with cart snapshot.`,
    },
    {
      action: 'Offer 5% discount coupon via SMS',
      channel: 'sms',
      agentDecision: `Email opened but not converted. Applying ₹${Math.floor(record.amount * 0.05).toLocaleString('en-IN')} discount. Sending SMS.`,
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    record.attemptCount++;
    record.lastAttemptAt = new Date().toISOString();
    record.interventions.push({ ...step, attempt: record.attemptCount, timestamp: new Date().toISOString() });

    onUpdate(record, `🛒 Attempt ${record.attemptCount}: ${step.action}...`);
    await delay(randomBetween(400, 800));

    const prob = getRecoveryProbability('checkout_abandoned', i, record);
    const succeeded = Math.random() < prob;
    // Discount reduces recoverable amount slightly
    const recoveredAmt = i === 1 ? Math.floor(record.amount * 0.95) : record.amount;

    if (succeeded) {
      record.recoveredAmount = recoveredAmt;
      record.status = 'recovered';
      record.resolvedAt = new Date().toISOString();
      auditLogger.log({
        recordId: record.id, customerName: record.customer.name,
        action: step.action, channel: step.channel,
        amount: recoveredAmt, outcome: 'success',
        agentDecision: step.agentDecision,
        details: `Checkout completed. Recovered ₹${recoveredAmt.toLocaleString('en-IN')}`,
      });
      return record;
    }

    auditLogger.log({
      recordId: record.id, customerName: record.customer.name,
      action: step.action, channel: step.channel,
      amount: 0, outcome: 'failed',
      agentDecision: step.agentDecision,
      details: `Attempt ${record.attemptCount} — customer did not convert`,
    });
  }

  record.status = 'failed';
  auditLogger.log({
    recordId: record.id, customerName: record.customer.name,
    action: 'Cart recovery exhausted', channel: 'system',
    amount: 0, outcome: 'stopped',
    agentDecision: 'Max nudges sent. Stopping to avoid spam. Cart flagged for retargeting.',
    details: 'Checkout recovery stopped per max-attempt rule.',
  });
  return record;
}

// --- SUBSCRIPTION FAILURE WORKFLOW (Dunning) ---
export async function subscriptionFailedWorkflow(record, onUpdate) {
  const steps = [
    {
      action: 'Silent card retry (Day 1)',
      channel: 'payment_gateway',
      agentDecision: `Subscription charge failed: ${record.failureReason}. Initiating Day-1 silent retry.`,
    },
    {
      action: 'Email dunning notice + update card link',
      channel: 'email',
      agentDecision: `Day-1 retry failed. Sending dunning email with update-payment CTA. Grace period: 7 days.`,
    },
    {
      action: 'Offer plan downgrade to retain',
      channel: 'email_sms',
      agentDecision: `Card not updated. Offering plan downgrade to prevent full churn. Retention > revenue right now.`,
    },
    {
      action: 'Final notice before suspension',
      channel: 'email',
      agentDecision: `Last-chance notice. Account will suspend in 24 hours. Offering 1-month free if they update now.`,
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    record.attemptCount++;
    record.lastAttemptAt = new Date().toISOString();
    record.interventions.push({ ...step, attempt: record.attemptCount, timestamp: new Date().toISOString() });

    onUpdate(record, `🔄 Dunning step ${record.attemptCount}: ${step.action}...`);
    await delay(randomBetween(350, 750));

    const prob = getRecoveryProbability('subscription_failed', i, record);
    const succeeded = Math.random() < prob;

    if (succeeded) {
      record.recoveredAmount = record.amount;
      record.status = 'recovered';
      record.resolvedAt = new Date().toISOString();
      auditLogger.log({
        recordId: record.id, customerName: record.customer.name,
        action: step.action, channel: step.channel,
        amount: record.amount, outcome: 'success',
        agentDecision: step.agentDecision,
        details: `Subscription renewed on dunning step ${record.attemptCount}`,
      });
      return record;
    }

    auditLogger.log({
      recordId: record.id, customerName: record.customer.name,
      action: step.action, channel: step.channel,
      amount: 0, outcome: 'failed',
      agentDecision: step.agentDecision,
      details: `Dunning step ${record.attemptCount} — no response`,
    });

    if (record.attemptCount >= record.maxAttempts) break;
  }

  record.status = 'failed';
  auditLogger.log({
    recordId: record.id, customerName: record.customer.name,
    action: 'Suspend account + mark churned', channel: 'system',
    amount: 0, outcome: 'stopped',
    agentDecision: 'Dunning sequence exhausted. Account suspended. Flagged for win-back campaign in 30 days.',
    details: 'Subscription cancellation processed.',
  });
  return record;
}

// --- B2B RECEIVABLES CHASER ---
export async function b2bOverdueWorkflow(record, onUpdate) {
  const steps = [
    {
      action: 'Send polite payment reminder',
      channel: 'email',
      agentDecision: `Invoice ${record.id} is ${record.daysOverdue} days overdue. Sending friendly reminder to ${record.customer.email}.`,
    },
    {
      action: 'Follow up with CC to finance manager',
      channel: 'email_escalated',
      agentDecision: `No response in 5 days. Escalating email thread to CC finance head at ${record.customer.name}.`,
    },
    {
      action: 'Phone call attempt by AR team',
      channel: 'phone',
      agentDecision: `Email escalation ignored. Queuing phone call to ${record.customer.phone}. Agent briefed with dispute history.`,
    },
    {
      action: 'Negotiate partial payment / payment plan',
      channel: 'phone_email',
      agentDecision: `Phone contact made. Customer citing ${record.failureReason}. Offering structured payment plan.`,
    },
    {
      action: 'Legal notice / collections escalation',
      channel: 'legal',
      agentDecision: `Amount: ₹${record.amount.toLocaleString('en-IN')}. All soft measures exhausted. Escalating to legal / collections.`,
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    record.attemptCount++;
    record.lastAttemptAt = new Date().toISOString();
    record.interventions.push({ ...step, attempt: record.attemptCount, timestamp: new Date().toISOString() });

    onUpdate(record, `📋 B2B step ${record.attemptCount}: ${step.action}...`);
    await delay(randomBetween(500, 900));

    const prob = getRecoveryProbability('b2b_overdue', i, record);
    const succeeded = Math.random() < prob;

    if (succeeded) {
      // Partial payment common in B2B
      const partialFactor = i >= 3 ? randomBetween(60, 100) / 100 : 1.0;
      record.recoveredAmount = Math.floor(record.amount * partialFactor);
      record.status = 'recovered';
      record.resolvedAt = new Date().toISOString();
      auditLogger.log({
        recordId: record.id, customerName: record.customer.name,
        action: step.action, channel: step.channel,
        amount: record.recoveredAmount, outcome: 'success',
        agentDecision: step.agentDecision,
        details: `Payment received: ₹${record.recoveredAmount.toLocaleString('en-IN')} (${Math.floor(partialFactor * 100)}% of invoice)`,
      });
      return record;
    }

    // Legal escalation if step 5
    if (i === 4) {
      record.status = 'escalated';
      auditLogger.log({
        recordId: record.id, customerName: record.customer.name,
        action: step.action, channel: step.channel,
        amount: 0, outcome: 'escalated',
        agentDecision: step.agentDecision,
        details: `Legal escalation initiated for ₹${record.amount.toLocaleString('en-IN')} overdue.`,
      });
      return record;
    }

    auditLogger.log({
      recordId: record.id, customerName: record.customer.name,
      action: step.action, channel: step.channel,
      amount: 0, outcome: 'failed',
      agentDecision: step.agentDecision,
      details: `Step ${record.attemptCount} — awaiting response`,
    });
  }
  return record;
}

// --- MANDATE RETRY SEQUENCER ---
export async function mandateFailedWorkflow(record, onUpdate) {
  const retryWindows = ['Immediate retry', 'Retry after 48 hours', 'Retry on salary day (1st)'];

  for (let i = 0; i < retryWindows.length; i++) {
    const window = retryWindows[i];
    record.attemptCount++;
    record.lastAttemptAt = new Date().toISOString();

    const agentDecision = `NACH mandate failed: ${record.failureReason}. ${window} — checking account balance signal.`;
    record.interventions.push({ action: `Mandate retry: ${window}`, channel: 'nach', attempt: record.attemptCount, timestamp: new Date().toISOString(), agentDecision });

    onUpdate(record, `🏦 NACH ${window}...`);
    await delay(randomBetween(400, 700));

    const prob = getRecoveryProbability('mandate_failed', i, record);
    const succeeded = Math.random() < prob;

    if (succeeded) {
      record.recoveredAmount = record.amount;
      record.status = 'recovered';
      record.resolvedAt = new Date().toISOString();
      auditLogger.log({
        recordId: record.id, customerName: record.customer.name,
        action: `Mandate retry: ${window}`, channel: 'nach',
        amount: record.amount, outcome: 'success',
        agentDecision,
        details: `NACH mandate succeeded on ${window}`,
      });
      return record;
    }

    auditLogger.log({
      recordId: record.id, customerName: record.customer.name,
      action: `Mandate retry: ${window}`, channel: 'nach',
      amount: 0, outcome: 'failed',
      agentDecision,
      details: `${window} — NACH bounce again`,
    });

    if (record.attemptCount >= record.maxAttempts) break;
  }

  // Offer alternate payment
  record.status = 'escalated';
  auditLogger.log({
    recordId: record.id, customerName: record.customer.name,
    action: 'Request mandate re-registration', channel: 'email_sms',
    amount: 0, outcome: 'escalated',
    agentDecision: 'All retry windows exhausted. Sending mandate re-registration link via UPI/Net Banking.',
    details: 'Customer directed to re-authorize payment mandate.',
  });
  return record;
}

export const workflowMap = {
  payment_failure: paymentFailureWorkflow,
  checkout_abandoned: checkoutAbandonedWorkflow,
  subscription_failed: subscriptionFailedWorkflow,
  b2b_overdue: b2bOverdueWorkflow,
  mandate_failed: mandateFailedWorkflow,
};
