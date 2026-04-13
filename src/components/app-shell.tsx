"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import type { PropsWithChildren } from "react";
import { appTheme } from "@/theme/theme";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
