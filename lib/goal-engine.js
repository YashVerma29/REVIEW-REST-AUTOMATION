/**
 * Goal Tracking & Milestone Engine
 * Phase 5: Calculates goal progress from actual review telemetry
 * and handles insufficient data states gracefully without misleading statistics.
 */

export function evaluateGoalProgress(goal, reviews = []) {
  if (!goal) return null;

  const startDate = goal.start_date ? new Date(`${goal.start_date}T00:00:00.000Z`) : new Date('2020-01-01');
  const endDate = goal.end_date ? new Date(`${goal.end_date}T23:59:59.999Z`) : new Date('2030-12-31');

  // Filter reviews within the goal window
  const windowReviews = reviews.filter(r => {
    const rawDate = r.review_date || r.visit_date || r.created_at;
    if (!rawDate) return false;
    const revTime = new Date(`${rawDate.slice(0, 10)}T12:00:00.000Z`).getTime();
    return revTime >= startDate.getTime() && revTime <= endDate.getTime();
  });

  const totalInWindow = windowReviews.length;

  // Handle insufficient data state
  if (totalInWindow < 2 && goal.type !== 'increase_reviews') {
    return {
      ...goal,
      current_value: totalInWindow > 0 ? (windowReviews[0].star_rating || 3) : null,
      progress_pct: 0,
      status: 'insufficient_data',
      reviews_in_window: totalInWindow,
      status_label: 'Insufficient Data',
      explanation: 'Fewer than 2 reviews recorded in the goal window. More customer feedback required to evaluate progress.'
    };
  }

  let currentValue = 0;
  let progressPct = 0;
  let status = 'in_progress';
  let explanation = '';

  const targetValue = Number(goal.target_value);
  const baselineValue = goal.baseline_value !== undefined ? Number(goal.baseline_value) : null;

  switch (goal.type) {
    case 'improve_rating': {
      const sum = windowReviews.reduce((acc, r) => acc + (r.star_rating || 3), 0);
      currentValue = Number((sum / totalInWindow).toFixed(2));
      const baseline = baselineValue !== null ? baselineValue : 3.5;

      if (currentValue >= targetValue) {
        progressPct = 100;
        status = 'achieved';
        explanation = `Target achieved! Average rating reached ${currentValue}★ (Target: ${targetValue}★).`;
      } else if (targetValue > baseline) {
        progressPct = Math.max(0, Math.min(100, Math.round(((currentValue - baseline) / (targetValue - baseline)) * 100)));
        status = currentValue < baseline ? 'at_risk' : 'in_progress';
        explanation = `Current average is ${currentValue}★ from ${totalInWindow} reviews. Target: ${targetValue}★.`;
      } else {
        progressPct = 50;
        status = 'in_progress';
      }
      break;
    }

    case 'reduce_negative_service': {
      // Count negative service reviews
      const negativeServiceReviews = windowReviews.filter(r => {
        const star = r.star_rating !== undefined ? r.star_rating : 3;
        const analysis = r.analysis || {};
        const sent = analysis.sentiment || (star >= 4 ? 'Positive' : star <= 2 ? 'Negative' : 'Neutral');
        const isService = (analysis.primary_category === 'Service' || analysis.primary_category === 'staff' ||
          (Array.isArray(analysis.topics) && (analysis.topics.includes('service') || analysis.topics.includes('staff'))));
        return (star <= 2 || sent.toLowerCase() === 'negative') && isService;
      });

      currentValue = negativeServiceReviews.length;
      const baseline = baselineValue !== null ? baselineValue : (targetValue + 4);

      if (currentValue <= targetValue) {
        progressPct = 100;
        status = 'achieved';
        explanation = `Goal met! Recorded ${currentValue} negative service review(s) (Threshold: <= ${targetValue}).`;
      } else {
        const maxExceed = Math.max(1, baseline - targetValue);
        const reduction = Math.max(0, baseline - currentValue);
        progressPct = Math.max(0, Math.min(99, Math.round((reduction / maxExceed) * 100)));
        status = currentValue > baseline ? 'at_risk' : 'in_progress';
        explanation = `${currentValue} negative service review(s) in window (Target: <= ${targetValue}).`;
      }
      break;
    }

    case 'reduce_dish_complaints': {
      const targetDish = (goal.dish_name || '').toLowerCase();
      const dishComplaints = windowReviews.filter(r => {
        const star = r.star_rating !== undefined ? r.star_rating : 3;
        const analysis = r.analysis || {};
        const sent = analysis.sentiment || (star >= 4 ? 'Positive' : star <= 2 ? 'Negative' : 'Neutral');
        const dishes = [
          r.menu_item,
          ...(analysis.mentioned_dish_names || []),
          ...(analysis.mentioned_dishes || [])
        ].filter(Boolean).map(d => d.toLowerCase());

        const matchesDish = targetDish ? dishes.some(d => d.includes(targetDish)) : true;
        return (star <= 2 || sent.toLowerCase() === 'negative') && matchesDish;
      });

      currentValue = dishComplaints.length;
      const baseline = baselineValue !== null ? baselineValue : (targetValue + 3);

      if (currentValue <= targetValue) {
        progressPct = 100;
        status = 'achieved';
        explanation = `Dish quality target achieved! Recorded ${currentValue} complaint(s) for ${goal.dish_name || 'dish'}.`;
      } else {
        const span = Math.max(1, baseline - targetValue);
        const reduction = Math.max(0, baseline - currentValue);
        progressPct = Math.max(0, Math.min(99, Math.round((reduction / span) * 100)));
        status = currentValue > baseline ? 'at_risk' : 'in_progress';
        explanation = `Recorded ${currentValue} complaint(s) for ${goal.dish_name || 'dish'} (Target: <= ${targetValue}).`;
      }
      break;
    }

    case 'increase_reviews': {
      currentValue = totalInWindow;
      progressPct = Math.min(100, Math.round((currentValue / Math.max(1, targetValue)) * 100));
      if (currentValue >= targetValue) {
        status = 'achieved';
        explanation = `Review collection goal achieved! Collected ${currentValue} reviews (Target: ${targetValue}).`;
      } else {
        status = 'in_progress';
        explanation = `Collected ${currentValue} / ${targetValue} reviews (${progressPct}% completed).`;
      }
      break;
    }

    default: {
      currentValue = totalInWindow;
      progressPct = Math.min(100, Math.round((currentValue / Math.max(1, targetValue)) * 100));
      status = currentValue >= targetValue ? 'achieved' : 'in_progress';
      explanation = `Current progress: ${currentValue} / ${targetValue}.`;
      break;
    }
  }

  return {
    ...goal,
    current_value: currentValue,
    baseline_value: baselineValue,
    progress_pct: progressPct,
    status,
    reviews_in_window: totalInWindow,
    status_label: status === 'achieved' ? 'Achieved' : status === 'at_risk' ? 'At Risk' : 'In Progress',
    explanation
  };
}
