#!/usr/bin/env python
"""
Script para ayudar a conectar Django con la BD existente Santacruzcomputer
Ejecutar: python configure_db.py
"""

import os
import sys
import django
from django.conf import settings

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command

def main():
    print("=" * 60)
    print("CONFIGURACIÓN DE CONEXIÓN CON POSTGRESQL")
    print("=" * 60)
    
    # Verificar que .env existe
    env_path = '.env'
    if not os.path.exists(env_path):
        print("\n❌ Error: No existe archivo .env")
        print("Por favor crea .env desde .env.example")
        return False
    
    # Intentar conectar
    print("\n🔍 Verificando conexión a PostgreSQL...")
    try:
        from django.db import connection
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        print("✅ Conexión exitosa!")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        return False
    
    # Generar modelos
    print("\n📊 Generando modelos desde base de datos...")
    try:
        print("   Ejecutando: python manage.py inspectdb")
        call_command('inspectdb', stdout_to_string=True, into_app=None)
        print("✅ Modelos generados en inspected_models.py")
    except Exception as e:
        print(f"❌ Error al generar modelos: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("✅ CONFIGURACIÓN COMPLETADA")
    print("=" * 60)
    print("\n📋 Próximos pasos:")
    print("1. Revisar apps/inspected_models.py")
    print("2. Distribuir modelos en sus respectivas apps:")
    print("   - Usuario → apps/users/models.py")
    print("   - Producto → apps/products/models.py")
    print("   - Venta, DetalleVenta, Pago → apps/orders/models.py")
    print("3. Actualizar serializers")
    print("4. Ejecutar: python manage.py runserver")
    print("\n📚 Ver CONEXION_DB.md para instrucciones detalladas\n")

if __name__ == '__main__':
    main()
