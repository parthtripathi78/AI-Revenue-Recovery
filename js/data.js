// data.js — Realistic mock batch data generator for AI Revenue Recovery Agent

const FAILURE_TYPES = ['payment_failure', 'checkout_abandoned', 'subscription_failed', 'b2b_overdue', 'mandate_failed'];

const CUSTOMERS = [
  { name: 'Riya Sharma', email: 'riya.sharma@techcorp.in', phone: '+91-9876543210', type: 'B2C', tier: 'Premium' },
  { name: 'Arjun Mehta', email: 'arjun.mehta@startup.io', phone: '+91-9123456789', type: 'B2C', tier: 'Standard' },
  { name: 'Priya Patel', email: 'priya@designhub.co', phone: '+91-9988776655', type: 'B2C', tier: 'Premium' },
  { name: 'InnovateTech Pvt Ltd', email: 'finance@innovatetech.in', phone: '+91-9000000001', type: 'B2B', tier: 'Enterprise' },
  { name: 'Cloudify Solutions', email: 'accounts@cloudify.io', phone: '+91-9000000002', type: 'B2B', tier: 'Enterprise' },
  { name: 'Sneha Kapoor', email: 'sneha.kapoor@gmail.com', phone: '+91-9876500001', type: 'B2C', tier: 'Basic' },
  { name: 'Rohit Gupta', email: 'rohit.g@fintech.co', phone: '+91-9876500002', type: 'B2C', tier: 'Standard' },
  { name: 'DataStream Analytics', email: 'billing@datastream.in', phone: '+91-9000000003', type: 'B2B', tier: 'Business' },
  { name: 'Aarav Singh', email: 'aarav@ecommerce.co', phone: '+91-9876500003', type: 'B2C', tier: 'Premium' },
  { name: 'NexGen Retail Ltd', email: 'ap@nexgenretail.in', phone: '+91-9000000004', type: 'B2B', tier: 'Enterprise' },
  { name: 'Meera Nair', email: 'meera.nair@outlook.com', phone: '+91-9876500004', type: 'B2C', tier: 'Basic' },
  { name: 'Vikram Joshi', email: 'vikram@saasplatform.io', phone: '+91-9876500005', type: 'B2C', tier: 'Standard' },
  { name: 'BuildRight Construction', email: 'finance@buildright.co', phone: '+91-9000000005', type: 'B2B', tier: 'Business' },
  { name: 'Kavya Reddy', email: 'kavya.reddy@studio.in', phone: '+91-9876500006', type: 'B2C', tier: 'Premium' },
  { name: 'Suresh Iyer', email: 'suresh.iyer@enterprise.co', phone: '+91-9876500007', type: 'B2C', tier: 'Standard' },
];

const PRODUCTS = [
  { name: 'Pro Subscription', price: 2999, category: 'SaaS' },
  { name: 'Enterprise Suite', price: 49999, category: 'SaaS' },
  { name: 'Basic Plan', price: 499, category: 'SaaS' },
  { name: 'Analytics Bundle', price: 8999, category: 'SaaS' },
  { name: 'E-commerce Cart', price: 3750, category: 'E-commerce' },
  { name: 'Premium Checkout', price: 12500, category: 'E-commerce' },
  { name: 'Annual License', price: 75000, category: 'License' },
  { name: 'Consulting Invoice', price: 150000, category: 'B2B Services' },
  { name: 'Monthly Retainer', price: 25000, category: 'B2B Services' },
  { name: 'Starter Pack', price: 999, category: 'SaaS' },
];

