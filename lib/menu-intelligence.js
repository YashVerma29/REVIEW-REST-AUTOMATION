/**
 * Menu & Revenue Intelligence Engine
 * Cross-references customer review sentiment with dish-level sales, margins, and refund data.
 * Categorizes dishes into:
 * - Star (High Sentiment, High Sales)
 * - Workhorse / At-Risk Cash Cow (Low/Mixed Sentiment, High Sales) -> Critical Revenue Threat
 * - Hidden Gem (High Sentiment, Low/Moderate Sales) -> Upsell Opportunity
 * - Underperformer / Question Mark (Low Sentiment, Low Sales) -> Menu Pruning Candidate
 */

export function analyzeMenuRevenuePerformance(reviews, salesData = []) {
  if (!salesData || salesData.length === 0) {
    return {
      has_sales_data: false,
      dishes: [],
      quadrants: { stars: [], cash_cows: [], hidden_gems: [], underperformers: [] },
      revenue_at_risk_total: 0,
      disclaimer: 'No POS sales data imported. Cross-referencing is operating on customer review frequency only.'
    };
  }

  // 1. Calculate sentiment score and complaint count per dish from reviews
  const dishSentimentMap = {};

  reviews.forEach(review => {
    const analysis = review.analysis || {};
    const dishes = [...(analysis.mentioned_dish_names || []), ...(analysis.mentioned_menu_items || [])];
    if (review.menu_item && !dishes.includes(review.menu_item)) {
      dishes.push(review.menu_item);
    }

    const rating = review.star_rating || 3;
    const isNeg = rating <= 2 || analysis.sentiment === 'Negative';
    const isPos = rating >= 4 || analysis.sentiment === 'Positive';

    dishes.forEach(dish => {
      if (!dishSentimentMap[dish]) {
        dishSentimentMap[dish] = {
          totalReviews: 0,
          ratingSum: 0,
          complaints: 0,
          praises: 0,
          commonIssues: []
        };
      }
      dishSentimentMap[dish].totalReviews++;
      dishSentimentMap[dish].ratingSum += rating;
      if (isNeg) {
        dishSentimentMap[dish].complaints++;
        if (analysis.primary_category) {
          dishSentimentMap[dish].commonIssues.push(analysis.primary_category);
        }
      }
      if (isPos) {
        dishSentimentMap[dish].praises++;
      }
    });
  });

  // Calculate median monthly revenue to define high vs low sales threshold
  const revenues = salesData.map(s => (s.monthly_units || 0) * (s.price || 0));
  const avgMonthlyRev = revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 50000;

  const analyzedDishes = [];
  const quadrants = {
    stars: [],
    cash_cows: [],
    hidden_gems: [],
    underperformers: []
  };

  let totalRevenueAtRisk = 0;

  salesData.forEach(item => {
    const dishName = item.dish_name;
    const reviewStats = dishSentimentMap[dishName] || {
      totalReviews: 0,
      ratingSum: 0,
      complaints: 0,
      praises: 0,
      commonIssues: []
    };

    const avgRating = reviewStats.totalReviews > 0 
      ? Number((reviewStats.ratingSum / reviewStats.totalReviews).toFixed(2)) 
      : 4.0; // neutral default if unreviewed

    const grossRevenue = (item.monthly_units || 0) * (item.price || 0);
    const foodCost = item.food_cost_pct || 32;
    const grossProfit = Math.round(grossRevenue * (1 - foodCost / 100));

    // Quadrant Classification
    const isHighSales = grossRevenue >= avgMonthlyRev;
    const isHighSentiment = avgRating >= 3.8 && reviewStats.complaints <= 1;

    let quadrant = '';
    let strategicRecommendation = '';
    let revenueAtRisk = 0;

    if (isHighSales && isHighSentiment) {
      quadrant = 'Star';
      strategicRecommendation = 'Signature brand anchor. Protect recipe consistency and highlight in digital marketing campaigns.';
      quadrants.stars.push(dishName);
    } else if (isHighSales && !isHighSentiment) {
      quadrant = 'At-Risk Cash Cow';
      // Revenue at risk: Customers experiencing issues on high volume items
      const churnRate = 0.25;
      revenueAtRisk = Math.round(grossRevenue * churnRate);
      totalRevenueAtRisk += revenueAtRisk;
      strategicRecommendation = `CRITICAL REVENUE THREAT: Generates ₹${grossRevenue.toLocaleString('en-IN')}/mo but suffers from recurring complaints (${reviewStats.complaints} logged). Address preparation & packaging immediately to prevent churn.`;
      quadrants.cash_cows.push(dishName);
    } else if (!isHighSales && isHighSentiment) {
      quadrant = 'Hidden Gem';
      strategicRecommendation = 'High guest appreciation but low volume. Feature as a daily special or package into bundled combo offerings.';
      quadrants.hidden_gems.push(dishName);
    } else {
      quadrant = 'Underperformer';
      strategicRecommendation = 'Low sales and poor feedback. Conduct recipe overhaul or consider pruning from active menu to reduce inventory complexity.';
      quadrants.underperformers.push(dishName);
    }

    analyzedDishes.push({
      dish_name: dishName,
      category: item.category || 'Mains',
      price: item.price,
      monthly_units: item.monthly_units,
      gross_revenue: grossRevenue,
      food_cost_pct: foodCost,
      gross_profit: grossProfit,
      average_rating: avgRating,
      review_count: reviewStats.totalReviews,
      complaints_count: reviewStats.complaints,
      praises_count: reviewStats.praises,
      quadrant,
      revenue_at_risk: revenueAtRisk,
      strategic_recommendation: strategicRecommendation
    });
  });

  return {
    has_sales_data: true,
    currency: 'INR',
    dishes: analyzedDishes.sort((a, b) => b.gross_revenue - a.gross_revenue),
    total_dishes_evaluated: analyzedDishes.length,
    quadrants,
    revenue_at_risk_total: totalRevenueAtRisk,
    disclaimer: 'Calculated using actual POS dish unit sales and review feedback correlation.'
  };
}
