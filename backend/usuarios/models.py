from django.db import models

class Persona(models.Model):
    id_persona = models.AutoField(primary_key=True, db_column='IdPersona')
    nombre = models.CharField(max_length=100)
    correo = models.EmailField(max_length=100, unique=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        db_table = 'Persona'

class Usuario(models.Model):
    # Alineado perfectamente con lo que espera tu frontend
    ROL_CHOICES = [
        ('admin', 'Administrador'),
        ('employee', 'Empleado / Vendedor'),
        ('client', 'Cliente'),
    ]
    
    persona = models.OneToOneField(Persona, on_delete=models.CASCADE, primary_key=True, db_column='idUsuario')
    rol = models.CharField(max_length=50, choices=ROL_CHOICES)
    activo = models.BooleanField(default=True)
    password_hash = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'Usuario'

class Cliente(models.Model):
    persona = models.OneToOneField(Persona, on_delete=models.CASCADE, primary_key=True, db_column='IdCliente')
    nit = models.CharField(max_length=20, unique=True)

    class Meta:
        db_table = 'Cliente'