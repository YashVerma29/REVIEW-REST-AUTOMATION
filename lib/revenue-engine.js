/**
 * Revenue Intelligence Engine
 * Phase 5: Imports verified sales data, analyzes dish performance,
 * correlates sentiment with actual revenue, and conducts before-and-after comparisons.
 *
 * CRITICAL RULE:
 * Never infer actual revenue from review ratings alone.
 * Do not invent profit margins, sales figures, or the causal impact of an AI recommendation.
 * Sales insights appear ONLY when sufficient sales data is available.
 */

export function parseSalesCSV(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') {
    throw new Error('CSV content is empty or invalid.');
  }

  const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row.');
  }

  // Parse header
  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

  const findIdx = (aliases) => rawHeaders.findIndex(h => aliases.includes(h));

  const dishIdx = findIdx(['dish_name', 'item_name', 'item', 'product', 'dish', 'name']);
  const unitsIdx = findIdx(['units_sold', 'monthly_units', 'orders', 'quantity', 'units', 'qty', 'count']);
  const priceIdx = findIdx(['price', 'unit_price', 'price_inr', 'rate', 'cost_per_unit']);
  const revenueIdx = findIdx(['revenue', 'monthly_revenue', 'total_revenue', 'sales', 'monthly_revenue_inr', 'total_sales']);
  const dateIdx = findIdx(['date', 'month', 'period', 'order_date', 'timestamp']);
  const outletIdx = findIdx(['outlet_name', 'outlet', 'location', 'branch']);
  const foodCostIdx = findIdx(['food_cost_pct', 'food_cost', 'cost_pct']);

  if (dishIdx === -1) {
    throw new Error('Missing required column: "dish_name" or "item_name".');
  }

  const parsedRecords = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (row.length === 0 || !row[dishIdx]) continue;

    const dishName = row[dishIdx].trim();
    if (!dishName) continue;

    const units = unitsIdx !== -1 && row[unitsIdx] ? parseInt(row[unitsIdx], 10) : 0;
    const price = priceIdx !== -1 && row[priceIdx] ? parseFloat(row[priceIdx]) : 0;

    let revenue = 0;
    if (revenueIdx !== -1 && row[revenueIdx]) {
      revenue = parseFloat(row[revenueIdx]);
    } else if (units > 0 && price > 0) {
      revenue = units * price;
    }

    if (isNaN(units) || units < 0) {
      throw new Error(`Row ${i + 1}: Invalid units sold "${row[unitsIdx]}".`);
    }

    parsedRecords.push({
      dish_name: dishName,
      units_sold: units,
      price: price > 0 ? price : (units > 0 && revenue > 0 ? Math.round(revenue / units) : 0),
      revenue: Math.round(revenue),
      food_cost_pct: foodCostIdx !== -1 && row[foodCostIdx] ? parseFloat(row[foodCostIdx]) : null,
      date: dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : '2026-10',
      outlet_name: outletIdx !== -1 && row[outletIdx] ? row[outletIdx] : 'All Outlets'
    });
  }

  if (parsedRecords.length === 0) {
    throw new Error('No valid sales rows found in CSV.');
  }

  return parsedRecords;
}

