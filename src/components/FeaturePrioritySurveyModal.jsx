import { useState } from 'preact/hooks';
import Modal from './Modal.jsx';
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
  const [mostImportant, setMostImportant] = useState(null);
  const [leastImportant, setLeastImportant] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFeatureClick = (featureId, type) => {
    if (type === 'most') {
      if (mostImportant === featureId) {
        // Clicking same feature again deselects it
        setMostImportant(null);
      } else {
        // If this feature was least important, clear that first
        if (leastImportant === featureId) {
          setLeastImportant(null);
        }
        setMostImportant(featureId);
      }
    } else if (type === 'least') {
      if (leastImportant === featureId) {
        // Clicking same feature again deselects it
        setLeastImportant(null);
      } else {
        // If this feature was most important, clear that first
        if (mostImportant === featureId) {
          setMostImportant(null);
        }
        setLeastImportant(featureId);
      }
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !mostImportant || !leastImportant) return;
    
    setIsSubmitting(true);
    
    try {
      // Create priorities array based on selections
      const availableFeatures = FEATURES.filter(f => 
        f.id !== mostImportant && f.id !== leastImportant
      ).map(f => f.id);

      const priorities = {
        mostImportant,
        leastImportant,
        available: availableFeatures
      };

      await saveSurveyResponse({
        priorities,
        userProfile,
        timestamp: Date.now()
      });
      
      trackEvent('survey', 'completed', 'feature-priority-topbottom');
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

  const canSubmit = mostImportant && leastImportant;
  const getFeatureById = (id) => FEATURES.find(f => f.id === id);

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
      <div class="p-6 max-w-4xl">
        <div class="mb-6">
          <h2 class="text-2xl font-bold mb-3 text-white">
            🚀 Help Shape ZenUML's Future
          </h2>
          <p class="text-gray-300 mb-4">
            We're planning our next phase of development and your opinion matters!
            Please select your most and least important features:
          </p>
          <p class="text-sm text-gray-400">
            💡 Tip: Click the buttons next to each feature to mark your priorities
          </p>
        </div>

        <div class="space-y-6 mb-6">
          {/* Selected Features Display */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Most Important Selection */}
            <div class="bg-green-900/30 border-2 border-dashed border-green-500 rounded-lg p-4 min-h-24">
              <h3 class="text-green-400 font-medium mb-3 text-center">Most Important to You</h3>
              <div class="min-h-16 flex items-center justify-center">
                {mostImportant ? (
                  <div class="bg-gray-700 border border-gray-600 rounded-lg p-3 w-full">
                    <div class="flex items-center gap-3">
                      <div class="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <div class="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined text-gray-300 text-lg">
                          {getFeatureById(mostImportant).icon}
                        </span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-white text-sm mb-1 truncate">
                          {getFeatureById(mostImportant).name}
                        </h4>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p class="text-green-300/60 text-sm text-center">Click on a feature below to mark it as most important</p>
                )}
              </div>
            </div>

            {/* Least Important Selection */}
            <div class="bg-red-900/30 border-2 border-dashed border-red-500 rounded-lg p-4 min-h-24">
              <h3 class="text-red-400 font-medium mb-3 text-center">Least Important to You</h3>
              <div class="min-h-16 flex items-center justify-center">
                {leastImportant ? (
                  <div class="bg-gray-700 border border-gray-600 rounded-lg p-3 w-full">
                    <div class="flex items-center gap-3">
                      <div class="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        5
                      </div>
                      <div class="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined text-gray-300 text-lg">
                          {getFeatureById(leastImportant).icon}
                        </span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-white text-sm mb-1 truncate">
                          {getFeatureById(leastImportant).name}
                        </h4>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p class="text-red-300/60 text-sm text-center">Click on a feature below to mark it as least important</p>
                )}
              </div>
            </div>
          </div>

          {/* Features List */}
          <div class="space-y-3">
            <h3 class="text-gray-300 font-medium text-center">Features</h3>
            <div class="space-y-3">
              {FEATURES.map((feature) => {
                const isMostImportant = mostImportant === feature.id;
                const isLeastImportant = leastImportant === feature.id;
                const isSelected = isMostImportant || isLeastImportant;

                return (
                  <div key={feature.id} class={`
                    bg-gray-700 hover:bg-gray-600 transition-colors duration-200 rounded-lg 
                    border border-gray-600 p-4
                    ${isSelected ? 'opacity-50' : ''}
                  `}>
                    <div class="flex items-center gap-4">
                      {/* Feature Icon */}
                      <div class="flex-shrink-0 w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined text-gray-300 text-lg">
                          {feature.icon}
                        </span>
                      </div>

                      {/* Feature Content */}
                      <div class="flex-1 min-w-0">
                        <h3 class="font-semibold text-white text-sm mb-1 truncate">
                          {feature.name}
                        </h3>
                        <p class="text-gray-400 text-xs leading-relaxed">
                          {feature.description}
                        </p>
                      </div>

                      {/* Selection Buttons */}
                      <div class="flex-shrink-0 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleFeatureClick(feature.id, 'most')}
                          disabled={isLeastImportant}
                          class={`
                            px-3 py-1 rounded text-xs font-medium transition-colors
                            ${isMostImportant 
                              ? 'bg-green-600 text-white' 
                              : isLeastImportant 
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed'
                                : 'bg-green-800 hover:bg-green-700 text-green-200'
                            }
                          `}
                        >
                          {isMostImportant ? 'Most Important' : 'Mark Most Important'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeatureClick(feature.id, 'least')}
                          disabled={isMostImportant}
                          class={`
                            px-3 py-1 rounded text-xs font-medium transition-colors
                            ${isLeastImportant 
                              ? 'bg-red-600 text-white' 
                              : isMostImportant 
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed'
                                : 'bg-red-800 hover:bg-red-700 text-red-200'
                            }
                          `}
                        >
                          {isLeastImportant ? 'Least Important' : 'Mark Least Important'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            disabled={isSubmitting || !canSubmit}
            class={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              canSubmit 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            } ${isSubmitting ? 'opacity-50' : ''}`}
          >
            {isSubmitting && (
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isSubmitting ? 'Submitting...' : 
             canSubmit ? 'Submit Feedback' : 'Select Most & Least Important'}
          </button>
        </div>
      </div>
    </Modal>
  );
}