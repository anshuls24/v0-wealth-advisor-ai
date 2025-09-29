// Real-time profile tracking system inspired by booking-agent-ts
import { ClientProfile, EMPTY_PROFILE } from './profile-schema';

export interface ProfileExtractionProgress {
  stage: string;
  message: string;
  progress: number;
  extractedFields: string[];
  confidence: number;
}

export interface ProfileTrackingResult {
  success: boolean;
  updatedProfile: ClientProfile;
  extractionLog: ProfileExtractionProgress[];
  fieldsUpdated: string[];
  overallConfidence: number;
}

export class RealTimeProfileTracker {
  private progressCallbacks: ((progress: ProfileExtractionProgress) => void)[] = [];
  private extractionLog: ProfileExtractionProgress[] = [];

  // Register callback for real-time progress updates
  onProgress(callback: (progress: ProfileExtractionProgress) => void) {
    this.progressCallbacks.push(callback);
  }

  // Emit progress update to all registered callbacks
  private emitProgress(stage: string, message: string, progress: number, extractedFields: string[], confidence: number) {
    const progressUpdate: ProfileExtractionProgress = {
      stage,
      message,
      progress,
      extractedFields,
      confidence
    };
    
    this.extractionLog.push(progressUpdate);
    
    // Emit to all callbacks
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progressUpdate);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  // Process user message with real-time progress tracking
  async processUserMessage(
    userMessage: string, 
    currentProfile: ClientProfile
  ): Promise<ProfileTrackingResult> {
    this.extractionLog = [];
    
    try {
      // Stage 1: Initialize processing
      this.emitProgress('initializing', 'Starting profile analysis...', 0, [], 0);
      
      // Stage 2: Perform structured extraction
      this.emitProgress('extracting', 'Analyzing user message for profile data...', 25, [], 0);
      
      // Import the extraction functions
      const { extractProfileUpdates, applyProfileUpdates } = await import('./profile-extractor');
      
      // Stage 3: Extract profile updates
      const updates = extractProfileUpdates(userMessage, currentProfile);
      const extractedFields = updates.map(u => u.field);
      const avgConfidence = updates.length > 0 ? updates.reduce((sum, u) => sum + u.confidence, 0) / updates.length : 0;
      
      this.emitProgress('processing', `Found ${updates.length} profile updates`, 50, extractedFields, avgConfidence);
      
      // Stage 4: Apply updates
      if (updates.length > 0) {
        this.emitProgress('applying', 'Applying profile updates...', 75, extractedFields, avgConfidence);
        
        const updatedProfile = applyProfileUpdates(currentProfile, updates);
        
        // Stage 5: Complete
        this.emitProgress('complete', `Successfully updated ${updates.length} profile fields`, 100, extractedFields, avgConfidence);
        
        return {
          success: true,
          updatedProfile,
          extractionLog: this.extractionLog,
          fieldsUpdated: extractedFields,
          overallConfidence: avgConfidence
        };
      } else {
        this.emitProgress('complete', 'No profile updates found in message', 100, [], 0);
        
        return {
          success: true,
          updatedProfile: currentProfile,
          extractionLog: this.extractionLog,
          fieldsUpdated: [],
          overallConfidence: 0
        };
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitProgress('error', `Profile extraction failed: ${errorMessage}`, 0, [], 0);
      
      return {
        success: false,
        updatedProfile: currentProfile,
        extractionLog: this.extractionLog,
        fieldsUpdated: [],
        overallConfidence: 0
      };
    }
  }

  // Get current extraction log
  getExtractionLog(): ProfileExtractionProgress[] {
    return [...this.extractionLog];
  }

  // Clear progress callbacks
  clearCallbacks() {
    this.progressCallbacks = [];
  }
}

// Singleton instance for global use
export const profileTracker = new RealTimeProfileTracker();
