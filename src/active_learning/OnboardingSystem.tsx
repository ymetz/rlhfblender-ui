import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Box, Paper, Typography, Button, IconButton, Fade } from '@mui/material';
import { Close as CloseIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';

// Onboarding step definitions
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  targetElement?: HTMLElement | null;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showOverlay?: boolean;
  showSkip?: boolean;
  customComponent?: React.ComponentType<OnboardingStepProps>;
}

export interface OnboardingStepProps {
  step: OnboardingStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
}

// Onboarding context
interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  startOnboarding: (steps: OnboardingStep[]) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipStep: () => void;
  completeOnboarding: () => void;
  setTargetElement: (stepId: string, element: HTMLElement | null) => void;
  triggerStepComplete: (stepId: string) => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// Onboarding Provider Component
export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [targetElements, setTargetElements] = useState<Map<string, HTMLElement | null>>(new Map());

  const completeOnboarding = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
    setTargetElements(new Map());
    // Also mark as completed in localStorage when user closes
    localStorage.setItem('activelearning-onboarding-completed', 'true');
  }, []);

  const startOnboarding = useCallback((newSteps: OnboardingStep[]) => {
    setSteps(newSteps);
    setCurrentStep(0);
    setIsActive(true);
    // Don't clear targetElements - keep the already registered elements
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  }, [currentStep, steps.length, completeOnboarding]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const setTargetElement = useCallback((stepId: string, element: HTMLElement | null) => {
    setTargetElements(prev => {
      const newMap = new Map(prev).set(stepId, element);
      return newMap;
    });
  }, []);

  const triggerStepComplete = useCallback((stepId: string) => {
    
    if (isActive && steps[currentStep]?.id === stepId) {
      nextStep();
    }
  }, [isActive, steps, currentStep, nextStep]);

  const contextValue: OnboardingContextType = {
    isActive,
    currentStep,
    steps,
    startOnboarding,
    nextStep,
    previousStep,
    skipStep,
    completeOnboarding,
    setTargetElement,
    triggerStepComplete,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {isActive && steps.length > 0 && (
        <OnboardingOverlay 
          step={steps[currentStep]}
          currentStepIndex={currentStep}
          totalSteps={steps.length}
          targetElement={(() => {
            const stepId = steps[currentStep].id;
            const element = targetElements.get(stepId);

            return element || null;
          })()}
          onNext={nextStep}
          onPrevious={previousStep}
          onSkip={skipStep}
          onClose={completeOnboarding}
        />
      )}
    </OnboardingContext.Provider>
  );
};

// Highlight wrapper component
export const OnboardingHighlight: React.FC<{
  stepId: string;
  children: React.ReactNode;
  highlight?: boolean;
  pulse?: boolean;
  preserveLayout?: boolean;
}> = ({ stepId, children, highlight = false, pulse = false, preserveLayout = false }) => {
  const { isActive, steps, currentStep, setTargetElement } = useOnboarding();
  const elementRef = React.useRef<HTMLDivElement>(null);
  
  // Register this element as a target when component mounts
  useEffect(() => {
    
    if (elementRef.current) {
      setTargetElement(stepId, elementRef.current);
    } else {
      console.warn(`No element found to register for step: ${stepId}`);
    }
  }, [stepId, setTargetElement]);

  const isCurrentStep = isActive && steps[currentStep]?.id === stepId;
  const shouldHighlight = isCurrentStep || highlight;

  // For layout-critical components, use a div that preserves all properties
  if (preserveLayout) {
    return (
      <div
        ref={elementRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'inherit',
          flexGrow: 1,
          ...(shouldHighlight && {
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-4px',
              left: '-4px',
              right: '-4px',
              bottom: '-4px',
              border: '3px solid #2196f3',
              borderRadius: '8px',
              zIndex: 1000,
              pointerEvents: 'none',
            },
          }),
        }}
      >
        {shouldHighlight && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              border: '3px solid #2196f3',
              borderRadius: 8,
              zIndex: 1000,
              pointerEvents: 'none',
              animation: pulse ? 'onboarding-pulse 2s infinite' : undefined,
            }}
          />
        )}
        <style>
          {`
            @keyframes onboarding-pulse {
              0% {
                box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);
                border-color: #2196f3;
              }
              70% {
                box-shadow: 0 0 0 10px rgba(33, 150, 243, 0);
                border-color: rgba(33, 150, 243, 0.8);
              }
              100% {
                box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
                border-color: #2196f3;
              }
            }
          `}
        </style>
        {children}
      </div>
    );
  }

  return (
    <Box
      ref={elementRef}
      sx={{
        position: 'relative',
        display: 'inline-block',
        ...(shouldHighlight && {
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            border: '3px solid #2196f3',
            borderRadius: 2,
            zIndex: 1000,
            pointerEvents: 'none',
            ...(pulse && {
              animation: 'onboarding-pulse 2s infinite',
            }),
          },
        }),
        '@keyframes onboarding-pulse': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(33, 150, 243, 0.7)',
            borderColor: '#2196f3',
          },
          '70%': {
            boxShadow: '0 0 0 10px rgba(33, 150, 243, 0)',
            borderColor: 'rgba(33, 150, 243, 0.8)',
          },
          '100%': {
            boxShadow: '0 0 0 0 rgba(33, 150, 243, 0)',
            borderColor: '#2196f3',
          },
        },
      }}
    >
      {children}
    </Box>
  );
};

