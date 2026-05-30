import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SetupPage from "./pages/SetupPage";
import InterviewPage from "./pages/InterviewPage";
import ReportPage from "./pages/ReportPage";
import WrittenPracticePage from "./pages/WrittenPracticePage";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary showHomeLink>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/interview" element={<ErrorBoundary showHomeLink><InterviewPage /></ErrorBoundary>} />
              <Route path="/practice" element={<ErrorBoundary showHomeLink><WrittenPracticePage /></ErrorBoundary>} />
              <Route path="/report" element={<ErrorBoundary showHomeLink><ReportPage /></ErrorBoundary>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
