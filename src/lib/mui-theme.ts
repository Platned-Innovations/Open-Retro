import { createTheme, alpha } from "@mui/material/styles";

/**
 * Primary matches the navy brand color already in use (Azure app icon).
 * Secondary is a teal accent used for highlights that shouldn't compete with
 * primary actions — it's deliberately far enough from primary's hue that the
 * two never get mistaken for one another, and far enough from the status
 * colors (success green, warning amber, error red) that it can't be misread
 * as state.
 */
export const theme = createTheme({
  palette: {
    primary: {
      main: "#0c2d58",
      light: "#3d597f",
      dark: "#081d3a",
    },
    secondary: {
      main: "#0f9d8c",
    },
    background: {
      default: "#f4f6fb",
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: alpha("#0c2d58", 0.14) },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          transition: "box-shadow 150ms ease, border-color 150ms ease",
        },
      },
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: alpha("#0c2d58", 0.04) },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});
