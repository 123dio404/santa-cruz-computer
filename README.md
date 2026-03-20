# Sistema de Gestión "Santa Cruz-Computer"
 Sistema integral para la automatización de inventarios, ventas y servicios técnicos de la empresa "Santa Cruz-Computer"

## Stack Tecnológico (Estándar de Industria)
* **Backend:** Django 5.0+ | Django REST Framework.
* **Frontend:** React 18+ (Vite).
* **Base de Datos:** PostgreSQL 16.
* **Entorno:** Docker / Docker Compose.

## Acuerdos de Colaboración (Reglas del Grupo 13)
Como equipo de arquitectura, hemos definido los siguientes estándares para asegurar la calidad del proyecto:

### 1. Control de Versiones (Git Flow)
* **Rama `main`:** Solo código estable y probado. Nadie hace push directo aquí.
* **Rama `develop`:** Rama de integración para pruebas grupales.
* **Ramas `feature`:** Cada tarea se trabaja en una rama aparte (ej: `feature/inventario`).
* **Pull Requests (PR):** Para unir código a `develop`, el Arquitecto debe realizar el Code Review.

### 2. Estándares de Código
* **Python:** Seguir estrictamente la guía de estilo PEP 8.
* **React:** Uso de componentes funcionales, Hooks y Clean Code.
* **Commits:** Mensajes en minúsculas y descriptivos (ej: `feat: tabla de componentes`).

## Estructura del Proyecto
santa-cruz-computer/
├── backend/                # Lógica del sistema (Django) [cite: 123]
│   ├── core/               # Configuración global del proyecto.
│   ├── inventario/         # RAM, discos, procesadores y periféricos[cite: 132, 133].
│   ├── usuarios/           # Roles: Admin, Técnico y Vendedor[cite: 129].
│   ├── ventas/             # Registro de notas de venta y descuentos[cite: 138, 139].
│   └── requirements.txt    # Librerías: django, djangorestframework, psycopg2.
├── database/               # Capa de datos (PostgreSQL) [cite: 120]
│   └── design.sql          # Script SQL con el diseño de tablas (ERD).
├── docs/                   # Documentación técnica y formal
│   ├── api-spec.md         # Manual de endpoints para el equipo de React.
│   └── perfil-SI1-G13.pdf  # Perfil, objetivos y entrevistas[cite: 18, 153].
├── frontend/               # Interfaz de usuario (React) [cite: 123]
│   └── src/
│       ├── components/     # Botones, modales y tablas reutilizables.
│       ├── pages/          # Login, Inventario, Ventas y Reportes[cite: 140].
│       └── services/       # Conexión con la API del Backend.
├── docker-compose.yml       # Orquestador del motor de base de datos.
└── README.md               # Este archivo.


## Inicio Rápido (Instalación)

1. Levantar la Base de Datos con Docker
No es necesario instalar PostgreSQL localmente. En la raíz del proyecto, ejecuta:

Bash
docker compose up -d
Esto activará el contenedor santacruz_db_container en el puerto 5432.

2. Configurar el Backend (Django)

Bash
cd backend 
pip install -r requirements.txt

3. Configurar el Frontend (React)
Bash
cd frontend
npm install
npm run dev
