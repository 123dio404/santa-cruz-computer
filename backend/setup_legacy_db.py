#!/usr/bin/env python
"""
Script interactivo para conectar Django con base de datos PostgreSQL existente
Ejecutar en la carpeta Backend: python setup_legacy_db.py
"""

import os
import sys
import subprocess
from pathlib import Path

def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")

def print_step(num, text):
    print(f"\n📌 PASO {num}: {text}")
    print("-" * 70)

def check_env_file():
    """Verifica si existe .env"""
    print_step(1, "Verificar archivo .env")
    
    if os.path.exists('.env'):
        print("✅ Archivo .env encontrado")
        return True
    elif os.path.exists('.env.example'):
        print("⚠️  No existe .env pero sí .env.example")
        print("\n¿Quieres crear .env desde .env.example? (s/n): ", end="")
        if input().lower() == 's':
            import shutil
            shutil.copy('.env.example', '.env')
            print("✅ .env creado. Edita la contraseña de PostgreSQL en .env")
            return False
        else:
            print("❌ .env es necesario para continuar")
            return False
    else:
        print("❌ No existe .env ni .env.example")
        return False

def check_psycopg2():
    """Verifica si psycopg2 está instalado"""
    print_step(2, "Verificar driver PostgreSQL (psycopg2)")
    
    try:
        import psycopg2
        print(f"✅ psycopg2 {psycopg2.__version__} está instalado")
        return True
    except ImportError:
        print("❌ psycopg2 no está instalado")
        print("\nInstalando psycopg2-binary...")
        result = subprocess.run([sys.executable, '-m', 'pip', 'install', 'psycopg2-binary'], 
                              capture_output=True)
        if result.returncode == 0:
            print("✅ psycopg2-binary instalado exitosamente")
            return True
        else:
            print("❌ Error al instalar psycopg2-binary")
            return False

def test_db_connection():
    """Prueba la conexión a la base de datos"""
    print_step(3, "Probar conexión a PostgreSQL")
    
    try:
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
        django.setup()
        
        from django.db import connection
        cursor = connection.cursor()
        
        # Prueba simple
        cursor.execute("SELECT 1")
        cursor.fetchone()
        
        # Obtener información de la BD
        cursor.execute("SELECT current_database(), version();")
        db_name, version = cursor.fetchone()
        
        print(f"✅ Conexión exitosa!")
        print(f"   Base de datos: {db_name}")
        print(f"   PostgreSQL: {version.split(',')[0]}")
        
        return True
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        print("\nVerifica:")
        print("  1. PostgreSQL está ejecutándose")
        print("  2. Credenciales en .env son correctas")
        print("  3. Base de datos 'Santacruzcomputer' existe")
        return False

def inspect_schema():
    """Ejecuta el script de inspección de esquema"""
    print_step(4, "Inspeccionar esquema de base de datos")
    
    try:
        result = subprocess.run([sys.executable, 'inspect_schema.py'], 
                              capture_output=False, text=True)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def generate_models():
    """Genera modelos con inspectdb"""
    print_step(5, "Generar modelos con inspectdb")
    
    try:
        print("Ejecutando: python manage.py inspectdb > inspected_models.py")
        result = subprocess.run([sys.executable, 'manage.py', 'inspectdb'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            models_output = result.stdout
            with open('inspected_models.py', 'w', encoding='utf-8') as f:
                f.write(models_output)
            print(f"✅ Modelos generados en inspected_models.py ({len(models_output)} bytes)")
            return True
        else:
            print(f"❌ Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print_header("CONEXIÓN DE DJANGO CON BASE DE DATOS POSTGRESQL EXISTENTE")
    print("Este script te guiará para conectar Django con tu BD 'Santacruzcomputer'")
    
    # Pasos
    steps = [
        ("Verificar .env", check_env_file),
        ("Instalar psycopg2", check_psycopg2),
        ("Probar conexión", test_db_connection),
        ("Inspeccionar esquema", inspect_schema),
        ("Generar modelos", generate_models),
    ]
    
    completed = 0
    for step_name, step_func in steps:
        try:
            if step_func():
                completed += 1
            else:
                print(f"\n⚠️  Error en paso: {step_name}")
                print("Soluciona el problema y vuelve a intentar")
                break
        except KeyboardInterrupt:
            print("\n\n❌ Proceso cancelado por el usuario")
            return
        except Exception as e:
            print(f"\n❌ Error inesperado: {e}")
            break
    
    # Resumen final
    print_header(f"RESUMEN: {completed}/{len(steps)} pasos completados")
    
    if completed == len(steps):
        print("✅ ¡TODO CONFIGURADO EXITOSAMENTE!")
        print("\n📋 Próximos pasos:")
        print("   1. Revisa el archivo: inspected_models.py")
        print("   2. Distribuye los modelos en sus apps:")
        print("      - Usuario → apps/users/models.py")
        print("      - Producto → apps/products/models.py")
        print("      - Venta, DetalleVenta, Pago → apps/orders/models.py")
        print("   3. Actualiza los serializers")
        print("   4. Ejecuta: python manage.py runserver")
        print("\n📚 Lee CONEXION_DB.md para instrucciones detalladas\n")
    else:
        print("❌ No se completaron todos los pasos")
        print("\nIntenta resolver el problema y ejecuta nuevamente este script\n")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Proceso cancelado")
        sys.exit(1)
