export interface ClientProfile {
  goals: {
    short_term: string | null;
    medium_term: string | null;
    long_term: string | null;
  };
  risk: {
    tolerance: string | null;
    history: string | null;
  };
  financials: {
    income: string | null;
    assets: string | null;
    expenses: string | null;
  };
  time_horizon: string | null;
  preferences: string[];
  expectations: string[];
}

export const EMPTY_PROFILE: ClientProfile = {
  goals: {
    short_term: null,
    medium_term: null,
    long_term: null,
  },
  risk: {
    tolerance: null,
    history: null,
  },
  financials: {
    income: null,
    assets: null,
    expenses: null,
  },
  time_horizon: null,
  preferences: [],
  expectations: [],
};

export function getMissingFields(profile: ClientProfile): string[] {
  const missing: string[] = [];
  
  // Check goals - need at least 2 out of 3 (short/medium/long term)
  const goalCount = [
    profile.goals.short_term,
    profile.goals.medium_term,
    profile.goals.long_term
  ].filter(Boolean).length;
  
  if (goalCount < 2) {
    if (!profile.goals.short_term) missing.push("short_term_goals");
    if (!profile.goals.medium_term) missing.push("medium_term_goals");
    if (!profile.goals.long_term) missing.push("long_term_goals");
  }
  
  // Check risk - only tolerance is required, history is optional
  if (!profile.risk.tolerance) missing.push("risk_tolerance");
  
  // Check financials - income is optional, but assets are important
  // If no income, assets become more critical to understand wealth source
  if (!profile.financials.assets) missing.push("assets");
  
  // Expenses can be a range, so it's optional
  // Income is optional (could be student, retired, etc.)
  
  // Check time horizon - necessary
  if (!profile.time_horizon) missing.push("time_horizon");
  
  // Check preferences - only 1 required (reduced from 2)
  if (profile.preferences.length < 1) missing.push("preferences");
  
  // Check expectations - only 1 required
  if (profile.expectations.length < 1) missing.push("expectations");
  
  return missing;
}

export function isProfileComplete(profile: ClientProfile): boolean {
  return getMissingFields(profile).length === 0;
}

export function getProfileCompletionPercentage(profile: ClientProfile): number {
  // Calculate total required fields based on flexible requirements
  let totalRequired = 0;
  
  // Goals: 2 out of 3 required
  const goalCount = [
    profile.goals.short_term,
    profile.goals.medium_term,
    profile.goals.long_term
  ].filter(Boolean).length;
  totalRequired += Math.min(goalCount, 2);
  
  // Risk: 1 required (tolerance only)
  if (profile.risk.tolerance) totalRequired += 1;
  
  // Financials: 1 required (assets)
  if (profile.financials.assets) totalRequired += 1;
  
  // Time horizon: 1 required
  if (profile.time_horizon) totalRequired += 1;
  
  // Preferences: 1 required
  if (profile.preferences.length >= 1) totalRequired += 1;
  
  // Expectations: 1 required
  if (profile.expectations.length >= 1) totalRequired += 1;
  
  const totalPossible = 6; // Total possible required fields
  return Math.round((totalRequired / totalPossible) * 100);
}

export function generateProfileSummary(profile: ClientProfile): string {
  const completed: string[] = [];
  const missing: string[] = [];
  
  // Goals - check if we have at least 2
  const goalCount = [
    profile.goals.short_term,
    profile.goals.medium_term,
    profile.goals.long_term
  ].filter(Boolean).length;
  
  if (goalCount >= 2) {
    const goalTypes = [];
    if (profile.goals.short_term) goalTypes.push("short-term");
    if (profile.goals.medium_term) goalTypes.push("medium-term");
    if (profile.goals.long_term) goalTypes.push("long-term");
    completed.push(`${goalTypes.join(" and ")} goals`);
  } else {
    missing.push("goals (need at least 2 timeframes)");
  }
  
  // Risk - only tolerance required
  if (profile.risk.tolerance) {
    completed.push("risk tolerance");
  } else {
    missing.push("risk tolerance");
  }
  
  // Financials - assets are most important
  if (profile.financials.assets) {
    completed.push("assets");
  } else {
    missing.push("assets");
  }
  
  // Optional financial info
  if (profile.financials.income) {
    completed.push("income information");
  }
  if (profile.financials.expenses) {
    completed.push("expenses");
  }
  
  // Time horizon
  if (profile.time_horizon) {
    completed.push("time horizon");
  } else {
    missing.push("time horizon");
  }
  
  // Preferences - only 1 required
  if (profile.preferences.length >= 1) {
    completed.push("investment preferences");
  } else {
    missing.push("investment preferences");
  }
  
  // Expectations - only 1 required
  if (profile.expectations.length >= 1) {
    completed.push("expectations");
  } else {
    missing.push("expectations");
  }
  
  let summary = "";
  
  if (completed.length > 0) {
    summary += `So far, you have provided: ${completed.join(", ")}. `;
  }
  
  if (missing.length > 0) {
    summary += `Missing: ${missing.join(", ")}. Please continue asking follow-up questions to fill those.`;
  }
  
  return summary;
}

