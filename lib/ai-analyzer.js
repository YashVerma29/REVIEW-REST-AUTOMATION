import { viasocket } from '../viasocket.js';

export const CATEGORIES = [
  'Food quality',
  'Taste',
  'Temperature',
  'Portion size',
  'Packaging',
  'Missing items',
  'Incorrect order',
  'Late preparation or delivery',
  'Food freshness',
  'Hygiene concerns',
  'Staff behavior',
  'Customer service',
  'Pricing and perceived value',
  'Menu availability',
  'Refund or payment issue',
  'Other',
  'No actionable issue'
];

// Safety allegation keywords that force Critical Review Required & QA escalation
const SAFETY_PATTERNS = [
  /food\s*poisoning/i,
  /vomit(ing)?/i,
  /nausea/i,
  /stomach\s*(infection|ache|pain|upset)/i,
  /diarrhea/i,
  /hospital(ized)?/i,
  /foreign\s*object/i,
  /staple/i,
  /cockroach/i,
  /insect/i,
  /bug\s*in/i,
  /fly\s*in/i,
  /hair\s*in/i,
  /glass\s*in/i,
  /raw\s*(chicken|meat|prawn|fish)/i,
  /stale/i,
  /rotten/i,
  /spoil(ed)?/i
];

const PACKAGING_PATTERNS = [
  /leak(ed|ing|age)?/i,
  /spill(ed|ing)?/i,
  /container\s*(crack|broke|crushed|open)/i,
  /lid\s*(loose|open|broken)/i,
  /bag\s*torn/i,
  /packaging/i,
  /poore\s*bag\s*me/i,
  /dabba/i
];

const DELIVERY_PATTERNS = [
  /delay(ed)?/i,
  /late/i,
  /rider/i,
  /driver/i,
  /45\s*min/i,
  /1\s*hour/i,
  /thanda/i,
  /cold/i,
  /ice\s*cold/i
];

const COMMON_DISHES = [
  'Butter Chicken',
  'Chicken Biryani',
  'Dal Makhani',
  'Paneer Tikka',
  'Garlic Naan',
  'Tandoori Roti',
  'Mutton Rogan Josh',
  'Prawn Curry',
  'Fish Amritsari',
  'Gulab Jamun',
  'Lassi',
  'Chole Bhature'
];

export function extractMentionedDishes(text) {
  const found = [];
  const lower = text.toLowerCase();
  for (const dish of COMMON_DISHES) {
    if (lower.includes(dish.toLowerCase())) {
      found.push(dish);
    }
  }
  return found;
}

export function detectHinglish(text) {
  const hinglishMarkers = [
    /\b(khana|thanda|kharab|swad|bahut|bekar|accha|dabba|tel|ganda|bheja|pani|nahi|tha|hai)\b/i,
    /poore bag me/i,
    /bilkul bekar/i
  ];
  return hinglishMarkers.some(regex => regex.test(text));
}

export function translateHinglishExcerpt(text) {
  let translated = text;
  const replacements = [
    [/poore bag me tel beh gaya/gi, 'oil spilled all over the delivery bag'],
    [/khana bilkul thanda tha/gi, 'the food was completely cold'],
    [/bahut bekar/gi, 'very terrible'],
    [/swad nahi tha/gi, 'had no taste/flavor'],
    [/kharab ho gaya/gi, 'was spoiled/ruined']
  ];
  replacements.forEach(([pattern, repl]) => {
    translated = translated.replace(pattern, repl);
  });
  return translated !== text ? translated : null;
}

/**
 * Deterministic AI Review Analyzer (High-Speed Local Fallback Engine)
 * Adheres strictly to Section 7: Schema-validated, facts vs interpretations, uncertainty detection.
 */
