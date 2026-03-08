

## Diagnóstico: Login no funciona

### Problemas encontrados:

1. **Google OAuth usa el método incorrecto**: El código actual usa `supabase.auth.signInWithOAuth()` directamente, pero este proyecto usa Lovable Cloud que requiere `lovable.auth.signInWithOAuth()`. La carpeta `src/integrations/lovable` no existe aún — hay que generarla con la herramienta de configuración de Social Auth.

2. **Email/Password puede requerir confirmación**: Si la confirmación por email está activada, los usuarios no pueden iniciar sesión tras registrarse hasta verificar su correo. El mensaje actual dice "¡Cuenta creada! Ya puedes acceder." lo cual es engañoso si necesitan confirmar email primero.

### Plan de corrección:

#### 1. Configurar Social Login con Lovable Cloud
- Usar la herramienta "Configure Social Auth" para generar el módulo `src/integrations/lovable`
- Esto creará la integración correcta con Google OAuth gestionado

#### 2. Actualizar `src/hooks/useAuth.ts`
- Cambiar `signInWithGoogle` para usar `lovable.auth.signInWithOAuth("google", ...)` en lugar de `supabase.auth.signInWithOAuth`

#### 3. Actualizar `src/pages/Auth.tsx`
- Mejorar el mensaje de registro para informar al usuario si necesita confirmar email
- Ajustar el flujo post-registro

#### 4. Verificar configuración de auto-confirm
- Comprobar si email auto-confirm está habilitado y ajustar mensajes según corresponda

### Archivos a modificar:
- `src/hooks/useAuth.ts` — corregir método Google OAuth
- `src/pages/Auth.tsx` — mejorar mensajes de feedback
- Se generará automáticamente `src/integrations/lovable/` con la herramienta

