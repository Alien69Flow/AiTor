import { LegalPage, LEGAL_CONTACT, type LegalSection } from "@/components/legal/LegalPage";

const UPDATED = "26 de octubre de 2026";

const sections: LegalSection[] = [
  {
    heading: "1. Quiénes somos y qué aceptas",
    paragraphs: [
      `Estos términos regulan el uso de Ai Tor, la aplicación del proyecto ΔlieπFlΦw DAO (en adelante, «Ai Tor», «nosotros»). Al crear una cuenta, iniciar sesión o usar la aplicación aceptas estos términos. Si no estás de acuerdo, no uses el servicio. El contacto para cualquier cuestión es ${LEGAL_CONTACT}.`,
    ],
  },
  {
    heading: "2. Cuenta y acceso",
    bullets: [
      "Puedes entrar con Google, Apple, enlace mágico por correo o en modo invitado.",
      "Debes tener al menos 16 años y capacidad legal para aceptar estos términos.",
      "Eres responsable de mantener el acceso a tu correo y de la actividad que ocurra en tu cuenta.",
      "El modo invitado guarda tus datos solo en tu navegador: si borras los datos del sitio, esa información se pierde y no podemos recuperarla.",
    ],
  },
  {
    heading: "3. Uso aceptable",
    paragraphs: ["Al usar Ai Tor te comprometes a no:"],
    bullets: [
      "Automatizar el servicio con fines de extracción masiva, scraping o reventa sin autorización escrita.",
      "Intentar acceder a datos de otros usuarios, a claves del servidor o a funciones internas.",
      "Usar el chat y los agentes para generar contenido ilegal, acosar, suplantar identidades o difundir desinformación deliberada.",
      "Eludir los límites de créditos, los controles de acceso o los sistemas de seguridad.",
      "Introducir malware ni atacar la infraestructura o los proveedores que dan soporte al servicio.",
    ],
  },
  {
    heading: "4. Datos de terceros: mercados, predicciones y capas del globo",
    paragraphs: [
      "Ai Tor agrega información de fuentes públicas: precios de criptoactivos, mercados de predicción (Polymarket, Kalshi, Limitless, Manifold), sismicidad, tráfico aéreo y marítimo, imágenes satelitales, meteorología y cámaras en directo de terceros como explore.org.",
      "Esa información se ofrece tal cual la publica su fuente, con posibles retrasos, errores o interrupciones. No la hemos verificado ni la garantizamos, y puede cambiar sin aviso. No constituye asesoramiento financiero, legal ni de inversión: cualquier decisión que tomes a partir de estos datos es responsabilidad tuya.",
      "Los mercados de predicción pueden estar restringidos en tu país (por ejemplo, Polymarket para usuarios en España). Es tu responsabilidad comprobar la legalidad de cada plataforma antes de usarla. Esta aplicación solo muestra datos de lectura; no ejecuta apuestas ni órdenes en tu nombre.",
    ],
  },
  {
    heading: "5. Chat, agentes y contenido generado por IA",
    paragraphs: [
      "Las respuestas las generan modelos de lenguaje y pueden ser inexactas, incompletas o inventar datos. Verifica siempre la información crítica antes de actuar. No uses la salida del chat como sustituto de asesoramiento profesional.",
      "Conservas la titularidad del texto y de los archivos que aportas. Nos concedes una licencia limitada para procesarlos con el único fin de prestarte el servicio (generar la respuesta, guardar el historial y aplicar los límites de uso). Puedes borrar tus conversaciones en cualquier momento.",
    ],
  },
  {
    heading: "6. Créditos, planes y pagos",
    bullets: [
      "Algunas funciones consumen créditos. Los precios y la cantidad de créditos por acción se muestran en la aplicación antes de usarlos.",
      "Los créditos no son moneda de curso legal, no generan intereses y no son transferibles entre cuentas.",
      "Salvo que la ley exija lo contrario, los créditos consumidos no son reembolsables. Si un fallo nuestro impide prestarte el servicio, repondremos los créditos afectados.",
      "Los pagos en criptoactivos son irreversibles. Verifica siempre la dirección y la red antes de enviar fondos.",
    ],
  },
  {
    heading: "7. Disponibilidad y cambios en el servicio",
    paragraphs: [
      "El servicio se ofrece «tal cual» y «según disponibilidad». Podemos modificarlo, suspender funciones o retirar integraciones (por ejemplo, un proveedor de datos que cambia su API o bloquea su acceso) sin previo aviso. No garantizamos una disponibilidad ininterrumpida ni un tiempo de respuesta determinado.",
    ],
  },
  {
    heading: "8. Propiedad intelectual",
    paragraphs: [
      "El nombre, el logotipo, la interfaz y el código propio de Ai Tor pertenecen a ΔlieπFlΦw DAO y están protegidos por las leyes de propiedad intelectual. Los datos de terceros pertenecen a sus respectivas fuentes y se muestran conforme a sus licencias. No puedes copiar, descompilar ni redistribuir la aplicación sin autorización escrita.",
    ],
  },
  {
    heading: "9. Limitación de responsabilidad",
    paragraphs: [
      `En la medida máxima permitida por la ley, Ai Tor y ΔlieπFlΦw DAO no responden de daños indirectos, lucro cesante, pérdida de datos, ni de pérdidas derivadas de operaciones en mercados, inversiones o decisiones tomadas a partir de la información mostrada. Nuestra responsabilidad total por cualquier reclamación se limita al importe que hayas pagado por el servicio en los seis meses anteriores. Nada en estos términos excluye la responsabilidad que no puede excluirse legalmente, incluida la derivada de dolo o negligencia grave.`,
    ],
  },
  {
    heading: "10. Suspensión y cancelación",
    paragraphs: [
      "Podemos suspender o cerrar una cuenta que incumpla estos términos, que abuse del servicio o que ponga en riesgo a otros usuarios o a la infraestructura. Puedes dejar de usar Ai Tor y solicitar el borrado de tu cuenta en cualquier momento escribiendo al contacto indicado; borraremos los datos según lo descrito en la política de privacidad.",
    ],
  },
  {
    heading: "11. Cambios en los términos",
    paragraphs: [
      "Podemos actualizar estos términos. Si el cambio es sustancial, lo avisaremos dentro de la aplicación o por correo antes de que sea efectivo. Seguir usando el servicio después de la fecha de entrada en vigor implica que aceptas la versión vigente.",
    ],
  },
  {
    heading: "12. Ley aplicable",
    paragraphs: [
      "Estos términos se rigen por la legislación española. Para cualquier controversia, ambas partes se someten a los juzgados y tribunales del domicilio del usuario cuando este sea consumidor, y a los de la Comunidad de Madrid en el resto de los casos.",
    ],
  },
];

export default function Terms() {
  return (
    <LegalPage
      path="/terms"
      title="Términos de servicio"
      description="Condiciones de uso de Ai Tor (ΔlieπFlΦw DAO): cuenta, uso aceptable, datos de mercado, chat con IA, créditos y responsabilidad."
      updated={UPDATED}
      intro="Estos términos explican qué puedes esperar del servicio y qué esperamos de ti. Ai Tor agrega datos abiertos y un chat con agentes de IA; no es un asesor financiero ni una plataforma de apuestas."
      sections={sections}
      other={{ to: "/privacy", label: "Leer la política de privacidad →" }}
    />
  );
}
