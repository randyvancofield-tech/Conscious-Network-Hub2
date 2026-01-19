/**
 * HCN Knowledge Service
 * Manages HCN-scoped knowledge with caching and remote fetch fallback
 */

export interface HCNKnowledge {
  founder: {
    name: string;
    linkedinUrl: string;
    role: string;
  };
  organization: {
    name: string;
    shortName: string;
    officialUrl: string;
    description: string;
  };
  products: Array<{
    name: string;
    shortName?: string;
    description: string;
    features?: string[];
    focus?: string;
  }>;
  scope: {
    answerable: string[];
    notAnswerable: string[];
  };
  closedKnowledgeMessage: string;
  mvpNotice: string;
  lastUpdated: string;
}

interface CachedKnowledge {
  fetchedAt: number;
  data: HCNKnowledge;
}

const CACHE_KEY = 'hcn_knowledge_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const HCN_KNOWLEDGE_URL = 'https://higherconscious.network/hcn-knowledge.json';

// Local HCN knowledge fallback (bundled at build time)
const LOCAL_HCN_KNOWLEDGE: HCNKnowledge = {
  founder: {
    name: "Randy Van Cofield Jr.",
    linkedinUrl: "https://www.linkedin.com/in/rcofield",
    role: "Founder"
  },
  organization: {
    name: "Higher Conscious Network LLC",
    shortName: "HCN",
    officialUrl: "https://higherconscious.network",
    description: "A decentralized social learning infrastructure designed to restore autonomy, protect identity, and create equitable economic opportunity through community-centered ethical technology."
  },
  products: [
    {
      name: "Conscious Network Hub",
      shortName: "CNH",
      description: "The primary platform for decentralized learning, provider marketplace, and community engagement.",
      features: [
        "User identity management",
        "Provider scheduling and billing",
        "Conscious Careers marketplace",
        "Social learning community",
        "Meeting synthesis and notes"
      ]
    },
    {
      name: "Conscious Careers",
      description: "Entrepreneurship support platform helping individuals and providers pursue business ownership with partnerships and revenue-sharing grants.",
      focus: "Minority empowerment and community resilience"
    }
  ],
  scope: {
    answerable: [
      "Higher Conscious Network LLC",
      "Conscious Network Hub",
      "Conscious Careers",
      "Founder profile and background",
      "Platform features and capabilities",
      "Decentralized learning and ethics",
      "Community and social learning"
    ],
    notAnswerable: [
      "General web search topics",
      "Real-time news and current events",
      "Maps and location services",
      "Image generation",
      "Information outside HCN scope"
    ]
  },
  closedKnowledgeMessage: "At this time, Wisdom Node is limited to official Higher Conscious Network sources for accuracy. I can answer questions about Higher Conscious Network LLC, Conscious Network Hub (CNH), Conscious Careers, and the Founder profile. For anything else, please rephrase the question to relate to HCN/CNH/Conscious Careers, or consult external sources.",
  mvpNotice: "MVP Mode: Answers are limited to HCN official sources for accuracy and reliability.",
  lastUpdated: "2026-01-19"
};

/**
 * Get HCN knowledge from cache, remote URL, or local fallback
 */
export const getHCNKnowledge = async (): Promise<HCNKnowledge | null> => {
  try {
    // 1. Try to get from cache
    const cached = getCachedKnowledge();
    if (cached) {
      console.log('HCN Knowledge: Using cached data');
      return cached.data;
    }

    // 2. Try to fetch from remote HCN site
    try {
      console.log('HCN Knowledge: Attempting remote fetch from', HCN_KNOWLEDGE_URL);
      const remote = await fetchRemoteHCNKnowledge();
      if (remote) {
        cacheKnowledge(remote);
        return remote;
      }
    } catch (error) {
      console.warn('HCN Knowledge: Remote fetch failed, falling back to local', error);
    }

    // 3. Fall back to local knowledge
    const local = getLocalHCNKnowledge();
    if (local) {
      cacheKnowledge(local);
      console.log('HCN Knowledge: Using local fallback');
      return local;
    }

    return null;
  } catch (error) {
    console.error('HCN Knowledge: Error retrieving knowledge', error);
    return null;
  }
};

/**
 * Get HCN knowledge from browser cache (localStorage)
 */