export function generateFinalProfileSummary(profile: ClientProfile): string {
  const summaryParts: string[] = [];
  
  // Goals Summary
  const goals = [];
  if (profile.goals.short_term) goals.push(`Short-term: ${profile.goals.short_term}`);
  if (profile.goals.medium_term) goals.push(`Medium-term: ${profile.goals.medium_term}`);
  if (profile.goals.long_term) goals.push(`Long-term: ${profile.goals.long_term}`);
  
  if (goals.length > 0) {
    summaryParts.push(`🎯 **Financial Goals:**\n${goals.join('\n')}`);
  }
  
  // Risk Profile Summary
  if (profile.risk.tolerance) {
    summaryParts.push(`⚖️ **Risk Profile:** ${profile.risk.tolerance}`);
  }
  if (profile.risk.history) {
    summaryParts.push(`📈 **Investment History:** ${profile.risk.history}`);
  }
  
  // Financial Situation Summary
  const financials = [];
  if (profile.financials.income) financials.push(`Income: ${profile.financials.income}`);
  if (profile.financials.assets) financials.push(`Assets: ${profile.financials.assets}`);
  if (profile.financials.expenses) financials.push(`Expenses: ${profile.financials.expenses}`);
  
  if (financials.length > 0) {
    summaryParts.push(`💰 **Financial Situation:**\n${financials.join('\n')}`);
  }
  
  // Time Horizon
  if (profile.time_horizon) {
    summaryParts.push(`⏰ **Time Horizon:** ${profile.time_horizon}`);
  }
  
  // Preferences
  if (profile.preferences.length > 0) {
    summaryParts.push(`🎨 **Investment Preferences:** ${profile.preferences.join(', ')}`);
  }
  
  // Expectations
  if (profile.expectations.length > 0) {
    summaryParts.push(`🎯 **Expectations:** ${profile.expectations.join(', ')}`);
  }
  
  return summaryParts.join('\n\n');
}

export function generateProfileCompletionSummary(profile: ClientProfile): string {
  const completionPercentage = getProfileCompletionPercentage(profile);
  const isComplete = isProfileComplete(profile);
  
  let summary = `## 📊 Profile Completion Summary\n\n`;
  summary += `**Completion Status:** ${completionPercentage}% ${isComplete ? '✅ Complete' : '⏳ In Progress'}\n\n`;
  
  if (isComplete) {
    summary += `🎉 **Congratulations!** Your financial profile is complete and ready for personalized investment recommendations.\n\n`;
    summary += `### 📋 Complete Profile Overview:\n\n`;
    summary += generateFinalProfileSummary(profile);
    summary += `\n\n### 🚀 Next Steps:\n`;
    summary += `- Personalized investment recommendations\n`;
    summary += `- Portfolio allocation strategy\n`;
    summary += `- Risk-adjusted return expectations\n`;
    summary += `- Ongoing monitoring and rebalancing plan\n`;
  } else {
    const missingFields = getMissingFields(profile);
    summary += `### 📝 Still Missing:\n`;
    summary += `- ${missingFields.join('\n- ')}\n\n`;
    summary += `### 💡 To Complete Your Profile:\n`;
    summary += `Continue our conversation to provide the remaining information. This will enable me to give you the most personalized and accurate financial advice.\n\n`;
    summary += `### 📋 Current Information:\n\n`;
    summary += generateFinalProfileSummary(profile);
  }
  
  return summary;
}

export function generateEditableProfileSummary(profile: ClientProfile): string {
  let summary = `## 📋 Your Financial Profile Summary\n\n`;
  summary += `Please review the information below and let me know if anything needs to be corrected or updated:\n\n`;
  
  // Goals Section
  summary += `### 🎯 Financial Goals\n`;
  if (profile.goals.short_term) {
    summary += `**Short-term (1-2 years):** ${profile.goals.short_term}\n`;
  }
  if (profile.goals.medium_term) {
    summary += `**Medium-term (3-7 years):** ${profile.goals.medium_term}\n`;
  }
  if (profile.goals.long_term) {
    summary += `**Long-term (8+ years):** ${profile.goals.long_term}\n`;
  }
  summary += `\n`;
  
  // Risk Profile Section
  summary += `### ⚖️ Risk Profile\n`;
  if (profile.risk.tolerance) {
    summary += `**Risk Tolerance:** ${profile.risk.tolerance}\n`;
  }
  if (profile.risk.history) {
    summary += `**Investment History:** ${profile.risk.history}\n`;
  }
  summary += `\n`;
  
  // Financial Situation Section
  summary += `### 💰 Financial Situation\n`;
  if (profile.financials.income) {
    summary += `**Annual Income:** ${profile.financials.income}\n`;
  }
  if (profile.financials.assets) {
    summary += `**Total Assets:** ${profile.financials.assets}\n`;
  }
  if (profile.financials.expenses) {
    summary += `**Monthly Expenses:** ${profile.financials.expenses}\n`;
  }
  summary += `\n`;
  
  // Time Horizon Section
  if (profile.time_horizon) {
    summary += `### ⏰ Time Horizon\n`;
    summary += `**Investment Timeline:** ${profile.time_horizon}\n\n`;
  }
  
  // Preferences Section
  if (profile.preferences.length > 0) {
    summary += `### 🎨 Investment Preferences\n`;
    summary += `**Preferences:** ${profile.preferences.join(', ')}\n\n`;
  }
  
  // Expectations Section
  if (profile.expectations.length > 0) {
    summary += `### 🎯 Expectations\n`;
    summary += `**Return Expectations:** ${profile.expectations.join(', ')}\n\n`;
  }
  
  summary += `### ✅ Verification\n`;
  summary += `Please review this summary and let me know:\n`;
  summary += `- Is all the information accurate?\n`;
  summary += `- Would you like to modify anything?\n`;
  summary += `- Are there any additional details you'd like to add?\n\n`;
  summary += `Once you confirm this information is correct, I'll provide personalized investment recommendations based on your complete financial profile.`;
  
  return summary;
}