// Onboarding overlay component
const OnboardingOverlay: React.FC<{
  step: OnboardingStep;
  currentStepIndex: number;
  totalSteps: number;
  targetElement: HTMLElement | null;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
}> = ({ step, currentStepIndex, totalSteps, targetElement, onNext, onPrevious, onSkip, onClose }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [tooltipPlacement, setTooltipPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          event.preventDefault();
          onNext();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (currentStepIndex > 0) {
            onPrevious();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious, currentStepIndex]);

  // Calculate tooltip position based on target element
  useEffect(() => {
    
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      
      // If element has no dimensions, it might not be rendered yet - wait
      if (rect.width === 0 || rect.height === 0) {
        console.warn(`Target element for ${step.id} has no dimensions, waiting...`);
        setTimeout(() => {
          // Retry positioning after a short delay
          if (targetElement) {
            const newRect = targetElement.getBoundingClientRect();
            if (newRect.width > 0 && newRect.height > 0) {
              // Trigger re-run of this effect
              setTooltipPosition({ top: -1, left: -1 });
            }
          }
        }, 100);
        return;
      }
      
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const tooltipWidth = 350; // Max width from tooltip styles
      const tooltipHeight = 200; // Estimated height
      const margin = 20; // Safety margin from screen edges

      // Use smaller spacing for better proximity to target elements
      const spacing = 12; // Distance from target element
      
      let placement: 'top' | 'bottom' | 'left' | 'right' = step.position || 'bottom';
      let top = 0;
      let left = 0;

      // Check which positions are feasible before choosing
      const canPlaceRight = rect.right + spacing + tooltipWidth <= viewport.width - margin;
      const canPlaceLeft = rect.left - spacing - tooltipWidth >= margin;
      const canPlaceBottom = rect.bottom + spacing + tooltipHeight <= viewport.height - margin;
      const canPlaceTop = rect.top - spacing - tooltipHeight >= margin;

      // For load-data step, prefer left placement to avoid covering the button
      if (step.id === 'load-data') {
        if (canPlaceLeft) {
          placement = 'left';
        } else if (canPlaceBottom) {
          placement = 'bottom';
        } else if (canPlaceTop) {
          placement = 'top';
        } else if (canPlaceRight) {
          placement = 'right';
        }
      } else {
        // For other steps, use original preference but check feasibility
        if (placement === 'right' && !canPlaceRight) {
          if (canPlaceLeft) placement = 'left';
          else if (canPlaceBottom) placement = 'bottom';
          else if (canPlaceTop) placement = 'top';
        } else if (placement === 'left' && !canPlaceLeft) {
          if (canPlaceRight) placement = 'right';
          else if (canPlaceBottom) placement = 'bottom';
          else if (canPlaceTop) placement = 'top';
        } else if (placement === 'bottom' && !canPlaceBottom) {
          if (canPlaceTop) placement = 'top';
          else if (canPlaceLeft) placement = 'left';
          else if (canPlaceRight) placement = 'right';
        } else if (placement === 'top' && !canPlaceTop) {
          if (canPlaceBottom) placement = 'bottom';
          else if (canPlaceLeft) placement = 'left';
          else if (canPlaceRight) placement = 'right';
        }
      }
      
      // Calculate position based on final placement with fine-tuning
      switch (placement) {
        case 'top':
          top = rect.top - tooltipHeight - spacing - 45; // Move up more to avoid overlap
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + spacing - 4; // Fine-tune for Load Data button
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - spacing - 50; // Move right for better proximity
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + spacing;
          break;
      }

      // Final boundary enforcement
      left = Math.max(margin, Math.min(viewport.width - tooltipWidth - margin, left));
      top = Math.max(margin, Math.min(viewport.height - tooltipHeight - margin, top));

      setTooltipPosition({ top, left });
      setTooltipPlacement(placement);
    }
  }, [targetElement, step.position, step.id]);

  // If step has custom component, use it
  if (step.customComponent) {
    const CustomComponent = step.customComponent;
    return (
      <CustomComponent
        step={step}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        onNext={onNext}
        onPrevious={onPrevious}
        onSkip={onSkip}
        onClose={onClose}
      />
    );
  }

  return (
    <>
      {/* Tooltip */}
      <Fade in={true}>
        <Paper
          elevation={8}
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'fixed',
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            zIndex: 1400,
            p: 3,
            maxWidth: 350,
            minWidth: 280,
            // Remove transform - positioning calculation already accounts for tooltip size
            '&::before': {
              content: '""',
              position: 'absolute',
              width: 0,
              height: 0,
              ...(tooltipPlacement === 'top' && {
                bottom: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid white',
              }),
              ...(tooltipPlacement === 'bottom' && {
                top: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid white',
              }),
              ...(tooltipPlacement === 'left' && {
                right: -8,
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderLeft: '8px solid white',
              }),
              ...(tooltipPlacement === 'right' && {
                left: -8,
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '8px solid white',
              }),
            },
          }}
        >
          {/* Close button */}
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          {/* Content */}
          <Box sx={{ pr: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              {step.title}
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.5 }}>
              {step.description}
            </Typography>

            {/* Progress indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Step {currentStepIndex + 1} of {totalSteps}
              </Typography>
              <Box sx={{ flex: 1, mx: 2, height: 4, bgcolor: 'grey.200', borderRadius: 2 }}>
                <Box
                  sx={{
                    height: '100%',
                    bgcolor: 'primary.main',
                    borderRadius: 2,
                    width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {currentStepIndex > 0 && (
                  <Button variant="outlined" size="small" onClick={onPrevious}>
                    Previous
                  </Button>
                )}
                {step.showSkip !== false && (
                  <Button variant="text" size="small" onClick={onSkip}>
                    Skip
                  </Button>
                )}
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={onNext}
                endIcon={<ArrowForwardIcon />}
              >
                {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Fade>
    </>
  );
};

// Predefined onboarding steps for the Active Learning Interface
export const createActiveLearningOnboardingSteps = (): OnboardingStep[] => [
  {
    id: 'load-data',
    title: 'Load Data',
    description: 'First, click the "Load Data" button to refresh and display the trajectory data in the projection view.',
    position: 'right',
    showOverlay: true,
  },
  {
    id: 'select-trajectory',
    title: 'Select Trajectories, Cluster or New Coordinate',
    description: 'Click on different trajectories (colored lines) to see individual states. You can also click on clusters (numbered regions) to select multiple related states.',
    position: 'left',
    showOverlay: true,
  },
  {
    id: 'provide-feedback',
    title: 'Provide Feedback',
    description: 'Use the feedback controls on the right to rate trajectories, compare episodes, or provide corrections. Then submit your feedback.',
    position: 'left',
    showOverlay: true,
  },
  {
    id: 'next-phase',
    title: 'Go to Next Phase',
    description: 'After providing feedback on multiple selections, click "Go to Next Phase" to train the model and continue to the next iteration.',
    position: 'top',
    showOverlay: true,
  },
];