export function analyzeReviewDeterministically(review) {
  const text = (review.review_text || '').trim();
  const lower = text.toLowerCase();
  const rating = parseFloat(review.star_rating !== undefined ? review.star_rating : (review.rating !== undefined ? review.rating : 3));

  // 1. Check for Ambiguous / Low Information Reviews
  // A low rating alone must NOT be treated as proof of a specific complaint.
  const hasSpecificKeywords = /(poison|vomit|nausea|sick|hospital|leak|spill|container|dabba|cold|thanda|late|delay|wait|portion|chhota|kam|staff|waiter|rude|price|expensive|loot|curry|chicken|biryani|roti|naan|paneer|dal|fish|prawn|tikka)/i.test(lower);
  const isVague = text.length < 25 && !hasSpecificKeywords;
  if (isVague) {
    return {
      sentiment: rating >= 4 ? 'Positive' : rating <= 2 ? 'Negative' : 'Neutral',
      confidence_score: 0.60,
      primary_category: 'No actionable issue',
      categories: ['No actionable issue'],
      primary_issue: 'Unspecified rating without sufficient textual detail',
      secondary_issues: [],
      mentioned_dish_names: [],
      severity: 'Low',
      urgency: 'Low',
      customer_intent: 'Rating Only',
      language: 'en',
      factual_summary: `Customer gave a ${rating}★ rating with minimal text: "${text}".`,
      inferred_interpretation: 'Customer did not provide specific operational details or complaint reasons.',
      is_uncertain: true,
      food_safety_flag: false,
      evidence_quote: text,
      suggested_next_action: 'Request customer for additional order details to understand dissatisfaction.',
      suggested_reply: `Dear Customer, thank you for your feedback regarding your recent ${rating}-star rating. We strive for excellence and would appreciate the opportunity to learn more about your experience. Please reach out to our management team directly so we can make this right.`,
      model_version: 'deterministic-r2r-v2.0',
      analyzed_at: new Date().toISOString()
    };
  }

  // 2. Multi-Category Detection
  const categories = [];
  let isSafety = false;
  let isPackaging = false;
  let isDelivery = false;

  // Food Safety / Hygiene Check
  if (SAFETY_PATTERNS.some(p => p.test(lower))) {
    isSafety = true;
    categories.push('Food freshness');
    categories.push('Hygiene concerns');
  }

  // Packaging Check
  if (PACKAGING_PATTERNS.some(p => p.test(lower))) {
    isPackaging = true;
    categories.push('Packaging');
  }

  // Delivery / Temperature Check
  if (DELIVERY_PATTERNS.some(p => p.test(lower))) {
    isDelivery = true;
    categories.push('Late preparation or delivery');
    if (/cold|thanda/i.test(lower)) {
      categories.push('Temperature');
    }
  }

  // Taste & Food Quality Check
  if (/taste|flavor|masala|spicy|bland|salt|dry|stale|burnt|undercooked|raw/i.test(lower)) {
    categories.push('Taste');
    categories.push('Food quality');
  }

  // Portion Size Check
  if (/portion|quantity|chhota|kam tha|small portion/i.test(lower)) {
    categories.push('Portion size');
  }

  // Staff Behavior Check
  if (/staff|waiter|manager|rude|arrogant|unprofessional|polite|courteous|hospitality/i.test(lower)) {
    categories.push('Staff behavior');
  }

  // Missing or Incorrect Items Check
  if (/missing|forgot|wrong item|incorrect order|did not receive/i.test(lower)) {
    categories.push('Missing items');
    categories.push('Incorrect order');
  }

  // Pricing Check
  if (/expensive|overpriced|price|cost|loot|worth/i.test(lower)) {
    categories.push('Pricing and perceived value');
  }

  // Customer Service / Refund
  if (/refund|money back|compensation|apology|customer care/i.test(lower)) {
    categories.push('Refund or payment issue');
    categories.push('Customer service');
  }

  // Positive Observations
  const hasPositiveWords = /delicious|superb|loved|best|amazing|tender|fresh|perfection|top notch|excellent|great/i.test(lower);
  const hasNegativeWords = /horrible|worst|bad|terrible|awful|degraded|disappointing|never again|waste/i.test(lower);

  // 3. Sentiment Determination
  let sentiment = 'Neutral';
  if (rating >= 4.0 && !hasNegativeWords) sentiment = 'Positive';
  else if (rating <= 2.0 && !hasPositiveWords) sentiment = 'Negative';
  else if (hasPositiveWords && (hasNegativeWords || isPackaging || isDelivery || rating <= 3.0)) sentiment = 'Mixed';
  else if (rating <= 2.0) sentiment = 'Negative';
  else if (rating >= 4.0) sentiment = 'Positive';

  if (categories.length === 0) {
    if (sentiment === 'Positive') categories.push('No actionable issue');
    else categories.push('Other');
  }

  const primaryCategory = categories[0] || 'Other';
  const secondaryIssues = categories.slice(1);

  // 4. Mentioned Dishes
  const mentionedDishes = extractMentionedDishes(text);
  if (review.menu_item && !mentionedDishes.includes(review.menu_item)) {
    mentionedDishes.push(review.menu_item);
  }

  // 5. Severity & Urgency
  let severity = 'Low';
  let urgency = 'Low';

  if (isSafety) {
    severity = 'Critical Review Required';
    urgency = 'Immediate';
  } else if (rating <= 2.0 && (isPackaging || categories.includes('Food quality') || categories.includes('Missing items'))) {
    severity = 'High';
    urgency = 'Normal';
  } else if (rating === 3.0 || sentiment === 'Mixed') {
    severity = 'Medium';
    urgency = 'Normal';
  } else {
    severity = rating >= 4 ? 'Informational' : 'Low';
    urgency = 'Low';
  }

  // 6. Evidence Quote Extraction
  let evidenceQuote = text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  for (const s of sentences) {
    if (isSafety && SAFETY_PATTERNS.some(p => p.test(s))) {
      evidenceQuote = s.trim();
      break;
    }
    if (isPackaging && PACKAGING_PATTERNS.some(p => p.test(s))) {
      evidenceQuote = s.trim();
      break;
    }
    if (hasNegativeWords && /horrible|worst|bad|terrible|awful/i.test(s)) {
      evidenceQuote = s.trim();
      break;
    }
  }

  // 7. Hinglish Detection & Translation
  const isHinglish = detectHinglish(text);
  const translatedText = isHinglish ? translateHinglishExcerpt(text) : null;

  // 8. Distinguish Explicit Facts from Interpretations
  const factualSummary = isSafety
    ? `Customer reported illness or spoilage allegation involving ${mentionedDishes.join(', ') || 'ordered meal'}.`
    : isPackaging
    ? `Customer reported packaging damage or spill in order containing ${mentionedDishes.join(', ') || 'food'}.`
    : isDelivery
    ? `Customer experienced delivery delay or temperature drop.`
    : sentiment === 'Positive'
    ? `Customer praised the food taste, service quality, and dining experience.`
    : `Customer expressed dissatisfaction with ${primaryCategory.toLowerCase()}.`;

  const inferredInterpretation = isSafety
    ? 'Potential cold-chain breach or ingredient batch contamination requiring immediate HACCP kitchen check.'
    : isPackaging
    ? 'Delivery container closure or bag sealing failed during transit stress.'
    : isDelivery
    ? 'Peak hour kitchen dispatch lag or third-party rider transit delay.'
    : 'Customer perception was below expected culinary or service standards.';

  // 9. Recommended Next Action
  let suggestedAction = 'Review operational metrics and log feedback.';
  if (isSafety) {
    suggestedAction = 'Execute emergency cold chain temperature check (<4°C), inspect supplier batch logs, and quarantine suspect inventory.';
  } else if (isPackaging) {
    suggestedAction = 'Audit dispatch station packaging; reinforce lid tape seal and evaluate 750ml spill-proof container alternatives.';
  } else if (categories.includes('Taste') || categories.includes('Food quality')) {
    suggestedAction = `Review standard recipe card for ${mentionedDishes[0] || 'affected dish'}; perform blind batch seasoning audit with Head Chef.`;
  }

  // 10. AI Response Draft (Professional, empathetic, no premature liability/refund promises)
  const reviewerName = review.reviewer_name || 'Customer';
  let replyDraft = '';
  if (sentiment === 'Positive') {
    replyDraft = `Dear ${reviewerName}, thank you so much for the wonderful ${Math.round(rating)}-star review! We are thrilled that you enjoyed our culinary offerings at ${review.outlet_name || 'our restaurant'}. We look forward to welcoming you back soon!`;
  } else if (isSafety) {
    replyDraft = `Dear ${reviewerName}, we treat your feedback with utmost seriousness. Food safety and guest well-being are our highest priorities. Our senior management and quality assurance team are investigating this immediately. Please reach out to our General Manager at management@royalspice.com with your order details so we can address this directly with you.`;
  } else if (isPackaging) {
    replyDraft = `Dear ${reviewerName}, we sincerely apologize for the condition in which your order arrived. Packaging integrity during transit is vital, and we clearly fell short. We have alerted our dispatch and packaging team to audit our container seals. Please contact us directly so we can make this right.`;
  } else {
    replyDraft = `Dear ${reviewerName}, thank you for bringing this to our attention regarding your recent experience with ${review.outlet_name || 'our restaurant'}. We are sorry that your experience did not meet our high standards. We are sharing your feedback with our culinary and operations team to ensure improvements.`;
  }

  return {
    sentiment,
    confidence_score: 0.94,
    primary_category: primaryCategory,
    categories,
    issue_categories: categories,
    primary_issue: `${primaryCategory} concern identified in review`,
    secondary_issues: secondaryIssues,
    mentioned_dish_names: mentionedDishes,
    severity,
    urgency,
    customer_intent: isSafety ? 'Urgent Safety Escalation' : sentiment === 'Positive' ? 'Appreciation' : 'Complaint',
    language: isHinglish ? 'Hinglish' : 'en',
    factual_summary: factualSummary,
    inferred_interpretation: inferredInterpretation,
    is_uncertain: false,
    food_safety_flag: isSafety,
    evidence_quote: evidenceQuote,
    translated_text: translatedText,
    suggested_next_action: suggestedAction,
    suggested_reply: replyDraft,
    model_version: 'deterministic-r2r-v2.0',
    analyzed_at: new Date().toISOString()
  };
}

