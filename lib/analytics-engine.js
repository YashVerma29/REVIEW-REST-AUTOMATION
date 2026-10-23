/**
 * Analytics & Growth Telemetry Engine
 * Phase 5: Date-filterable metrics, period-over-period comparisons,
 * rating distribution, sentiment trends, volume over time, and frequently mentioned dishes.
 */

export function calculateAnalyticsMetrics(reviews = [], options = {}) {
  const {
    period = '30d',
    startDate = null,
    endDate = null,
    outlet = 'All Outlets'
  } = options;

  // Filter by outlet if specified
  const outletFiltered = (!outlet || outlet === 'All Outlets')
    ? reviews
    : reviews.filter(r => (r.outlet_name || 'Main') === outlet);

  // Determine current period date boundaries
  // Use current local simulation time (2026-10-22) as default upper bound if no dates specified
  const now = new Date('2026-10-22T23:59:59.999Z');
  let currentStart;
  let currentEnd;
  let durationMs;

  if (startDate && endDate) {
    currentStart = new Date(`${startDate}T00:00:00.000Z`);
    currentEnd = new Date(`${endDate}T23:59:59.999Z`);
    durationMs = Math.max(currentEnd.getTime() - currentStart.getTime(), 86400000);
  } else if (period === '7d') {
    durationMs = 7 * 86400000;
    currentEnd = now;
    currentStart = new Date(now.getTime() - durationMs);
  } else if (period === '90d') {
    durationMs = 90 * 86400000;
    currentEnd = now;
    currentStart = new Date(now.getTime() - durationMs);
  } else if (period === 'all') {
    durationMs = 365 * 86400000;
    currentEnd = now;
    currentStart = new Date('2020-01-01T00:00:00.000Z');
  } else {
    // Default 30d
    durationMs = 30 * 86400000;
    currentEnd = now;
    currentStart = new Date(now.getTime() - durationMs);
  }

  // Determine previous period date boundaries for period-over-period comparison
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  // Partition reviews into current and previous period
  const currentReviews = [];
  const previousReviews = [];

  outletFiltered.forEach(r => {
    const rawDate = r.review_date || r.visit_date || r.created_at;
    if (!rawDate) return;
    const revTime = new Date(`${rawDate.slice(0, 10)}T12:00:00.000Z`).getTime();

    if (revTime >= currentStart.getTime() && revTime <= currentEnd.getTime()) {
      currentReviews.push(r);
    } else if (revTime >= previousStart.getTime() && revTime <= previousEnd.getTime()) {
      previousReviews.push(r);
    }
  });

  // Calculate current period stats
  const total = currentReviews.length;
  let ratingSum = 0;
  const ratingDistribution = {
    1: { count: 0, percentage: 0 },
    2: { count: 0, percentage: 0 },
    3: { count: 0, percentage: 0 },
    4: { count: 0, percentage: 0 },
    5: { count: 0, percentage: 0 }
  };

  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;

  const volumeByDate = {};
  const sentimentByDate = {};
  const complaintCategoryCounts = {};
  const praiseCategoryCounts = {};
  const dishStats = {};

  currentReviews.forEach(r => {
    const star = Math.max(1, Math.min(5, Math.round(r.star_rating !== undefined ? r.star_rating : (r.rating !== undefined ? r.rating : 3))));
    ratingDistribution[star].count++;
    ratingSum += star;

    const analysis = r.analysis || {};
    const sent = (analysis.sentiment || (star >= 4 ? 'Positive' : star <= 2 ? 'Negative' : 'Neutral')).toLowerCase();

    if (sent === 'positive') positiveCount++;
    else if (sent === 'negative') negativeCount++;
    else neutralCount++;

    // Volume over time
    const dStr = (r.review_date || r.visit_date || '2026-10-15').slice(0, 10);
    volumeByDate[dStr] = (volumeByDate[dStr] || 0) + 1;

    if (!sentimentByDate[dStr]) {
      sentimentByDate[dStr] = { date: dStr, positive: 0, neutral: 0, negative: 0, total: 0 };
    }
    sentimentByDate[dStr][sent]++;
    sentimentByDate[dStr].total++;

    // Complaint & praise categories
    const primaryCat = analysis.primary_category || (Array.isArray(analysis.topics) && analysis.topics[0]) || 'Operational';
    if (star <= 2 || sent === 'negative') {
      complaintCategoryCounts[primaryCat] = (complaintCategoryCounts[primaryCat] || 0) + 1;
    } else if (star >= 4 || sent === 'positive') {
      praiseCategoryCounts[primaryCat] = (praiseCategoryCounts[primaryCat] || 0) + 1;
    }

    // Dish mentions
    const dishes = [...(analysis.mentioned_dish_names || []), ...(analysis.mentioned_dishes || [])];
    if (r.menu_item && !dishes.includes(r.menu_item)) dishes.push(r.menu_item);

    dishes.forEach(dish => {
      const trimmed = dish.trim();
      if (!trimmed) return;
      if (!dishStats[trimmed]) {
        dishStats[trimmed] = {
          dish_name: trimmed,
          mentions_count: 0,
          rating_sum: 0,
          positive_count: 0,
          negative_count: 0
        };
      }
      dishStats[trimmed].mentions_count++;
      dishStats[trimmed].rating_sum += star;
      if (sent === 'positive' || star >= 4) dishStats[trimmed].positive_count++;
      if (sent === 'negative' || star <= 2) dishStats[trimmed].negative_count++;
    });
  });

  // Calculate percentages for rating distribution
  if (total > 0) {
    for (let s = 1; s <= 5; s++) {
      ratingDistribution[s].percentage = Number(((ratingDistribution[s].count / total) * 100).toFixed(1));
    }
  }

  const averageRating = total > 0 ? Number((ratingSum / total).toFixed(2)) : 0;
  const positivePct = total > 0 ? Number(((positiveCount / total) * 100).toFixed(1)) : 0;
  const neutralPct = total > 0 ? Number(((neutralCount / total) * 100).toFixed(1)) : 0;
  const negativePct = total > 0 ? Number(((negativeCount / total) * 100).toFixed(1)) : 0;

  // Frequently mentioned dishes array
  const frequentlyMentionedDishes = Object.values(dishStats)
    .sort((a, b) => b.mentions_count - a.mentions_count)
    .map(d => ({
      dish_name: d.dish_name,
      mentions_count: d.mentions_count,
      average_rating: Number((d.rating_sum / d.mentions_count).toFixed(2)),
      positive_percentage: Number(((d.positive_count / d.mentions_count) * 100).toFixed(1)),
      negative_percentage: Number(((d.negative_count / d.mentions_count) * 100).toFixed(1)),
      positive_count: d.positive_count,
      negative_count: d.negative_count
    }));

  // Sentiment trends array
  const sentimentTrends = Object.values(sentimentByDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Volume over time array
  const volumeOverTime = Object.entries(volumeByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Top complaint and praise categories
  const topComplaintCategories = Object.entries(complaintCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
    }));

  const topPraiseCategories = Object.entries(praiseCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
    }));

  // Period-over-Period Comparison Logic
  const prevTotal = previousReviews.length;
  let prevRatingSum = 0;
  let prevPosCount = 0;
  let prevNegCount = 0;

  previousReviews.forEach(r => {
    const star = Math.max(1, Math.min(5, Math.round(r.star_rating !== undefined ? r.star_rating : 3)));
    prevRatingSum += star;
    const sent = (r.analysis?.sentiment || (star >= 4 ? 'positive' : star <= 2 ? 'negative' : 'neutral')).toLowerCase();
    if (sent === 'positive') prevPosCount++;
    if (sent === 'negative') prevNegCount++;
  });

  const prevAvgRating = prevTotal > 0 ? Number((prevRatingSum / prevTotal).toFixed(2)) : 0;
  const prevPosPct = prevTotal > 0 ? Number(((prevPosCount / prevTotal) * 100).toFixed(1)) : 0;
  const prevNegPct = prevTotal > 0 ? Number(((prevNegCount / prevTotal) * 100).toFixed(1)) : 0;

  // Zero-baseline logic: do not produce NaN or Infinity if previous period is 0 or current is empty
  const hasSufficientComparisonData = prevTotal >= 2 && total >= 2;

  const comparison = {
    has_sufficient_data: hasSufficientComparisonData,
    explanation: hasSufficientComparisonData
      ? 'Comparison calculated against the immediately preceding period of equal duration.'
      : 'Insufficient historical baseline data in the previous period to calculate statistically valid percentage deltas.',
    previous_period: {
      window: `${previousStart.toISOString().slice(0, 10)} to ${previousEnd.toISOString().slice(0, 10)}`,
      total_reviews: prevTotal,
      average_rating: prevAvgRating,
      positive_percentage: prevPosPct,
      negative_percentage: prevNegPct
    },
    deltas: {
      volume_delta: hasSufficientComparisonData ? (total - prevTotal) : null,
      volume_pct_change: hasSufficientComparisonData && prevTotal > 0 ? Number((((total - prevTotal) / prevTotal) * 100).toFixed(1)) : null,
      rating_delta: hasSufficientComparisonData ? Number((averageRating - prevAvgRating).toFixed(2)) : null,
      positive_pct_delta: hasSufficientComparisonData ? Number((positivePct - prevPosPct).toFixed(1)) : null,
      negative_pct_delta: hasSufficientComparisonData ? Number((negativePct - prevNegPct).toFixed(1)) : null
    }
  };

  return {
    query: {
      period,
      start_date: currentStart.toISOString().slice(0, 10),
      end_date: currentEnd.toISOString().slice(0, 10),
      outlet
    },
    summary: {
      total_reviews: total,
      average_rating: averageRating,
      positive_count: positiveCount,
      neutral_count: neutralCount,
      negative_count: negativeCount,
      positive_percentage: positivePct,
      neutral_percentage: neutralPct,
      negative_percentage: negativePct,
      has_sufficient_data: total >= 1
    },
    rating_distribution: ratingDistribution,
    sentiment_trends: sentimentTrends,
    volume_over_time: volumeOverTime,
    top_complaint_categories: topComplaintCategories,
    top_praise_categories: topPraiseCategories,
    frequently_mentioned_dishes: frequentlyMentionedDishes,
    period_over_period: comparison
  };
}
