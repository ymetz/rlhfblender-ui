import React from 'react';
import { useSetupConfigState } from '../../SetupConfigContext';
import { UIConfig } from '../../types';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const StyledContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(0.75),
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
  margin: `${theme.spacing(0.5)} auto`,
  maxWidth: '65%',
  backgroundColor: theme.palette.background.l1,
}));

const StyledText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  margin: 0,
  lineHeight: 1.5,
}));

const instructionStrings: Record<string, string> = {
  rating: 'Rate the example via the slider',
  ranking: 'Select the best example',
  correction: 'Select steps to correct',
  demonstration: 'Click on the demo button to provide a demonstration',
  featureSelection: 'Click on the feature-selection to button to generate an annotation',
  text: 'Enter text to provide feedback',
};

const UserInstruction = () => {
  const uiConfig: UIConfig = useSetupConfigState().activeUIConfig;
  
  const feedbackTypes = Object.keys(uiConfig.feedbackComponents).filter(
    (key) => uiConfig.feedbackComponents[key]
  );
  
  const feedbackTypeNames = feedbackTypes.map((type) =>
    type.replace(/([A-Z])/g, ' $1').toLowerCase()
  );

  return (
    <StyledContainer>
      <StyledText variant="body1">
        {feedbackTypeNames.length > 0
          ? feedbackTypeNames
              .map((type) => instructionStrings[type])
              .join(' ')
          : 'No feedback types selected.'}
      </StyledText>
    </StyledContainer>
  );
};

export default UserInstruction;