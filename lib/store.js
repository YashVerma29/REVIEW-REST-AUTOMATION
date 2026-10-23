import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'db.json')
  : path.join(__dirname, '..', 'data', 'db.json');

// Ensure data directory exists and seed initial data if needed
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (process.env.DATA_DIR && !fs.existsSync(DB_PATH)) {
  const initialDataPath = path.join(__dirname, '..', 'data', 'db.json');
  if (fs.existsSync(initialDataPath)) {
    try {
      fs.copyFileSync(initialDataPath, DB_PATH);
    } catch (e) {
      console.warn('Could not seed initial db.json to DATA_DIR:', e.message);
    }
  }
}

// Security & Password Helpers
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password, hash) {
  if (!hash || !hash.includes(':')) return false;
  const [salt, key] = hash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export function generateToken(payload) {
  const secret = process.env.VIASOCKET_EMBED_SECRET || 'r2r-production-jwt-secret-key-32b';
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const secret = process.env.VIASOCKET_EMBED_SECRET || 'r2r-production-jwt-secret-key-32b';
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// Initial Seed Data for Demo & Out-of-the-box Testing
const DEFAULT_ORG_ID = 'org-royal-spice-01';
const DEFAULT_OWNER_ID = 'usr-owner-01';

const INITIAL_STATE = {
  organizations: [
    {
      id: DEFAULT_ORG_ID,
      name: 'Royal Spice Kitchen',
      org_slug: 'royal-spice-kitchen',
      brand_group: 'Royal Spice Hospitality Group',
      plan_tier: 'growth',
      monthly_review_limit: 1500,
      created_at: '2026-10-01T00:00:00.000Z',
      business_metrics: {
        average_order_value: 650,
        unvoiced_multiplier: 10,
        churn_probability: 0.60
      }
    }
  ],
  users: [
    {
      id: DEFAULT_OWNER_ID,
      email: 'owner@royalspice.com',
      password_hash: hashPassword('DemoPassword123!'),
      full_name: 'Rajesh Sharma',
      role: 'restaurant_owner',
      created_at: '2026-10-01T00:00:00.000Z'
    },
    {
      id: 'usr-gm-02',
      email: 'gm@royalspice.com',
      password_hash: hashPassword('DemoPassword123!'),
      full_name: 'Priya Mehta',
      role: 'restaurant_manager',
      created_at: '2026-10-02T00:00:00.000Z'
    },
    {
      id: 'usr-chef-03',
      email: 'chef@royalspice.com',
      password_hash: hashPassword('DemoPassword123!'),
      full_name: 'Vikram Seth',
      role: 'staff',
      created_at: '2026-10-02T00:00:00.000Z'
    }
  ],
  organization_members: [
    {
      id: 'mem-01',
      organization_id: DEFAULT_ORG_ID,
      user_id: DEFAULT_OWNER_ID,
      role: 'restaurant_owner',
      assigned_outlet_ids: ['out-01', 'out-02', 'out-03'],
      status: 'active'
    },
    {
      id: 'mem-02',
      organization_id: DEFAULT_ORG_ID,
      user_id: 'usr-gm-02',
      role: 'restaurant_manager',
      assigned_outlet_ids: ['out-01', 'out-02', 'out-03'],
      status: 'active'
    },
    {
      id: 'mem-03',
      organization_id: DEFAULT_ORG_ID,
      user_id: 'usr-chef-03',
      role: 'staff',
      assigned_outlet_ids: ['out-01'],
      status: 'active'
    }
  ],
  outlets: [
    {
      id: 'out-01',
      organization_id: DEFAULT_ORG_ID,
      name: 'Downtown Flagship',
      code: 'DF-01',
      city: 'Delhi',
      time_zone: 'Asia/Kolkata',
      status: 'active'
    },
    {
      id: 'out-02',
      organization_id: DEFAULT_ORG_ID,
      name: 'Cyber City Cloud Kitchen',
      code: 'CK-02',
      city: 'Gurugram',
      time_zone: 'Asia/Kolkata',
      status: 'active'
    },
    {
      id: 'out-03',
      organization_id: DEFAULT_ORG_ID,
      name: 'Westend Mall',
      code: 'WM-03',
      city: 'Noida',
      time_zone: 'Asia/Kolkata',
      status: 'active'
    }
  ],
  integrations: [
    {
      id: 'int-01',
      organization_id: DEFAULT_ORG_ID,
      provider: 'google_business',
      service_id: 'rowr707oknl4',
      status: 'ready_to_connect',
      auth_id: null,
      config: { actions: ['List All Reviews', 'Reply To Review', 'List Locations'], triggers: ['New Review Posted'] },
      last_synced_at: null
    },
    {
      id: 'int-02',
      organization_id: DEFAULT_ORG_ID,
      provider: 'slack',
      service_id: 'rowbu58rc',
      status: 'ready_to_connect',
      auth_id: null,
      config: { default_channel: '#kitchen-alerts' },
      last_synced_at: null
    },
    {
      id: 'int-03',
      organization_id: DEFAULT_ORG_ID,
      provider: 'gmail',
      service_id: 'rowo0bqrhj5g',
      status: 'ready_to_connect',
      auth_id: null,
      config: { executive_recipient: 'owner@royalspice.com' },
      last_synced_at: null
    },
    {
      id: 'int-04',
      organization_id: DEFAULT_ORG_ID,
      provider: 'google_sheets',
      service_id: 'rowqm5xi2',
      status: 'ready_to_connect',
      auth_id: null,
      config: { target_sheet_name: 'R2R Review Master' },
      last_synced_at: null
    },
    {
      id: 'int-05',
      organization_id: DEFAULT_ORG_ID,
      provider: 'square',
      service_id: 'rowsiann682n',
      status: 'ready_to_connect',
      auth_id: null,
      config: { sync_orders: true, sync_refunds: true },
      last_synced_at: null
    }
  ],
  sync_runs: [],
  reviews: [],
  review_analyses: [],
  issue_clusters: [],
  issue_cluster_reviews: [],
  root_cause_investigations: [],
  response_drafts: [],
  improvement_tasks: [],
  goals: [],
  sales_records: [],
  automation_rules: [
    {
      id: 'rule-01',
      organization_id: DEFAULT_ORG_ID,
      rule_type: 'negative_review_alert',
      name: 'Immediate Negative Review & Safety Alert',
      description: 'Trigger immediate kitchen notification on Slack when review is <= 2★ or marked Critical Review Required',
      is_enabled: true,
      trigger_config: { min_rating: 2, severity_threshold: 'High' },
      action_config: { channel: 'slack', target: '#kitchen-alerts' },
      viasocket_action_id: 'row1jrbor'
    },
    {
      id: 'rule-02',
      organization_id: DEFAULT_ORG_ID,
      rule_type: 'repeated_complaint_alert',
      name: 'Complaint Cluster Spike Alert',
      description: 'Notify Executive Chef when recurring complaints on a dish exceed 3 occurrences in 7 days',
      is_enabled: true,
      trigger_config: { threshold_count: 3, window_days: 7 },
      action_config: { channel: 'slack', target: '#ops-management' },
      viasocket_action_id: 'row1jrbor'
    },
    {
      id: 'rule-03',
      organization_id: DEFAULT_ORG_ID,
      rule_type: 'daily_report',
      name: 'Daily Operational Review Digest',
      description: 'Send daily summary of new feedback, sentiment breakdown, and pending response drafts',
      is_enabled: true,
      trigger_config: { schedule_time: '23:00' },
      action_config: { channel: 'gmail', recipient: 'owner@royalspice.com' },
      viasocket_action_id: 'rowogelpy0h6'
    },
    {
      id: 'rule-04',
      organization_id: DEFAULT_ORG_ID,
      rule_type: 'weekly_improvement_report',
      name: 'Weekly Executive Operations Brief',
      description: 'Executive briefing with WoW deltas, resolved task outcomes, and estimated revenue impact',
      is_enabled: true,
      trigger_config: { day_of_week: 'Monday', schedule_time: '08:00' },
      action_config: { channel: 'gmail', recipient: 'owner@royalspice.com' },
      viasocket_action_id: 'rowogelpy0h6'
    },
    {
      id: 'rule-05',
      organization_id: DEFAULT_ORG_ID,
      rule_type: 'integration_failure_alert',
      name: 'Integration Failure & Circuit Breaker Alert',
      description: 'Log safe diagnostic errors, execute bounded retries (max 3), and notify administrator when failure threshold (3) is exceeded',
      is_enabled: true,
      trigger_config: { failure_threshold: 3, max_retries: 3 },
      action_config: { channel: 'gmail', recipient: 'owner@royalspice.com', escalate_to: 'admin' },
      viasocket_action_id: 'rowogelpy0h6'
    }
  ],
  automation_runs: [],
  notifications: [
    {
      id: 'notif-01',
      organization_id: DEFAULT_ORG_ID,
      user_id: DEFAULT_OWNER_ID,
      type: 'food_safety_alert',
      title: 'Food Safety Allegation Escalation',
      message: '1 customer review reported illness symptoms (Prawn Curry, Westend Mall). Urgent QA audit initiated.',
      severity: 'critical',
      is_read: false,
      action_url: '#view-investigation',
      created_at: '2026-10-21T18:15:00.000Z'
    },
    {
      id: 'notif-02',
      organization_id: DEFAULT_ORG_ID,
      user_id: DEFAULT_OWNER_ID,
      type: 'report_ready',
      title: 'Weekly Executive Brief Ready',
      message: 'Week of Oct 12–19 report is ready. 20 reviews analyzed; 1 critical improvement task completed.',
      severity: 'normal',
      is_read: true,
      action_url: '#view-reports',
      created_at: '2026-10-21T17:00:00.000Z'
    }
  ],
  audit_logs: [
    {
      id: 'aud-01',
      organization_id: DEFAULT_ORG_ID,
      user_id: DEFAULT_OWNER_ID,
      action: 'ORGANIZATION_INITIALIZED',
      entity_type: 'organization',
      entity_id: DEFAULT_ORG_ID,
      details: 'Enterprise organization "Royal Spice Kitchen" initialized with 3 outlets.',
      ip_address: '127.0.0.1',
      created_at: '2026-10-01T00:00:00.000Z'
    }
  ],
  subscription_accounts: [
    {
      id: 'sub-01',
      organization_id: DEFAULT_ORG_ID,
      plan_tier: 'growth',
      monthly_price_inr: 8999,
      current_period_start: '2026-10-01',
      current_period_end: '2026-10-31',
      reviews_analyzed_this_period: 20,
      reviews_limit: 1500,
      outlets_count: 3,
      outlets_limit: 10,
      status: 'active',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-21T18:00:00.000Z'
    }
  ],
  menu_sales: [
    { dish_name: 'Butter Chicken', monthly_orders: 1600, price_inr: 640, monthly_revenue_inr: 1024000 },
    { dish_name: 'Chicken Biryani', monthly_orders: 1430, price_inr: 450, monthly_revenue_inr: 643500 },
    { dish_name: 'Dal Makhani', monthly_orders: 1850, price_inr: 340, monthly_revenue_inr: 629000 },
    { dish_name: 'Paneer Tikka', monthly_orders: 1250, price_inr: 350, monthly_revenue_inr: 437500 },
    { dish_name: 'Mutton Rogan Josh', monthly_orders: 420, price_inr: 680, monthly_revenue_inr: 285600 },
    { dish_name: 'Garlic Naan', monthly_orders: 3100, price_inr: 90, monthly_revenue_inr: 279000 },
    { dish_name: 'Prawn Curry', monthly_orders: 290, price_inr: 720, monthly_revenue_inr: 208800 },
    { dish_name: 'Tandoori Roti', monthly_orders: 4200, price_inr: 40, monthly_revenue_inr: 168000 },
    { dish_name: 'Gulab Jamun', monthly_orders: 950, price_inr: 140, monthly_revenue_inr: 133000 },
    { dish_name: 'Fish Amritsari', monthly_orders: 180, price_inr: 480, monthly_revenue_inr: 86400 }
  ]
};

class MultiTenantStore {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure all required collections exist
        for (const key of Object.keys(INITIAL_STATE)) {
          if (!parsed[key]) {
            parsed[key] = INITIAL_STATE[key];
          }
        }
        if (Array.isArray(parsed.outlets)) {
          parsed.outlets.forEach(o => {
            if (!o.organization_id) o.organization_id = DEFAULT_ORG_ID;
            if (!o.status) o.status = 'active';
            if (!o.code) o.code = o.id.toUpperCase();
            if (!o.city) o.city = 'Delhi';
          });
        }
        if (Array.isArray(parsed.organizations)) {
          parsed.organizations.forEach(org => {
            if (!org.org_slug && !org.slug) {
              org.org_slug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            }
          });
        }
        if (Array.isArray(parsed.automation_rules)) {
          if (!parsed.automation_rules.some(r => r.id === 'rule-05' || r.rule_type === 'integration_failure_alert')) {
            parsed.automation_rules.push({
              id: 'rule-05',
              organization_id: DEFAULT_ORG_ID,
              rule_type: 'integration_failure_alert',
              name: 'Integration Failure & Circuit Breaker Alert',
              description: 'Log safe diagnostic errors, execute bounded retries (max 3), and notify administrator when failure threshold (3) is exceeded',
              is_enabled: true,
              trigger_config: { failure_threshold: 3, max_retries: 3 },
              action_config: { channel: 'gmail', recipient: 'owner@royalspice.com', escalate_to: 'admin' },
              viasocket_action_id: 'rowogelpy0h6'
            });
          }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading db.json, initializing defaults:', e.message);
    }
    this.save(INITIAL_STATE);
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  save(customState = null) {
    try {
      const stateToSave = customState || this.state;
      fs.writeFileSync(DB_PATH, JSON.stringify(stateToSave, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving to db.json:', e);
    }
  }

  // --- Multi-Tenant Organization Management ---
  getOrganizations() {
    return this.state.organizations || [];
  }

  getOrganization(orgId) {
    return this.state.organizations.find(o => o.id === orgId) || null;
  }

  findOrganizationBySlug(slug) {
    if (!slug) return null;
    const cleanSlug = String(slug).toLowerCase().trim();
    return this.state.organizations.find(o => 
      (o.org_slug && o.org_slug.toLowerCase() === cleanSlug) ||
      (o.slug && o.slug.toLowerCase() === cleanSlug) ||
      (o.id && o.id.toLowerCase() === cleanSlug)
    ) || null;
  }

  getPublicRestaurantProfile(slug) {
    const org = this.findOrganizationBySlug(slug);
    if (!org) return null;
    const outlets = this.getOutlets(org.id).filter(o => o.status === 'active');
    return {
      id: org.id,
      name: org.name,
      slug: org.org_slug || org.slug || org.id,
      brand_group: org.brand_group || org.name,
      welcome_message: 'We cherish your honest dining feedback. Every review goes directly to our executive chef and management team to help us continuously elevate our food, service, and hospitality.',
      privacy_policy_notice: 'Your personal details (name and email) are strictly optional and confidential. They will never be published online or shared with third parties.',
      cuisine: 'North Indian, Mughlai & Fine Dining',
      city: outlets[0]?.city || 'Metro Area',
      outlets: outlets.map(o => ({
        id: o.id,
        name: o.name,
        code: o.code,
        city: o.city
      }))
    };
  }

  createOrganization({ name, org_slug, brand_group, plan_tier = 'starter' }) {
    const org = {
      id: `org-${crypto.randomBytes(6).toString('hex')}`,
      name,
      org_slug: org_slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      brand_group: brand_group || name,
      plan_tier,
      monthly_review_limit: plan_tier === 'pro' ? 5000 : plan_tier === 'growth' ? 1500 : 500,
      business_metrics: {
        average_order_value: 650,
        unvoiced_multiplier: 10,
        churn_probability: 0.60
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.organizations.push(org);

    // Create subscription account
    this.state.subscription_accounts.push({
      id: `sub-${crypto.randomBytes(6).toString('hex')}`,
      organization_id: org.id,
      plan_tier,
      monthly_price_inr: plan_tier === 'pro' ? 19999 : plan_tier === 'growth' ? 8999 : 3499,
      current_period_start: new Date().toISOString().slice(0, 10),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      reviews_analyzed_this_period: 0,
      reviews_limit: org.monthly_review_limit,
      outlets_count: 0,
      outlets_limit: plan_tier === 'pro' ? 25 : plan_tier === 'growth' ? 10 : 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    this.save();
    return org;
  }

  // --- Users & Authentication ---
  findUserByEmail(email) {
    return this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  findUserById(userId) {
    return this.state.users.find(u => u.id === userId) || null;
  }

  createUser({ email, password, full_name, role = 'restaurant_owner' }) {
    const user = {
      id: `usr-${crypto.randomBytes(6).toString('hex')}`,
      email: email.toLowerCase().trim(),
      password_hash: hashPassword(password),
      full_name: full_name.trim(),
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.users.push(user);
    this.save();
    return user;
  }

  addOrganizationMember(orgId, userId, role, assigned_outlet_ids = []) {
    const member = {
      id: `mem-${crypto.randomBytes(6).toString('hex')}`,
      organization_id: orgId,
      user_id: userId,
      role,
      assigned_outlet_ids,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.organization_members.push(member);
    this.save();
    return member;
  }

  getOrganizationMembers(orgId) {
    const members = this.state.organization_members.filter(m => m.organization_id === orgId);
    return members.map(m => {
      const u = this.findUserById(m.user_id) || {};
      return {
        ...m,
        email: u.email,
        full_name: u.full_name
      };
    });
  }

  // --- Outlets (Tenant Scoped) ---
  getOutlets(orgId) {
    return this.state.outlets.filter(o => !orgId || o.organization_id === orgId || (!o.organization_id && orgId === DEFAULT_ORG_ID));
  }

  createOutlet(orgId, { name, code, city, time_zone = 'Asia/Kolkata' }) {
    const outlet = {
      id: `out-${crypto.randomBytes(4).toString('hex')}`,
      organization_id: orgId,
      name,
      code: code || name.slice(0, 3).toUpperCase(),
      city: city || 'Metro',
      time_zone,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.outlets.push(outlet);

    // Update subscription outlet count
    const sub = this.getSubscription(orgId);
    if (sub) {
      sub.outlets_count = this.state.outlets.filter(o => o.organization_id === orgId).length;
    }

    this.save();
    return outlet;
  }

  // --- Reviews & Ingestion (Tenant Scoped) ---
  getReviews({ orgId = DEFAULT_ORG_ID, outletId, source, rating, sentiment, category, severity, search, moderation, isPublic, dateFrom, dateTo } = {}) {
    let list = this.state.reviews.filter(r => r.organization_id === orgId);

    const isAllOutlets = !outletId || outletId === 'all' || outletId === 'All Outlets' || (typeof outletId === 'string' && (outletId.toLowerCase() === 'all' || outletId.toLowerCase() === 'all outlets'));
    if (!isAllOutlets) {
      list = list.filter(r => r.outlet_id === outletId || r.outlet_name === outletId);
    }
    if (source && source !== 'all' && (typeof source !== 'string' || (source.toLowerCase() !== 'all' && source !== 'All Sources'))) {
      const qSource = String(source).toLowerCase().replace(/[\s_-]+/g, '');
      list = list.filter(r => {
        if (qSource === 'googlesheets' || qSource === 'sheet') {
          return Boolean(r.review_id?.startsWith('GS-') || r.source_platform === 'Google Sheets' || r.review_source === 'Google Sheets');
        }
        const rSrc = (r.source_platform || r.review_source || r.platform || '').toLowerCase().replace(/[\s_-]+/g, '');
        return rSrc === qSource || rSrc.includes(qSource) || qSource.includes(rSrc);
      });
    }
    if (rating && rating !== 'all' && rating !== 'All Ratings') {
      const rNum = parseFloat(rating);
      if (!isNaN(rNum)) {
        list = list.filter(r => Math.round(r.star_rating ?? r.rating ?? 5) === rNum);
      }
    }
    if (sentiment && sentiment !== 'all' && (typeof sentiment !== 'string' || (sentiment.toLowerCase() !== 'all' && !sentiment.toLowerCase().startsWith('all sentimen')))) {
      list = list.filter(r => (r.analysis?.sentiment || '').toLowerCase() === String(sentiment).toLowerCase());
    }
    if (category && category !== 'all' && (typeof category !== 'string' || (category.toLowerCase() !== 'all' && category !== 'All Categories'))) {
      list = list.filter(r => {
        const primary = r.analysis?.primary_category || '';
        const cats = r.analysis?.categories || [];
        return primary === category || cats.includes(category);
      });
    }
    if (severity && severity !== 'all' && (typeof severity !== 'string' || (severity.toLowerCase() !== 'all' && severity !== 'All Severities'))) {
      list = list.filter(r => (r.analysis?.severity || '').toLowerCase() === String(severity).toLowerCase());
    }
    if (moderation && moderation !== 'all' && (typeof moderation !== 'string' || (moderation.toLowerCase() !== 'all' && moderation !== 'All Moderation'))) {
      list = list.filter(r => (r.moderation_status || 'approved').toLowerCase() === String(moderation).toLowerCase());
    }
    if (isPublic !== undefined && isPublic !== null && isPublic !== 'all' && isPublic !== 'All') {
      const isPubBool = isPublic === 'true' || isPublic === true;
      list = list.filter(r => Boolean(r.is_public_submission) === isPubBool);
    }
    if (dateFrom) {
      list = list.filter(r => (r.review_date || r.visit_date || r.created_at || '').slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      list = list.filter(r => (r.review_date || r.visit_date || r.created_at || '').slice(0, 10) <= dateTo);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.review_text && r.review_text.toLowerCase().includes(q)) ||
        (r.reviewer_name && r.reviewer_name.toLowerCase().includes(q)) ||
        (r.customer_email && r.customer_email.toLowerCase().includes(q)) ||
        (r.menu_item && r.menu_item.toLowerCase().includes(q)) ||
        (r.analysis?.mentioned_menu_items && r.analysis.mentioned_menu_items.some(d => d.toLowerCase().includes(q)))
      );
    }

    return list;
  }

  updateReviewModeration(orgId, reviewId, status, note = '') {
    const rev = this.state.reviews.find(r => r.organization_id === orgId && (r.review_id === reviewId || r.id === reviewId));
    if (!rev) return null;

    rev.moderation_status = status;
    rev.moderation_note = note;
    rev.moderated_at = new Date().toISOString();

    this.logAudit(orgId, null, 'REVIEW_MODERATED', 'review', reviewId, `Moderation status set to "${status}". Note: ${note || 'None'}`);
    this.save();
    return rev;
  }

  addReviews(orgId, newReviews) {
    let addedCount = 0;
    newReviews.forEach(r => {
      // Ensure tenant scoping
      r.organization_id = orgId;
      if (!r.content_fingerprint) {
        const textKey = `${r.outlet_name || ''}_${r.star_rating || ''}_${(r.review_text || '').trim().toLowerCase()}`;
        r.content_fingerprint = crypto.createHash('sha256').update(textKey).digest('hex');
      }

      const exists = this.state.reviews.some(
        ex => ex.organization_id === orgId && (ex.content_fingerprint === r.content_fingerprint || (ex.review_id && ex.review_id === r.review_id))
      );

      if (!exists) {
        this.state.reviews.push(r);
        addedCount++;
      }
    });

    // Update subscription reviews analyzed meter
    const sub = this.getSubscription(orgId);
    if (sub) {
      sub.reviews_analyzed_this_period = this.state.reviews.filter(r => r.organization_id === orgId).length;
    }

    this.save();
    return addedCount;
  }

  upsertReviewBatch(orgId, incomingReviews) {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const validReviews = [];

    if (!Array.isArray(incomingReviews)) {
      return { inserted: 0, updated: 0, skipped: 0, failed: 1, validReviews: [] };
    }

    incomingReviews.forEach((r, idx) => {
      // Validate incoming review record
      if (!r || typeof r !== 'object') {
        failed++;
        return;
      }
      const rawText = (r.review_text || r.text || r.comment || r.feedback || '').toString().trim();
      if (!rawText) {
        failed++;
        return;
      }

      // Scope to authenticated organization
      r.organization_id = orgId;
      r.review_text = rawText;

      // Normalize star rating between 1 and 5
      const numRating = parseInt(r.star_rating || r.rating || '5', 10);
      r.star_rating = isNaN(numRating) ? 5 : Math.max(1, Math.min(5, numRating));
      r.rating = r.star_rating;

      // Ensure stable identifiers
      if (!r.review_id) {
        r.review_id = r.external_review_id || `VSOK-${Date.now()}-${idx + 1}`;
      }
      if (!r.external_review_id) {
        r.external_review_id = r.review_id;
      }

      // Compute content fingerprint for deduplication
      if (!r.content_fingerprint) {
        const textKey = `${(r.outlet_name || '').trim().toLowerCase()}_${r.star_rating}_${rawText.toLowerCase()}`;
        r.content_fingerprint = crypto.createHash('sha256').update(textKey).digest('hex');
      }

      // Check existing review
      const existing = this.state.reviews.find(ex =>
        ex.organization_id === orgId && (
          ex.content_fingerprint === r.content_fingerprint ||
          (ex.review_id && r.review_id && ex.review_id === r.review_id) ||
          (ex.external_review_id && r.external_review_id && ex.external_review_id === r.external_review_id)
        )
      );

      if (existing) {
        let changed = false;
        // Non-destructive update: preserve existing data, enrich with new fields if available
        if (r.external_review_id && !existing.external_review_id) {
          existing.external_review_id = r.external_review_id;
          changed = true;
        }
        if (r.source_url && !existing.source_url) {
          existing.source_url = r.source_url;
          changed = true;
        }
        if (r.reviewer_name && (!existing.reviewer_name || existing.reviewer_name.startsWith('Guest #'))) {
          existing.reviewer_name = r.reviewer_name;
          changed = true;
        }
        if (r.mentioned_dish && !existing.mentioned_dish) {
          existing.mentioned_dish = r.mentioned_dish;
          changed = true;
        }
        if (changed) {
          updated++;
        } else {
          skipped++;
        }
        validReviews.push(existing);
      } else {
        // Default timestamps and statuses
        if (!r.created_at) r.created_at = new Date().toISOString();
        if (!r.moderation_status) r.moderation_status = 'approved';
        this.state.reviews.push(r);
        inserted++;
        validReviews.push(r);
      }
    });

    // Update subscription reviews analyzed meter
    const sub = this.getSubscription(orgId);
    if (sub) {
      sub.reviews_analyzed_this_period = this.state.reviews.filter(r => r.organization_id === orgId).length;
    }

    this.save();
    return { inserted, updated, skipped, failed, validReviews };
  }

  recordSyncRun(orgId, runData) {
    if (!this.state.sync_runs) {
      this.state.sync_runs = [];
    }
    const record = {
      id: runData.id || `sync-${crypto.randomBytes(6).toString('hex')}`,
      organization_id: orgId,
      user_id: runData.user_id || null,
      source: runData.source || 'viasocket',
      started_at: runData.started_at || new Date().toISOString(),
      completed_at: runData.completed_at || new Date().toISOString(),
      status: runData.status || 'success', // 'success', 'empty', 'partial', 'failed'
      records_fetched: Number(runData.records_fetched || 0),
      records_inserted: Number(runData.records_inserted || 0),
      records_updated: Number(runData.records_updated || 0),
      records_skipped: Number(runData.records_skipped || 0),
      records_failed: Number(runData.records_failed || 0),
      error_summary: runData.error_summary ? String(runData.error_summary).slice(0, 300) : null,
      created_at: new Date().toISOString()
    };
    this.state.sync_runs.unshift(record);
    if (this.state.sync_runs.length > 200) {
      this.state.sync_runs = this.state.sync_runs.slice(0, 200);
    }
    this.save();
    return record;
  }

  getLatestSyncRun(orgId, source = null) {
    if (!this.state.sync_runs) return null;
    return this.state.sync_runs.find(r =>
      r.organization_id === orgId && (!source || r.source === source)
    ) || null;
  }

  getSyncRuns(orgId, limit = 20) {
    if (!this.state.sync_runs) return [];
    return this.state.sync_runs
      .filter(r => r.organization_id === orgId)
      .slice(0, limit);
  }

  updateReviewReply(orgId, reviewId, replyText, status = 'approved') {
    const rev = this.state.reviews.find(r => r.organization_id === orgId && r.review_id === reviewId);
    if (!rev) return null;

    if (!rev.analysis) rev.analysis = {};
    rev.analysis.approved_reply = replyText;
    rev.analysis.reply_approval_status = status;
    rev.analysis.reply_status_updated_at = new Date().toISOString();

    // Also update response_drafts table
    let draft = this.state.response_drafts.find(d => d.review_id === reviewId);
    if (!draft) {
      draft = {
        id: `drf-${crypto.randomBytes(4).toString('hex')}`,
        review_id: reviewId,
        draft_text: replyText,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.state.response_drafts.push(draft);
    } else {
      draft.draft_text = replyText;
      draft.status = status;
      draft.updated_at = new Date().toISOString();
    }

    this.save();
    return rev;
  }

  // --- Issue Clusters & Root-Cause Investigations ---
  getClusters(orgId = DEFAULT_ORG_ID) {
    return this.state.issue_clusters.filter(c => c.organization_id === orgId);
  }

  setClusters(orgId, clusters) {
    // Replace clusters for this tenant
    this.state.issue_clusters = this.state.issue_clusters.filter(c => c.organization_id !== orgId);
    clusters.forEach(c => {
      c.organization_id = orgId;
      this.state.issue_clusters.push(c);
    });
    this.save();
  }

  getClusterInvestigation(clusterId) {
    return this.state.root_cause_investigations.find(i => i.issue_cluster_id === clusterId) || null;
  }

  saveClusterInvestigation(clusterId, investigationData) {
    let inv = this.state.root_cause_investigations.find(i => i.issue_cluster_id === clusterId);
    if (!inv) {
      inv = {
        id: `inv-${crypto.randomBytes(4).toString('hex')}`,
        issue_cluster_id: clusterId,
        ...investigationData,
        investigated_at: new Date().toISOString()
      };
      this.state.root_cause_investigations.push(inv);
    } else {
      Object.assign(inv, investigationData);
      inv.investigated_at = new Date().toISOString();
    }
    this.save();
    return inv;
  }

  // --- Improvement Tasks (Tenant Scoped) ---
  getTasks(orgId = DEFAULT_ORG_ID, filter = {}) {
    if (!this.state.improvement_tasks) this.state.improvement_tasks = [];
    let list = this.state.improvement_tasks.filter(t => t.organization_id === orgId);

    if (filter.status && filter.status !== 'All') {
      const s = filter.status.toLowerCase();
      list = list.filter(t => (t.status || '').toLowerCase() === s);
    }
    if (filter.priority && filter.priority !== 'All') {
      const p = filter.priority.toLowerCase();
      list = list.filter(t => (t.priority || '').toLowerCase() === p);
    }
    if (filter.outlet && filter.outlet !== 'All Outlets') {
      list = list.filter(t => (t.outlets_affected || []).includes(filter.outlet) || t.outlet_name === filter.outlet);
    }

    return list.sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
  }

  createTask(orgId, taskData) {
    if (!this.state.improvement_tasks) this.state.improvement_tasks = [];
    const now = new Date().toISOString();
    const newTask = {
      id: taskData.id || `task-${crypto.randomBytes(4).toString('hex')}`,
      action_id: taskData.action_id || `act-${crypto.randomBytes(4).toString('hex')}`,
      organization_id: orgId,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      linked_reviews: Array.isArray(taskData.linked_reviews) ? taskData.linked_reviews : (taskData.linked_reviews ? [taskData.linked_reviews] : []),
      priority: taskData.priority || 'medium',
      priority_score: taskData.priority_score || (taskData.priority === 'urgent' ? 90 : taskData.priority === 'high' ? 75 : 50),
      assignee: taskData.assignee || null,
      assigned_role: taskData.assigned_role || 'Manager',
      due_date: taskData.due_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: taskData.status || 'Open',
      completion_notes: taskData.completion_notes || '',
      category: taskData.category || 'General',
      cluster_key: taskData.cluster_key || taskData.title || 'General',
      outlets_affected: Array.isArray(taskData.outlets_affected) ? taskData.outlets_affected : ['All Outlets'],
      created_at: now,
      updated_at: now,
      completed_at: (taskData.status === 'Completed' || taskData.status === 'Resolved') ? now : null
    };

    this.state.improvement_tasks.unshift(newTask);
    this.logAudit(orgId, null, 'TASK_CREATED', 'improvement_task', newTask.id, `Created task: "${newTask.title}" (${newTask.priority} priority)`);
    this.save();
    return newTask;
  }

  updateTask(orgId, taskId, updates = {}) {
    const task = this.state.improvement_tasks.find(t => t.organization_id === orgId && (t.id === taskId || t.action_id === taskId));
    if (!task) return null;

    const allowed = ['title', 'description', 'priority', 'priority_score', 'assignee', 'due_date', 'status', 'completion_notes', 'outlets_affected', 'linked_reviews'];
    allowed.forEach(k => {
      if (updates[k] !== undefined) task[k] = updates[k];
    });

    task.updated_at = new Date().toISOString();
    if (task.status === 'Completed' || task.status === 'Resolved') {
      task.completed_at = task.completed_at || task.updated_at;
      task.resolved_at = task.resolved_at || task.updated_at;
    } else {
      task.completed_at = null;
    }

    this.logAudit(orgId, null, 'TASK_UPDATED', 'improvement_task', task.id, `Updated task details for "${task.title}".`);
    this.save();
    return task;
  }

  setTasks(orgId, tasks) {
    this.state.improvement_tasks = this.state.improvement_tasks.filter(t => t.organization_id !== orgId);
    tasks.forEach(t => {
      t.organization_id = orgId;
      this.state.improvement_tasks.push(t);
    });
    this.save();
  }

  updateTaskStatus(orgId, taskId, status, notes = '') {
    const task = this.state.improvement_tasks.find(t => t.organization_id === orgId && (t.id === taskId || t.action_id === taskId));
    if (!task) return null;

    task.status = status;
    task.updated_at = new Date().toISOString();
    if (notes) {
      if (!task.notes) task.notes = [];
      task.notes.push({ text: notes, date: new Date().toISOString() });
      task.completion_notes = notes;
    }
    if (status === 'Resolved' || status === 'Completed') {
      task.resolved_at = new Date().toISOString();
      task.completed_at = task.resolved_at;
    } else if (status === 'Dismissed') {
      task.dismissed_at = new Date().toISOString();
    }
    this.save();
    return task;
  }

  resolveTaskWithOutcome(orgId, taskId, actualResult, afterRating) {
    const task = this.state.improvement_tasks.find(t => t.organization_id === orgId && (t.id === taskId || t.action_id === taskId));
    if (!task) return null;

    task.status = 'Resolved';
    task.actual_result = actualResult;
    task.after_rating = afterRating ? parseFloat(afterRating) : null;
    task.resolved_at = new Date().toISOString();
    task.completed_at = task.resolved_at;
    task.updated_at = new Date().toISOString();

    // Log in audit log
    this.logAudit(orgId, null, 'TASK_RESOLVED', 'improvement_task', taskId, `Outcome recorded: "${actualResult}" (Post-intervention rating: ${afterRating}★)`);

    this.save();
    return task;
  }

  deleteTask(orgId, taskId) {
    if (!this.state.improvement_tasks) return false;
    const initialLen = this.state.improvement_tasks.length;
    this.state.improvement_tasks = this.state.improvement_tasks.filter(
      t => !(t.organization_id === orgId && (t.id === taskId || t.action_id === taskId))
    );
    const deleted = this.state.improvement_tasks.length < initialLen;
    if (deleted) {
      this.logAudit(orgId, null, 'TASK_DELETED', 'improvement_task', taskId, `Task ${taskId} removed.`);
      this.save();
    }
    return deleted;
  }

  // --- Goal Tracking (Tenant Scoped) ---
  getGoals(orgId = DEFAULT_ORG_ID) {
    if (!this.state.goals) this.state.goals = [];
    return this.state.goals.filter(g => g.organization_id === orgId);
  }

  saveGoal(orgId, goalData) {
    if (!this.state.goals) this.state.goals = [];
    const now = new Date().toISOString();
    let goal = this.state.goals.find(g => g.organization_id === orgId && g.id === goalData.id);

    if (goal) {
      Object.assign(goal, goalData, { updated_at: now });
    } else {
      goal = {
        id: goalData.id || `goal-${crypto.randomBytes(4).toString('hex')}`,
        organization_id: orgId,
        type: goalData.type || 'improve_rating',
        title: goalData.title || 'Performance Goal',
        target_metric: goalData.target_metric || 'average_rating',
        target_value: Number(goalData.target_value) || 4.5,
        baseline_value: goalData.baseline_value !== undefined ? Number(goalData.baseline_value) : null,
        start_date: goalData.start_date || now.slice(0, 10),
        end_date: goalData.end_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        dish_name: goalData.dish_name || null,
        created_at: now,
        updated_at: now
      };
      this.state.goals.push(goal);
    }

    this.logAudit(orgId, null, 'GOAL_SAVED', 'goal', goal.id, `Saved goal: "${goal.title}" (Target: ${goal.target_value})`);
    this.save();
    return goal;
  }

  deleteGoal(orgId, goalId) {
    if (!this.state.goals) return false;
    const initialLen = this.state.goals.length;
    this.state.goals = this.state.goals.filter(g => !(g.organization_id === orgId && g.id === goalId));
    const deleted = this.state.goals.length < initialLen;
    if (deleted) {
      this.logAudit(orgId, null, 'GOAL_DELETED', 'goal', goalId, `Goal ${goalId} removed.`);
      this.save();
    }
    return deleted;
  }

  // --- Sales Records (Tenant Scoped) ---
  getSalesRecords(orgId = DEFAULT_ORG_ID) {
    if (!this.state.sales_records) this.state.sales_records = [];
    const tenantSales = this.state.sales_records.filter(s => s.organization_id === orgId);
    if (tenantSales.length > 0) return tenantSales;
    // Fall back to seed menu_sales for default org
    if (orgId === DEFAULT_ORG_ID && this.state.menu_sales && this.state.menu_sales.length > 0) {
      return this.state.menu_sales.map(m => ({
        ...m,
        organization_id: DEFAULT_ORG_ID,
        units_sold: m.monthly_orders || 0,
        price: m.price_inr || 0,
        revenue: m.monthly_revenue_inr || 0,
        date: '2026-10',
        outlet_name: 'All Outlets'
      }));
    }
    return [];
  }

  addSalesRecords(orgId, records) {
    if (!this.state.sales_records) this.state.sales_records = [];
    // Remove existing for same organization if overwriting batch
    const stamped = records.map(r => ({
      ...r,
      organization_id: orgId,
      id: r.id || `sls-${crypto.randomBytes(4).toString('hex')}`,
      imported_at: new Date().toISOString()
    }));
    this.state.sales_records.push(...stamped);
    this.logAudit(orgId, null, 'SALES_DATA_IMPORTED', 'sales_records', orgId, `Imported ${records.length} sales records via CSV/integration.`);
    this.save();
    return stamped;
  }

  clearSalesRecords(orgId) {
    if (!this.state.sales_records) return;
    this.state.sales_records = this.state.sales_records.filter(s => s.organization_id !== orgId);
    this.save();
  }

  // --- Automation Rules & Runs ---
  getAutomationRules(orgId = DEFAULT_ORG_ID) {
    return this.state.automation_rules.filter(r => r.organization_id === orgId);
  }

  getAutomationWorkflows(orgId = DEFAULT_ORG_ID) {
    const rules = this.getAutomationRules(orgId);
    const runs = this.getAutomationRuns(orgId);

    const ruleA = rules.find(r => r.rule_type === 'negative_review_alert' || r.id === 'rule-01') || {
      id: 'rule-01',
      name: 'Workflow A: New Negative Review & Safety Alert',
      description: 'Instant analysis on review storage, alert threshold validation, authorized owner notification with secure review link & deduplication.',
      rule_type: 'negative_review_alert',
      is_enabled: true,
      trigger_config: { min_rating: 2, severity_threshold: 'High', alert_food_safety: true },
      action_config: { channel: 'slack', target: '#kitchen-alerts' },
      viasocket_action_id: 'row1jrbor'
    };

    const ruleB = rules.find(r => r.rule_type === 'daily_report' || r.id === 'rule-03') || {
      id: 'rule-03',
      name: 'Workflow B: Daily Restaurant Summary',
      description: 'Scheduled daily digest summarizing rating trends, recurring complaints, positive themes, and high-priority AI tasks.',
      rule_type: 'daily_report',
      is_enabled: true,
      trigger_config: { schedule_time: '21:00', frequency: 'daily' },
      action_config: { channel: 'gmail', recipient: 'owner@royalspice.com' },
      viasocket_action_id: 'rowogelpy0h6'
    };

    const ruleC = rules.find(r => r.rule_type === 'weekly_improvement_report' || r.id === 'rule-04') || {
      id: 'rule-04',
      name: 'Workflow C: Weekly Improvement Report',
      description: 'Week-over-week period comparison, new/recurring/resolved issue tracking, and measurable follow-up actions.',
      rule_type: 'weekly_improvement_report',
      is_enabled: true,
      trigger_config: { day_of_week: 'Monday', schedule_time: '08:00' },
      action_config: { channel: 'gmail', recipient: 'owner@royalspice.com' },
      viasocket_action_id: 'rowogelpy0h6'
    };

    const ruleD = rules.find(r => r.rule_type === 'integration_failure_alert' || r.id === 'rule-05') || {
      id: 'rule-05',
      name: 'Workflow D: Integration Failure Alert & Circuit Breaker',
      description: 'Safe diagnostic telemetry logging, bounded exponential retries (max 3), and automated administrator escalation on failure threshold breach.',
      rule_type: 'integration_failure_alert',
      is_enabled: true,
      trigger_config: { failure_threshold: 3, max_retries: 3 },
      action_config: { channel: 'gmail', recipient: 'owner@royalspice.com', escalate_to: 'admin' },
      viasocket_action_id: 'rowogelpy0h6'
    };

    return [
      {
        key: 'workflow_a',
        rule_id: ruleA.id,
        name: ruleA.name || 'Workflow A: New Negative Review & Safety Alert',
        description: ruleA.description || 'Instant analysis on review storage, alert threshold validation, authorized owner notification with secure review link & deduplication.',
        rule_type: 'negative_review_alert',
        is_enabled: ruleA.is_enabled ?? true,
        trigger_config: ruleA.trigger_config || { min_rating: 2, severity_threshold: 'High', alert_food_safety: true },
        action_config: ruleA.action_config || { channel: 'slack', target: '#kitchen-alerts' },
        delivery_channel: ruleA.action_config?.channel || 'slack',
        delivery_target: ruleA.action_config?.target || ruleA.action_config?.recipient || '#kitchen-alerts',
        thresholds: {
          min_rating: ruleA.trigger_config?.min_rating ?? 2,
          critical_safety: ruleA.trigger_config?.alert_food_safety !== false
        },
        channels: [
          ruleA.action_config?.channel === 'gmail' ? 'Gmail' : 'Slack',
          'Executive In-App Alert'
        ],
        supported_action: ruleA.viasocket_action_id || (ruleA.action_config?.channel === 'gmail' ? 'rowogelpy0h6' : 'row1jrbor'),
        service_id: ruleA.action_config?.channel === 'gmail' ? 'rowo0bqrhj5g' : 'rowbu58rc',
        last_run: runs.find(r => r.automation_rule_id === ruleA.id) || null
      },
      {
        key: 'workflow_b',
        rule_id: ruleB.id,
        name: ruleB.name || 'Workflow B: Daily Restaurant Summary',
        description: ruleB.description || 'Scheduled daily digest summarizing rating trends, recurring complaints, positive themes, and high-priority AI tasks.',
        rule_type: 'daily_report',
        is_enabled: ruleB.is_enabled ?? true,
        trigger_config: ruleB.trigger_config || { schedule_time: '21:00' },
        action_config: ruleB.action_config || { channel: 'gmail', recipient: 'owner@royalspice.com' },
        delivery_channel: ruleB.action_config?.channel || 'gmail',
        delivery_target: ruleB.action_config?.recipient || ruleB.action_config?.target || 'owner@royalspice.com',
        thresholds: { schedule_time: `${ruleB.trigger_config?.schedule_time || '21:00'} Daily` },
        channels: [
          ruleB.action_config?.channel === 'slack' ? 'Slack' : 'Gmail',
          'Daily Operations Feed'
        ],
        supported_action: ruleB.viasocket_action_id || (ruleB.action_config?.channel === 'slack' ? 'row1jrbor' : 'rowogelpy0h6'),
        service_id: ruleB.action_config?.channel === 'slack' ? 'rowbu58rc' : 'rowo0bqrhj5g',
        last_run: runs.find(r => r.automation_rule_id === ruleB.id) || null
      },
      {
        key: 'workflow_c',
        rule_id: ruleC.id,
        name: ruleC.name || 'Workflow C: Weekly Improvement Report',
        description: ruleC.description || 'Week-over-week period comparison, new/recurring/resolved issue tracking, and measurable follow-up actions.',
        rule_type: 'weekly_improvement_report',
        is_enabled: ruleC.is_enabled ?? true,
        trigger_config: ruleC.trigger_config || { day_of_week: 'Monday', schedule_time: '08:00' },
        action_config: ruleC.action_config || { channel: 'gmail', recipient: 'owner@royalspice.com' },
        delivery_channel: ruleC.action_config?.channel || 'gmail',
        delivery_target: ruleC.action_config?.recipient || ruleC.action_config?.target || 'owner@royalspice.com',
        thresholds: { schedule_time: `${ruleC.trigger_config?.day_of_week || 'Monday'} ${ruleC.trigger_config?.schedule_time || '08:00'}` },
        channels: [
          ruleC.action_config?.channel === 'slack' ? 'Slack' : 'Gmail',
          'Executive CX Brief'
        ],
        supported_action: ruleC.viasocket_action_id || (ruleC.action_config?.channel === 'slack' ? 'row1jrbor' : 'rowogelpy0h6'),
        service_id: ruleC.action_config?.channel === 'slack' ? 'rowbu58rc' : 'rowo0bqrhj5g',
        last_run: runs.find(r => r.automation_rule_id === ruleC.id) || null
      },
      {
        key: 'workflow_d',
        rule_id: ruleD.id,
        name: ruleD.name || 'Workflow D: Integration Failure Alert & Circuit Breaker',
        description: ruleD.description || 'Safe diagnostic telemetry logging, bounded exponential retries (max 3), and automated administrator escalation on failure threshold breach.',
        rule_type: 'integration_failure_alert',
        is_enabled: ruleD.is_enabled ?? true,
        trigger_config: ruleD.trigger_config || { failure_threshold: 3, max_retries: 3 },
        action_config: ruleD.action_config || { channel: 'gmail', recipient: 'owner@royalspice.com', escalate_to: 'admin' },
        delivery_channel: ruleD.action_config?.channel || 'gmail',
        delivery_target: ruleD.action_config?.recipient || ruleD.action_config?.target || 'owner@royalspice.com',
        thresholds: {
          failure_threshold: ruleD.trigger_config?.failure_threshold ?? 3,
          max_retries: ruleD.trigger_config?.max_retries ?? 3
        },
        channels: ['Admin Alert Email', 'Circuit Breaker Monitor'],
        supported_action: ruleD.viasocket_action_id || 'rowogelpy0h6',
        service_id: 'rowbu58rc',
        last_run: runs.find(r => r.automation_rule_id === ruleD.id) || null
      }
    ];
  }

  toggleAutomationRule(orgId, ruleId, isEnabled) {
    const rules = this.getAutomationRules(orgId);
    const rule = rules.find(r => r.id === ruleId || r.rule_type === ruleId);
    if (!rule) return null;

    rule.is_enabled = Boolean(isEnabled);
    this.logAudit(orgId, null, 'AUTOMATION_RULE_TOGGLED', 'automation_rule', rule.id, `Rule "${rule.name}" set to ${rule.is_enabled ? 'ENABLED' : 'DISABLED'}`);
    this.save();
    return rule;
  }

  updateAutomationRule(orgId, ruleId, updates = {}) {
    const rules = this.getAutomationRules(orgId);
    const rule = rules.find(r => r.id === ruleId || r.rule_type === ruleId);
    if (!rule) return null;

    if (updates.name) rule.name = updates.name;
    if (updates.description) rule.description = updates.description;
    if (updates.is_enabled !== undefined) rule.is_enabled = Boolean(updates.is_enabled);
    if (updates.trigger_config) rule.trigger_config = { ...rule.trigger_config, ...updates.trigger_config };
    if (updates.action_config) {
      rule.action_config = { ...rule.action_config, ...updates.action_config };
      if (rule.action_config.channel === 'slack') {
        rule.viasocket_action_id = 'row1jrbor';
      } else if (rule.action_config.channel === 'gmail') {
        rule.viasocket_action_id = 'rowogelpy0h6';
      }
    }

    this.logAudit(orgId, null, 'AUTOMATION_RULE_UPDATED', 'automation_rule', rule.id, `Updated automation rule settings for "${rule.name}"`);
    this.save();
    return rule;
  }

  getAutomationRuns(orgId = DEFAULT_ORG_ID) {
    const ruleIds = new Set(this.getAutomationRules(orgId).map(r => r.id));
    return this.state.automation_runs.filter(run => ruleIds.has(run.automation_rule_id));
  }

  recordAutomationRun(ruleId, { trigger_event, status, payload, result_message }) {
    const run = {
      id: `run-${crypto.randomBytes(4).toString('hex')}`,
      automation_rule_id: ruleId,
      trigger_event,
      status,
      payload: payload || {},
      result_message,
      retry_count: 0,
      executed_at: new Date().toISOString()
    };
    this.state.automation_runs.unshift(run);
    // Keep max 100 runs
    if (this.state.automation_runs.length > 100) this.state.automation_runs.pop();
    this.save();
    return run;
  }

  // --- Notifications ---
  getNotifications(orgId = DEFAULT_ORG_ID, userId = null) {
    return this.state.notifications.filter(n =>
      n.organization_id === orgId && (!userId || n.user_id === userId)
    );
  }

  markNotificationRead(notificationId) {
    const notif = this.state.notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.is_read = true;
      this.save();
    }
    return notif;
  }

  createNotification(orgId, { user_id, type, title, message, severity = 'normal', action_url }) {
    const notif = {
      id: `notif-${crypto.randomBytes(4).toString('hex')}`,
      organization_id: orgId,
      user_id: user_id || null,
      type,
      title,
      message,
      severity,
      is_read: false,
      action_url,
      created_at: new Date().toISOString()
    };
    this.state.notifications.unshift(notif);
    this.save();
    return notif;
  }

  // --- Integrations ---
  getIntegrations(orgId = DEFAULT_ORG_ID) {
    if (!this.state.integrations) this.state.integrations = [];
    return this.state.integrations.filter(i => i.organization_id === orgId);
  }

  saveIntegration(orgId, provider, authId, serviceId, config = {}) {
    if (!this.state.integrations) this.state.integrations = [];
    const existingIndex = this.state.integrations.findIndex(i => 
      i.organization_id === orgId && (i.provider === provider || i.service_id === serviceId)
    );
    const now = new Date().toISOString();
    if (existingIndex >= 0) {
      this.state.integrations[existingIndex] = {
        ...this.state.integrations[existingIndex],
        auth_id: authId,
        service_id: serviceId || this.state.integrations[existingIndex].service_id,
        status: 'connected',
        config: { ...this.state.integrations[existingIndex].config, ...config },
        updated_at: now
      };
      this.save();
      return this.state.integrations[existingIndex];
    } else {
      const newInt = {
        id: `int-${crypto.randomBytes(4).toString('hex')}`,
        organization_id: orgId,
        provider,
        service_id: serviceId,
        auth_id: authId,
        status: 'connected',
        config,
        created_at: now,
        updated_at: now
      };
      this.state.integrations.push(newInt);
      this.save();
      return newInt;
    }
  }

  disconnectIntegration(orgId, providerOrServiceId) {
    if (!this.state.integrations) this.state.integrations = [];
    const item = this.state.integrations.find(i => 
      i.organization_id === orgId && (i.provider === providerOrServiceId || i.service_id === providerOrServiceId || i.id === providerOrServiceId)
    );
    if (item) {
      item.status = 'disconnected';
      item.auth_id = null;
      item.updated_at = new Date().toISOString();
      this.save();
      return item;
    }
    return null;
  }

  // --- Audit Logs ---
  logAudit(orgId, userId, action, entityType, entityId, details, ipAddress = '127.0.0.1') {
    const entry = {
      id: `aud-${crypto.randomBytes(4).toString('hex')}`,
      organization_id: orgId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    };
    this.state.audit_logs.unshift(entry);
    if (this.state.audit_logs.length > 200) this.state.audit_logs.pop();
    this.save();
    return entry;
  }

  getAuditLogs(orgId = DEFAULT_ORG_ID) {
    return this.state.audit_logs.filter(a => a.organization_id === orgId);
  }

  // --- Subscriptions & Billing ---
  getSubscription(orgId = DEFAULT_ORG_ID) {
    return this.state.subscription_accounts.find(s => s.organization_id === orgId) || null;
  }

  // --- Menu Sales & Revenue Data ---
  getMenuSales() {
    return this.state.menu_sales || [];
  }

  setMenuSales(salesList) {
    this.state.menu_sales = salesList;
    this.save();
    return this.state.menu_sales;
  }

  // Reset / Bootstrap Demo Data
  resetDemoData(orgId, analyzedReviews, actions, clusters = []) {
    this.state.reviews = this.state.reviews.filter(r => r.organization_id !== orgId);
    analyzedReviews.forEach(r => {
      r.organization_id = orgId;
      this.state.reviews.push(r);
    });

    this.state.improvement_tasks = this.state.improvement_tasks.filter(t => t.organization_id !== orgId);
    actions.forEach(a => {
      a.organization_id = orgId;
      this.state.improvement_tasks.push(a);
    });

    this.state.issue_clusters = this.state.issue_clusters.filter(c => c.organization_id !== orgId);
    clusters.forEach(c => {
      c.organization_id = orgId;
      this.state.issue_clusters.push(c);
    });

    this.save();
    return {
      reviewsCount: analyzedReviews.length,
      tasksCount: actions.length,
      clustersCount: clusters.length
    };
  }

  // --- Phase 4 viaSocket AI Agent Intelligence Storage ---
  getRecurringComplaints(orgId = DEFAULT_ORG_ID) {
    if (!this.state.recurring_complaints) this.state.recurring_complaints = [];
    return this.state.recurring_complaints.find(rc => rc.organization_id === orgId) || null;
  }

  saveRecurringComplaints(orgId, data) {
    if (!this.state.recurring_complaints) this.state.recurring_complaints = [];
    let rec = this.state.recurring_complaints.find(rc => rc.organization_id === orgId);
    if (!rec) {
      rec = { organization_id: orgId, ...data, updated_at: new Date().toISOString() };
      this.state.recurring_complaints.push(rec);
    } else {
      Object.assign(rec, data);
      rec.updated_at = new Date().toISOString();
    }
    this.save();
    return rec;
  }

  getGrowthRecommendations(orgId = DEFAULT_ORG_ID) {
    if (!this.state.growth_recommendations) this.state.growth_recommendations = [];
    return this.state.growth_recommendations.find(gr => gr.organization_id === orgId) || null;
  }

  saveGrowthRecommendations(orgId, data) {
    if (!this.state.growth_recommendations) this.state.growth_recommendations = [];
    let rec = this.state.growth_recommendations.find(gr => gr.organization_id === orgId);
    if (!rec) {
      rec = { organization_id: orgId, ...data, updated_at: new Date().toISOString() };
      this.state.growth_recommendations.push(rec);
    } else {
      Object.assign(rec, data);
      rec.updated_at = new Date().toISOString();
    }
    this.save();
    return rec;
  }

  getResponseDrafts(orgId = DEFAULT_ORG_ID, status = null) {
    const orgReviews = this.state.reviews.filter(r => r.organization_id === orgId);
    const drafts = [];

    orgReviews.forEach(r => {
      const existingDraft = (this.state.response_drafts || []).find(d => d.review_id === r.review_id);
      const draftText = existingDraft?.draft_text || r.analysis?.suggested_reply || '';
      const draftStatus = existingDraft?.status || r.analysis?.reply_approval_status || 'draft';

      if (draftText) {
        if (!status || draftStatus === status) {
          drafts.push({
            id: existingDraft?.id || `drf-${r.review_id}`,
            review_id: r.review_id,
            reviewer_name: r.reviewer_name || r.customer_name || 'Guest',
            star_rating: r.star_rating !== undefined ? r.star_rating : (r.rating !== undefined ? r.rating : 3),
            outlet_name: r.outlet_name || 'Main',
            review_date: r.review_date || r.visit_date || '2026-10-15',
            review_text: r.review_text || '',
            sentiment: r.analysis?.sentiment || (r.star_rating >= 4 ? 'positive' : r.star_rating <= 2 ? 'negative' : 'neutral'),
            topics: r.analysis?.topics || [],
            draft_text: draftText,
            status: draftStatus,
            requires_approval: true,
            updated_at: existingDraft?.updated_at || r.analysis?.analyzed_at || new Date().toISOString()
          });
        }
      }
    });

    return drafts.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  saveQAConversation(orgId, { threadId, question, answer, userId }) {
    if (!this.state.qa_conversations) this.state.qa_conversations = [];
    const entry = {
      id: `qa-${crypto.randomBytes(4).toString('hex')}`,
      organization_id: orgId,
      thread_id: threadId,
      user_id: userId,
      question,
      answer,
      created_at: new Date().toISOString()
    };
    this.state.qa_conversations.unshift(entry);
    if (this.state.qa_conversations.length > 100) this.state.qa_conversations.pop();
    this.save();
    return entry;
  }

  getQAConversations(orgId = DEFAULT_ORG_ID, threadId = null) {
    if (!this.state.qa_conversations) this.state.qa_conversations = [];
    let list = this.state.qa_conversations.filter(c => c.organization_id === orgId);
    if (threadId) {
      list = list.filter(c => c.thread_id === threadId);
    }
    return list;
  }
}

export const store = new MultiTenantStore();
