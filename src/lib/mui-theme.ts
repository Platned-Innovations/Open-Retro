import { createTheme } from "@mui/material/styles";

/**
 * Starting point for the MUI migration. Primary matches the navy brand color
 * already in use (Azure app icon, existing "primary" buttons) so pages don't
 * visually clash while both design systems are in the app at once. Expect
 * this to evolve as more pages move over.
 */
export const theme = createTheme({
  palette: {
    primary: {
      main: "#0c2d58",
    },
  },
  shape: {
    borderRadius: 8,
  },
});
