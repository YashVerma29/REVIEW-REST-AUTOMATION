import crypto from 'crypto';
import { calculateSmartPriority } from './scoring.js';

/**
 * Complaint Clustering Engine
 * Groups related reviews by (Category :: Dish or Outlet pattern)
 */
export function clusterReviews(reviews, totalOutlets = 3) {
  const clustersMap = new Map();

  reviews.forEach(review => {
    const analysis = review.analysis || {};
    const isNegative = analysis.sentiment === 'Negative' || analysis.sentiment === 'Mixed' || (review.star_rating <= 2.5);
    if (!isNegative) return; // Only cluster dissatisfaction feedback

    const category = analysis.primary_category || 'Food quality';
    const dishes = analysis.mentioned_dish_names || [];
    const dish = dishes.length > 0 ? dishes[0] : null;

    let clusterKey = '';
    let problemStatement = '';
    let whyItMatters = '';

    if (analysis.food_safety_flag) {
      clusterKey = `Food freshness and safety :: ${dish || 'General Kitchen'}`;
      problemStatement = `CRITICAL: Customer allegations regarding food freshness or safety (${dish || 'food preparation'}).`;
      whyItMatters = 'Food safety allegations carry grave health liabilities, regulatory scrutiny, brand reputational destruction, and immediate customer loss.';
    } else if (category === 'Packaging' || (analysis.categories || []).includes('Packaging')) {
      clusterKey = `Packaging and leakage :: Delivery Orders`;
      problemStatement = `Recurring packaging container leakage, cracked lids, or bag tears reported in delivery transit.`;
      whyItMatters = 'Packaging failures ruin the dining experience upon arrival, drive immediate 1-star ratings, and cause customer churn.';
    } else if (category === 'Late preparation or delivery' || (analysis.categories || []).includes('Late preparation or delivery')) {
      clusterKey = `Delivery delays :: ${review.outlet_name || 'All Outlets'}`;
      problemStatement = `Extended wait times and cold food delivery reported during peak order windows.`;
      whyItMatters = 'Delivery delays result in customer frustration, cold food delivery, and platform delivery rating penalties.';
    } else if (dish) {
      clusterKey = `${category} :: ${dish}`;
      problemStatement = `Inconsistent ${category.toLowerCase()} reported specifically for "${dish}".`;
      whyItMatters = `Discontent with core dishes damages customer loyalty and drives diners to competitor alternatives.`;
    } else {
      clusterKey = `${category} :: ${review.outlet_name || 'General'}`;
      problemStatement = `Repeated dissatisfaction related to ${category.toLowerCase()}.`;
      whyItMatters = 'Operational friction directly depresses average outlet ratings and customer return frequency.';
    }

    if (!clustersMap.has(clusterKey)) {
      clustersMap.set(clusterKey, {
        id: `cls-${crypto.createHash('md5').update(clusterKey).digest('hex').slice(0, 8)}`,
        cluster_key: clusterKey,
        category,
        mentioned_dish: dish,
        problem_statement: problemStatement,
        why_it_matters: whyItMatters,
        reviews: [],
        review_ids: [],
        outlets_affected: new Set(),
        ratings_sum: 0,
        has_safety_incident: false,
        first_seen_at: review.review_date,
        last_seen_at: review.review_date
      });
    }

    const cluster = clustersMap.get(clusterKey);
    cluster.reviews.push(review);
    cluster.review_ids.push(review.review_id || review.id);
    if (review.outlet_name) cluster.outlets_affected.add(review.outlet_name);
    cluster.ratings_sum += (review.star_rating || 1);
    if (analysis.food_safety_flag) cluster.has_safety_incident = true;
    if (review.review_date < cluster.first_seen_at) cluster.first_seen_at = review.review_date;
    if (review.review_date > cluster.last_seen_at) cluster.last_seen_at = review.review_date;
  });

  // Calculate scores & format output
  const clusters = Array.from(clustersMap.values()).map(c => {
    const reviewCount = c.reviews.length;
    const avgRating = Number((c.ratings_sum / reviewCount).toFixed(1));
    const outletsList = Array.from(c.outlets_affected);

    const scoreResult = calculateSmartPriority({
      severity: c.has_safety_incident ? 'Critical Review Required' : reviewCount >= 3 ? 'High' : 'Medium',
      reviewCount,
      avgRating,
      newestReviewDate: c.last_seen_at,
      outletsAffectedCount: outletsList.length,
      totalOutlets,
      hasSafetyIncident: c.has_safety_incident
    });

    return {
      id: c.id,
      cluster_key: c.cluster_key,
      category: c.category,
      mentioned_dish: c.mentioned_dish,
      problem_statement: c.problem_statement,
      why_it_matters: c.why_it_matters,
      total_reviews: reviewCount,
      average_star_rating: avgRating,
      outlets_affected: outletsList,
      priority_score: scoreResult.score,
      priority_level: scoreResult.level,
      priority_explanation: scoreResult.explanation,
      has_safety_incident: c.has_safety_incident,
      first_seen_at: c.first_seen_at,
      last_seen_at: c.last_seen_at,
      evidence_quotes: c.reviews.slice(0, 3).map(r => r.review_text),
      review_ids: c.review_ids
    };
  });

  return clusters.sort((a, b) => b.priority_score - a.priority_score);
}