export function analyzeRevenueIntelligence(salesData = [], reviews = []) {
  if (!salesData || salesData.length === 0) {
    return {
      has_sales_data: false,
      dishes: [],
      quadrants: {
        stars: [],
        at_risk_cash_cows: [],
        hidden_gems: [],
        underperformers: []
      },
      sales_trends: [],
      total_sales_revenue: 0,
      total_units_sold: 0,
      disclaimer: 'No verified sales data imported yet. Sales insights appear only when verified sales records are uploaded or connected through Square integration.'
    };
  }

  // 1. Cross-reference reviews with sales data
  const dishSentimentMap = {};

  reviews.forEach(review => {
    const analysis = review.analysis || {};
    const dishes = [
      review.menu_item,
      ...(analysis.mentioned_dish_names || []),
      ...(analysis.mentioned_dishes || [])
    ].filter(Boolean);

    const star = review.star_rating !== undefined ? review.star_rating : 3;
    const isNeg = star <= 2 || (analysis.sentiment || '').toLowerCase() === 'negative';
    const isPos = star >= 4 || (analysis.sentiment || '').toLowerCase() === 'positive';

    dishes.forEach(dish => {
      const name = dish.trim();
      if (!name) return;
      if (!dishSentimentMap[name]) {
        dishSentimentMap[name] = {
          totalReviews: 0,
          ratingSum: 0,
          complaints: 0,
          praises: 0,
          excerpts: []
        };
      }
      dishSentimentMap[name].totalReviews++;
      dishSentimentMap[name].ratingSum += star;
      if (isNeg) {
        dishSentimentMap[name].complaints++;
        if (review.review_text) dishSentimentMap[name].excerpts.push(review.review_text.slice(0, 80));
      }
      if (isPos) {
        dishSentimentMap[name].praises++;
      }
    });
  });

  // Calculate median monthly revenue to define high vs low sales threshold
  const revenues = salesData.map(s => s.revenue || (s.units_sold * s.price) || 0);
  const totalRevenue = revenues.reduce((a, b) => a + b, 0);
  const totalUnits = salesData.reduce((acc, s) => acc + (s.units_sold || 0), 0);
  const avgMonthlyRev = revenues.length > 0 ? (totalRevenue / revenues.length) : 0;

  const analyzedDishes = [];
  const quadrants = {
    stars: [],
    at_risk_cash_cows: [],
    hidden_gems: [],
    underperformers: []
  };

  salesData.forEach(item => {
    const dishName = item.dish_name;
    // Find sentiment match (exact or substring)
    let reviewStats = dishSentimentMap[dishName];
    if (!reviewStats) {
      const matchedKey = Object.keys(dishSentimentMap).find(k =>
        k.toLowerCase().includes(dishName.toLowerCase()) || dishName.toLowerCase().includes(k.toLowerCase())
      );
      if (matchedKey) reviewStats = dishSentimentMap[matchedKey];
    }

    const hasReviews = reviewStats && reviewStats.totalReviews > 0;
    const avgRating = hasReviews ? Number((reviewStats.ratingSum / reviewStats.totalReviews).toFixed(2)) : 4.0;
    const complaintCount = hasReviews ? reviewStats.complaints : 0;
    const praiseCount = hasReviews ? reviewStats.praises : 0;

    const dishRevenue = item.revenue || ((item.units_sold || 0) * (item.price || 0));
    const isHighSales = dishRevenue >= avgMonthlyRev;
    const isHighSentiment = avgRating >= 4.0 && complaintCount <= 1;

    let quadrant = 'underperformers';
    let strategicRecommendation = '';
    let isRevenueAtRisk = false;

    if (isHighSales && isHighSentiment) {
      quadrant = 'stars';
      strategicRecommendation = 'Top performer. Protect recipe standards and feature prominently on menu.';
    } else if (isHighSales && !isHighSentiment) {
      quadrant = 'at_risk_cash_cows';
      strategicRecommendation = 'CRITICAL: High sales volume but customer feedback shows recurring friction. Immediate kitchen/packaging audit required.';
      isRevenueAtRisk = true;
    } else if (!isHighSales && isHighSentiment) {
      quadrant = 'hidden_gems';
      strategicRecommendation = 'High customer satisfaction but modest volume. Candidate for server recommendation and combo upsells.';
    } else {
      quadrant = 'underperformers';
      strategicRecommendation = 'Low volume and poor feedback. Consider recipe reformulation or menu pruning.';
    }

    const analyzedDish = {
      dish_name: dishName,
      units_sold: item.units_sold || 0,
      price: item.price || 0,
      revenue: dishRevenue,
      food_cost_pct: item.food_cost_pct || null,
      review_count: hasReviews ? reviewStats.totalReviews : 0,
      average_rating: avgRating,
      complaint_count: complaintCount,
      praise_count: praiseCount,
      quadrant,
      strategic_recommendation: strategicRecommendation,
      is_revenue_at_risk: isRevenueAtRisk
    };

    analyzedDishes.push(analyzedDish);
    if (!quadrants[quadrant]) quadrants[quadrant] = [];
    quadrants[quadrant].push(analyzedDish);
  });

  // Group sales trends by date/month if available
  const salesByDate = {};
  salesData.forEach(item => {
    const d = item.date || '2026-10';
    if (!salesByDate[d]) {
      salesByDate[d] = { date: d, total_revenue: 0, total_units: 0 };
    }
    salesByDate[d].total_revenue += item.revenue || (item.units_sold * item.price);
    salesByDate[d].total_units += item.units_sold || 0;
  });

  const salesTrends = Object.values(salesByDate).sort((a, b) => a.date.localeCompare(b.date));

  return {
    has_sales_data: true,
    total_sales_revenue: totalRevenue,
    total_units_sold: totalUnits,
    dishes: analyzedDishes.sort((a, b) => b.revenue - a.revenue),
    quadrants,
    sales_trends: salesTrends,
    disclaimer: 'Sales figures reflect imported POS records only. Review correlations are observational and not causal.'
  };
}

