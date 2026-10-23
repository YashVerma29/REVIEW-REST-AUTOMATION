import { parse } from 'csv-parse/sync';
import crypto from 'crypto';

/**
 * Parses raw CSV and extracts column headers + sample rows for the Onboarding Mapping Step.
 */
export function inspectCSVHeadersAndSample(csvString) {
  try {
    const records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      to: 5 // Sample first 5 rows
    });

    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    return {
      success: true,
      headers,
      sample_rows: records,
      total_preview_count: records.length
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to inspect CSV headers: ${err.message}`,
      headers: [],
      sample_rows: []
    };
  }
}

/**
 * Validates a single manual review entry
 */
export function validateManualReview(data, existingReviews = []) {
  const errors = [];
  const text = (data.review_text || '').trim();
  const rating = parseFloat(data.star_rating);
  const outlet = (data.outlet_name || '').trim();
  const dateRaw = (data.review_date || '').trim();

  if (!text || text.length < 3) errors.push('Review text must be at least 3 characters.');
  if (isNaN(rating) || rating < 1 || rating > 5) errors.push('Star rating must be between 1.0 and 5.0.');
  if (!outlet) errors.push('Outlet name is required.');

  let normalizedDate = dateRaw;
  if (!dateRaw) {
    normalizedDate = new Date().toISOString().slice(0, 10);
  } else {
    const d = new Date(dateRaw);
    if (isNaN(d.getTime())) errors.push('Invalid date format. Expected YYYY-MM-DD.');
    else normalizedDate = d.toISOString().slice(0, 10);
  }

  const reviewId = data.review_id || `MAN-${Date.now()}`;
  const textKey = `${outlet}_${rating}_${text.toLowerCase()}`;
  const contentFingerprint = crypto.createHash('sha256').update(textKey).digest('hex');

  const isDuplicate = existingReviews.some(
    r => r.content_fingerprint === contentFingerprint || r.review_id === reviewId
  );
  if (isDuplicate) {
    errors.push('A review with identical outlet, rating, and text already exists.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    review: {
      review_id: reviewId,
      source_platform: data.source_platform || 'Manual Entry',
      outlet_name: outlet,
      reviewer_name: data.reviewer_name || 'Direct Customer',
      star_rating: rating,
      review_date: normalizedDate,
      review_text: text,
      menu_item: data.menu_item || '',
      content_fingerprint: contentFingerprint
    }
  };
}

/**
 * Validates a public customer review submitted via /r/{restaurant-slug}
 * Implements honeypot spam protection, category ratings, sanitization, and duplicate detection.
 */
export function validatePublicCustomerReview(data, existingReviews = []) {
  const errors = [];

  // 1. Honeypot anti-bot check
  if (data.website_hp && String(data.website_hp).trim().length > 0) {
    return {
      valid: false,
      isSpam: true,
      errors: ['Automated or bot submission detected. Feedback rejected.']
    };
  }

  // 2. Overall rating validation (1 to 5 integer)
  const overallRating = parseInt(data.star_rating, 10);
  if (isNaN(overallRating) || overallRating < 1 || overallRating > 5) {
    errors.push('Overall rating must be a whole number between 1 and 5 stars.');
  }

  // 3. Category sub-ratings (Food, Service, Cleanliness, Value for Money)
  const parseSubRating = (val, name) => {
    if (val === undefined || val === null || val === '') return overallRating || 3;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 5) {
      errors.push(`${name} rating must be between 1 and 5 stars.`);
      return 3;
    }
    return num;
  };

  const foodRating = parseSubRating(data.food_quality_rating ?? data.food_quality, 'Food Quality');
  const serviceRating = parseSubRating(data.service_rating ?? data.service, 'Service');
  const cleanlinessRating = parseSubRating(data.cleanliness_rating ?? data.cleanliness, 'Cleanliness');
  const valueRating = parseSubRating(data.value_rating ?? data.value_for_money, 'Value for Money');

  // 4. Written feedback validation
  const feedbackRaw = (data.review_text || data.written_feedback || '').trim();
  if (!feedbackRaw || feedbackRaw.length < 5) {
    errors.push('Written feedback must be at least 5 characters.');
  }
  if (feedbackRaw.length > 2500) {
    errors.push('Written feedback cannot exceed 2,500 characters.');
  }

  // Anti-abuse: script injection and HTML tag sanitization
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(feedbackRaw) ||
      /javascript:/gi.test(feedbackRaw) ||
      /<iframe\b/gi.test(feedbackRaw)) {
    return {
      valid: false,
      isAbusive: true,
      errors: ['Feedback contains unsafe or malicious script tags.']
    };
  }

  // Spam content keyword check
  const spamPatterns = ['viagra', 'casino bonus', 'poker chips', 'free bitcoin', 'crypto doubler', 'whatsapp me for loans'];
  const lowerFeedback = feedbackRaw.toLowerCase();
  if (spamPatterns.some(kw => lowerFeedback.includes(kw))) {
    return {
      valid: false,
      isSpam: true,
      errors: ['Feedback detected as commercial spam or promotional advertisement.']
    };
  }

  // Sanitize feedback (strip any dangerous angle brackets)
  const sanitizedFeedback = feedbackRaw.replace(/<[^>]*>?/gm, '');

  // 5. Optional customer details
  let customerName = (data.customer_name || data.reviewer_name || '').trim();
  let customerEmail = (data.customer_email || '').trim().toLowerCase();

  if (customerName.length > 100) customerName = customerName.slice(0, 100);
  if (customerEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      errors.push('Please provide a valid email address or leave the email field empty.');
    }
  }

  // 6. Optional dish & visit date
  const menuItem = (data.menu_item || data.dish || '').trim().slice(0, 100);
  let visitDate = (data.visit_date || '').trim();
  if (visitDate) {
    const d = new Date(visitDate);
    if (isNaN(d.getTime())) {
      errors.push('Invalid visit date format. Expected YYYY-MM-DD.');
    } else {
      visitDate = d.toISOString().slice(0, 10);
    }
  } else {
    visitDate = new Date().toISOString().slice(0, 10);
  }

  // 7. Duplicate submission detection
  const outletId = (data.outlet_id || '').trim();
  const outletName = (data.outlet_name || '').trim();
  const fingerprintKey = `${outletId || outletName}_${overallRating}_${sanitizedFeedback.toLowerCase()}_${customerEmail}`;
  const contentFingerprint = crypto.createHash('sha256').update(fingerprintKey).digest('hex');

  const isDuplicate = existingReviews.some(
    r => r.content_fingerprint === contentFingerprint
  );
  if (isDuplicate) {
    return {
      valid: false,
      isDuplicate: true,
      errors: ['You have already submitted this feedback. Thank you for your review!']
    };
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const reviewId = data.review_id || `CUST-${crypto.randomBytes(5).toString('hex')}`;

  return {
    valid: true,
    review: {
      review_id: reviewId,
      organization_id: data.organization_id,
      outlet_id: outletId,
      outlet_name: outletName || 'Main Outlet',
      source_platform: 'Direct Customer Review',
      review_source: 'Public Feedback Form',
      reviewer_name: customerName || 'Anonymous Guest',
      customer_email: customerEmail || null,
      star_rating: overallRating,
      food_quality_rating: foodRating,
      service_rating: serviceRating,
      cleanliness_rating: cleanlinessRating,
      value_rating: valueRating,
      review_text: sanitizedFeedback,
      menu_item: menuItem,
      visit_date: visitDate,
      review_date: visitDate,
      is_public_submission: true,
      is_private_feedback: true,
      moderation_status: 'pending',
      content_fingerprint: contentFingerprint,
      created_at: new Date().toISOString()
    }
  };
}

/**
 * Main CSV parser and validator with dynamic column mapping and duplicate prevention
 */
export function parseAndValidateCSV(csvString, existingReviews = [], columnMapping = {}) {
  let records = [];
  try {
    records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse CSV format: ${err.message}`,
      accepted: [],
      rejected: [],
      duplicates: [],
      totalRows: 0,
      errorReportCsv: ''
    };
  }

  const accepted = [];
  const rejected = [];
  const duplicates = [];

  // Index existing reviews to catch duplicates
  const seenFingerprints = new Set(
    existingReviews.map(r => r.content_fingerprint || crypto.createHash('sha256').update(`${r.outlet_name || ''}_${r.star_rating || ''}_${(r.review_text || '').trim().toLowerCase()}`).digest('hex'))
  );
  const seenIds = new Set(existingReviews.map(r => String(r.review_id || '').trim().toLowerCase()).filter(Boolean));

  records.forEach((row, index) => {
    const rowNum = index + 2;
    const errors = [];

    // Helper to get value with user mapping fallback
    const getVal = (standardField, commonAliases) => {
      if (columnMapping[standardField] && row[columnMapping[standardField]] !== undefined) {
        return String(row[columnMapping[standardField]]).trim();
      }
      for (const alias of commonAliases) {
        if (row[alias] !== undefined) return String(row[alias]).trim();
      }
      return '';
    };

    // 1. Review ID
    let reviewId = getVal('review_id', ['review_id', 'Review ID', 'id', 'ID']);
    if (!reviewId) {
      reviewId = `REV-GEN-${Date.now()}-${rowNum}`;
    }

    // 2. Outlets & Source
    const outletName = getVal('outlet_name', ['outlet_name', 'Outlet Name', 'outlet', 'location', 'Branch']) || 'Main Outlet';
    const sourcePlatform = getVal('source_platform', ['source_platform', 'review_source', 'Review Source', 'source', 'Platform']) || 'Google';
    const reviewerName = getVal('reviewer_name', ['reviewer_name', 'Reviewer Name', 'reviewer', 'customer_name', 'Author']) || 'Anonymous Diner';
    const menuItem = getVal('menu_item', ['menu_item', 'dish', 'Dish', 'item', 'Food Item']);

    // 3. Review Text
    const reviewText = getVal('review_text', ['review_text', 'Review Text', 'text', 'comment', 'Feedback', 'Review']);
    if (!reviewText || reviewText.length < 3) {
      errors.push('Missing or too short review text (minimum 3 characters required)');
    }

    // 4. Rating validation
    const ratingRaw = getVal('star_rating', ['star_rating', 'Star Rating', 'rating', 'Rating', 'stars', 'Score']);
    const rating = parseFloat(ratingRaw);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      errors.push(`Invalid star rating "${ratingRaw}". Must be a number between 1.0 and 5.0`);
    }

    // 5. Date validation & normalization to YYYY-MM-DD
    const dateRaw = getVal('review_date', ['review_date', 'Review Date', 'date', 'Date', 'timestamp', 'created_at']);
    let normalizedDate = null;
    if (!dateRaw) {
      errors.push('Missing review date');
    } else {
      const parsedDate = new Date(dateRaw);
      if (isNaN(parsedDate.getTime())) {
        errors.push(`Malformed review date "${dateRaw}". Expected format: YYYY-MM-DD`);
      } else {
        normalizedDate = parsedDate.toISOString().slice(0, 10);
      }
    }

    // If validation errors exist, reject row
    if (errors.length > 0) {
      rejected.push({
        rowNum,
        reviewId,
        reasons: errors,
        raw: row
      });
      return;
    }

    // 6. Duplicate Detection (ID and Content Fingerprint)
    const textKey = `${outletName}_${rating}_${reviewText.toLowerCase()}`;
    const contentFingerprint = crypto.createHash('sha256').update(textKey).digest('hex');

    if (seenIds.has(reviewId.toLowerCase())) {
      duplicates.push({
        rowNum,
        reviewId,
        reason: `Duplicate review ID "${reviewId}" already exists in organization records.`,
        raw: row
      });
      return;
    }

    if (seenFingerprints.has(contentFingerprint)) {
      duplicates.push({
        rowNum,
        reviewId,
        reason: 'Identical review content, rating, and outlet already imported.',
        raw: row
      });
      return;
    }

    // Mark as seen in this batch
    seenIds.add(reviewId.toLowerCase());
    seenFingerprints.add(contentFingerprint);

    accepted.push({
      review_id: reviewId,
      source_platform: sourcePlatform,
      review_source: sourcePlatform,
      outlet_name: outletName,
      reviewer_name: reviewerName,
      star_rating: rating,
      review_date: normalizedDate,
      review_text: reviewText,
      menu_item: menuItem,
      content_fingerprint: contentFingerprint
    });
  });

  // 7. Generate Downloadable Error Report CSV
  let errorReportCsv = 'Row Number,Review ID,Error Type,Details\n';
  rejected.forEach(r => {
    errorReportCsv += `${r.rowNum},"${r.reviewId}","Validation Error","${r.reasons.join('; ').replace(/"/g, '""')}"\n`;
  });
  duplicates.forEach(d => {
    errorReportCsv += `${d.rowNum},"${d.reviewId}","Duplicate Detected","${d.reason.replace(/"/g, '""')}"\n`;
  });

  return {
    success: true,
    totalRows: records.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    duplicateCount: duplicates.length,
    accepted,
    rejected,
    duplicates,
    errorReportCsv
  };
}