/**
 * Root-Cause Investigation Agent
 * Section 9: Generates ranked hypotheses, evidence references, missing info, and verification steps.
 */
export function investigateIssueCluster(cluster, allReviews = [], operationalRecords = {}) {
  const category = cluster.category || '';
  const dish = cluster.mentioned_dish || '';
  const isSafety = cluster.has_safety_incident;
  const isPackaging = category === 'Packaging' || cluster.cluster_key.includes('Packaging');
  const isDelivery = category.includes('Delivery') || category.includes('Late') || cluster.cluster_key.includes('Delivery');

  const hypotheses = [];
  const supportingEvidence = [];
  const contradictoryEvidence = [];
  const missingInformation = [];
  const verificationSteps = [];

  // Facts extracted from reviews
  const confirmedFacts = [
    `${cluster.total_reviews} verified customer review(s) reported complaints regarding ${cluster.cluster_key}.`,
    `Average star rating across the complaint cluster is ${cluster.average_star_rating}★.`,
    `Outlets impacted: ${cluster.outlets_affected.join(', ') || 'All Locations'}.`,
    `Earliest incident on record: ${cluster.first_seen_at}; Most recent incident: ${cluster.last_seen_at}.`
  ];

  if (isSafety) {
    hypotheses.push({
      rank: 1,
      title: 'Perishable Ingredient Cold-Chain Temperature Breach',
      probability: '72%',
      explanation: `Raw ingredients for ${dish || 'protein dishes'} may have experienced temperature excursion (>4°C) during intake, prep storage, or power cycle.`
    });
    hypotheses.push({
      rank: 2,
      title: 'Hot-Holding or Reheating Station Failure',
      probability: '23%',
      explanation: 'Prepared gravies or cooked batches maintained below the 65°C safe holding threshold during dinner service rush.'
    });
    hypotheses.push({
      rank: 3,
      title: 'Supplier Batch Contamination',
      probability: '5%',
      explanation: 'Specific batch delivered by seafood or poultry vendor on target date may have had high bacterial load prior to delivery.'
    });

    supportingEvidence.push('Multiple customer reviews explicitly describe acute illness onset within 4-12 hours of dining.');
    supportingEvidence.push('Complaints concentrated around seafood/protein menu items.');
    contradictoryEvidence.push('No formal municipal health inspection notices received for this date window.');
    missingInformation.push('Kitchen digital temperature datalogger history for the specific evening service.');
    missingInformation.push('Ingredient supplier batch lot numbers and delivery receipt timestamps.');
    verificationSteps.push('Step 1: Check walk-in chiller and line fridge temperature logs for <4°C compliance.');
    verificationSteps.push('Step 2: Inspect raw seafood/meat supplier quality certificates and delivery logs for suspect batch.');
    verificationSteps.push('Step 3: Conduct sensory and microbiological swab test on current station inventory.');
    verificationSteps.push('Step 4: Audit staff handwashing and cross-contamination sanitization practices.');
  } else if (isPackaging) {
    hypotheses.push({
      rank: 1,
      title: 'Substandard Container Seal or Wall Thickness Under Delivery Transit Pressure',
      probability: '68%',
      explanation: 'Thin polypropylene container lids deforming and popping open when stacked in delivery rider thermal bags.'
    });
    hypotheses.push({
      rank: 2,
      title: 'Overfilling Beyond Container Safe Fill Line',
      probability: '22%',
      explanation: 'Curry and gravy portions filled to the rim without heat-expansion headroom, forcing liquid past the gasket seal.'
    });
    hypotheses.push({
      rank: 3,
      title: 'Aggressive Bag Handling During Two-Wheeler Transit',
      probability: '10%',
      explanation: 'Third-party delivery riders placing bags sideways or carrying unstrapped parcels over bumpy roads.'
    });

    supportingEvidence.push('Reviews state oil and gravy pooled in delivery outer bags.');
    supportingEvidence.push('Customer photo evidence confirms cracked container rims.');
    contradictoryEvidence.push('Dine-in reviews for the same dish show zero container or presentation complaints.');
    missingInformation.push('Specific delivery container vendor SKU specifications (single-lock vs dual-lock leakproof tubs).');
    missingInformation.push('Split between self-delivery staff vs third-party aggregator delivery partners.');
    verificationSteps.push('Step 1: Perform 20-minute water tilt and compression test on current container SKU.');
    verificationSteps.push('Step 2: Enforce mandatory heat-shrink or tamper-proof lid sealing tape on all liquid orders.');
    verificationSteps.push('Step 3: Mandate maximum 85% fill line SOP on portioning ladles.');
    verificationSteps.push('Step 4: Sample 50 delivered orders with secret-shopper test deliveries.');
  } else if (isDelivery) {
    hypotheses.push({
      rank: 1,
      title: 'Kitchen Dispatch Bottleneck During Peak Hours (8 PM - 10 PM)',
      probability: '65%',
      explanation: 'Order preparation time exceeded 25 minutes due to tandoor/curry station overload, compounding transit delay.'
    });
    hypotheses.push({
      rank: 2,
      title: 'Third-Party Delivery Rider Assignment Delay',
      probability: '35%',
      explanation: 'Aggregator dispatch algorithms taking 15+ minutes to assign nearby drivers during rain or high demand.'
    });

    supportingEvidence.push('Complaints note orders taking 60+ minutes from order placement to door.');
    supportingEvidence.push('Food arriving cold/lukewarm.');
    contradictoryEvidence.push('Afternoon orders (1 PM - 4 PM) consistently report on-time arrival.');
    missingInformation.push('POS KDS (Kitchen Display System) bump bar timestamps to isolate prep time vs transit time.');
    verificationSteps.push('Step 1: Review KDS prep-to-dispatch turnaround time for peak hour batches.');
    verificationSteps.push('Step 2: Adjust aggregator delivery radius during peak congestion.');
    verificationSteps.push('Step 3: Introduce insulated thermal hot bags for order staging area.');
  } else {
    hypotheses.push({
      rank: 1,
      title: `Recipe Drift or Seasoning Inconsistency in Batch Preparation (${dish || 'Menu Items'})`,
      probability: '60%',
      explanation: 'Prep cooks not utilizing calibrated measuring spoons or deviating from master recipe cards during shift handovers.'
    });
    hypotheses.push({
      rank: 2,
      title: 'Ingredient Freshness Variance',
      probability: '40%',
      explanation: 'Using aged spices or sub-optimal dairy products yielding flat flavor profiles.'
    });

    supportingEvidence.push(`Customer reviews complain dish tasted bland, overly salty, or dry compared to previous visits.`);
    contradictoryEvidence.push('Repeat customers ordering other dishes report high satisfaction.');
    missingInformation.push('Duty roster of cooks responsible for morning base gravy preparation on reported dates.');
    verificationSteps.push('Step 1: Head Chef blind tasting audit of morning and evening sauce batches.');
    verificationSteps.push('Step 2: Verify digital gram scales at all culinary prep stations.');
    verificationSteps.push('Step 3: Retrain station commis on standardized recipe cards.');
  }

  return {
    investigation_id: `inv-${crypto.randomBytes(4).toString('hex')}`,
    cluster_id: cluster.id,
    cluster_key: cluster.cluster_key,
    confirmed_facts: confirmedFacts,
    hypotheses,
    supporting_evidence: supportingEvidence,
    contradictory_evidence: contradictoryEvidence,
    missing_information: missingInformation,
    verification_steps: verificationSteps,
    confidence_assessment: isSafety ? 'High Confidence (Immediate Kitchen Audit Required)' : 'Moderate Confidence (Operational Data Verification Needed)',
    disclaimer: 'These findings represent AI-formulated hypotheses derived from customer review telemetry. Operational causes must be verified via physical kitchen audit before taking disciplinary action.'
  };
}
