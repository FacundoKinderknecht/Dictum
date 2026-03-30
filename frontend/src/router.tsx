import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import MedicoDashboard from "./pages/medico/Dashboard";
import Informes from "./pages/medico/Informes";
import MisInformes from "./pages/medico/MisInformes";
import Pacientes from "./pages/medico/Pacientes";
import NuevoInforme from "./pages/medico/NuevoInforme";
import EditarInforme from "./pages/medico/EditarInforme";
import VerInforme from "./pages/medico/VerInforme";
import PerfilPaciente from "./pages/medico/PerfilPaciente";
import PerfilMedico from "./pages/medico/PerfilMedico";
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
    path: "/medico/informes",
    element: (
      <ProtectedRoute role="medico">
        <Informes />
      </ProtectedRoute>
    ),
  },
  {
    path: "/medico/mis-informes",
    element: (
      <ProtectedRoute role="medico">
        <MisInformes />
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
  {
    path: "/medico/ver-informe/:id",
    element: (
      <ProtectedRoute role="medico">
        <VerInforme />
      </ProtectedRoute>
    ),
  },
  {
    path: "/medico/paciente/:id",
    element: (
      <ProtectedRoute role="medico">
        <PerfilPaciente />
      </ProtectedRoute>
    ),
  },
  {
    path: "/medico/perfil-medico/:id",
    element: (
      <ProtectedRoute role="medico">
        <PerfilMedico />
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
