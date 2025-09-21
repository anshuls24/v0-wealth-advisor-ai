import { ClientProfile } from './profile-schema';

export interface ProfileUpdate {
  field: string;
  value: string;
  confidence: number;
}

export function extractProfileUpdates(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  // Extract goals - more flexible detection
  if (message.includes('short') && (message.includes('goal') || message.includes('term') || message.includes('year'))) {
    const match = extractValue(userMessage, ['short', 'goal', 'term', 'year']);
    if (match) {
      updates.push({ field: 'goals.short_term', value: match, confidence: 0.8 });
    }
  }
  
  if (message.includes('medium') && (message.includes('goal') || message.includes('term') || message.includes('year'))) {
    const match = extractValue(userMessage, ['medium', 'goal', 'term', 'year']);
    if (match) {
      updates.push({ field: 'goals.medium_term', value: match, confidence: 0.8 });
    }
  }
  
  if (message.includes('long') && (message.includes('goal') || message.includes('term') || message.includes('year'))) {
    const match = extractValue(userMessage, ['long', 'goal', 'term', 'year']);
    if (match) {
      updates.push({ field: 'goals.long_term', value: match, confidence: 0.8 });
    }
  }
  
  // Extract general goals without timeframe specification
  if ((message.includes('goal') || message.includes('want') || message.includes('plan')) && 
      !message.includes('short') && !message.includes('medium') && !message.includes('long')) {
    const match = extractValue(userMessage, ['goal', 'want', 'plan']);
    if (match && !currentProfile.goals.short_term && !currentProfile.goals.medium_term && !currentProfile.goals.long_term) {
      // If no goals are set, assign to short-term by default
      updates.push({ field: 'goals.short_term', value: match, confidence: 0.7 });
    }
  }
  
  // Extract risk tolerance
  if (message.includes('risk') && (message.includes('tolerance') || message.includes('comfortable'))) {
    const match = extractValue(userMessage, ['risk', 'tolerance', 'comfortable']);
    if (match) {
      updates.push({ field: 'risk.tolerance', value: match, confidence: 0.9 });
    }
  }
  
  // Extract income - optional but helpful
  if (message.includes('income') || message.includes('salary') || message.includes('earn') || message.includes('make')) {
    const match = extractValue(userMessage, ['income', 'salary', 'earn', 'make']);
    if (match) {
      updates.push({ field: 'financials.income', value: match, confidence: 0.9 });
    }
  }
  
  // Extract assets - most important for financials
  if (message.includes('asset') || message.includes('saving') || message.includes('invest') || 
      message.includes('money') || message.includes('wealth') || message.includes('inheritance')) {
    const match = extractValue(userMessage, ['asset', 'saving', 'invest', 'money', 'wealth', 'inheritance']);
    if (match) {
      updates.push({ field: 'financials.assets', value: match, confidence: 0.8 });
    }
  }
  
  // Extract expenses - optional, can be a range
  if (message.includes('expense') || message.includes('spend') || message.includes('cost') || 
      message.includes('budget') || message.includes('monthly')) {
    const match = extractValue(userMessage, ['expense', 'spend', 'cost', 'budget', 'monthly']);
    if (match) {
      updates.push({ field: 'financials.expenses', value: match, confidence: 0.8 });
    }
  }
  
  // Extract time horizon
  if (message.includes('time') && (message.includes('horizon') || message.includes('year'))) {
    const match = extractValue(userMessage, ['time', 'horizon', 'year']);
    if (match) {
      updates.push({ field: 'time_horizon', value: match, confidence: 0.8 });
    }
  }
  
  // Extract preferences
  if (message.includes('prefer') || message.includes('like') || message.includes('want') || 
      message.includes('esg') || message.includes('sustainable') || message.includes('conservative') ||
      message.includes('aggressive') || message.includes('hands-off') || message.includes('active')) {
    const match = extractValue(userMessage, ['prefer', 'like', 'want', 'esg', 'sustainable', 'conservative', 'aggressive', 'hands-off', 'active']);
    if (match) {
      updates.push({ field: 'preferences', value: match, confidence: 0.7 });
    }
  }
  
  // Extract expectations
  if (message.includes('expect') || message.includes('hope') || message.includes('return') || 
      message.includes('success') || message.includes('achieve')) {
    const match = extractValue(userMessage, ['expect', 'hope', 'return', 'success', 'achieve']);
    if (match) {
      updates.push({ field: 'expectations', value: match, confidence: 0.7 });
    }
  }
  
  return updates;
}

function extractValue(message: string, keywords: string[]): string | null {
  // Simple extraction - look for content after keywords
  const sentences = message.split(/[.!?]/);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const hasKeyword = keywords.some(keyword => lowerSentence.includes(keyword));
    
    if (hasKeyword && sentence.trim().length > 10) {
      return sentence.trim();
    }
  }
  
  return null;
}

export function applyProfileUpdates(profile: ClientProfile, updates: ProfileUpdate[]): ClientProfile {
  const newProfile = { ...profile };
  
  for (const update of updates) {
    if (update.confidence > 0.6) { // Lowered threshold for more flexible updates
      const fieldParts = update.field.split('.');
      
      if (fieldParts.length === 2) {
        const [section, field] = fieldParts;
        if (section === 'goals' && field in newProfile.goals) {
          (newProfile.goals as any)[field] = update.value;
        } else if (section === 'risk' && field in newProfile.risk) {
          (newProfile.risk as any)[field] = update.value;
        } else if (section === 'financials' && field in newProfile.financials) {
          (newProfile.financials as any)[field] = update.value;
        }
      } else if (fieldParts.length === 1) {
        const field = fieldParts[0];
        if (field === 'time_horizon') {
          newProfile.time_horizon = update.value;
        } else if (field === 'preferences') {
          // Add to preferences array if not already present
          if (!newProfile.preferences.includes(update.value)) {
            newProfile.preferences.push(update.value);
          }
        } else if (field === 'expectations') {
          // Add to expectations array if not already present
          if (!newProfile.expectations.includes(update.value)) {
            newProfile.expectations.push(update.value);
          }
        }
      }
    }
  }
  
  return newProfile;
}
