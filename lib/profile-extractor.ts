import { ClientProfile } from './profile-schema';

export interface ProfileUpdate {
  field: string;
  value: string;
  confidence: number;
}

// Enhanced NLP-based profile extraction inspired by booking-agent-ts approach
export function extractProfileUpdates(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  console.log('🔍 Smart profile extraction from:', userMessage);
  console.log('📊 Current profile context:', currentProfile);
  
  // Context-aware structured extraction with confidence scoring
  const extractionResults = performStructuredExtraction(userMessage, currentProfile);
  updates.push(...extractionResults);
  
  console.log(`✅ Extracted ${updates.length} structured updates with confidence scores`);
  return updates;
}

// Smart structured extraction inspired by booking-agent-ts architecture
function performStructuredExtraction(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  // 1. FINANCIAL GOALS EXTRACTION - Context-aware timeframe detection
  const goalExtraction = extractFinancialGoals(userMessage, currentProfile);
  updates.push(...goalExtraction);
  
  // 2. RISK TOLERANCE EXTRACTION - Sentiment and keyword analysis  
  const riskExtraction = extractRiskTolerance(userMessage, currentProfile);
  updates.push(...riskExtraction);
  
  // 3. FINANCIAL ASSETS EXTRACTION - Numeric and context analysis
  const assetExtraction = extractFinancialAssets(userMessage, currentProfile);
  updates.push(...assetExtraction);
  
  // 4. TIME HORIZON EXTRACTION - Temporal analysis
  const timeExtraction = extractTimeHorizon(userMessage, currentProfile);
  updates.push(...timeExtraction);
  
  // 5. INVESTMENT PREFERENCES - Preference analysis
  const prefExtraction = extractInvestmentPreferences(userMessage, currentProfile);
  updates.push(...prefExtraction);
  
  // 6. RETURN EXPECTATIONS - Performance expectation analysis
  const expectationExtraction = extractReturnExpectations(userMessage, currentProfile);
  updates.push(...expectationExtraction);
  
  return updates;
}

// Context-aware goal extraction with timeframe intelligence
function extractFinancialGoals(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  // Skip if all goals are already filled
  if (currentProfile.goals.short_term && currentProfile.goals.medium_term && currentProfile.goals.long_term) {
    return updates;
  }
  
  // Goal keywords with confidence scoring
  const goalKeywords = ['want', 'goal', 'plan', 'save', 'buy', 'need', 'hope', 'wish', 'intend', 'aim'];
  const hasGoalKeyword = goalKeywords.some(keyword => message.includes(keyword));
  
  // Timeframe detection for smart slot assignment
  const shortTermIndicators = ['soon', 'month', 'year', 'immediate', 'next year', 'short term'];
  const mediumTermIndicators = ['few years', 'medium term', '3 years', '5 years', '7 years'];
  const longTermIndicators = ['retirement', 'long term', 'decade', '10 years', '20 years', '30 years'];
  
  if (hasGoalKeyword || userMessage.length > 10) {
    let confidence = 0.6;
    let targetSlot = 'short_term'; // Default
    
    // Smart timeframe assignment
    if (shortTermIndicators.some(indicator => message.includes(indicator))) {
      targetSlot = 'short_term';
      confidence = 0.8;
    } else if (mediumTermIndicators.some(indicator => message.includes(indicator))) {
      targetSlot = 'medium_term'; 
      confidence = 0.85;
    } else if (longTermIndicators.some(indicator => message.includes(indicator))) {
      targetSlot = 'long_term';
      confidence = 0.9;
    }
    
    // Use first available slot if target is occupied
    if ((currentProfile.goals as any)[targetSlot]) {
      if (!currentProfile.goals.short_term) targetSlot = 'short_term';
      else if (!currentProfile.goals.medium_term) targetSlot = 'medium_term';  
      else if (!currentProfile.goals.long_term) targetSlot = 'long_term';
      else return updates; // All slots filled
    }
    
    updates.push({
      field: `goals.${targetSlot}`,
      value: userMessage.trim(),
      confidence
    });
    
    console.log(`🎯 Goal extracted for ${targetSlot}: "${userMessage}" (confidence: ${confidence})`);
  }
  
  return updates;
}

