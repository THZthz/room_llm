import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f766e"
    },
    secondary: {
      main: "#f97316"
    },
    error: {
      main: "#dc2626"
    },
    background: {
      default: "#fff7ed",
      paper: "#fffbf5"
    }
  },
  shape: {
    borderRadius: 18
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif',
    h3: {
      fontWeight: 700,
      letterSpacing: "-0.03em"
    },
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.02em"
    },
    button: {
      textTransform: "none",
      fontWeight: 700
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    }
  }
});
