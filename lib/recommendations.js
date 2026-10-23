import { calculatePriorityScore } from './scoring.js';

export const ACTION_STATUSES = ['Suggested', 'Approved', 'In Progress', 'Completed', 'Dismissed'];

/**
 * Review-to-Revenue Recommendation Generator
 * Clusters analyzed reviews into operational business issues and generates evidence-based action playbooks.
 */
export function generateRecommendations(reviews, businessMetrics = null) {
  if (!reviews || reviews.length === 0) return [];

  // Group negative / mixed reviews by category & outlet
  const issueMap = new Map();

  reviews.forEach(review => {
    const analysis = review.analysis || {};
    const categories = analysis.categories || [analysis.primary_category].filter(Boolean);
    const isNegativeOrMixed = analysis.sentiment === 'Negative' || analysis.sentiment === 'Mixed' || review.star_rating <= 3;
    const isSafety = analysis.severity === 'Critical Review Required';

    if (isNegativeOrMixed || isSafety) {
      categories.forEach(cat => {
        if (cat === 'Positive customer experience') return;

        // Group key by category, or by specific dish if taste/safety related
        const dish = (analysis.mentioned_menu_items && analysis.mentioned_menu_items[0]) || null;
        let clusterKey = cat;
        if ((cat === 'Food taste and quality' || cat === 'Food freshness and safety concerns') && dish) {
          clusterKey = `${cat} :: ${dish}`;
        }

        if (!issueMap.has(clusterKey)) {
          issueMap.set(clusterKey, {
            category: cat,
            dish,
            supportingReviews: [],
            outlets: new Set()
          });
        }

        const cluster = issueMap.get(clusterKey);
        cluster.supportingReviews.push({
          review_id: review.review_id,
          outlet_name: review.outlet_name,
          star_rating: review.star_rating,
          review_date: review.review_date,
          review_text: review.review_text,
          severity: analysis.severity,
          category: cat
        });
        cluster.outlets.add(review.outlet_name);
      });
    }
  });

  const actions = [];

  issueMap.forEach((cluster, clusterKey) => {
    const revs = cluster.supportingReviews;
    const reviewCount = revs.length;
    const outletList = Array.from(cluster.outlets);

    // Calculate priority score for this issue
    const scoringResult = calculatePriorityScore({
      supporting_reviews: revs,
      confidence: 0.94
    });

    // Evidence quotes
    const evidenceQuotes = revs.slice(0, 3).map(r => `"${r.review_text.slice(0, 120)}..." (${r.outlet_name}, ${r.star_rating}★)`);

    // Financial calculations (transparent assumptions)
    let financialImpact = null;
    if (businessMetrics && businessMetrics.average_order_value && businessMetrics.monthly_orders) {
      // Estimate churn risk formula:
      // Estimated at-risk customer base = (reviewCount * 12 multiplier for unvoiced complaints)
      // Churn probability for bad experience = 40%
      // Revenue at risk = atRiskCustomers * churnProb * AOV
      const unvoicedMultiplier = 10;
      const churnRate = scoringResult.score >= 80 ? 0.60 : 0.35;
      const atRiskOrders = reviewCount * unvoicedMultiplier;
      const estimatedLoss = Math.round(atRiskOrders * churnRate * businessMetrics.average_order_value);

      financialImpact = {
        has_sales_data: true,
        estimated_revenue_at_risk: estimatedLoss,
        currency: businessMetrics.currency || 'INR',
        formula: `${reviewCount} reported review(s) × ${unvoicedMultiplier} (unvoiced factor) × ${(churnRate * 100)}% churn prob × ${businessMetrics.average_order_value} AOV`,
        disclaimer: 'Calculated using provided sales metrics and industry-standard churn multipliers.'
      };
    } else {
      financialImpact = {
        has_sales_data: false,
        estimated_revenue_at_risk: null,
        label: 'Customer Sentiment & Retention Risk',
        explanation: 'Financial impact requires importing store sales data (AOV and monthly order volume). Showing customer retention risk index instead.'
      };
    }

    // Generate specific playbook recommendation based on category
    let problem = '';
    let whyItMatters = '';
    let suggestedAction = '';
    let responsibleRole = 'Store Operations Manager';
    let deadline = '7 days';
    let estimatedEffort = 'Medium';
    let expectedOutcome = '';
    let successMetric = '';
    let evaluationPeriod = '14 days';

    switch (cluster.category) {
      case 'Packaging and leakage':
        problem = `Recurring food container leakage and spills reported in ${reviewCount} delivery order(s).`;
        whyItMatters = 'Spilled food ruins customer first impressions, generates immediate 1-star ratings on aggregator apps, and triggers 100% refund requests.';
        suggestedAction = 'Conduct immediate tamper-evident seal audit on all gravy containers; test thicker 450ml/750ml polypropylene leak-proof tubs with heat-induction or silicone clip lids.';
        responsibleRole = 'Packaging & Dispatch Lead';
        deadline = '3 days';
        estimatedEffort = 'Medium';
        expectedOutcome = 'Zero leakage complaints on delivery orders and improved aggregator app ratings.';
        successMetric = 'Packaging-related complaint rate < 0.5% over the next 14 days.';
        evaluationPeriod = '14 days';
        break;

      case 'Food freshness and safety concerns':
        problem = `CRITICAL: Customer allegations regarding food freshness or safety (${cluster.dish || 'kitchen items'}).`;
        whyItMatters = 'Food safety allegations carry grave health liabilities, regulatory scrutiny, brand reputational destruction, and immediate customer loss.';
        suggestedAction = 'Execute an emergency kitchen hygiene audit: check cold chain refrigeration temperatures (<4°C), inspect raw ingredient supplier batches, and review hot-holding logs (>65°C).';
        responsibleRole = 'Head Chef & Quality Assurance Officer';
        deadline = '24 hours';
        estimatedEffort = 'High';
        expectedOutcome = 'Total compliance with food hygiene safety benchmarks and zero contamination reports.';
        successMetric = '100% kitchen station temperature logging compliance and 0 repeat safety complaints.';
        evaluationPeriod = '7 days';
        break;

      case 'Delivery delays':
        problem = `Customer complaints regarding excessive wait times and cold delivery orders (${reviewCount} review(s)).`;
        whyItMatters = 'Delivery delays result in cold food, lower repeat order frequency, and platform algorithmic down-ranking on Zomato and Swiggy.';
        suggestedAction = 'Analyze Kitchen Order Ticket (KOT) prep times during peak rush hours (8-10 PM); implement a 15-minute rider dispatch buffer and use thermal insulated courier bags.';
        responsibleRole = 'Kitchen Expeditor & Logistics Coordinator';
        deadline = '5 days';
        estimatedEffort = 'Medium';
        expectedOutcome = 'Average kitchen preparation time reduced below 18 minutes; delivery food arrives warm.';
        successMetric = 'KOT dispatch prep time < 18 mins; late delivery complaints reduced by 70%.';
        evaluationPeriod = '14 days';
        break;

      case 'Food taste and quality':
        problem = `Inconsistent taste or quality reported for "${cluster.dish || 'menu dishes'}" (${reviewCount} complaint(s)).`;
        whyItMatters = 'Inconsistent taste damages brand reputation and drives customers to competitor dining alternatives.';
        suggestedAction = `Audit standard recipe cards and prep stations for ${cluster.dish || 'target dishes'}. Conduct blind batch tasting with head chef and verify seasoning measurements.`;
        responsibleRole = 'Executive Chef';
        deadline = '4 days';
        estimatedEffort = 'Low';
        expectedOutcome = 'Standardized flavor profile and restored customer satisfaction.';
        successMetric = `Positive review proportion for ${cluster.dish || 'target dish'} >= 85%.`;
        evaluationPeriod = '21 days';
        break;

      case 'Staff behavior':
        problem = `Customer dissatisfaction regarding front-of-house staff service and attentiveness (${reviewCount} review(s)).`;
        whyItMatters = 'Dine-in guests remember poor hospitality longer than good food; negative service reviews heavily influence local Google Maps foot traffic.';
        suggestedAction = 'Hold a service briefing on greeting protocols, bill verification before presentation, and table check-in frequency. Conduct manager-level table visits during peak dinner.';
        responsibleRole = 'Restaurant General Manager';
        deadline = '2 days';
        estimatedEffort = 'Low';
        expectedOutcome = 'Elevated guest hospitality experience and proactive dispute resolution.';
        successMetric = 'Staff praise mentions in reviews increase by 50%; zero rude staff complaints.';
        evaluationPeriod = '14 days';
        break;

      case 'Pricing and value for money':
        problem = `Perception of poor value for money or reduced portion sizes (${reviewCount} review(s)).`;
        whyItMatters = 'Value perception directly dictates customer repurchase frequency in casual and QSR dining.';
        suggestedAction = 'Audit portion weights (grammage standards) on the line to prevent plating variance. Consider introducing high-value combos or rice/bread accompaniments.';
        responsibleRole = 'F&B Operations Director';
        deadline = '7 days';
        estimatedEffort = 'Medium';
        expectedOutcome = 'Improved customer value score without compromising food cost margins.';
        successMetric = 'Portion/pricing complaints drop to < 2% of total reviews.';
        evaluationPeriod = '30 days';
        break;

      default:
        problem = `Recurring customer feedback in category: ${cluster.category} (${reviewCount} review(s)).`;
        whyItMatters = 'Addressing operational friction directly enhances overall guest satisfaction and NPS.';
        suggestedAction = `Review operational standards for ${cluster.category.toLowerCase()} across affected outlets: ${outletList.join(', ')}.`;
        responsibleRole = 'Store Operations Manager';
        deadline = '7 days';
        estimatedEffort = 'Low';
        expectedOutcome = 'Resolved operational bottleneck.';
        successMetric = 'Review rating in this category improves to >= 4.2★.';
        evaluationPeriod = '14 days';
        break;
    }

    actions.push({
      action_id: `ACT-${clusterKey.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)}-${Date.now().toString().slice(-4)}`,
      category: cluster.category,
      dish: cluster.dish,
      cluster_key: clusterKey,
      problem,
      why_it_matters: whyItMatters,
      evidence_quotes: evidenceQuotes,
      review_count: reviewCount,
      outlets_affected: outletList,
      priority_score: scoringResult.score,
      priority_level: scoringResult.level,
      priority_badge: scoringResult.badge,
      priority_explanation: scoringResult.explanation,
      suggested_action: suggestedAction,
      responsible_role: responsibleRole,
      deadline,
      estimated_effort: estimatedEffort,
      expected_outcome: expectedOutcome,
      success_metric: successMetric,
      evaluation_period: evaluationPeriod,
      financial_impact: financialImpact,
      status: 'Suggested',
      notes: [],
      created_at: new Date().toISOString()
    });
  });

  // Sort by priority score descending
  return actions.sort((a, b) => b.priority_score - a.priority_score);
}
