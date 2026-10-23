/**
 * Smart Priority Scoring Engine (0-100)
 * Evaluates business issues based on frequency, severity, rating impact, recency, and multi-outlet spread.
 */

export const PRIORITY_LEVELS = {
  CRITICAL: { min: 80, max: 100, label: 'Critical Priority', badge: 'critical' },
  HIGH: { min: 60, max: 79, label: 'High Priority', badge: 'high' },
  MEDIUM: { min: 35, max: 59, label: 'Medium Priority', badge: 'medium' },
  LOW: { min: 0, max: 34, label: 'Low Priority', badge: 'low' }
};

export function calculatePriorityScore(issue) {
  const reviews = issue.supporting_reviews || [];
  const k = reviews.length;
  if (k === 0) return { score: 0, level: 'Low Priority', badge: 'low', explanation: 'No supporting reviews.' };

  // 1. Frequency Factor (0 - 100)
  // 1 review = 20, 3 reviews = 55, 5+ reviews = 90-100
  const frequencyFactor = Math.min(100, Math.round(15 + Math.min(k, 8) * 11));

  // 2. Severity Factor (0 - 100)
  let maxSeverity = 'Low';
  let severitySum = 0;
  let hasFoodSafetyIncident = false;

  reviews.forEach(r => {
    const sev = r.severity || 'Low';
    if (sev === 'Critical Review Required' || r.category === 'Food freshness and safety concerns') {
      hasFoodSafetyIncident = true;
      maxSeverity = 'Critical Review Required';
      severitySum += 100;
    } else if (sev === 'High') {
      if (maxSeverity !== 'Critical Review Required') maxSeverity = 'High';
      severitySum += 75;
    } else if (sev === 'Medium') {
      if (maxSeverity === 'Low') maxSeverity = 'Medium';
      severitySum += 45;
    } else {
      severitySum += 20;
    }
  });
  const severityFactor = Math.round(severitySum / k);

  // 3. Rating Impact Factor (0 - 100)
  // 1-star = 100, 2-star = 75, 3-star = 50, 4-star = 25, 5-star = 0
  const ratingSum = reviews.reduce((acc, r) => acc + (5 - (r.star_rating || 3)) * 25, 0);
  const ratingImpactFactor = Math.min(100, Math.max(0, Math.round(ratingSum / k)));

  // 4. Recency Factor (0 - 100)
  const now = new Date();
  let recencySum = 0;
  reviews.forEach(r => {
    const rDate = new Date(r.review_date || now);
    const diffDays = Math.max(0, (now - rDate) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) recencySum += 100;
    else if (diffDays <= 14) recencySum += 75;
    else if (diffDays <= 30) recencySum += 45;
    else recencySum += 20;
  });
  const recencyFactor = Math.round(recencySum / k);

  // 5. Multi-Outlet Factor (0 - 100)
  const outlets = new Set(reviews.map(r => r.outlet_name).filter(Boolean));
  let multiOutletFactor = 30; // 1 outlet
  if (outlets.size === 2) multiOutletFactor = 70;
  else if (outlets.size >= 3) multiOutletFactor = 100;

  // Weighted raw calculation
  // Weights: Severity (30%), Frequency (25%), Rating Impact (20%), Recency (15%), Outlet Spread (10%)
  let rawScore = (
    0.30 * severityFactor +
    0.25 * frequencyFactor +
    0.20 * ratingImpactFactor +
    0.15 * recencyFactor +
    0.10 * multiOutletFactor
  );

  // Safety floor: Food safety allegations must automatically be categorized as Critical (>= 85)
  if (hasFoodSafetyIncident) {
    rawScore = Math.max(rawScore, 85);
  }

  // Factor in confidence (default 0.90 if missing)
  const confidence = issue.confidence ?? 0.92;
  const finalScore = Math.min(100, Math.max(1, Math.round(rawScore * (0.85 + 0.15 * confidence))));

  // Determine Level
  let level = PRIORITY_LEVELS.LOW.label;
  let badge = PRIORITY_LEVELS.LOW.badge;
  if (finalScore >= PRIORITY_LEVELS.CRITICAL.min) {
    level = PRIORITY_LEVELS.CRITICAL.label;
    badge = PRIORITY_LEVELS.CRITICAL.badge;
  } else if (finalScore >= PRIORITY_LEVELS.HIGH.min) {
    level = PRIORITY_LEVELS.HIGH.label;
    badge = PRIORITY_LEVELS.HIGH.badge;
  } else if (finalScore >= PRIORITY_LEVELS.MEDIUM.min) {
    level = PRIORITY_LEVELS.MEDIUM.label;
    badge = PRIORITY_LEVELS.MEDIUM.badge;
  }

  // Construct transparent explanation
  const outletNames = Array.from(outlets).join(', ');
  const avgRating = (reviews.reduce((acc, r) => acc + (r.star_rating || 0), 0) / k).toFixed(1);
  const explanation = `Score ${finalScore}/100 (${level}): Based on ${k} review(s) across ${outlets.size} outlet(s) [${outletNames}]. Rating drag is severe at ${avgRating}★ average. ` +
    (hasFoodSafetyIncident 
      ? 'CRITICAL OVERRIDE: Customer reported food safety / contamination incident requiring immediate kitchen audit.' 
      : `Severity weight: ${severityFactor}%, frequency index: ${frequencyFactor}%, recency weighting: ${recencyFactor}%.`);

  return {
    score: finalScore,
    level,
    badge,
    factors: {
      frequency: frequencyFactor,
      severity: severityFactor,
      ratingImpact: ratingImpactFactor,
      recency: recencyFactor,
      multiOutlet: multiOutletFactor,
      hasFoodSafetyIncident
    },
    explanation
  };
}

export function calculateSmartPriority({ severity, reviewCount, avgRating, newestReviewDate, outletsAffectedCount, totalOutlets, hasSafetyIncident }) {
  const dummyReviews = Array.from({ length: reviewCount }).map((_, i) => ({
    severity: hasSafetyIncident ? 'Critical Review Required' : severity,
    star_rating: avgRating,
    review_date: newestReviewDate,
    outlet_name: `Outlet ${i + 1}`
  }));
  return calculatePriorityScore({
    supporting_reviews: dummyReviews,
    total_outlets: totalOutlets || 3
  });
}
