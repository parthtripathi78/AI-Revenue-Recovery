// charts.js — Chart rendering using Chart.js

let recoveryDonut = null;
let channelBar = null;
let timelineChart = null;
let recoveryCurve = null;

function destroyChart(chart) {
  if (chart) { try { chart.destroy(); } catch(e) {} }
}

export function renderRecoveryDonut(summary) {
  const ctx = document.getElementById('recoveryDonut');
  if (!ctx) return;
  destroyChart(recoveryDonut);

  const { byStatus } = summary;
  recoveryDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Recovered', 'Failed', 'Escalated', 'In Progress', 'DNC', 'Pending'],
      datasets: [{
        data: [byStatus.recovered, byStatus.failed, byStatus.escalated, byStatus.in_progress, byStatus.dnc, byStatus.pending],
        backgroundColor: ['#00D4AA', '#FF4757', '#FFA502', '#4ECDC4', '#747D8C', '#2F3542'],
        borderColor: '#0D1B2A',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#A8B2C1', font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} records`
          }
        }
      },
      animation: { animateScale: true, duration: 800 },
    }
  });
}

export function renderChannelBar(summary) {
  const ctx = document.getElementById('channelBar');
  if (!ctx) return;
  destroyChart(channelBar);

  const types = Object.keys(summary.byType);
  const labels = types.map(t => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
  const atRisk = types.map(t => summary.byType[t].atRisk / 100000); // in lakhs
  const recovered = types.map(t => summary.byType[t].recovered / 100000);

  channelBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'At Risk (₹L)',
          data: atRisk,
          backgroundColor: 'rgba(255, 71, 87, 0.6)',
          borderColor: '#FF4757',
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: 'Recovered (₹L)',
          data: recovered,
          backgroundColor: 'rgba(0, 212, 170, 0.7)',
          borderColor: '#00D4AA',
          borderWidth: 1,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#A8B2C1', font: { size: 11, family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: {
          ticks: { color: '#A8B2C1', font: { size: 11, family: 'Inter' }, callback: v => `₹${v.toFixed(1)}L` },
          grid: { color: 'rgba(255,255,255,0.08)' },
        }
      },
      plugins: {
        legend: { labels: { color: '#A8B2C1', font: { family: 'Inter', size: 12 }, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ₹${(ctx.parsed.y * 100000).toLocaleString('en-IN')}`
          }
        }
      },
      animation: { duration: 700 },
    }
  });
}

export function renderRecoveryCurve(recoveredOverTime) {
  const ctx = document.getElementById('recoveryCurve');
  if (!ctx) return;
  destroyChart(recoveryCurve);

  recoveryCurve = new Chart(ctx, {
    type: 'line',
    data: {
      labels: recoveredOverTime.map((_, i) => `#${i + 1}`),
      datasets: [{
        label: 'Cumulative Recovered (₹)',
        data: recoveredOverTime,
        borderColor: '#00D4AA',
        backgroundColor: 'rgba(0, 212, 170, 0.15)',
        pointBackgroundColor: '#00D4AA',
        pointRadius: 3,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#A8B2C1', font: { size: 10, family: 'Inter' } }, grid: { display: false } },
        y: {
          ticks: { color: '#A8B2C1', font: { size: 10, family: 'Inter' }, callback: v => `₹${(v / 1000).toFixed(0)}K` },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      },
      plugins: {
        legend: { labels: { color: '#A8B2C1', font: { family: 'Inter' }, usePointStyle: true } },
        tooltip: {
          callbacks: { label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN')} recovered` }
        }
      },
      animation: { duration: 400 },
    }
  });
}

export function updateRecoveryCurve(value) {
  if (!recoveryCurve) return;
  recoveryCurve.data.datasets[0].data.push(value);
  recoveryCurve.data.labels.push(`#${recoveryCurve.data.labels.length + 1}`);
  recoveryCurve.update('none');
}
