import { ClientProfile, EMPTY_PROFILE } from './profile-schema';

type ProfileRecord = {
  profile: ClientProfile;
  updatedAt: number;
};

const store: Map<string, ProfileRecord> = new Map();

function deepMergeProfile(base: ClientProfile, incoming: Partial<ClientProfile>): ClientProfile {
  const result: ClientProfile = JSON.parse(JSON.stringify(base));
  const apply = (target: any, src: any) => {
    if (!src) return;
    Object.keys(src).forEach((key) => {
      const srcVal = (src as any)[key];
      if (srcVal === undefined || srcVal === null) return;
      if (Array.isArray(srcVal)) {
        (target as any)[key] = srcVal;
      } else if (typeof srcVal === 'object') {
        (target as any)[key] = apply((target as any)[key] || {}, srcVal);
      } else {
        (target as any)[key] = srcVal;
      }
    });
    return target;
  };
  return apply(result, incoming);
}

export const ProfileStore = {
  get(userId?: string | null): ClientProfile | null {
    if (!userId) return null;
    const rec = store.get(userId);
    return rec ? rec.profile : null;
  },

  set(userId: string, profile: ClientProfile) {
    if (!userId) return;
    store.set(userId, { profile, updatedAt: Date.now() });
  },

  merge(userId: string | null | undefined, incoming: Partial<ClientProfile> | null | undefined): ClientProfile {
    const existing = (userId && store.get(userId)?.profile) || EMPTY_PROFILE;
    const merged = deepMergeProfile(existing, incoming || {});
    if (userId) {
      store.set(userId, { profile: merged, updatedAt: Date.now() });
    }
    return merged;
  },
};


