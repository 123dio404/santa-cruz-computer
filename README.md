# Santa Cruz-Computer - Sistema de Gestión

Este proyecto es un sistema integral para la automatización de inventarios, ventas y servicios técnicos para la empresa "Santa Cruz-Computer".

## 📂 Estructura del Proyecto

El proyecto está organizado de la siguiente manera:

*   **`backend/`**: Lógica del servidor desarrollada en Django 5.0 y Django REST Framework.
    *   `core/`: Configuración global (settings, urls, wsgi).
    *   `usuarios/`: Gestión de perfiles, autenticación, **bitácora** y seguridad (bloqueo de 3 intentos).
    *   `inventario/`: Control de productos, stock y proveedores.
    *   `ventas/`: Procesamiento de ventas, reservas y clientes.
    *   `venv/`: Entorno virtual de Python (local).
*   **`frontend/`**: Interfaz de usuario moderna desarrollada en React + Vite + Tailwind CSS.
    *   `src/app/context/`: Lógica global (Autenticación real).
    *   `src/app/pages/`: Vistas del sistema (Dashboard, Inventario, Ventas, etc.).
    *   `src/app/components/`: Componentes UI reutilizables.
*   **`database/`**: Recursos relacionados con la base de datos.
    *   `design.sql`: Diseño original de la base de datos.
    *   `docker-compose.yml`: Configuración para levantar PostgreSQL en Docker.
*   **`docs/`**: Documentación del proyecto, manuales y guías rápidas.

---

## 🚀 Cómo ejecutar el sistema

### 1. Backend (Django)
Desde una terminal en la raíz del proyecto:
```bash
cd backend
source venv/bin/activate
# Si es la primera vez, instala las dependencias:
# pip install -r requirements.txt
python3 manage.py runserver
```
El servidor de la API correrá en `http://localhost:8000`.

### 2. Frontend (React)
Desde **otra** terminal en la raíz del proyecto:
```bash
cd frontend
# Si es la primera vez, instala las dependencias:
# npm install
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

## 🛡️ Características de Seguridad Implementadas
1.  **Autenticación Real**: Conexión directa entre React y Django.
2.  **Bitácora de Auditoría**: Registro automático de ingresos, salidas e intentos fallidos.
3.  **Bloqueo de Cuenta**: Tras 3 intentos fallidos, la cuenta se bloquea por 15 minutos.
4.  **Validación de Contraseñas**: Exige mayúsculas, minúsculas y números para mayor seguridad.
5.  **Recuperación de Contraseña**: Envío de códigos de seguridad (visibles en la terminal del backend).

---

## 🛠️ Stack Tecnológico
*   **Lenguajes**: Python, TypeScript.
*   **Frameworks**: Django, React.
*   **Estilos**: Tailwind CSS, Shadcn UI.
*   **Base de Datos**: SQLite (Desarrollo) / PostgreSQL (Producción).
