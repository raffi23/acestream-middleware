import { FC, PropsWithChildren } from "react";
import { ThemeProvider } from "./theme-provider";

const ClientProviders: FC<PropsWithChildren> = ({ children }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
};

export default ClientProviders;
