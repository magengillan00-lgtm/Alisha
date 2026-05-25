// Service to fetch free LLM API keys from GitHub repositories
// Parses README from alistaitsacle/free-llm-api-keys

export interface FreeKey {
  id: string;
  key: string;
  model: string;
  status: 'new' | 'active' | 'rate_limited' | 'expired' | 'unknown';
  budget: string;
  rateLimit: string;
  expires: string;
  description: string;
  category: string;
  baseUrl: string;
}

// Map model categories to emojis
const CATEGORY_ICONS: Record<string, string> = {
  'GPT': '🧠',
  'Claude': '🎭',
  'Gemini': '💎',
  'DeepSeek': '🔍',
  'Multi-Model': '🔄',
  'Kimi': '🌙',
  'Image': '🖼️',
  'Audio': '🔊',
  'Embedding': '📐',
};

const CATEGORY_COLORS: Record<string, string> = {
  'GPT': 'from-green-500 to-emerald-600',
  'Claude': 'from-purple-500 to-violet-600',
  'Gemini': 'from-blue-500 to-cyan-500',
  'DeepSeek': 'from-orange-500 to-amber-600',
  'Multi-Model': 'from-teal-500 to-emerald-500',
  'Kimi': 'from-indigo-500 to-blue-600',
  'Image': 'from-pink-500 to-rose-600',
  'Audio': 'from-yellow-500 to-orange-500',
  'Embedding': 'from-gray-500 to-slate-600',
};

export function getCategoryIcon(category: string): string {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (category.includes(key)) return icon;
  }
  return '🔑';
}

export function getCategoryColor(category: string): string {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (category.includes(key)) return color;
  }
  return 'from-emerald-500 to-teal-600';
}

function parseStatus(statusStr: string): FreeKey['status'] {
  const s = statusStr.trim().toLowerCase();
  if (s.includes('new') || s.includes('🆕')) return 'new';
  if (s.includes('active') || s.includes('✅')) return 'active';
  if (s.includes('rate') || s.includes('limited') || s.includes('⏳')) return 'rate_limited';
  if (s.includes('expired') || s.includes('❌')) return 'expired';
  return 'unknown';
}

/**
 * Parse the README content from free-llm-api-keys to extract key information
 */
