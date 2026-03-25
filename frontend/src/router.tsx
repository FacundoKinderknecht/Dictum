import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import MedicoDashboard from "./pages/medico/Dashboard";
import Pacientes from "./pages/medico/Pacientes";
import NuevoInforme from "./pages/medico/NuevoInforme";
import EditarInforme from "./pages/medico/EditarInforme";
import ColaImpresion from "./pages/secretaria/ColaImpresion";
import Usuarios from "./pages/admin/Usuarios";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/registro",
    element: <Registro />,
  },

  // ── Médico ────────────────────────────────────────────────
  {
    path: "/medico/dashboard",
    element: (
      <ProtectedRoute role="medico">
        <MedicoDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/medico/pacientes",
    element: (
      <ProtectedRoute role="medico">
        <Pacientes />
      </ProtectedRoute>
    ),
  },
  {
    path: "/medico/nuevo-informe",
    element: (
      <ProtectedRoute role="medico">
        <NuevoInforme />
      </ProtectedRoute>
    ),
  },
  {
    path: "/medico/editar-informe/:id",
    element: (
      <ProtectedRoute role="medico">
        <EditarInforme />
      </ProtectedRoute>
    ),
  },

  // ── Secretaria ────────────────────────────────────────────
  {
    path: "/secretaria/cola-impresion",
    element: (
      <ProtectedRoute role="secretaria">
        <ColaImpresion />
      </ProtectedRoute>
    ),
  },

  // ── Admin ─────────────────────────────────────────────────
  {
    path: "/admin/usuarios",
    element: (
      <ProtectedRoute role="admin">
        <Usuarios />
      </ProtectedRoute>
    ),
  },

  // Fallback
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);