// Risk tolerance extraction with sentiment analysis
function extractRiskTolerance(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  if (currentProfile.risk.tolerance) return updates;
  
  const riskKeywords = {
    conservative: ['conservative', 'safe', 'low risk', 'careful', 'cautious', 'stable', 'secure'],
    moderate: ['moderate', 'balanced', 'medium', 'comfortable', 'reasonable', 'middle'],
    aggressive: ['aggressive', 'high risk', 'growth', 'bold', 'risky', 'adventurous']
  };
  
  let maxConfidence = 0;
  let riskLevel = '';
  
  for (const [level, keywords] of Object.entries(riskKeywords)) {
    const matches = keywords.filter(keyword => message.includes(keyword)).length;
    const confidence = Math.min(0.9, 0.6 + (matches * 0.1));
    
    if (matches > 0 && confidence > maxConfidence) {
      maxConfidence = confidence;
      riskLevel = level;
    }
  }
  
  if (riskLevel && maxConfidence > 0.5) {
    updates.push({
      field: 'risk.tolerance',
      value: riskLevel,
      confidence: maxConfidence
    });
    console.log(`⚖️ Risk tolerance extracted: ${riskLevel} (confidence: ${maxConfidence})`);
  }
  
  return updates;
}

// Financial assets extraction with numeric intelligence
function extractFinancialAssets(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  if (currentProfile.financials.assets) return updates;
  
  // Numeric patterns and financial keywords
  const hasNumbers = /\d+/.test(userMessage);
  const hasMoneySymbols = /\$[\d,]+/.test(userMessage) || /\d+k\b/.test(userMessage) || /\d+000/.test(userMessage);
  const financialKeywords = ['saving', 'asset', 'worth', 'total', 'account', 'bank', 'portfolio', 'investment'];
  
  const hasFinancialKeyword = financialKeywords.some(keyword => message.includes(keyword));
  
  if (hasNumbers || hasMoneySymbols || hasFinancialKeyword) {
    let confidence = 0.5;
    
    if (hasMoneySymbols) confidence = 0.9;
    else if (hasNumbers && hasFinancialKeyword) confidence = 0.8;
    else if (hasNumbers) confidence = 0.6;
    
    updates.push({
      field: 'financials.assets',
      value: userMessage.trim(),
      confidence
    });
    console.log(`💰 Assets extracted: "${userMessage}" (confidence: ${confidence})`);
  }
  
  return updates;
}

// Time horizon extraction with temporal intelligence
function extractTimeHorizon(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  if (currentProfile.time_horizon) return updates;
  
  const timeKeywords = ['year', 'month', 'time', 'when', 'timeline', 'horizon', 'period', 'term'];
  const hasTimeKeyword = timeKeywords.some(keyword => message.includes(keyword));
  const hasNumbers = /\d+/.test(userMessage);
  
  if (hasTimeKeyword || hasNumbers) {
    let confidence = 0.6;
    
    if (hasTimeKeyword && hasNumbers) confidence = 0.85;
    else if (hasTimeKeyword) confidence = 0.7;
    
    updates.push({
      field: 'time_horizon',
      value: userMessage.trim(),
      confidence
    });
    console.log(`⏰ Time horizon extracted: "${userMessage}" (confidence: ${confidence})`);
  }
  
  return updates;
}

// Investment preferences extraction
function extractInvestmentPreferences(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  if (currentProfile.preferences.length >= 3) return updates;
  
  const prefKeywords = ['prefer', 'like', 'want', 'interested', 'stock', 'bond', 'etf', 'fund', 'crypto', 'real estate'];
  const hasPrefKeyword = prefKeywords.some(keyword => message.includes(keyword));
  
  if (hasPrefKeyword) {
    updates.push({
      field: 'preferences',
      value: userMessage.trim(),
      confidence: 0.75
    });
    console.log(`🎨 Investment preference extracted: "${userMessage}"`);
  }
  
  return updates;
}

// Return expectations extraction
function extractReturnExpectations(userMessage: string, currentProfile: ClientProfile): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const message = userMessage.toLowerCase();
  
  if (currentProfile.expectations.length >= 2) return updates;
  
  const expectKeywords = ['expect', 'hope', 'return', 'gain', 'profit', 'earn'];
  const hasExpectKeyword = expectKeywords.some(keyword => message.includes(keyword));
  const hasPercentage = /%/.test(userMessage) || /\d+%/.test(userMessage);
  
  if (hasExpectKeyword || hasPercentage) {
    let confidence = 0.7;
    if (hasPercentage) confidence = 0.9;
    
    updates.push({
      field: 'expectations',
      value: userMessage.trim(),
      confidence
    });
    console.log(`🎯 Return expectation extracted: "${userMessage}" (confidence: ${confidence})`);
  }
  
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
