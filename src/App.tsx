import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import VoiceAssistant from "@/components/VoiceAssistant";
import Index from "./pages/Index.tsx";
import Balance from "./pages/Balance.tsx";
import History from "./pages/History.tsx";
import Recharge from "./pages/Recharge.tsx";
import Profile from "./pages/Profile.tsx";
import NotFound from "./pages/NotFound.tsx";
import ScanQR from "./pages/ScanQR.tsx";
import PayContact from "./pages/PayContact.tsx";
import PayPhone from "./pages/PayPhone.tsx";
import BankTransfer from "./pages/BankTransfer.tsx";
import UPIPayment from "./pages/UPIPayment.tsx";
import SelfTransfer from "./pages/SelfTransfer.tsx";
import PayBills from "./pages/PayBills.tsx";
import Auth from "./pages/Auth.tsx";
import PayViaQR from "./pages/PayViaQR.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/balance" element={<ProtectedRoute><Balance /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/recharge" element={<ProtectedRoute><Recharge /></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><ScanQR /></ProtectedRoute>} />
            <Route path="/pay-contact" element={<ProtectedRoute><PayContact /></ProtectedRoute>} />
            <Route path="/pay-phone" element={<ProtectedRoute><PayPhone /></ProtectedRoute>} />
            <Route path="/bank-transfer" element={<ProtectedRoute><BankTransfer /></ProtectedRoute>} />
            <Route path="/upi" element={<ProtectedRoute><UPIPayment /></ProtectedRoute>} />
            <Route path="/self-transfer" element={<ProtectedRoute><SelfTransfer /></ProtectedRoute>} />
            <Route path="/pay-bills" element={<ProtectedRoute><PayBills /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/pay-qr" element={<ProtectedRoute><PayViaQR /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <VoiceAssistant />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
