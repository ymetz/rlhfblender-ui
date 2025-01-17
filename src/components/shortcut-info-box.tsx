import React, { useState } from "react";
import { useShortcuts } from "../ShortCutProvider";
import { Keyboard } from "@mui/icons-material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { Box, Button, Paper, Typography, useTheme } from "@mui/material";

const ShortcutItem = ({ id, shortcut }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        py: 0.75,
      }}
    >
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
        {shortcut.description}
      </Typography>
      <Box
        component="kbd"
        sx={{
          px: 1,
          py: 0.25,
          ml: 1,
          minWidth: "24px",
          textAlign: "center",
          borderRadius: "4px",
          fontSize: "0.75rem",
          backgroundColor: theme.palette.background.l2,
          border: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
          fontFamily: "sans-serif",
        }}
      >
        {shortcut.key.toUpperCase()}
      </Box>
    </Box>
  );
};

export const ShortcutsInfoBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { shortcuts } = useShortcuts();
  const theme = useTheme();

  const shortcutEntries = Object.entries(shortcuts);
  const midpoint = Math.ceil(shortcutEntries.length / 2);
  const leftColumn = shortcutEntries.slice(0, midpoint);
  const rightColumn = shortcutEntries.slice(midpoint);

  return (
    <Paper
      elevation={3}
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: "450px",
        backgroundColor: theme.palette.background.l1,
        borderRadius: `${theme.shape.borderRadius}px`,
        overflow: "hidden",
      }}
    >
      <Button
        onClick={() => setIsOpen(!isOpen)}
        fullWidth
        sx={{
          py: 1,
          px: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`,
          "&:hover": {
            backgroundColor: theme.palette.primary.dark,
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Keyboard />
          <Typography variant="body1">Keyboard Shortcuts</Typography>
        </Box>
        {isOpen ? <ExpandMore /> : <ExpandLess />}
      </Button>

      {isOpen && (
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: "flex", gap: 4 }}>
            <Box sx={{ flex: 1 }}>
              {leftColumn.map(([id, shortcut]) => (
                <ShortcutItem key={id} id={id} shortcut={shortcut} />
              ))}
            </Box>
            <Box sx={{ flex: 1 }}>
              {rightColumn.map(([id, shortcut]) => (
                <ShortcutItem key={id} id={id} shortcut={shortcut} />
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
};