/**
 * Live viaSocket AI Review Analyzer (Deep Reasoning with Structured JSON Schema)
 */
export async function analyzeReviewWithViaSocket(review, organizationId = 'org-royal-spice-01') {
  try {
    const text = review.review_text || '';
    const rating = review.star_rating || 3;
    const outlet = review.outlet_name || 'Main Outlet';

    const prompt = `You are the Lead Restaurant Review Intelligence Agent for Review-to-Revenue SaaS.
Analyze the following customer review and produce a schema-validated structured assessment.

Review Metadata:
- Restaurant Outlet: ${outlet}
- Star Rating: ${rating}★
- Review Verbatim: "${text}"

Strict Operational Guidelines:
1. Distinguish explicit facts from inferred interpretations.
2. If review text is vague (e.g. only star rating without description), mark is_uncertain = true.
3. If food poisoning, severe illness, insects, or foreign objects are alleged, set food_safety_flag = true and severity = "Critical Review Required".
4. Do NOT promise refunds or admit legal liability in the suggested reply. Keep replies empathetic, concise, and professional.
5. Identify any mentioned dishes and match to menu categories.`;

    const user = viasocket.user(organizationId);
    const response = await user.ai.send({
      message: prompt,
      service: 'openai',
      model: 'gpt-5-mini',
      responseType: 'json_schema',
      jsonSchema: {
        name: 'review_analysis',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            sentiment: { type: 'string', enum: ['Positive', 'Neutral', 'Negative', 'Mixed'] },
            confidence_score: { type: 'number' },
            primary_category: { type: 'string', enum: CATEGORIES },
            categories: { type: 'array', items: { type: 'string' } },
            primary_issue: { type: 'string' },
            secondary_issues: { type: 'array', items: { type: 'string' } },
            mentioned_dish_names: { type: 'array', items: { type: 'string' } },
            severity: { type: 'string', enum: ['Informational', 'Low', 'Medium', 'High', 'Critical Review Required'] },
            urgency: { type: 'string', enum: ['Immediate', 'Normal', 'Low'] },
            customer_intent: { type: 'string' },
            language: { type: 'string' },
            factual_summary: { type: 'string' },
            inferred_interpretation: { type: 'string' },
            is_uncertain: { type: 'boolean' },
            food_safety_flag: { type: 'boolean' },
            evidence_quote: { type: 'string' },
            suggested_next_action: { type: 'string' },
            suggested_reply: { type: 'string' }
          },
          required: [
            'sentiment', 'confidence_score', 'primary_category', 'categories',
            'primary_issue', 'severity', 'factual_summary', 'food_safety_flag',
            'evidence_quote', 'suggested_reply'
          ]
        }
      }
    });

    if (response && response.content) {
      const parsed = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;
      return {
        ...parsed,
        model_version: 'viasocket-openai/gpt-5-mini',
        analyzed_at: new Date().toISOString()
      };
    }
  } catch (err) {
    console.warn('viaSocket live AI analysis call failed, using deterministic fallback:', err.message);
  }

  // Graceful deterministic fallback
  return analyzeReviewDeterministically(review);
}
