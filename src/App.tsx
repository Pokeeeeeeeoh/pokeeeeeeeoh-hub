import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import BookingInfo from "./pages/BookingInfo";
import BookingForm from "./pages/BookingForm";
import BookingConfirmation from "./pages/BookingConfirmation";
import SelectSlot from "./pages/SelectSlot";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClients from "./pages/admin/AdminClients";
import AdminCalendar from "./pages/admin/AdminCalendar";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminEmails from "./pages/admin/AdminEmails";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import Privacy from "./pages/Privacy";
import About from "./pages/About";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/book" element={<BookingInfo />} />
          <Route path="/book/form" element={<BookingForm />} />
          <Route path="/book/confirmation" element={<BookingConfirmation />} />
          <Route path="/select-slot" element={<SelectSlot />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/about" element={<About />} />
          
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/calendar" element={<AdminCalendar />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/emails" element={<AdminEmails />} />
          </Route>
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