function parseReadmeKeys(readmeContent: string): FreeKey[] {
  const keys: FreeKey[] = [];
  const BASE_URL = 'https://aiapiv2.pekpik.com/v1';

  // Split into sections by ### headers
  const sections = readmeContent.split(/^### /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const headerLine = lines[0] || '';
    
    // Extract category name (e.g., "GPT-5.5 `05-25 22:37`")
    const categoryMatch = headerLine.match(/^([^\s`]+)/);
    const category = categoryMatch ? categoryMatch[1] : headerLine.split('`')[0].trim();

    // Find table rows (lines starting with |)
    const tableRows = lines.filter(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
    
    // Skip header and separator rows
    const dataRows = tableRows.filter(row => {
      const trimmed = row.trim();
      return !trimmed.includes('---') && !trimmed.includes('Key') && !trimmed.includes('Model');
    });

    for (const row of dataRows) {
      const cells = row.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length < 6) continue;

      // Extract key from first cell (might be wrapped in backticks)
      let key = cells[0].replace(/`/g, '').trim();
      const model = cells[1].replace(/`/g, '').trim();
      const statusStr = cells[2] || '';
      const budget = cells[3] || '';
      const rateLimit = cells[4] || '';
      const expires = cells[5] || '';
      const description = cells[6] || '';

      if (!key.startsWith('sk-')) continue; // Skip non-key rows

      keys.push({
        id: `fk-${keys.length}-${key.slice(-6)}`,
        key,
        model,
        status: parseStatus(statusStr),
        budget,
        rateLimit,
        expires,
        description,
        category,
        baseUrl: BASE_URL,
      });
    }
  }

  return keys;
}

/**
 * Fetch free keys from the GitHub README
 */
export async function fetchFreeKeys(): Promise<FreeKey[]> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/alistaitsacle/free-llm-api-keys/contents/README.md',
      {
        headers: {
          'Accept': 'application/vnd.github.v3.raw',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch README:', response.status);
      return [];
    }

    const readmeContent = await response.text();
    const keys = parseReadmeKeys(readmeContent);

    // Filter only usable keys (new or active)
    const usableKeys = keys.filter(k => k.status === 'new' || k.status === 'active' || k.status === 'unknown');

    // Return first 10 usable keys, prioritizing variety
    return prioritizeKeys(usableKeys).slice(0, 10);
  } catch (error) {
    console.error('Error fetching free keys:', error);
    return [];
  }
}

/**
 * Prioritize keys to give variety across categories
 */
function prioritizeKeys(keys: FreeKey[]): FreeKey[] {
  const categoryMap = new Map<string, FreeKey[]>();
  
  for (const key of keys) {
    const cat = key.category;
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat)!.push(key);
  }

  // Round-robin across categories
  const result: FreeKey[] = [];
  const categories = Array.from(categoryMap.keys());
  let hasMore = true;

  while (hasMore && result.length < 10) {
    hasMore = false;
    for (const cat of categories) {
      const catKeys = categoryMap.get(cat)!;
      if (catKeys.length > 0) {
        result.push(catKeys.shift()!);
        hasMore = true;
        if (result.length >= 10) break;
      }
    }
  }

  return result;
}

/**
 * Test if a free key is still working by making a simple models request
 */
export async function testFreeKey(key: FreeKey): Promise<boolean> {
  try {
    const response = await fetch(`${key.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${key.key}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch available models for a free key
 */
export async function fetchFreeKeyModels(key: FreeKey): Promise<string[]> {
  try {
    const response = await fetch(`${key.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${key.key}`,
      },
    });

    if (!response.ok) return [key.model]; // Fallback to the key's default model

    const data = await response.json();
    const models = (data.data || []).map((m: { id: string }) => m.id);
    
    // Always include the key's default model
    if (!models.includes(key.model)) {
      models.unshift(key.model);
    }

    return models;
  } catch {
    return [key.model];
  }
}

/**
 * Verify that a key and model combination works by sending a minimal test request.
 * Returns { success: boolean, error?: string }
 */
export async function verifyKeyModel(key: FreeKey, model: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${key.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || '';

    if (response.status === 429) {
      return { success: false, error: 'تم تجاوز حد الطلبات - المفتاح محدود السرعة' };
    }
    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'المفتاح منتهي الصلاحية أو غير صالح' };
    }
    if (response.status === 404) {
      return { success: false, error: 'الموديل غير متاح مع هذا المفتاح' };
    }
    return { success: false, error: errorMsg || `خطأ HTTP: ${response.status}` };
  } catch (err) {
    return { success: false, error: 'فشل الاتصال - تحقق من الإنترنت' };
  }
}

/**
 * Verify that a manual API key and model combination works.
 * Returns { success: boolean, error?: string }
 */
export async function verifyManualKeyModel(
  provider: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { PROVIDERS } = await import('@/lib/gemini-client');
    const p = PROVIDERS[provider as keyof typeof PROVIDERS];
    if (!p) return { success: false, error: 'مزود غير معروف' };

    const works = await p.testModel(apiKey, model);
    if (works) {
      return { success: true };
    }
    return { success: false, error: 'الموديل لا يعمل مع هذا المفتاح' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل التحقق';
    return { success: false, error: msg };
  }
}

/**
 * Send a chat message using a free key (OpenAI-compatible format)
 */
export async function sendFreeKeyMessage(
  key: FreeKey,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const response = await fetch(`${key.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      max_tokens: 1024,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || '';
    
    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('KEY_EXPIRED');
    }
    throw new Error(errorMsg || 'حدث خطأ أثناء الاتصال');
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'لم يتم الحصول على رد.';
}
