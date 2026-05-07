import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Sellers from "@/pages/Sellers";
import History from "@/pages/History";
import Install from "@/pages/Install";
import Dynamics from "@/pages/Dynamics";
import Watchlist from "@/pages/Watchlist";
import Lifecycle from "@/pages/Lifecycle";
import Signals from "@/pages/Signals";
import Opportunities from "@/pages/Opportunities";

function App() {
    useEffect(() => {
        document.title = "Гуру — Аналітика Rozetka та Epicentr";
    }, []);

    return (
        <div className="App">
            <BrowserRouter>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/dashboard" element={<Navigate to="/" replace />} />
                        <Route path="/watchlist" element={<Watchlist />} />
                        <Route path="/opportunities" element={<Opportunities />} />
                        <Route path="/lifecycle" element={<Lifecycle />} />
                        <Route path="/signals" element={<Signals />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/products/:productKey" element={<Products />} />
                        <Route path="/dynamics" element={<Dynamics />} />
                        <Route path="/sellers" element={<Sellers />} />
                        <Route path="/history" element={<History />} />
                        <Route path="/install" element={<Install />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
            <Toaster position="bottom-right" />
        </div>
    );
}

export default App;