export function compareBeforeAndAfterIntervention(task, salesData = [], reviews = [], windowDays = 14) {
  const resolvedTimestamp = task?.resolved_at || task?.completed_at || task?.updated_at;
  if (!task || !resolvedTimestamp) {
    return {
      has_intervention_data: false,
      message: 'Task must be completed with a documented resolution timestamp to run before-and-after comparison.'
    };
  }

  const interventionDate = new Date(resolvedTimestamp);
  const baselineStart = new Date(interventionDate.getTime() - (windowDays * 86400000));
  const followUpEnd = new Date(interventionDate.getTime() + (windowDays * 86400000));

  let baselineReviews = 0;
  let baselineRatingSum = 0;
  let baselineComplaints = 0;

  let followUpReviews = 0;
  let followUpRatingSum = 0;
  let followUpComplaints = 0;

  const linkedReviewIds = new Set(task.linked_reviews || []);

  reviews.forEach(r => {
    const rawDate = r.review_date || r.visit_date || r.created_at;
    if (!rawDate) return;
    const revTime = new Date(rawDate).getTime();
    const isTargetReview = linkedReviewIds.size === 0 || linkedReviewIds.has(r.review_id);

    if (revTime >= baselineStart.getTime() && revTime < interventionDate.getTime()) {
      baselineReviews++;
      baselineRatingSum += (r.star_rating || 3);
      if (isTargetReview && (r.star_rating <= 2)) baselineComplaints++;
    } else if (revTime >= interventionDate.getTime() && revTime <= followUpEnd.getTime()) {
      followUpReviews++;
      followUpRatingSum += (r.star_rating || 3);
      if (isTargetReview && (r.star_rating <= 2)) followUpComplaints++;
    }
  });

  const baselineAvgRating = baselineReviews > 0 ? Number((baselineRatingSum / baselineReviews).toFixed(2)) : 0;
  const followUpAvgRating = followUpReviews > 0 ? Number((followUpRatingSum / followUpReviews).toFixed(2)) : (task.after_rating || 0);

  const ratingChange = (followUpAvgRating > 0 && baselineAvgRating > 0)
    ? Number((followUpAvgRating - baselineAvgRating).toFixed(2))
    : 0;

  return {
    has_intervention_data: true,
    task_id: task.id,
    task_title: task.title,
    intervention_date: interventionDate.toISOString().slice(0, 10),
    window_days: windowDays,
    baseline: {
      window: `${baselineStart.toISOString().slice(0, 10)} to ${interventionDate.toISOString().slice(0, 10)}`,
      total_reviews: baselineReviews,
      average_rating: baselineAvgRating,
      complaint_count: baselineComplaints
    },
    follow_up: {
      window: `${interventionDate.toISOString().slice(0, 10)} to ${followUpEnd.toISOString().slice(0, 10)}`,
      total_reviews: followUpReviews,
      average_rating: followUpAvgRating,
      complaint_count: followUpComplaints
    },
    outcomes: {
      rating_delta: ratingChange,
      complaint_reduction: Math.max(0, baselineComplaints - followUpComplaints),
      actual_result_notes: task.actual_result || task.completion_notes || 'Action implemented.'
    },
    non_causal_notice: 'Telemetry reflects observed differences before and after SOP implementation. External factors such as customer volume and seasonality are not controlled.'
  };
}
