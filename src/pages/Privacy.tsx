import { LegalPage, LEGAL_CONTACT, type LegalSection } from "@/components/legal/LegalPage";

const UPDATED = "26 de octubre de 2026";

const sections: LegalSection[] = [
  {
    heading: "1. Quién es el responsable",
    paragraphs: [
      `Ai Tor es una aplicación del proyecto ΔlieπFlΦw DAO (en adelante, «Ai Tor», «nosotros»). El responsable del tratamiento de los datos descritos en esta página es ΔlieπFlΦw DAO, con dirección de contacto ${LEGAL_CONTACT}. No hay un delegado de protección de datos designado; cualquier cuestión sobre esta política se atiende en esa dirección.`,
    ],
  },
  {
    heading: "2. Qué datos recogemos",
    paragraphs: ["Recogemos únicamente los datos necesarios para que la aplicación funcione:"],
    bullets: [
      "Datos de cuenta: dirección de correo electrónico y, si decides usarlo, el nombre y la foto que devuelve el proveedor de identidad (Google o Apple). Nunca recibimos tu contraseña de esos servicios.",
      "Datos de sesión: identificador de usuario interno, tokens de sesión y la fecha del último acceso.",
      "Contenido que creas: conversaciones con los agentes, alertas y preferencias que guardas en tu cuenta.",
      "Datos técnicos: dirección IP, tipo de navegador, idioma y páginas visitadas, en los registros del servidor y en las métricas agregadas de uso.",
      "Datos de pago: si compras créditos o una suscripción, el pago se procesa en un proveedor externo; nosotros recibimos únicamente el identificador de la transacción, el importe y el estado, nunca el número completo de la tarjeta.",
    ],
  },
  {
    heading: "3. Por qué y con qué base legal",
    bullets: [
      "Crear y mantener tu cuenta, autenticarte y sincronizar tus datos entre dispositivos: ejecución del contrato que aceptas al registrarte.",
      "Prestar el servicio de chat, agentes, mercados y capas del globo, y medir el consumo de créditos: ejecución del contrato.",
      "Seguridad, prevención de abuso y registro de errores: interés legítimo en proteger el servicio y a sus usuarios.",
      "Comunicaciones sobre el servicio (avisos de seguridad, cambios relevantes): interés legítimo y, cuando la ley lo exige, tu consentimiento.",
      "Analítica de uso agregada: tu consentimiento, que puedes retirar en cualquier momento.",
    ],
  },
  {
    heading: "4. Con quién compartimos datos",
    paragraphs: [
      "No vendemos datos personales. Compartimos lo imprescindible con proveedores que actúan como encargados del tratamiento y que están sujetos a sus propias obligaciones de confidencialidad:",
    ],
    bullets: [
      "Supabase: base de datos, autenticación y funciones de servidor.",
      "Vercel: alojamiento de la aplicación web y de las funciones de API.",
      "Google (Gemini) y los proveedores de modelos de lenguaje que elijas en el chat: procesan el texto de tus mensajes para generar la respuesta.",
      "Google Workspace, Apple y los proveedores de identidad que actives: solo para verificar tu identidad al iniciar sesión.",
      "GitHub: si vinculas tu cuenta para el proxy de repositorios o interactúas con nuestros workflows.",
      "Proveedores de datos de mercado y de fuentes públicas (precios, predicciones, satélites, sismicidad, cámaras en directo): reciben parámetros de consulta, no tu identidad.",
    ],
  },
  {
    heading: "5. Transferencias internacionales",
    paragraphs: [
      "Algunos de estos proveedores están ubicados en Estados Unidos o fuera del Espacio Económico Europeo. Cuando ocurre, la transferencia se ampara en las cláusulas contractuales tipo de la Comisión Europea o en una decisión de adecuación. Puedes solicitar más información escribiendo al contacto indicado al final.",
    ],
  },
  {
    heading: "6. Cuánto tiempo conservamos los datos",
    bullets: [
      "Cuenta y contenido: mientras la cuenta esté activa. Si la eliminas, borramos los datos asociados en un plazo máximo de 30 días, salvo lo que la ley obligue a conservar.",
      "Conversaciones del chat: se guardan en tu cuenta hasta que las borras o eliminas la cuenta.",
      "Registros técnicos: entre 30 y 90 días.",
      "Facturación y obligaciones fiscales: el plazo legal aplicable, normalmente 5 años en España.",
    ],
  },
  {
    heading: "7. Tus derechos",
    paragraphs: [
      "Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a " +
        `${LEGAL_CONTACT}` +
        ". Responderemos en el plazo máximo de un mes. Si consideras que no hemos atendido tu solicitud correctamente, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
      "Puedes iniciar sesión con Google o Apple y, si no quieres crear cuenta, usar la aplicación en modo invitado: en ese caso tus datos se guardan solo en tu navegador y no se envían a nuestra base de datos, aunque las consultas a los modelos de lenguaje sí pasan por nuestros servidores.",
    ],
  },
  {
    heading: "8. Cookies y almacenamiento local",
    paragraphs: [
      "Usamos cookies y almacenamiento local estrictamente necesarios para mantener la sesión iniciada, recordar la última pestaña y tus preferencias visuales. También medimos el uso con analítica agregada (Vercel Analytics), sin cookies publicitarias ni seguimiento entre sitios. No usamos cookies de terceros con fines publicitarios.",
    ],
  },
  {
    heading: "9. Seguridad",
    paragraphs: [
      "Las conexiones se cifran con TLS. Las contraseñas, si las usas, se almacenan con hash en Supabase; los proveedores OAuth nunca nos entregan la tuya. El acceso a la base de datos está protegido con reglas por fila, de modo que cada usuario solo puede leer y escribir sus propios datos. Las claves de servicios externos permanecen en el servidor y nunca se envían al navegador.",
    ],
  },
  {
    heading: "10. Uso por menores",
    paragraphs: [
      "El servicio no está dirigido a menores de 16 años y no recogemos conscientemente sus datos. Si detectamos una cuenta de un menor, la eliminaremos.",
    ],
  },
  {
    heading: "11. Cambios en esta política",
    paragraphs: [
      "Si cambiamos esta política de forma sustancial, lo avisaremos dentro de la aplicación o por correo antes de que el cambio sea efectivo, y actualizaremos la fecha de revisión que aparece al principio.",
    ],
  },
  {
    heading: "12. Permisos de Google",
    paragraphs: [
      "Cuando inicias sesión con Google, la aplicación solicita únicamente los permisos de perfil básico (correo electrónico, nombre e imagen). Usamos esos datos solo para crear y autenticar tu cuenta, y no los compartimos con terceros ajenos a los proveedores enumerados en el apartado 4. Si quieres revocar el acceso, puedes hacerlo en https://myaccount.google.com/permissions.",
    ],
  },
];

export default function Privacy() {
  return (
    <LegalPage
      path="/privacy"
      title="Política de privacidad"
      description="Qué datos recoge Ai Tor (ΔlieπFlΦw DAO), con qué base legal, con quién se comparten y cómo ejercer tus derechos."
      updated={UPDATED}
      intro="Ai Tor es un terminal de inteligencia para datos abiertos: mercados, predicciones, señales sísmicas, tráfico aéreo y marítimo, capas del globo y un chat con agentes de IA. Para prestarte ese servicio necesitamos tratar algunos datos personales. Esta página explica cuáles, para qué y cómo puedes controlarlos."
      sections={sections}
      other={{ to: "/terms", label: "Leer los términos de servicio →" }}
    />
  );
}
