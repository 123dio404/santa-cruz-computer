
// main.tsx - Punto de entrada de la aplicación React
// Este archivo le dice al navegador dónde montar la app (elemento con id="root" en index.html)
// y carga los estilos globales de Tailwind CSS.

import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
