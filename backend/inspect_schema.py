#!/usr/bin/env python
"""
Script para revisar el esquema de la base de datos Santacruzcomputer
Ejecutar: python inspect_schema.py
"""

import os
import django
from decouple import config

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

def inspect_schema():
    """Inspecciona el esquema de las tablas en PostgreSQL"""
    
    print("=" * 80)
    print("ESQUEMA DE BASE DE DATOS: Santacruzcomputer")
    print("=" * 80)
    
    with connection.cursor() as cursor:
        # Obtener todas las tablas
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        
        if not tables:
            print("No se encontraron tablas.")
            return
        
        print(f"\n📊 Total de tablas: {len(tables)}\n")
        
        for (table_name,) in tables:
            print(f"\n{'=' * 80}")
            print(f"📋 TABLA: {table_name.upper()}")
            print(f"{'=' * 80}")
            
            # Obtener columnas
            cursor.execute(f"""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_name = '{table_name}'
                ORDER BY ordinal_position;
            """)
            
            columns = cursor.fetchall()
            
            print(f"\n{'Columna':<20} {'Tipo':<15} {'Nullable':<10} {'Default':<20}")
            print("-" * 80)
            
            for col_name, data_type, is_nullable, col_default, max_len in columns:
                nullable = "SÍ" if is_nullable == "YES" else "NO"
                default = col_default if col_default else "-"
                if max_len:
                    data_type = f"{data_type}({max_len})"
                print(f"{col_name:<20} {data_type:<15} {nullable:<10} {str(default):<20}")
            
            # Obtener índices
            cursor.execute(f"""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = '{table_name}';
            """)
            
            indexes = cursor.fetchall()
            if indexes:
                print(f"\n🔑 ÍNDICES:")
                for idx_name, idx_def in indexes:
                    print(f"   - {idx_name}")
            
            # Obtener claves foráneas
            cursor.execute(f"""
                SELECT constraint_name, column_name, foreign_table_name, foreign_column_name
                FROM information_schema.key_column_usage
                WHERE table_name = '{table_name}' AND foreign_table_name IS NOT NULL;
            """)
            
            fks = cursor.fetchall()
            if fks:
                print(f"\n🔗 RELACIONES (Foreign Keys):")
                for constr, col, fk_table, fk_col in fks:
                    print(f"   - {col} → {fk_table}.{fk_col}")
            
            # Obtener triggers
            cursor.execute(f"""
                SELECT trigger_name, trigger_schema, event_object_table, event_manipulation
                FROM information_schema.triggers
                WHERE event_object_table = '{table_name}';
            """)
            
            triggers = cursor.fetchall()
            if triggers:
                print(f"\n⚡ TRIGGERS:")
                for trig_name, trig_schema, trig_table, event in triggers:
                    print(f"   - {trig_name} ({event})")
    
    print("\n" + "=" * 80)
    print("✅ INSPECCIÓN COMPLETADA")
    print("=" * 80 + "\n")

if __name__ == '__main__':
    try:
        inspect_schema()
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nAsegúrate de que:")
        print("1. PostgreSQL está corriendo")
        print("2. El archivo .env está configurado correctamente")
        print("3. La base de datos 'Santacruzcomputer' existe")
