import React from "react";
import { Box, Button } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import DemoIcon from "../../../icons/demo-icon";

interface DemoSectionProps {
  showDemo: boolean;
  onDemoClick: () => void;
  hasDemoFeedback: boolean;
}

const DemoSection: React.FC<DemoSectionProps> = ({
  showDemo,
  onDemoClick,
  hasDemoFeedback,
}) => {
  const theme = useTheme();

  if (!showDemo) {
    return null;
  }

  const DemoButton = styled(Button)(({ theme }) => ({
    position: "absolute",
    top: "10px",
    left: "10px",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  }));

  /*return (

        <Button
          variant="contained"
          onClick={onDemoClick}
          className="demo"
          sx={{
            boxShadow: hasDemoFeedback
              ? `0px 0px 20px 0px ${theme.palette.primary.main}`
              : 'none',
          }}
          endIcon={<DemoIcon color={theme.palette.primary.contrastText} />}
        >
          Demo
        </Button>
  );*/

  return (
    <DemoButton
      variant="contained"
      onClick={onDemoClick}
      className="demo"
      sx={{
        boxShadow: hasDemoFeedback
          ? `0px 0px 20px 0px ${theme.palette.primary.main}`
          : "none",
      }}
      endIcon={<DemoIcon color={theme.palette.primary.contrastText} />}
    >
      Demo
    </DemoButton>
  );
};

export default DemoSection;
