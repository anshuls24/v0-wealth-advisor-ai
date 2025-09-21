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
  
  // Check goals
  if (!profile.goals.short_term) missing.push("short_term_goals");
  if (!profile.goals.medium_term) missing.push("medium_term_goals");
  if (!profile.goals.long_term) missing.push("long_term_goals");
  
  // Check risk
  if (!profile.risk.tolerance) missing.push("risk_tolerance");
  if (!profile.risk.history) missing.push("risk_history");
  
  // Check financials
  if (!profile.financials.income) missing.push("income");
  if (!profile.financials.assets) missing.push("assets");
  if (!profile.financials.expenses) missing.push("expenses");
  
  // Check time horizon
  if (!profile.time_horizon) missing.push("time_horizon");
  
  // Check preferences (at least 2 required)
  if (profile.preferences.length < 2) missing.push("preferences");
  
  // Check expectations (at least 1 required)
  if (profile.expectations.length < 1) missing.push("expectations");
  
  return missing;
}

export function isProfileComplete(profile: ClientProfile): boolean {
  return getMissingFields(profile).length === 0;
}

export function getProfileCompletionPercentage(profile: ClientProfile): number {
  const totalFields = 9; // Total required fields
  const missingFields = getMissingFields(profile).length;
  return Math.round(((totalFields - missingFields) / totalFields) * 100);
}

export function generateProfileSummary(profile: ClientProfile): string {
  const completed: string[] = [];
  const missing: string[] = [];
  
  // Goals
  if (profile.goals.short_term) completed.push("short-term goals");
  else missing.push("short-term goals");
  
  if (profile.goals.medium_term) completed.push("medium-term goals");
  else missing.push("medium-term goals");
  
  if (profile.goals.long_term) completed.push("long-term goals");
  else missing.push("long-term goals");
  
  // Risk
  if (profile.risk.tolerance) completed.push("risk tolerance");
  else missing.push("risk tolerance");
  
  if (profile.risk.history) completed.push("risk history");
  else missing.push("risk history");
  
  // Financials
  if (profile.financials.income) completed.push("income information");
  else missing.push("income information");
  
  if (profile.financials.assets) completed.push("assets");
  else missing.push("assets");
  
  if (profile.financials.expenses) completed.push("expenses");
  else missing.push("expenses");
  
  // Time horizon
  if (profile.time_horizon) completed.push("time horizon");
  else missing.push("time horizon");
  
  // Preferences
  if (profile.preferences.length >= 2) completed.push("investment preferences");
  else missing.push("investment preferences");
  
  // Expectations
  if (profile.expectations.length >= 1) completed.push("expectations");
  else missing.push("expectations");
  
  let summary = "";
  
  if (completed.length > 0) {
    summary += `So far, you have provided: ${completed.join(", ")}. `;
  }
  
  if (missing.length > 0) {
    summary += `Missing: ${missing.join(", ")}. Please continue asking follow-up questions to fill those.`;
  }
  
  return summary;
}
