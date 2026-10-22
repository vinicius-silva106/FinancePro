/**
 * FinancePro - High Performance Vector Chart Engine (SVG)
 * Zero external dependencies, ultra-lightweight, crystal clear on Retina & Mobile displays.
 */

class FinanceCharts {
  /**
   * Renders the Future Cash Flow Runway Projection
   * @param {string} containerId - Target element ID
   * @param {Array} timeline - Array of { date, balance, income, expense, events }
   */
  static renderForecastChart(containerId, timeline) {
    const container = document.getElementById(containerId);
    if (!container || !timeline || timeline.length === 0) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 240;
    const padding = { top: 20, right: 25, bottom: 35, left: 60 };

    const balances = timeline.map(t => t.balance);
    const minVal = Math.min(...balances);
    const maxVal = Math.max(...balances);
    
    const range = (maxVal - minVal) || 100;
    const yMin = Math.min(0, minVal - range * 0.1);
    const yMax = maxVal + range * 0.1;

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const getX = (index) => padding.left + (index / (timeline.length - 1)) * plotWidth;
    const getY = (val) => padding.top + plotHeight - ((val - yMin) / (yMax - yMin)) * plotHeight;

    let pathD = `M ${getX(0)} ${getY(timeline[0].balance)}`;
    for (let i = 1; i < timeline.length; i++) {
      pathD += ` L ${getX(i)} ${getY(timeline[i].balance)}`;
    }

    const areaD = `${pathD} L ${getX(timeline.length - 1)} ${padding.top + plotHeight} L ${getX(0)} ${padding.top + plotHeight} Z`;

    let zeroLine = '';
    if (yMin < 0 && yMax > 0) {
      const zeroY = getY(0);
      zeroLine = `<line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="#EF4444" stroke-dasharray="4" stroke-width="1.5" opacity="0.7"/>
                  <text x="${padding.left - 8}" y="${zeroY + 4}" fill="#EF4444" font-size="10" text-anchor="end" font-weight="600">R$ 0</text>`;
    }

    const yLabels = [yMin, (yMin + yMax) / 2, yMax];
    const yLabelsSvg = yLabels.map(val => {
      const y = getY(val);
      return `<text x="${padding.left - 8}" y="${y + 4}" fill="#64748B" font-size="10" text-anchor="end">R$ ${Math.round(val).toLocaleString('pt-BR')}</text>
              <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    }).join('');

    const xIndices = [0, Math.floor(timeline.length / 2), timeline.length - 1];
    const xLabelsSvg = xIndices.map(idx => {
      const x = getX(idx);
      const rawDate = timeline[idx].date.split('-');
      const formatted = `${rawDate[2]}/${rawDate[1]}`;
      return `<text x="${x}" y="${height - 10}" fill="#64748B" font-size="11" text-anchor="middle">${formatted}</text>`;
    }).join('');

    const hasNegative = minVal < 0;
    const strokeColor = hasNegative ? '#F43F5E' : '#6366F1';
    const gradId = `forecastGrad_${Math.random().toString(36).substr(2, 9)}`;

    const svgHtml = `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        ${yLabelsSvg}
        ${zeroLine}
        <path d="${areaD}" fill="url(#${gradId})"/>
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${xLabelsSvg}
      </svg>
      <div id="chart-tooltip" style="position: absolute; display: none; background: #1E293B; color: #FFF; padding: 6px 12px; border-radius: 8px; font-size: 11px; pointer-events: none; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 10;"></div>
    `;

    container.innerHTML = svgHtml;

    const tooltip = container.querySelector('#chart-tooltip');
    const handleMove = (clientX) => {
      const rect = container.getBoundingClientRect();
      const relX = clientX - rect.left;
      if (relX < padding.left || relX > width - padding.right) {
        tooltip.style.display = 'none';
        return;
      }
      const ratio = (relX - padding.left) / plotWidth;
      const idx = Math.min(timeline.length - 1, Math.max(0, Math.round(ratio * (timeline.length - 1))));
      const item = timeline[idx];

      const rawDate = item.date.split('-');
      const formattedDate = `${rawDate[2]}/${rawDate[1]}/${rawDate[0]}`;
      const eventsHtml = item.events.length > 0 ? `<div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; font-size: 10px; color: #CBD5E1;">${item.events.join('<br>')}</div>` : '';

      tooltip.innerHTML = `
        <strong>${formattedDate}</strong><br>
        Saldo Previsto: <span style="color: ${item.balance >= 0 ? '#10B981' : '#F43F5E'}; font-weight: 700;">R$ ${item.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        ${eventsHtml}
      `;
      tooltip.style.display = 'block';
      tooltip.style.left = `${Math.min(width - 150, Math.max(10, relX - 70))}px`;
      tooltip.style.top = `10px`;
    };

    container.onmousemove = (e) => handleMove(e.clientX);
    container.onmouseleave = () => { tooltip.style.display = 'none'; };
    container.ontouchmove = (e) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX);
    };
    container.ontouchend = () => { tooltip.style.display = 'none'; };
  }

  /**
   * Renders the Daily Expenses Timeline & Accumulation Curve
   * @param {string} containerId - Target element ID
   * @param {Array} dailyTimeline - Array of { day, date, amount, accumulated, count }
   */
  static renderExpensesTimelineChart(containerId, dailyTimeline) {
    const container = document.getElementById(containerId);
    if (!container || !dailyTimeline || dailyTimeline.length === 0) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 220;
    const padding = { top: 25, right: 30, bottom: 35, left: 60 };

    const amounts = dailyTimeline.map(d => d.amount);
    const accumulated = dailyTimeline.map(d => d.accumulated);
    const maxDaily = Math.max(...amounts, 50);
    const maxAccum = Math.max(...accumulated, 100);

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const numDays = dailyTimeline.length;
    const stepX = plotWidth / numDays;
    const barWidth = Math.max(4, Math.min(14, stepX * 0.55));

    const getYDaily = (val) => padding.top + plotHeight - (val / maxDaily) * plotHeight;
    const getYAccum = (val) => padding.top + plotHeight - (val / maxAccum) * plotHeight;

    const yGridSteps = [0, maxAccum * 0.5, maxAccum];
    const yGridSvg = yGridSteps.map(val => {
      const y = getYAccum(val);
      return `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
        <text x="${padding.left - 8}" y="${y + 4}" fill="#64748B" font-size="10" text-anchor="end">R$ ${Math.round(val).toLocaleString('pt-BR')}</text>
      `;
    }).join('');

    const barsSvg = dailyTimeline.map((item, idx) => {
      const x = padding.left + (idx + 0.5) * stepX - barWidth / 2;
      const barH = item.amount > 0 ? ((item.amount / maxDaily) * (plotHeight * 0.85)) : 2;
      const y = padding.top + plotHeight - barH;
      const fillColor = item.amount > 0 ? 'url(#expenseBarGrad)' : 'rgba(255,255,255,0.04)';
      const opacity = item.amount > 0 ? '1' : '0.5';

      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" fill="${fillColor}" opacity="${opacity}" />`;
    }).join('');

    let curvePath = `M ${padding.left + 0.5 * stepX} ${getYAccum(dailyTimeline[0].accumulated)}`;
    for (let i = 1; i < numDays; i++) {
      const cx = padding.left + (i + 0.5) * stepX;
      const cy = getYAccum(dailyTimeline[i].accumulated);
      curvePath += ` L ${cx} ${cy}`;
    }

    const xLabelsSvg = dailyTimeline.filter(d => d.day === 1 || d.day % 5 === 0 || d.day === numDays).map(d => {
      const x = padding.left + (d.day - 0.5) * stepX;
      return `<text x="${x}" y="${height - 10}" fill="#64748B" font-size="10" text-anchor="middle">Dia ${d.day}</text>`;
    }).join('');

    const svgHtml = `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
        <defs>
          <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FB7185"/>
            <stop offset="100%" stop-color="#E11D48"/>
          </linearGradient>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#F59E0B"/>
            <stop offset="100%" stop-color="#F43F5E"/>
          </linearGradient>
        </defs>
        ${yGridSvg}
        ${barsSvg}
        <path d="${curvePath}" fill="none" stroke="url(#curveGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${xLabelsSvg}
      </svg>
      <div id="timeline-tooltip" style="position: absolute; display: none; background: #1E293B; color: #FFF; padding: 8px 12px; border-radius: 8px; font-size: 11px; pointer-events: none; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 14px rgba(0,0,0,0.6); z-index: 10;"></div>
    `;

    container.innerHTML = svgHtml;

    const tooltip = container.querySelector('#timeline-tooltip');
    const handleHover = (clientX) => {
      const rect = container.getBoundingClientRect();
      const relX = clientX - rect.left;
      if (relX < padding.left || relX > width - padding.right) {
        tooltip.style.display = 'none';
        return;
      }

      const ratio = (relX - padding.left) / plotWidth;
      const idx = Math.min(numDays - 1, Math.max(0, Math.floor(ratio * numDays)));
      const item = dailyTimeline[idx];

      const parts = item.date.split('-');
      const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

      tooltip.innerHTML = `
        <strong>📅 ${formattedDate}</strong><br>
        Gasto no Dia: <span style="color: #F43F5E; font-weight: 700;">R$ ${item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> (${item.count} compra${item.count !== 1 ? 's' : ''})<br>
        Total Acumulado: <span style="color: #F59E0B; font-weight: 700;">R$ ${item.accumulated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      `;
      tooltip.style.display = 'block';
      tooltip.style.left = `${Math.min(width - 160, Math.max(10, relX - 60))}px`;
      tooltip.style.top = `10px`;
    };

    container.onmousemove = (e) => handleHover(e.clientX);
    container.onmouseleave = () => { tooltip.style.display = 'none'; };
    container.ontouchmove = (e) => {
      if (e.touches.length > 0) handleHover(e.touches[0].clientX);
    };
    container.ontouchend = () => { tooltip.style.display = 'none'; };
  }
}

window.FinanceCharts = FinanceCharts;