const getCachedKnowledge = (): CachedKnowledge | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedKnowledge = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - parsed.fetchedAt < CACHE_DURATION) {
      return parsed;
    }

    // Cache expired, remove it
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch (error) {
    console.error('HCN Knowledge: Cache read error', error);
    return null;
  }
};

/**
 * Cache HCN knowledge in localStorage
 */
const cacheKnowledge = (knowledge: HCNKnowledge): void => {
  try {
    const cached: CachedKnowledge = {
      fetchedAt: Date.now(),
      data: knowledge
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('HCN Knowledge: Cache write error', error);
  }
};

/**
 * Fetch HCN knowledge from remote URL with CORS handling
 */
const fetchRemoteHCNKnowledge = async (): Promise<HCNKnowledge | null> => {
  try {
    const response = await fetch(HCN_KNOWLEDGE_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors',
    });

    if (!response.ok) {
      console.warn(`HCN Knowledge: Remote fetch returned status ${response.status}`);
      return null;
    }

    const data: HCNKnowledge = await response.json();
    return data;
  } catch (error) {
    console.warn('HCN Knowledge: Remote fetch failed', error);
    return null;
  }
};

/**
 * Get local fallback HCN knowledge
 */
const getLocalHCNKnowledge = (): HCNKnowledge | null => {
  return LOCAL_HCN_KNOWLEDGE;
};

/**
 * Build system context for Wisdom Node with HCN scope
 */
export const buildHCNSystemContext = (hcnKnowledge: HCNKnowledge | null): string => {
  if (!hcnKnowledge) {
    return 'You are the HCN-scoped Wisdom Node. You only answer questions about Higher Conscious Network, Conscious Network Hub, and related products.';
  }

  return `You are the HCN-scoped Wisdom Node of the Conscious Network Hub. 

IMPORTANT - You operate in MVP Mode with limited scope:

**Founder Information:**
- Name: ${hcnKnowledge.founder.name}
- Profile: ${hcnKnowledge.founder.linkedinUrl}
- Role: ${hcnKnowledge.founder.role}

**Organization:**
- Name: ${hcnKnowledge.organization.name} (${hcnKnowledge.organization.shortName})
- Official Site: ${hcnKnowledge.organization.officialUrl}
- Mission: ${hcnKnowledge.organization.description}

**Key Products:**
${hcnKnowledge.products.map(p => `- ${p.name}: ${p.description}`).join('\n')}

**Scope - You CAN answer questions about:**
${hcnKnowledge.scope.answerable.map(s => `- ${s}`).join('\n')}

**Scope - You CANNOT answer questions about:**
${hcnKnowledge.scope.notAnswerable.map(s => `- ${s}`).join('\n')}

**When asked about topics outside your scope, respond with:**
"${hcnKnowledge.closedKnowledgeMessage}"

**When providing answers, include:**
- References to official HCN sources when available
- The MVP Notice: "${hcnKnowledge.mvpNotice}"
- Links to https://higherconscious.network or the founder's LinkedIn when relevant

Always prioritize accuracy and only cite information from official HCN sources.`;
};

/**
 * Check if a question is within HCN scope
 */
export const isQuestionInScope = (question: string, hcnKnowledge: HCNKnowledge | null): boolean => {
  if (!hcnKnowledge) return false;

  const lowerQuestion = question.toLowerCase();
  const scopeKeywords = hcnKnowledge.scope.answerable
    .map(s => s.toLowerCase())
    .concat(
      hcnKnowledge.founder.name.toLowerCase(),
      hcnKnowledge.organization.name.toLowerCase(),
      hcnKnowledge.organization.shortName.toLowerCase(),
      ...hcnKnowledge.products.map(p => p.name.toLowerCase()),
      'founder',
      'ceo',
      'conscious network',
      'hcn',
      'cnh',
      'conscious careers'
    );

  return scopeKeywords.some(keyword => lowerQuestion.includes(keyword));
};

/**
 * Generate a closed knowledge response
 */
export const getClosedKnowledgeResponse = (hcnKnowledge: HCNKnowledge | null): string => {
  if (!hcnKnowledge) {
    return 'At this time, Wisdom Node is limited to official Higher Conscious Network sources for accuracy. I can answer questions about Higher Conscious Network LLC, Conscious Network Hub (CNH), Conscious Careers, and the Founder profile. For anything else, please rephrase the question to relate to HCN/CNH/Conscious Careers, or consult external sources.';
  }
  return hcnKnowledge.closedKnowledgeMessage;
};
