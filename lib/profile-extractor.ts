import { ClientProfile } from './profile-schema';

export interface ProfileUpdate {
  field: string;
  value: string;
  confidence: number;
}

export function extractProfileUpdates(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  console.log('Extracting profile updates from:', userMessage);
  console.log('Current profile state:', currentProfile);
  
  // Ultra-aggressive approach - assign ANY response to the first empty field in each category
  
  // Goals - assign ANY response to first empty goal slot
  if (userMessage.length > 2 && !currentProfile.goals.short_term && !currentProfile.goals.medium_term && !currentProfile.goals.long_term) {
    console.log('Checking for goal response...');
    if (message.includes('want') || message.includes('goal') || message.includes('plan') || 
        message.includes('save') || message.includes('buy') || message.includes('retire') ||
        message.includes('wedding') || message.includes('house') || message.includes('car') ||
        message.includes('education') || message.includes('vacation') || message.includes('debt') ||
        message.includes('pay') || message.includes('fund') || message.includes('invest') ||
        message.includes('nothing') || message.includes('like')) {
      console.log('Found goal response:', userMessage);
      updates.push({ field: 'goals.short_term', value: userMessage.trim(), confidence: 0.7 });
    }
  }
  
  // Risk tolerance - assign ANY response that could be risk-related
  if (!currentProfile.risk.tolerance) {
    console.log('Checking for risk response...');
    if (message.includes('risk') || message.includes('conservative') || message.includes('aggressive') || 
        message.includes('moderate') || message.includes('comfortable') || message.includes('tolerance') ||
        message.includes('like') || message.includes('prefer') || /\d+/.test(userMessage) ||
        message.includes('nothing') || message.includes('ok')) {
      console.log('Found risk response:', userMessage);
      updates.push({ field: 'risk.tolerance', value: userMessage.trim(), confidence: 0.7 });
    }
  }
  
  // Assets - assign ANY response with numbers or money-related terms
  if (!currentProfile.financials.assets) {
    console.log('Checking for asset response...');
    if (message.includes('money') || message.includes('saving') || message.includes('asset') || 
        message.includes('worth') || message.includes('total') || message.includes('ira') ||
        message.includes('bank') || message.includes('account') || message.includes('fund') ||
        /\$[\d,]+/.test(userMessage) || /\d+k/.test(userMessage) || /\d+000/.test(userMessage) ||
        /\d+/.test(userMessage)) {
      console.log('Found asset response:', userMessage);
      updates.push({ field: 'financials.assets', value: userMessage.trim(), confidence: 0.7 });
    }
  }
  
  // Time horizon - assign ANY response with time-related terms
  if (!currentProfile.time_horizon) {
    console.log('Checking for time horizon response...');
    if (message.includes('year') || message.includes('retire') || message.includes('time') || 
        message.includes('when') || message.includes('month') || message.includes('yr') ||
        message.includes('wedding') || message.includes('house') || message.includes('buy') ||
        /\d+/.test(userMessage)) {
      console.log('Found time horizon response:', userMessage);
      updates.push({ field: 'time_horizon', value: userMessage.trim(), confidence: 0.7 });
    }
  }
  
  // Preferences - assign ANY response about investment preferences
  if (currentProfile.preferences.length < 1) {
    console.log('Checking for preference response...');
    if (message.includes('prefer') || message.includes('like') || message.includes('want') || 
        message.includes('avoid') || message.includes('stock') || message.includes('bond') ||
        message.includes('option') || message.includes('etf') || message.includes('mutual') ||
        message.includes('invest') || message.includes('fund') || message.includes('portfolio')) {
      console.log('Found preference response:', userMessage);
      updates.push({ field: 'preferences', value: userMessage.trim(), confidence: 0.7 });
    }
  }
  
  // Expectations - assign ANY response with percentage or return expectations
  if (currentProfile.expectations.length < 1) {
    console.log('Checking for expectation response...');
    if (message.includes('expect') || message.includes('hope') || message.includes('return') || 
        message.includes('percent') || message.includes('%') || message.includes('earn') ||
        message.includes('gain') || message.includes('profit') || /\d+%/.test(userMessage) ||
        /\d+/.test(userMessage)) {
      console.log('Found expectation response:', userMessage);
      updates.push({ field: 'expectations', value: userMessage.trim(), confidence: 0.7 });
    }
  }
  
  console.log('Total updates found:', updates.length);
  return updates;
}

function extractValue(message: string, keywords: string[]): string | null {
  // Simple extraction - just return the message if it contains any keyword
  const lowerMessage = message.toLowerCase();
  
  for (const keyword of keywords) {
    if (lowerMessage.includes(keyword)) {
      return message.trim();
    }
  }
  
  return null;
}

// Test function to verify extraction is working
export function testProfileExtraction() {
  const testProfile = {
    goals: { short_term: null, medium_term: null, long_term: null },
    risk: { tolerance: null, history: null },
    financials: { income: null, assets: null, expenses: null },
    time_horizon: null,
    preferences: [],
    expectations: []
  };
  
  const testMessages = [
    "pay for my wedding",
    "buy a house", 
    "10",
    "120k",
    "50k",
    "ira",
    "6 months for wedding",
    "3 yrs",
    "options and stocks",
    "avoid bonds",
    "12 percent"
  ];
  
  console.log('=== TESTING PROFILE EXTRACTION ===');
  testMessages.forEach(msg => {
    const updates = extractProfileUpdates(msg, testProfile);
    console.log(`Test message "${msg}" -> Updates:`, updates);
  });
  console.log('=== END TEST ===');
}

export function applyProfileUpdates(profile: ClientProfile, updates: ProfileUpdate[]): ClientProfile {
  const newProfile = { ...profile };
  
  for (const update of updates) {
    if (update.confidence > 0.5) { // Even more lenient threshold for better extraction
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
