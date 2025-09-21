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