const PAYMENT_METHODS = ['Visa ****4242', 'Mastercard ****9870', 'UPI - PhonePe', 'UPI - GPay', 'Net Banking - HDFC', 'NACH Mandate', 'Razorpay PG'];
const FAILURE_REASONS = {
  payment_failure: ['Insufficient funds', 'Card expired', 'Bank declined', 'CVV mismatch', 'Network timeout', '3DS auth failed'],
  checkout_abandoned: ['Price shock at checkout', 'Forced account creation', 'Slow page load', 'Payment method unavailable', 'Shipping cost surprise', 'Session timeout'],
  subscription_failed: ['Card expired', 'Bank declined recurring', 'Mandate revoked', 'Credit limit exceeded', 'Account frozen'],
  b2b_overdue: ['Cash flow issue', 'Invoice dispute', 'Payment approver on leave', 'Bank transfer delayed', 'PO number mismatch'],
  mandate_failed: ['NACH bounce', 'Account closed', 'Insufficient balance', 'Mandate limit exceeded', 'Bank downtime'],
};

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId() {
  return 'REC-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function generateRecord(index) {
  const failureType = FAILURE_TYPES[index % FAILURE_TYPES.length] || randomChoice(FAILURE_TYPES);
  const customer = randomChoice(CUSTOMERS);
  const product = randomChoice(PRODUCTS);
  const paymentMethod = randomChoice(PAYMENT_METHODS);
  const failureReason = randomChoice(FAILURE_REASONS[failureType]);
  
  // B2B gets higher amounts
  let amount = product.price;
  if (customer.type === 'B2B') amount = amount * randomBetween(2, 8);
  if (failureType === 'b2b_overdue') amount = randomBetween(25000, 500000);
  
  const daysOverdue = randomBetween(1, 45);
  const riskScore = calculateRiskScore(failureType, daysOverdue, amount, customer.tier);
  
  return {
    id: generateId(),
    index: index + 1,
    customer: { ...customer },
    product: { ...product },
    failureType,
    failureReason,
    paymentMethod,
    amount,
    currency: 'INR',
    daysOverdue,
    riskScore,
    attemptCount: 0,
    maxAttempts: getMaxAttempts(failureType, customer.type),
    status: 'pending', // pending | in_progress | recovered | failed | escalated | dnc
    recoveredAmount: 0,
    channel: null,
    interventions: [],
    auditLog: [],
    createdAt: daysAgo(daysOverdue),
    lastAttemptAt: null,
    resolvedAt: null,
    isDNC: Math.random() < 0.04, // 4% are DNC
    notes: '',
  };
}

function calculateRiskScore(failureType, daysOverdue, amount, tier) {
  let score = 0;
  // Time decay
  if (daysOverdue <= 3) score += 40;
  else if (daysOverdue <= 7) score += 30;
  else if (daysOverdue <= 14) score += 20;
  else if (daysOverdue <= 30) score += 10;
  else score += 5;
  // Amount factor
  if (amount >= 100000) score += 30;
  else if (amount >= 25000) score += 20;
  else if (amount >= 5000) score += 10;
  else score += 5;
  // Tier factor
  const tierScores = { Enterprise: 25, Premium: 20, Business: 18, Standard: 12, Basic: 8 };
  score += tierScores[tier] || 10;
  // Type factor
  const typeScores = { b2b_overdue: 5, payment_failure: 4, subscription_failed: 3, mandate_failed: 3, checkout_abandoned: 2 };
  score += typeScores[failureType] || 2;
  return Math.min(score, 100);
}

function getMaxAttempts(failureType, customerType) {
  const base = {
    payment_failure: 3,
    checkout_abandoned: 2,
    subscription_failed: 4,
    b2b_overdue: 5,
    mandate_failed: 3,
  };
  return base[failureType] || 3;
}

export function generateBatch(count = 50) {
  // Distribute across failure types
  const records = [];
  for (let i = 0; i < count; i++) {
    records.push(generateRecord(i));
  }
  // Sort by risk score descending (agent processes highest risk first)
  return records.sort((a, b) => b.riskScore - a.riskScore);
}

export function getBatchSummary(records) {
  const totalAtRisk = records.reduce((s, r) => s + r.amount, 0);
  const totalRecovered = records.reduce((s, r) => s + r.recoveredAmount, 0);
  const byType = {};
  FAILURE_TYPES.forEach(t => {
    const typeRecords = records.filter(r => r.failureType === t);
    byType[t] = {
      count: typeRecords.length,
      atRisk: typeRecords.reduce((s, r) => s + r.amount, 0),
      recovered: typeRecords.reduce((s, r) => s + r.recoveredAmount, 0),
    };
  });
  return {
    total: records.length,
    totalAtRisk,
    totalRecovered,
    recoveryRate: totalAtRisk > 0 ? (totalRecovered / totalAtRisk * 100).toFixed(1) : 0,
    byStatus: {
      pending: records.filter(r => r.status === 'pending').length,
      in_progress: records.filter(r => r.status === 'in_progress').length,
      recovered: records.filter(r => r.status === 'recovered').length,
      failed: records.filter(r => r.status === 'failed').length,
      escalated: records.filter(r => r.status === 'escalated').length,
      dnc: records.filter(r => r.status === 'dnc').length,
    },
    byType,
  };
}

export { FAILURE_TYPES };
