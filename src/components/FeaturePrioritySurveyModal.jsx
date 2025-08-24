import { useState } from 'preact/hooks';
import Modal from './Modal.jsx';
import PriorityRanking from './PriorityRanking.jsx';
import { saveSurveyResponse } from '../services/surveyService.js';
import { trackEvent } from '../analytics.js';

const FEATURES = [
  {
    id: 'sharing',
    name: 'Enhanced Sharing',
    description: 'Advanced sharing options with team collaboration',
    icon: 'share'
  },
  {
    id: 'project-management',
    name: 'Project Management',
    description: 'Organize diagrams into projects and folders',
    icon: 'folder_open'
  },
  {
    id: 'drag-edit',
    name: 'Drag & Drop Editing',
    description: 'Visual diagram editing with drag and drop',
    icon: 'drag_indicator'
  },
  {
    id: 'enhanced-editor',
    name: 'Enhanced Code Editor',
    description: 'Advanced code editing with better autocomplete',
    icon: 'code'
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistance',
    description: 'AI-powered diagram generation and suggestions',
    icon: 'smart_toy'
  }
];

export function FeaturePrioritySurveyModal({ show, closeHandler, userProfile }) {
  const [priorities, setPriorities] = useState(FEATURES.map(f => f.id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await saveSurveyResponse({
        priorities,
        userProfile,
        timestamp: Date.now()
      });
      
      trackEvent('survey', 'completed', 'feature-priority');
      setIsSubmitted(true);
      
      // Auto close after 2 seconds
      setTimeout(() => {
        closeHandler();
      }, 2000);
      
    } catch (error) {
      console.error('Error saving survey response:', error);
      trackEvent('survey', 'error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitted) {
      trackEvent('survey', 'dismissed', 'feature-priority');
    }
    closeHandler();
  };

  if (isSubmitted) {
    return (
      <Modal show={show} closeHandler={handleClose}>
        <div class="p-6 text-center">
          <div class="mb-4">
            <span class="material-symbols-outlined text-green-500 text-6xl">
              check_circle
            </span>
          </div>
          <h2 class="text-xl font-semibold mb-2 text-white">Thank You for Your Feedback!</h2>
          <p class="text-gray-300">
            Your input will help us prioritize the most valuable features.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal show={show} closeHandler={handleClose}>
      <div class="p-6 max-w-2xl">
        <div class="mb-6">
          <h2 class="text-2xl font-bold mb-3 text-white">
            🚀 Help Shape ZenUML's Future
          </h2>
          <p class="text-gray-300 mb-4">
            We're planning our next phase of development and your opinion matters!
            Please rank these features by your priority:
          </p>
          <p class="text-sm text-gray-400">
            💡 Tip: Drag cards to reorder them, with your most desired feature at the top
          </p>
        </div>

        <div class="mb-6">
          <PriorityRanking 
            features={FEATURES}
            priorities={priorities}
            onPrioritiesChange={setPriorities}
          />
        </div>

        <div class="flex justify-between items-center pt-4 border-t border-gray-600">
          <button
            type="button"
            onClick={handleClose}
            class="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Not Now
          </button>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isSubmitting && (
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </Modal>
  );
}