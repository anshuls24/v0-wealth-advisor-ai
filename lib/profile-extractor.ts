import { ClientProfile } from './profile-schema';

export interface ProfileUpdate {
  field: string;
  value: string;
  confidence: number;
}

export function extractProfileUpdates(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  // Extract goals
  if (message.includes('short') && (message.includes('goal') || message.includes('term'))) {
    const match = extractValue(userMessage, ['short', 'goal', 'term']);
    if (match) {
      updates.push({ field: 'goals.short_term', value: match, confidence: 0.8 });
    }
  }
  
  if (message.includes('medium') && (message.includes('goal') || message.includes('term'))) {
    const match = extractValue(userMessage, ['medium', 'goal', 'term']);
    if (match) {
      updates.push({ field: 'goals.medium_term', value: match, confidence: 0.8 });
    }
  }
  
  if (message.includes('long') && (message.includes('goal') || message.includes('term'))) {
    const match = extractValue(userMessage, ['long', 'goal', 'term']);
    if (match) {
      updates.push({ field: 'goals.long_term', value: match, confidence: 0.8 });
    }
  }
  
  // Extract risk tolerance
  if (message.includes('risk') && (message.includes('tolerance') || message.includes('comfortable'))) {
    const match = extractValue(userMessage, ['risk', 'tolerance', 'comfortable']);
    if (match) {
      updates.push({ field: 'risk.tolerance', value: match, confidence: 0.9 });
    }
  }
  
  // Extract income
  if (message.includes('income') || message.includes('salary') || message.includes('earn')) {
    const match = extractValue(userMessage, ['income', 'salary', 'earn']);
    if (match) {
      updates.push({ field: 'financials.income', value: match, confidence: 0.9 });
    }
  }
  
  // Extract assets
  if (message.includes('asset') || message.includes('saving') || message.includes('invest')) {
    const match = extractValue(userMessage, ['asset', 'saving', 'invest']);
    if (match) {
      updates.push({ field: 'financials.assets', value: match, confidence: 0.8 });
    }
  }
  
  // Extract expenses
  if (message.includes('expense') || message.includes('spend') || message.includes('cost')) {
    const match = extractValue(userMessage, ['expense', 'spend', 'cost']);
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
    if (update.confidence > 0.7) { // Only apply high-confidence updates
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
        }
      }
    }
  }
  
  return newProfile;
}
